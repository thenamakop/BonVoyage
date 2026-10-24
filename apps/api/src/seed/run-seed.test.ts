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
import { afterAll, describe, expect, it } from 'vitest';
import { createAuth } from '../auth/auth';
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
