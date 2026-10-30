import { createDb } from '@bonvoyage/db';
import {
  costItem,
  destination,
  hub,
  invitation,
  itinerary,
  itineraryDecision,
  itineraryItem,
  notification,
  packageDecision,
  pastTrip,
  preference,
  recommendationItem,
  recommendationRun,
  trip,
  tripMember,
  tripPackage,
  tripTransition,
  vote,
} from '@bonvoyage/db/schema';
import { account, user } from '@bonvoyage/db/schema/auth';
import { indiaDate } from '@bonvoyage/shared';
import { asc, eq, inArray, like, sql } from 'drizzle-orm';
import { resolve } from 'node:path';
import { createRouting, curatedProvider, estimateProvider } from '@bonvoyage/integrations/routing';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { createAuth } from '../auth/auth';
import { FAIRNESS_LAMBDA, SCORING_WEIGHTS } from '../config/scoring';
import {
  acceptItinerary,
  getItinerary,
  itineraryAlternatives,
  modifyItinerary,
  planItinerary,
} from '../itinerary/service';
import { getNotifications } from '../notifications/service';
import { giveOpinion, listTripPackages, selectPackage } from '../packages/service';
import { saveMyPreference } from '../preferences/service';
import {
  chooseDestination,
  getLatestRecommendation,
  requestRecommendations,
} from '../recommendations/service';
import { closeSubmissions, getTrip, updateTrip } from '../trips/service';
import {
  DATE_CLASH_DEMO,
  DATE_CLASH_GAP_DAYS,
  DEMO_SCENARIOS,
  HILLS_DEMO,
  HILLS_MIN_FEASIBLE,
  MEERA_PREFERENCE,
  TIGHT_BUDGET_DEMO,
  TIGHT_BUDGET_INR,
  TIGHT_BUDGET_MARGIN,
} from './demo-trips';
import { DEMO_EMAIL_DOMAIN } from './fresh-demos';
import { runSeed } from './run-seed';
import { createHillsCopies } from './timing-copies';

// S0-5: the seed is idempotent and leaves the expected trip shape.
// S1-6: it follows the state machine (T1, T2, then an I1 per submission).

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: 'http://localhost:4000',
});
const catalogueDir = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
const PASSWORD = 'seed-demo-password-1';

afterAll(async () => {
  await pool.end();
});

describe('runSeed', () => {
  it('runs twice with identical row counts and the expected trip shape', async () => {
    await runSeed({ db, auth, catalogueDir, password: PASSWORD, log: () => {} });
    const first = await Promise.all(
      [trip, tripMember, preference, tripTransition, pastTrip].map(async (t) => {
        const rows = await db.select({ n: sql<number>`count(*)::int` }).from(t);
        return rows[0]!.n;
      }),
    );
    await runSeed({ db, auth, catalogueDir, password: PASSWORD, log: () => {} });
    const second = await Promise.all(
      [trip, tripMember, preference, tripTransition, pastTrip].map(async (t) => {
        const rows = await db.select({ n: sql<number>`count(*)::int` }).from(t);
        return rows[0]!.n;
      }),
    );
    expect(second).toEqual(first);
    const past = await db
      .select({ placeName: pastTrip.placeName })
      .from(pastTrip)
      .innerJoin(destination, eq(destination.id, pastTrip.destinationId))
      .where(eq(destination.slug, 'rishikesh'));
    expect(past).toEqual([{ placeName: null }]);

    const demo = await db.select().from(trip).where(eq(trip.title, 'Long weekend in the hills'));
    expect(demo).toHaveLength(1);
    expect(demo[0]!.status).toBe('collecting_preferences');

    const members = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tripMember)
      .where(eq(tripMember.tripId, demo[0]!.id));
    expect(members[0]!.n).toBe(3);

    const prefs = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tripMember)
      .where(sql`${tripMember.tripId} = ${demo[0]!.id} and ${tripMember.submittedAt} is not null`);
    expect(prefs[0]!.n).toBe(2);

    const transitions = await db
      .select({ id: tripTransition.transitionId, event: tripTransition.event })
      .from(tripTransition)
      .where(eq(tripTransition.tripId, demo[0]!.id))
      .orderBy(asc(tripTransition.createdAt));
    expect(transitions).toEqual([
      { id: 'T1', event: 'createTrip' },
      { id: 'T2', event: 'inviteMembers' },
      { id: 'I1', event: 'preferenceSubmitted' },
      { id: 'I1', event: 'preferenceSubmitted' },
    ]);
  });
});

