import type { Db } from '@bonvoyage/db';
import { destination, trip, tripMember } from '@bonvoyage/db/schema';
import { addDaysUtc } from '@bonvoyage/engine';
import { indiaDate, type PreferenceInput } from '@bonvoyage/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Logger } from 'pino';
import { acceptInvitation, createInvitation } from '../invitations/service';
import { saveMyPreference } from '../preferences/service';
import { createTrip } from '../trips/service';
import { demoWindowStart } from './demo-window';

// S2-8: the three Sprint 2 demo trips. Each is built through the same services
// the API uses (T1 createTrip, T2 the first invitation, joins through the
// link, an I1 per submission and T3 on the last), so the seed never writes a
// status itself. Every step is resumable, so a second seed run adds nothing.
// All three end in ready_for_recommendation; the organiser asks on screen.
//
// The catalogue's costs and car distances are still draft (stage B1 is due
// 1 November), so each scenario keeps a wide margin from its limit; the seed
// tests assert the margins and are the early warning when B1 moves them.

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

export type DemoMember = 'Asha' | 'Rohan' | 'Meera' | 'Kabir';

/** A date `n` days after the demo window's first day (0 is the window start). */
export type DemoDates = (daysFromWindowStart: number) => string;

export interface DemoScenario {
  title: string;
  budgetTotalInr: number;
  radiusKm: number;
  durationNights: number;
  /** The organiser first; each member's preference, dated from the window start. */
  members: { name: DemoMember; input: (at: DemoDates) => PreferenceInput }[];
}

