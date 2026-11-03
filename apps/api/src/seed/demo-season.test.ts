import { createDb } from '@bonvoyage/db';
import { destination, preference, trip, tripMember } from '@bonvoyage/db/schema';
import { user } from '@bonvoyage/db/schema/auth';
import { addDaysUtc, monthShift, weekdayOf, windowMonths } from '@bonvoyage/engine';
import { createRouting, curatedProvider, estimateProvider } from '@bonvoyage/integrations/routing';
import { indiaDate, nightsBetween } from '@bonvoyage/shared';
import { eq, inArray } from 'drizzle-orm';
import { resolve } from 'node:path';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from '../auth/auth';
import { FAIRNESS_LAMBDA, SCORING_WEIGHTS } from '../config/scoring';
import { planItinerary } from '../itinerary/service';
import { changePackage, listTripPackages, selectPackage } from '../packages/service';
import { saveMyPreference } from '../preferences/service';
import {
  chooseDestination,
  getLatestRecommendation,
  requestRecommendations,
} from '../recommendations/service';
import { closeSubmissions, updateTrip } from '../trips/service';
import {
  DATE_CLASH_DEMO,
  DEMO_ANCHORS,
  HILLS_DEMO,
  LONG_WEEKEND_TITLE,
  MEERA_PREFERENCE,
  TIGHT_BUDGET_DEMO,
  demoDates,
} from './demo-trips';
import { DEMO_MIN_LEAD_DAYS, DEMO_SEARCH_DAYS, demoWindowStart } from './demo-window';
import { DEMO_EMAIL_DOMAIN, deleteDemoTrips } from './fresh-demos';
import { runSeed } from './run-seed';

// #154: a reset on any day puts each demo trip's window on a Saturday that keeps every
// destination the demo script names in season, so the script's places and prices hold.
// Each case resets the demo trips (--fresh-demos) on a fixed run day, as Maulik does on
// preview, and reads the dates the seed really wrote.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: 'http://localhost:4000',
});
const catalogueDir = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
const PASSWORD = 'seed-demo-password-1';
const SATURDAY = 6;

const RUN_DATES = [
  '2026-10-28',
  '2026-11-03',
  '2026-11-20',
  '2026-11-28',
  '2026-12-15',
  '2027-02-01',
] as const;
const JOURNEY_DATES = ['2026-11-03', '2026-11-28'] as const;
const TITLES = Object.keys(DEMO_ANCHORS);

// 06:30 UTC is noon in India, so the India date is the run day.
const clockOn = (day: string) => () => new Date(`${day}T06:30:00Z`);

const reset = (day: string) =>
  runSeed({
    db,
    auth,
    catalogueDir,
    password: PASSWORD,
    freshDemos: true,
    clock: clockOn(day),
    log: () => {},
  });

interface Window {
  /** The first day everyone can make (a lone window's start for the date clash demo). */
  start: string;
  end: string;
  /** The earliest date any member entered. */
  earliest: string;
  /** False when the members' windows do not overlap. */
  common: boolean;
}

/** What the seed wrote: each demo trip's window, from its members' own dates. */
async function windowsWritten(): Promise<Map<string, Window>> {
  const rows = await db
    .select({ title: trip.title, start: preference.dateStart, end: preference.dateEnd })
    .from(trip)
    .innerJoin(tripMember, eq(tripMember.tripId, trip.id))
    .innerJoin(preference, eq(preference.tripMemberId, tripMember.id))
    .where(inArray(trip.title, TITLES));
  const out = new Map<string, Window>();
  for (const title of TITLES) {
    const mine = rows.filter((r) => r.title === title);
    expect(mine.length, title).toBeGreaterThan(0);
    const start = mine.map((r) => r.start).reduce((a, b) => (a > b ? a : b));
    const end = mine.map((r) => r.end).reduce((a, b) => (a < b ? a : b));
    const earliest = mine.map((r) => r.start).reduce((a, b) => (a < b ? a : b));
    out.set(title, { start, end, earliest, common: start <= end });
  }
  return out;
}

const monthsOf = async (slugs: string[]) =>
  slugs.length
    ? db
        .select({ slug: destination.slug, bestMonths: destination.bestMonths })
        .from(destination)
        .where(inArray(destination.slug, slugs))
    : [];

const summary: string[] = [];

beforeAll(async () => {
  // Users and the catalogue; the cases below reset the trips themselves.
  await runSeed({ db, auth, catalogueDir, password: PASSWORD, log: () => {} });
});

afterAll(async () => {
  // Leave the demo trips as a first seed finds them, for the other seed tests.
  await deleteDemoTrips(db);
  process.stdout.write(
    [
      '',
      'Demo windows chosen (first day of the common window, nights in season for the anchors)',
      '| Run day | Long weekend in the hills | Hills shortlist demo | Tight budget demo | Date clash demo (Asha) |',
      '| --- | --- | --- | --- | --- |',
      ...summary,
      '',
    ].join('\n'),
  );
  await pool.end();
});