// S2-8: each demo trip gives its outcome AND keeps its margin with today's
// draft catalogue. When stage B1's verified costs and distances land, these
// are the early warning that a demo would flip.
describe('Sprint 2 demo trips', () => {
  const routing = createRouting({
    db,
    providers: [curatedProvider(db), estimateProvider()],
    clock: () => new Date(),
    ttlDays: 30,
    logger: { warn: () => {} },
  });
  const deps = {
    db,
    logger: pino({ level: 'silent' }),
    clock: () => new Date(),
    routing,
    weights: SCORING_WEIGHTS,
    lambda: FAIRNESS_LAMBDA,
  };
  const tripOf = async (title: string) => {
    const [row] = await db.select().from(trip).where(eq(trip.title, title));
    if (!row) throw new Error(`${title} was not seeded`);
    return row;
  };

  it('are seeded through the services and left ready for recommendations', async () => {
    await runSeed({ db, auth, catalogueDir, password: PASSWORD, log: () => {} });
    for (const { title, members } of DEMO_SCENARIOS) {
      const row = await tripOf(title);
      expect(row.status, title).toBe('ready_for_recommendation');
      const transitions = await db
        .select({ id: tripTransition.transitionId })
        .from(tripTransition)
        .where(eq(tripTransition.tripId, row.id))
        .orderBy(asc(tripTransition.createdAt), asc(tripTransition.id));
      // T1, T2, an I1 for every submission but the last, then T3 (decision 0001).
      expect(transitions.map((t) => t.id)).toEqual([
        'T1',
        'T2',
        ...members.slice(1).map(() => 'I1'),
        'T3',
      ]);
    }
    // Script step 2: Meera's bell starts empty, so the shortlist makes it read 1.
    const [meera] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, `meera${DEMO_EMAIL_DOMAIN}`));
    if (!meera) throw new Error('Meera was not seeded');
    expect((await getNotifications(db, meera.id)).unreadCount).toBe(0);
    // A plain seed keeps the joins it wrote; only --fresh-demos clears them, which is
    // why the script's setup section asks for that reset.
    const [ashaRow] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, `asha${DEMO_EMAIL_DOMAIN}`));
    if (!ashaRow) throw new Error('Asha was not seeded');
    expect((await getNotifications(db, ashaRow.id)).unreadCount).toBe(5);
  });

  it('hills: a shortlist with at least 8 feasible destinations', async () => {
    const row = await tripOf(HILLS_DEMO.title);
    const res = await requestRecommendations(deps, row.id, row.organiserId);
    expect(res.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });
    expect(res.run?.kind).toBe('shortlist');
    expect(res.run!.feasibleCount).toBeGreaterThanOrEqual(HILLS_MIN_FEASIBLE);
  });

  it('tight budget: nothing fits, F5 binds, the trip sets the cap, every near miss is 25% over', async () => {
    const row = await tripOf(TIGHT_BUDGET_DEMO.title);
    const res = await requestRecommendations(deps, row.id, row.organiserId);
    expect(res.transition).toEqual({ transitionId: 'T6>T8', to: 'collecting_preferences' });
    const run = res.run!;
    const f5 = (run.diagnostic?.nearMisses ?? []).flatMap((e) =>
      e.failures.filter((f) => f.id === 'F5').map((f) => ({ slug: e.slug, actual: f.actual })),
    );
    expect(run).toMatchObject({ kind: 'diagnostic', feasibleCount: 0, bindingConstraint: 'F5' });
    expect(run.diagnostic?.suggestions).toContainEqual(
      expect.objectContaining({ constraint: 'F5', capSource: 'trip' }),
    );
    expect(f5.length).toBeGreaterThan(0);
    for (const miss of f5) {
      expect(miss.actual, miss.slug).toBeGreaterThanOrEqual(TIGHT_BUDGET_MARGIN * TIGHT_BUDGET_INR);
    }
  });

  // S3-8: the demo script's transport comparison. Round 2 after "Raise the
  // group budget to ₹14,000" lists Bikaner, which has verified train, bus and
  // car rows from Gurugram, so its packages compare modes, not just stays.
  it('tight budget round 2: the raised budget lists Bikaner, whose packages compare at least two modes', async () => {
    const row = await tripOf(TIGHT_BUDGET_DEMO.title);
    const latest = await getLatestRecommendation(db, row.id, row.organiserId);
    const raise = latest.run?.diagnostic?.suggestions.find(
      (s) => s.constraint === 'F5' && s.capSource === 'trip',
    );
    if (raise?.constraint !== 'F5') throw new Error('no F5 suggestion on round 1');
    expect(raise.newGroupCapInr).toBe(14000);

    // What the screen does: save the budget, "Mark ready again" (T3b), ask again.
    await updateTrip(deps, row.id, row.organiserId, { budgetTotalInr: raise.newGroupCapInr });
    await closeSubmissions(deps, row.id, row.organiserId);
    const round2 = await requestRecommendations(deps, row.id, row.organiserId);
    expect(round2.run).toMatchObject({ kind: 'shortlist', round: 2 });
    expect(round2.items.map((i) => i.destination.slug)).toContain('bikaner');
    // M3 (plan finding f): round 2 is this trip's first shortlist, so R17 never
    // reorders it. Any change to a first shortlist's order fails here.
    expect(round2.items.map((i) => i.destination.slug)).toEqual([
      'vrindavan',
      'mathura',
      'bikaner',
    ]);

    await chooseDestination(deps, row.id, row.organiserId, { destinationSlug: 'bikaner' });
    const { packages } = await listTripPackages(db, row.id, row.organiserId);
    expect(new Set(packages.map((p) => p.transportMode)).size).toBeGreaterThanOrEqual(2);
    // The script also points at the over-budget flags.
    expect(packages.some((p) => p.overBudget)).toBe(true);
    // #18: the script quotes each card's one-way time (gurugram/bikaner train, 390 min).
    const saver = packages.find((p) => p.label === 'Saver')!;
    expect(saver.transportMode).toBe('train');
    expect(saver.oneWayMinutes).toBe(390);
  });

  it('date clash: T4 with F3, windows at least 5 days apart', async () => {
    const row = await tripOf(DATE_CLASH_DEMO.title);
    const res = await requestRecommendations(deps, row.id, row.organiserId);
    expect(res.transition).toEqual({ transitionId: 'T4', to: 'collecting_preferences' });
    expect(res.run).toMatchObject({
      kind: 'diagnostic',
      bindingConstraint: 'F3',
      feasibleCount: 0,
    });
    expect(res.run!.groupProfile.conflicts).toContainEqual({
      code: 'NO_COMMON_WINDOW',
      blocking: true,
    });
    expect(DATE_CLASH_GAP_DAYS).toBeGreaterThanOrEqual(5);
  });
});

