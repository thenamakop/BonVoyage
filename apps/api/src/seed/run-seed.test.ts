import { createDb } from '@bonvoyage/db';
import { preference, trip, tripMember } from '@bonvoyage/db/schema';
import { eq, sql } from 'drizzle-orm';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createAuth } from '../auth/auth';
import { runSeed } from './run-seed';

// S0-5: the seed is idempotent and leaves the expected trip shape.

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
    await runSeed({ db, auth, catalogueDir, password: PASSWORD });
    const first = await Promise.all(
      [trip, tripMember, preference].map(async (t) => {
        const rows = await db.select({ n: sql<number>`count(*)::int` }).from(t);
        return rows[0]!.n;
      }),
    );
    await runSeed({ db, auth, catalogueDir, password: PASSWORD });
    const second = await Promise.all(
      [trip, tripMember, preference].map(async (t) => {
        const rows = await db.select({ n: sql<number>`count(*)::int` }).from(t);
        return rows[0]!.n;
      }),
    );
    expect(second).toEqual(first);

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
  });
});