describe('demoWindowStart', () => {
  const chakrata = { slug: 'chakrata', bestMonths: [3, 4, 5, 6, 9, 10, 11] };
  const winter = { slug: 'bikaner', bestMonths: [10, 11, 12, 1, 2] };

  it('28 Nov 2026 is a Saturday; a 28 Oct run day lands on 14 Nov, the first one 14 days ahead', () => {
    expect(weekdayOf('2026-11-28')).toBe(SATURDAY);
    // 28 Oct + 14 days is Wednesday 11 Nov, so the first Saturday is 14 Nov.
    expect(demoWindowStart('2026-10-28', 2, [chakrata])).toBe('2026-11-14');
  });

  it('takes the first Saturday exactly 14 days ahead, never earlier', () => {
    // 7 Nov 2026 is a Saturday: 14 days later is 21 Nov, also a Saturday.
    expect(demoWindowStart('2026-11-07', 2, [])).toBe('2026-11-21');
    // The Saturday 13 days ahead is too soon.
    expect(demoWindowStart('2026-11-08', 2, [])).toBe('2026-11-28');
    expect(DEMO_MIN_LEAD_DAYS).toBe(14);
  });

  it('skips Saturdays whose nights leave the season', () => {
    // 5 Dec 2026 is out of Chakrata's season; the next one opens in March.
    expect(demoWindowStart('2026-11-20', 2, [chakrata])).toBe('2027-03-06');
    // 31 Oct 2026 is a Saturday, but its second night is 1 Nov: not an October-only window.
    const october = { slug: 'october', bestMonths: [10] };
    expect(weekdayOf('2026-10-31')).toBe(SATURDAY);
    expect(demoWindowStart('2026-10-17', 2, [october])).toBe('2027-10-02');
    // Across a year end: 9 Jan 2027 is the first Saturday 14 days after 20 Dec.
    expect(demoWindowStart('2026-12-20', 2, [winter])).toBe('2027-01-09');
  });

  it('needs every anchor in season, not just one', () => {
    const both = [chakrata, winter];
    expect(demoWindowStart('2026-10-28', 2, both)).toBe('2026-11-14');
    // Chakrata and Bikaner share only October and November.
    expect(demoWindowStart('2026-11-20', 2, both)).toBe('2027-10-02');
  });

  it('throws a clear error when nothing fits within the search window', () => {
    const never = { slug: 'nowhere', bestMonths: [] };
    expect(() => demoWindowStart('2026-11-03', 2, [never])).toThrow(
      `No Saturday window of 2 nights within ${DEMO_SEARCH_DAYS} days of 2026-11-03 is in season for nowhere ()`,
    );
  });
});

describe('every demo trip is in season and starts on a Saturday', () => {
  for (const day of RUN_DATES) {
    it(`after a reset on ${day}`, async () => {
      await reset(day);
      const windows = await windowsWritten();
      const today = indiaDate(clockOn(day)());
      const row: string[] = [];
      for (const title of TITLES) {
        const w = windows.get(title)!;
        const anchors = await monthsOf([...DEMO_ANCHORS[title]!]);
        expect(anchors.map((a) => a.slug).sort(), title).toEqual([...DEMO_ANCHORS[title]!].sort());
        // The window opens on a Saturday, at least two weeks ahead; everyone's own
        // earliest date is still from today onwards (the server's own check). The date
        // clash demo has no common window: its window is Asha's, the earliest date given.
        const clash = title === DATE_CLASH_DEMO.title;
        const opens = clash ? w.earliest : w.start;
        expect(weekdayOf(opens), title).toBe(SATURDAY);
        expect(nightsBetween(today, opens), title).toBeGreaterThanOrEqual(DEMO_MIN_LEAD_DAYS);
        expect(w.earliest >= today, title).toBe(true);
        if (clash) {
          // F3: the windows do not overlap, so there is no common window at all.
          expect(w.common, title).toBe(false);
          row.push(opens);
          continue;
        }
        expect(w.common, title).toBe(true);
        // Three days, two nights, each night in a best month of every anchor.
        expect(nightsBetween(w.start, w.end), title).toBe(HILLS_DEMO.durationNights);
        for (let i = 0; i < HILLS_DEMO.durationNights; i++) {
          const month = Number(addDaysUtc(w.start, i).slice(5, 7));
          for (const a of anchors) expect(a.bestMonths, `${title} ${a.slug}`).toContain(month);
        }
        // The engine agrees: F4 does not fail for any anchor.
        for (const a of anchors) {
          expect(monthShift(windowMonths(w.start, w.end), a.bestMonths), `${title} ${a.slug}`).toBe(
            0,
          );
        }
        row.push(`${w.start} to ${w.end}`);
      }
      summary.push(`| ${day} | ${row.join(' | ')} |`);
    }, 60_000);
  }
});