// S2-8: the R15 timing script's copies reach ready_for_recommendation through
// the same seed helper, each under its own title.
describe('timing copies of the hills demo', () => {
  it('creates ready copies with distinct titles', async () => {
    const copies = await createHillsCopies(process.env.DATABASE_URL ?? '', 2, 'test');
    try {
      expect(new Set(copies.tripIds).size).toBe(2);
      const rows = await db
        .select({ title: trip.title, status: trip.status })
        .from(trip)
        .where(inArray(trip.id, copies.tripIds));
      expect(rows.map((r) => r.status)).toEqual([
        'ready_for_recommendation',
        'ready_for_recommendation',
      ]);
      expect(rows.map((r) => r.title).sort()).toEqual([
        'Hills shortlist demo (timing test-1)',
        'Hills shortlist demo (timing test-2)',
      ]);
    } finally {
      await copies.close();
    }
  });
});

// S3-8: "Long weekend in the hills" is the Monday demo's journey. Once Meera
// submits, the first shortlisted place must give at least 3 packages and a
// day plan with an activity on every full day (a day with no travel), and the
// plan must take a Remove and a Swap (I5) before it is accepted (T14).
describe('Long weekend in the hills: the full journey through the services', () => {
  const routing = createRouting({
    db,
    providers: [curatedProvider(db), estimateProvider()],
    clock: () => new Date(),
    ttlDays: 30,
    logger: { warn: () => {} },
  });
  const deps = {
    db,
    logger: pino({ level: 'silent' }),
    clock: () => new Date(),
    routing,
    weights: SCORING_WEIGHTS,
    lambda: FAIRNESS_LAMBDA,
  };

  it('Meera submits, then shortlist, Saver package, day plan, Remove, Swap, accept: finalised', async () => {
    const [row] = await db.select().from(trip).where(eq(trip.title, 'Long weekend in the hills'));
    if (!row) throw new Error('Long weekend in the hills was not seeded');
    const [meera] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, `meera${DEMO_EMAIL_DOMAIN}`));
    if (!meera) throw new Error('Meera was not seeded');
    const inDays = (n: number) => indiaDate(new Date(Date.now() + n * 86_400_000));
    await saveMyPreference(deps, row.id, meera.id, MEERA_PREFERENCE(inDays));
    const asha = row.organiserId;

    const rec = await requestRecommendations(deps, row.id, asha);
    expect(rec.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });
    const first = rec.items[0]!.destination;
    // The demo script names it; a catalogue change that moves it fails here first.
    expect(first.slug).toBe('chakrata');
    // Script step 2 (optional line): "Meera's bell shows 1". Earlier tests in this
    // file ran the other demo trips, so this counts the script's trip alone.
    const bell = await getNotifications(db, meera.id);
    expect(bell.items.filter((n) => n.tripId === row.id).map((n) => n.message)).toEqual([
      'A shortlist of destinations is ready',
    ]);

    await chooseDestination(deps, row.id, asha, { destinationSlug: first.slug });
    const { packages } = await listTripPackages(db, row.id, asha);
    expect(packages.length).toBeGreaterThanOrEqual(3);
    // Chakrata has only a car row from Gurugram, so its packages compare stays.
    expect(packages.map((p) => [p.label, p.transportMode, p.stayTier])).toEqual([
      ['Saver', 'car', 'budget'],
      ['Balanced', 'car', 'mid'],
      ['Comfort', 'car', 'premium'],
    ]);
    const saver = packages.find((p) => p.label === 'Saver')!;
    // #18: the card's one-way time (gurugram/chakrata car, 425 min).
    expect(saver.oneWayMinutes).toBe(425);
    await giveOpinion(deps, row.id, saver.id, meera.id, 'accept');
    await selectPackage(deps, row.id, saver.id, asha);

    const planned = await planItinerary(deps, row.id, asha);
    const days = planned.itinerary!.days;
    // The card and the day plan agree: the onward leg lasts oneWayMinutes.
    // A missing time gives NaN, so the check fails rather than passes.
    const minutesOf = (hhmm: string | null) =>
      hhmm === null ? NaN : Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    const onward = days.flatMap((d) => d.items).find((i) => i.legId === 'onward')!;
    expect(minutesOf(onward.end) - minutesOf(onward.start)).toBe(saver.oneWayMinutes);
    const fullDays = days.filter((d) => !d.items.some((i) => i.kind === 'travel'));
    expect(fullDays.length).toBeGreaterThan(0);
    for (const d of fullDays) {
      expect(
        d.items.some((i) => i.kind === 'activity'),
        `day ${d.day}`,
      ).toBe(true);
    }
    // The script points at Tiger Falls as "Not verified" (its row is draft).
    const visits = days.flatMap((d) => d.items).filter((i) => i.kind === 'activity');
    const visitTo = (key: string) => {
      const visit = visits.find((i) => i.place?.key === key);
      if (!visit) throw new Error(`the plan has no visit to ${key}`);
      return visit;
    };
    const tiger = visitTo('chakrata/tiger-falls');
    const temple = visitTo('chakrata/lakhamandal-temple');
    expect(tiger.verified).toBe(false);

    // I5 twice, as in the script: the plan uses every Chakrata place, so Swap
    // has nothing to offer until Remove frees Lakhamandal Temple; then Tiger
    // Falls is swapped for it and the visit becomes verified.
    const before = await itineraryAlternatives(deps, row.id, tiger.id, asha);
    expect(before.places).toEqual([]);
    await modifyItinerary(deps, row.id, temple.id, asha, { action: 'remove' });
    const { places } = await itineraryAlternatives(deps, row.id, tiger.id, asha);
    expect(places.map((p) => p.key)).toEqual(['chakrata/lakhamandal-temple']);
    await modifyItinerary(deps, row.id, tiger.id, asha, {
      action: 'replace',
      placeKey: 'chakrata/lakhamandal-temple',
    });
    const adjusted = (await getItinerary(db, row.id, asha)).itinerary!.days.flatMap((d) => d.items);
    expect(adjusted.find((i) => i.id === temple.id)?.kind).toBe('free');
    expect(adjusted.find((i) => i.id === tiger.id)).toMatchObject({
      place: { key: 'chakrata/lakhamandal-temple' },
      verified: true,
    });

    await acceptItinerary(deps, row.id, asha);
    const [done] = await db.select({ status: trip.status }).from(trip).where(eq(trip.id, row.id));
    expect(done!.status).toBe('finalised');
    // Script step 4.9: the finalised dashboard shows Dates and a Cancel trip button.
    const dashboard = await getTrip(db, row.id, asha, deps.clock);
    const [accepted] = packages.filter((p) => p.label === 'Saver');
    expect(dashboard.startDate).toBe(accepted!.startDate);
    expect(dashboard.endDate).toBe(accepted!.endDate);
    expect(dashboard.availableActions).toContainEqual({ action: 'cancelTrip', enabled: true });
    const transitions = await db
      .select({ id: tripTransition.transitionId })
      .from(tripTransition)
      .where(eq(tripTransition.tripId, row.id))
      .orderBy(asc(tripTransition.createdAt), asc(tripTransition.id));
    // After the seed's T1, T2, I1, I1.
    expect(transitions.map((t) => t.id).slice(4)).toEqual([
      'T3',
      'T6>T7',
      'T9',
      'T11',
      'T12',
      'I5',
      'I5',
      'T14',
    ]);
  });
});

