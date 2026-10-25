import { createDb } from '@bonvoyage/db';
import {
  destination,
  pastTrip,
  preference,
  trip,
  tripMember,
  tripTransition,
} from '@bonvoyage/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { resolve } from 'node:path';
import { createRouting, curatedProvider, estimateProvider } from '@bonvoyage/integrations/routing';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { createAuth } from '../auth/auth';
import { SCORING_WEIGHTS } from '../config/scoring';
import { requestRecommendations } from '../recommendations/service';
import {
  DATE_CLASH_DEMO,
  DATE_CLASH_GAP_DAYS,
  DEMO_SCENARIOS,
  HILLS_DEMO,
  HILLS_MIN_FEASIBLE,
  TIGHT_BUDGET_DEMO,
  TIGHT_BUDGET_INR,
  TIGHT_BUDGET_MARGIN,
} from './demo-trips';
import { runSeed } from './run-seed';

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