// The script's own figures, on the two run days that straddle the bug: 3 Nov (the old rule
// gave 4 Dec, out of season) and 28 Nov.
describe('the demo script holds after a reset', () => {
  for (const day of JOURNEY_DATES) {
    it(`on ${day}: Chakrata first with three packages and Tiger Falls unverified; Bikaner round 2 and the Bus change`, async () => {
      await reset(day);
      const clock = clockOn(day);
      const deps = {
        db,
        logger: pino({ level: 'silent' }),
        clock,
        routing: createRouting({
          db,
          providers: [curatedProvider(db), estimateProvider()],
          clock,
          ttlDays: 30,
          logger: { warn: () => {} },
        }),
        weights: SCORING_WEIGHTS,
        lambda: FAIRNESS_LAMBDA,
      };
      const idOf = async (name: string) => {
        const [row] = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, `${name}${DEMO_EMAIL_DOMAIN}`));
        if (!row) throw new Error(`${name} was not seeded`);
        return row.id;
      };
      const tripOf = async (title: string) => {
        const [row] = await db.select().from(trip).where(eq(trip.title, title));
        if (!row) throw new Error(`${title} was not seeded`);
        return row;
      };

      // Steps 1 to 4: Meera submits, the shortlist, packages and the day plan.
      const hills = await tripOf(LONG_WEEKEND_TITLE);
      const asha = hills.organiserId;
      const meera = await idOf('meera');
      const at = await demoDates(db, clock, hills.title, hills.durationNights);
      await saveMyPreference(deps, hills.id, meera, MEERA_PREFERENCE(at));
      const rec = await requestRecommendations(deps, hills.id, asha);
      expect(rec.items[0]!.destination.slug).toBe('chakrata');
      await chooseDestination(deps, hills.id, asha, { destinationSlug: 'chakrata' });
      const { packages } = await listTripPackages(db, hills.id, asha);
      expect(packages.map((p) => [p.label, p.transportMode, p.stayTier])).toEqual([
        ['Saver', 'car', 'budget'],
        ['Balanced', 'car', 'mid'],
        ['Comfort', 'car', 'premium'],
      ]);
      expect(packages.map((p) => [p.label, p.totalInr, p.perPersonInr])).toEqual([
        ['Saver', 29566, 9856],
        ['Balanced', 31566, 10522],
        ['Comfort', 39966, 13322],
      ]);
      const saver = packages.find((p) => p.label === 'Saver')!;
      expect(weekdayOf(saver.startDate)).toBe(SATURDAY);
      await selectPackage(deps, hills.id, saver.id, asha);
      const plan = await planItinerary(deps, hills.id, asha);
      const visits = plan
        .itinerary!.days.flatMap((d) => d.items)
        .filter((i) => i.kind === 'activity');
      expect(visits.find((i) => i.place?.key === 'chakrata/tiger-falls')?.verified).toBe(false);

      // Step 5: Tight budget round 2 lists Bikaner, whose packages compare modes.
      const tight = await tripOf(TIGHT_BUDGET_DEMO.title);
      const organiser = tight.organiserId;
      await requestRecommendations(deps, tight.id, organiser);
      const latest = await getLatestRecommendation(db, tight.id, organiser);
      const raise = latest.run?.diagnostic?.suggestions.find(
        (s) => s.constraint === 'F5' && s.capSource === 'trip',
      );
      if (raise?.constraint !== 'F5') throw new Error('no F5 suggestion on round 1');
      expect(raise.newGroupCapInr).toBe(15500);
      expect(raise.unlocks).toEqual(['bikaner', 'mathura', 'pushkar', 'rishikesh', 'vrindavan']);
      await updateTrip(deps, tight.id, organiser, { budgetTotalInr: raise.newGroupCapInr });
      await closeSubmissions(deps, tight.id, organiser);
      const round2 = await requestRecommendations(deps, tight.id, organiser);
      expect(round2.items.map((i) => i.destination.slug)).toEqual([
        'rishikesh',
        'pushkar',
        'vrindavan',
        'mathura',
        'bikaner',
      ]);
      await chooseDestination(deps, tight.id, organiser, { destinationSlug: 'bikaner' });
      const bikaner = (await listTripPackages(db, tight.id, organiser)).packages;
      expect(new Set(bikaner.map((p) => p.transportMode)).size).toBeGreaterThanOrEqual(2);
      expect(bikaner.map((p) => [p.label, p.totalInr, p.overByInr])).toEqual([
        ['Saver', 13995, 0],
        ['Balanced', 19195, 3695],
        ['Comfort', 25195, 9695],
        ['Comfort by car', 36688, 21188],
      ]);

      // Step 5.7: Balanced changed to Bus. The entry-fee line depends on the weekday, so this
      // is the figure that moved when the window slid to a Friday.
      const balanced = bikaner.find((p) => p.label === 'Balanced')!;
      const changed = (
        await changePackage(deps, tight.id, balanced.id, organiser, { transportMode: 'bus' })
      ).packages.find((p) => p.id === balanced.id)!;
      expect([changed.totalInr, changed.perPersonInr, changed.overByInr]).toEqual([
        22570, 7524, 7070,
      ]);
      expect(changed.lines.find((l) => l.category === 'activities')?.amountInr).toBe(210);
    }, 120_000);
  }
});