// S3-8: --fresh-demos deletes every demo-organised trip (and, by cascade,
// everything it owns) and builds the demo trips again; demo users keep their
// accounts and password. It runs last, once the tests above have used the trips.
describe('runSeed with freshDemos', () => {
  const demoTripIds = async () =>
    (
      await db
        .select({ id: trip.id })
        .from(trip)
        .innerJoin(user, eq(user.id, trip.organiserId))
        .where(like(user.email, `%${DEMO_EMAIL_DOMAIN}`))
    ).map((r) => r.id);
  const demoUsers = () =>
    db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(like(user.email, `%${DEMO_EMAIL_DOMAIN}`))
      .orderBy(asc(user.email));
  const AUTH_HEADERS = { host: 'localhost:4000', origin: 'http://localhost:4000' };
  const idOf = async (name: string) => {
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, `${name}${DEMO_EMAIL_DOMAIN}`));
    if (!row) throw new Error(`${name} was not seeded`);
    return row.id;
  };
  const bellOf = async (name: string) => getNotifications(db, await idOf(name));

  it('refuses, deleting nothing, when a non-demo user belongs to a demo trip', async () => {
    const signedUp = await auth.api.signUpEmail({
      body: { email: 'fresh-outsider@test.bv', password: PASSWORD, name: 'Outsider' },
      headers: AUTH_HEADERS,
    });
    const outsiderId = (signedUp as { user: { id: string } }).user.id;
    const [hills] = await db.select().from(trip).where(eq(trip.title, HILLS_DEMO.title));
    if (!hills) throw new Error('Hills shortlist demo was not seeded');
    await db.insert(tripMember).values({ tripId: hills.id, userId: outsiderId, role: 'member' });
    const before = await demoTripIds();
    try {
      await expect(
        runSeed({ db, auth, catalogueDir, password: PASSWORD, freshDemos: true, log: () => {} }),
      ).rejects.toThrow(/non-demo user belongs to "Hills shortlist demo"/);
      expect((await demoTripIds()).sort()).toEqual(before.sort());
    } finally {
      await db.delete(user).where(eq(user.id, outsiderId));
    }
  });

  it('deletes the used demo trips with their packages and day plans, then builds them fresh', async () => {
    const usersBefore = await demoUsers();
    const oldTrips = await demoTripIds();
    // The journeys above left packages and day plans on the demo trips.
    const oldPackages = (
      await db
        .select({ id: tripPackage.id })
        .from(tripPackage)
        .where(inArray(tripPackage.tripId, oldTrips))
    ).map((p) => p.id);
    expect(oldPackages.length).toBeGreaterThan(0);
    const oldItineraries = (
      await db
        .select({ id: itinerary.id })
        .from(itinerary)
        .where(inArray(itinerary.packageId, oldPackages))
    ).map((i) => i.id);
    expect(oldItineraries.length).toBeGreaterThan(0);

    const lines: string[] = [];
    await runSeed({
      db,
      auth,
      catalogueDir,
      password: PASSWORD,
      freshDemos: true,
      log: (l) => lines.push(l),
    });
    const printed = lines.join('\n');
    expect(printed).toContain(`Fresh demos: deleted ${oldTrips.length} demo trips:`);
    expect(printed).toContain('  Long weekend in the hills (was finalised)');
    expect(printed).toContain('Demo trips created:');

    // The old trips and everything they owned are gone.
    expect(await db.select().from(trip).where(inArray(trip.id, oldTrips))).toEqual([]);
    expect(await db.select().from(tripPackage).where(inArray(tripPackage.id, oldPackages))).toEqual(
      [],
    );
    expect(await db.select().from(itinerary).where(inArray(itinerary.id, oldItineraries))).toEqual(
      [],
    );

    // No orphan row anywhere below trip.
    const orphans = await db.execute<{ n: number }>(sql`
      select (
        (select count(*) from ${tripMember} c left join ${trip} t on t.id = c.trip_id where t.id is null)
        + (select count(*) from ${invitation} c left join ${trip} t on t.id = c.trip_id where t.id is null)
        + (select count(*) from ${tripTransition} c left join ${trip} t on t.id = c.trip_id where t.id is null)
        + (select count(*) from ${notification} c left join ${trip} t on t.id = c.trip_id
            where c.trip_id is not null and t.id is null)
        + (select count(*) from ${preference} c left join ${tripMember} m on m.id = c.trip_member_id
            where m.id is null)
        + (select count(*) from ${recommendationRun} c left join ${trip} t on t.id = c.trip_id where t.id is null)
        + (select count(*) from ${recommendationItem} c left join ${recommendationRun} r on r.id = c.run_id
            where r.id is null)
        + (select count(*) from ${vote} c left join ${recommendationRun} r on r.id = c.run_id
            where r.id is null)
        + (select count(*) from ${tripPackage} c left join ${trip} t on t.id = c.trip_id where t.id is null)
        + (select count(*) from ${costItem} c left join ${tripPackage} p on p.id = c.package_id where p.id is null)
        + (select count(*) from ${packageDecision} c left join ${tripPackage} p on p.id = c.package_id
            where p.id is null)
        + (select count(*) from ${itinerary} c left join ${tripPackage} p on p.id = c.package_id where p.id is null)
        + (select count(*) from ${itineraryItem} c left join ${itinerary} i on i.id = c.itinerary_id
            where i.id is null)
        + (select count(*) from ${itineraryDecision} c left join ${itinerary} i on i.id = c.itinerary_id
            where i.id is null)
      )::int as n`);
    expect(orphans.rows[0]?.n).toBe(0);

    // A fresh demo starts with every bell at 0 (script: setup and step 1), though
    // the rebuild's joins wrote five for Asha.
    expect(printed).toContain('Fresh demos: cleared 5 notifications from the rebuild.');
    for (const name of ['asha', 'rohan', 'meera']) {
      const bell = await bellOf(name);
      expect(bell, name).toEqual({ items: [], unreadCount: 0 });
    }

    // Demo users kept their accounts, and their password still signs in.
    const usersAfter = await demoUsers();
    expect(usersAfter).toEqual(usersBefore);
    const accounts = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(account)
      .where(
        inArray(
          account.userId,
          usersAfter.map((u) => u.id),
        ),
      );
    expect(accounts[0]!.n).toBe(usersAfter.length);
    const signIn = await auth.api.signInEmail({
      body: { email: `meera${DEMO_EMAIL_DOMAIN}`, password: PASSWORD },
      headers: AUTH_HEADERS,
    });
    expect((signIn as { user?: { id: string } }).user?.id).toBe(
      usersAfter.find((u) => u.email === `meera${DEMO_EMAIL_DOMAIN}`)?.id,
    );

    // The demo trips are back where a first seed leaves them; the timing copies are not.
    const fresh = await db
      .select({ title: trip.title, status: trip.status })
      .from(trip)
      .innerJoin(user, eq(user.id, trip.organiserId))
      .where(like(user.email, `%${DEMO_EMAIL_DOMAIN}`))
      .orderBy(asc(trip.title));
    expect(fresh).toEqual([
      { title: 'Date clash demo', status: 'ready_for_recommendation' },
      { title: 'Hills shortlist demo', status: 'ready_for_recommendation' },
      { title: 'Long weekend in the hills', status: 'collecting_preferences' },
      { title: 'Tight budget demo', status: 'ready_for_recommendation' },
    ]);
  });

  it('clears only what the rebuild wrote: a real user and a demo user on a real trip keep theirs', async () => {
    const signedUp = await auth.api.signUpEmail({
      body: { email: 'fresh-real@test.bv', password: PASSWORD, name: 'Real Person' },
      headers: AUTH_HEADERS,
    });
    const realId = (signedUp as { user: { id: string } }).user.id;
    const meeraId = await idOf('meera');
    const [realHub] = await db.select({ id: hub.id }).from(hub).limit(1);
    const [realTrip] = await db
      .insert(trip)
      .values({
        title: 'A real trip',
        organiserId: realId,
        originHubId: realHub!.id,
        durationNights: 2,
        budgetTotalInr: 10000,
        radiusKm: 400,
      })
      .returning({ id: trip.id });
    const payload = { tripId: realTrip!.id, tripTitle: 'A real trip' };
    const received = await db
      .insert(notification)
      .values([
        { userId: realId, tripId: realTrip!.id, type: 'shortlist_ready', payload },
        { userId: meeraId, tripId: realTrip!.id, type: 'shortlist_ready', payload },
      ])
      .returning({ id: notification.id });
    try {
      await runSeed({
        db,
        auth,
        catalogueDir,
        password: PASSWORD,
        freshDemos: true,
        log: () => {},
      });
      const left = await db
        .select({ id: notification.id })
        .from(notification)
        .where(
          inArray(
            notification.id,
            received.map((r) => r.id),
          ),
        );
      expect(left).toHaveLength(2);
      expect((await bellOf('asha')).unreadCount).toBe(0);
    } finally {
      // Its organised trip and those notifications go with the account.
      await db.delete(user).where(eq(user.id, realId));
    }
    expect((await bellOf('meera')).unreadCount).toBe(0);
  });

  // The script's bells, from a fresh reset. It ends the file, so it can use the trip.
  it('after the shortlist, Meera has exactly the one line, and Asha still none', async () => {
    const deps = {
      db,
      logger: pino({ level: 'silent' }),
      clock: () => new Date(),
      routing: createRouting({
        db,
        providers: [curatedProvider(db), estimateProvider()],
        clock: () => new Date(),
        ttlDays: 30,
        logger: { warn: () => {} },
      }),
      weights: SCORING_WEIGHTS,
      lambda: FAIRNESS_LAMBDA,
    };
    const [row] = await db.select().from(trip).where(eq(trip.title, 'Long weekend in the hills'));
    if (!row) throw new Error('Long weekend in the hills was not seeded');
    const inDays = (n: number) => indiaDate(new Date(Date.now() + n * 86_400_000));
    await saveMyPreference(deps, row.id, await idOf('meera'), MEERA_PREFERENCE(inDays));
    expect((await bellOf('asha')).unreadCount).toBe(0);

    const rec = await requestRecommendations(deps, row.id, row.organiserId);
    expect(rec.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });

    const meera = await bellOf('meera');
    expect(meera.unreadCount).toBe(1);
    expect(meera.items.map((n) => [n.type, n.tripTitle, n.message])).toEqual([
      ['shortlist_ready', 'Long weekend in the hills', 'A shortlist of destinations is ready'],
    ]);
    expect((await bellOf('asha')).unreadCount).toBe(0);
  });
});