const asha = (at: DemoDates): PreferenceInput => ({
  destinationTypes: ['mountain', 'adventure'],
  activities: ['trekking', 'rafting', 'camping'],
  climate: 'cold',
  travelStyle: 'budget',
  budgetMinInr: 12000,
  budgetMaxInr: 18000,
  dateStart: at(0),
  dateEnd: at(3),
});
const rohan = (at: DemoDates): PreferenceInput => ({
  destinationTypes: ['spiritual', 'mountain'],
  activities: ['yoga_wellness', 'temples', 'trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 10000,
  budgetMaxInr: 16000,
  dateStart: at(-1),
  dateEnd: at(2),
});
const meera = (at: DemoDates): PreferenceInput => ({
  destinationTypes: ['heritage', 'hill_station'],
  activities: ['museums', 'trekking', 'food_trails'],
  climate: 'any',
  travelStyle: 'comfort',
  budgetMinInr: 11000,
  budgetMaxInr: 17000,
  dateStart: at(-1),
  dateEnd: at(3),
});

/** S3-8: what Meera submits on screen for "Long weekend in the hills" (demo step 1). */
export const MEERA_PREFERENCE = meera;

/** Hills: 3 members, a common window of 3 days, ₹48,000 from Gurugram within 450 km. */
export const HILLS_DEMO: DemoScenario = {
  title: 'Hills shortlist demo',
  budgetTotalInr: 48000,
  radiusKm: 450,
  durationNights: 2,
  members: [
    { name: 'Asha', input: asha },
    { name: 'Rohan', input: rohan },
    { name: 'Meera', input: meera },
  ],
};

/** Margin: 32 destinations were feasible on 26 Oct 2026; the demo needs at least 8. */
export const HILLS_MIN_FEASIBLE = 8;

/**
 * Tight budget: the same group and trip with a group budget far below every
 * estimate. Members' lowest maximum (₹16,000 x 3) stays above it, so the trip
 * budget sets the cap and the F5 suggestion is the organiser's to apply.
 */
// Margin: with stage B1a's verified costs the cheapest estimate is ₹13,600 (Mathura),
// so ₹7,000 is about half of it.
export const TIGHT_BUDGET_INR = 7000;
/** Every F5 near miss must cost at least this multiple of the tight budget. */
export const TIGHT_BUDGET_MARGIN = 1.25;

export const TIGHT_BUDGET_DEMO: DemoScenario = {
  ...HILLS_DEMO,
  title: 'Tight budget demo',
  budgetTotalInr: TIGHT_BUDGET_INR,
};

/** Margin: Rohan's window starts 6 days after Asha's ends (at least 5 needed). */
export const DATE_CLASH_GAP_DAYS = 6;

export const DATE_CLASH_DEMO: DemoScenario = {
  ...HILLS_DEMO,
  title: 'Date clash demo',
  members: [
    { name: 'Asha', input: asha },
    {
      name: 'Rohan',
      input: (at) => ({
        ...rohan(at),
        // Asha's window ends 3 days after the window start.
        dateStart: at(3 + DATE_CLASH_GAP_DAYS),
        dateEnd: at(3 + DATE_CLASH_GAP_DAYS + 3),
      }),
    },
  ],
};

export const DEMO_SCENARIOS = [HILLS_DEMO, TIGHT_BUDGET_DEMO, DATE_CLASH_DEMO] as const;

/** The first demo trip, built by run-seed.ts; Meera submits on screen (demo step 1). */
export const LONG_WEEKEND_TITLE = 'Long weekend in the hills';

/**
 * #154: per demo trip, the destinations docs/demo/sprint-3-demo.md relies on. The seed
 * puts the trip's window on the first Saturday where every night is in season for all of
 * them (demoWindowStart), so a reset on any day still shows the script's places and prices.
 * The date clash demo names no place: it stops at F3.
 */
export const DEMO_ANCHORS: Readonly<Record<string, readonly string[]>> = {
  [LONG_WEEKEND_TITLE]: ['chakrata'],
  [HILLS_DEMO.title]: ['chakrata'],
  [TIGHT_BUDGET_DEMO.title]: ['vrindavan', 'mathura', 'bikaner'],
  [DATE_CLASH_DEMO.title]: [],
};

/**
 * The dates helper for one demo trip on the run day: `at(0)` is the first Saturday at
 * least 14 days ahead whose nights are in season for the trip's anchors. The catalogue
 * must be imported (the anchors' best months come from it).
 */
export async function demoDates(
  db: Db,
  clock: () => Date,
  title: string,
  nights: number,
): Promise<DemoDates> {
  const slugs = DEMO_ANCHORS[title] ?? [];
  const anchors = slugs.length
    ? await db
        .select({ slug: destination.slug, bestMonths: destination.bestMonths })
        .from(destination)
        .where(inArray(destination.slug, [...slugs]))
    : [];
  const missing = slugs.filter((slug) => !anchors.some((a) => a.slug === slug));
  if (missing.length) throw new Error(`demo anchor ${missing.join(', ')} is not in the catalogue`);
  const start = demoWindowStart(indiaDate(clock()), nights, anchors);
  return (n) => addDaysUtc(start, n);
}

/**
 * Find or build one demo trip and bring it to ready_for_recommendation.
 * `title` overrides the scenario's (the timing script makes copies).
 */
export async function seedDemoTrip(
  deps: Deps,
  scenario: DemoScenario,
  userIds: ReadonlyMap<string, string>,
  {
    title = scenario.title,
    originHubSlug = 'gurugram',
  }: { title?: string; originHubSlug?: string } = {},
): Promise<string> {
  const { db, clock } = deps;
  const idOf = (name: DemoMember) => {
    const id = userIds.get(name);
    if (!id) throw new Error(`demo user ${name} is missing`);
    return id;
  };
  const [organiser, ...others] = scenario.members;
  if (!organiser) throw new Error(`${scenario.title} has no members`);
  const organiserId = idOf(organiser.name);

  // T1: one trip per title and organiser.
  let tripId = (
    await db
      .select({ id: trip.id })
      .from(trip)
      .where(and(eq(trip.organiserId, organiserId), eq(trip.title, title)))
      .limit(1)
  )[0]?.id;
  if (!tripId) {
    tripId = (
      await createTrip({ db, clock }, organiserId, {
        title,
        originHubSlug,
        durationNights: scenario.durationNights,
        budgetTotalInr: scenario.budgetTotalInr,
        radiusKm: scenario.radiusKm,
      })
    ).id;
  }

  const statusOf = async () =>
    (await db.select({ status: trip.status }).from(trip).where(eq(trip.id, tripId)))[0]?.status;

  // T2 on the first link; later runs reuse the active link while collecting.
  if ((await statusOf()) === 'draft' || (await statusOf()) === 'collecting_preferences') {
    const { invitation } = await createInvitation(deps, tripId, organiserId);
    // Joining is idempotent for an active member.
    for (const m of others) await acceptInvitation(deps, invitation.token, idOf(m.name));
  }

  // Everyone joins before anyone submits, so only the last submission fires T3.
  const at = await demoDates(db, clock, scenario.title, scenario.durationNights);
  for (const m of scenario.members) {
    const userId = idOf(m.name);
    const [row] = await db
      .select({ submittedAt: tripMember.submittedAt })
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)))
      .limit(1);
    if (row && row.submittedAt === null) {
      await saveMyPreference(deps, tripId, userId, m.input(at));
    }
  }
  return tripId;
}
