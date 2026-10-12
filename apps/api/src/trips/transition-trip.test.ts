import { createDb } from '@bonvoyage/db';
import { hub, trip, tripMember, tripTransition } from '@bonvoyage/db/schema';
import { user } from '@bonvoyage/db/schema/auth';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { transitionTrip } from './transition-trip';

// S0-5 step 7 (RUNBOOK A3): the only code path that changes trip.status.
// Test setup may write trip.status directly to arrange a state.

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const clock = () => new Date('2026-11-01T12:00:00+05:30'); // India date 2026-11-01

const uid = (n: string) => `ts-user-${n}`;
let seq = 0;

async function makeUser(name: string): Promise<string> {
  const id = uid(`${seq++}`);
  await db.insert(user).values({ id, name, email: `${id}@test.bv` });
  return id;
}

async function makeTrip(
  status: string,
  opts: {
    startDate?: string;
    members?: { userId: string; role?: 'organiser' | 'member'; submitted?: boolean }[];
  } = {},
) {
  const [h] = await db
    .insert(hub)
    .values({
      slug: `ts-hub-${seq}`,
      name: 'H',
      state: 'S',
      lat: 28,
      lng: 77,
      collectedOn: '2026-10-12',
      reviewStatus: 'draft',
    })
    .returning({ id: hub.id });
  seq++;
  const organiser = await makeUser('org');
  const [t] = await db
    .insert(trip)
    .values({
      title: 'T',
      organiserId: organiser,
      originHubId: h!.id,
      durationNights: 2,
      budgetTotalInr: 10000,
      radiusKm: 400,
      status: status as 'draft',
      startDate: opts.startDate,
    })
    .returning({ id: trip.id });
  for (const m of opts.members ?? []) {
    await db.insert(tripMember).values({
      tripId: t!.id,
      userId: m.userId,
      role: m.role ?? 'member',
      submittedAt: m.submitted ? new Date() : null,
    });
  }
  return { tripId: t!.id, organiser };
}

const transitionsOf = (tripId: string) =>
  db.select().from(tripTransition).where(eq(tripTransition.tripId, tripId));

afterAll(async () => {
  await pool.end();
});

describe('transitionTrip', () => {
  it('T2 moves a draft trip to collecting_preferences and writes one row', async () => {
    const { tripId, organiser } = await makeTrip('draft');
    const r = await transitionTrip(
      { db, logger, clock },
      { tripId, event: 'inviteMembers', actorUserId: organiser },
    );
    expect(r).toMatchObject({ transitionId: 'T2', kind: 'external', to: 'collecting_preferences' });
    expect(r.actions).toEqual(['sendInvitations', 'openSubmissionWindow']);
    const [t] = await db.select().from(trip).where(eq(trip.id, tripId));
    expect(t!.status).toBe('collecting_preferences');
    const rows = await transitionsOf(tripId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      transitionId: 'T2',
      event: 'inviteMembers',
      fromStatus: 'draft',
      toStatus: 'collecting_preferences',
    });
  });

  it('I1 leaves the status unchanged and still writes a row', async () => {
    const submitter = await makeUser('s1');
    const pending = await makeUser('p1');
    const { tripId, organiser } = await makeTrip('collecting_preferences', {
      members: [
        { userId: submitter, submitted: true },
        { userId: pending, submitted: false },
      ],
    });
    const r = await transitionTrip(
      { db, logger, clock },
      { tripId, event: 'preferenceSubmitted', actorUserId: organiser },
    );
    expect(r).toMatchObject({ transitionId: 'I1', kind: 'internal', to: 'collecting_preferences' });
    const rows = await transitionsOf(tripId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.transitionId).toBe('I1');
  });

  it('T3b excludes the non-submitter', async () => {
    const s1 = await makeUser('s2');
    const s2 = await makeUser('s3');
    const p1 = await makeUser('p2');
    const { tripId, organiser } = await makeTrip('collecting_preferences', {
      members: [
        { userId: s1, submitted: true },
        { userId: s2, submitted: true },
        { userId: p1, submitted: false },
      ],
    });
    const r = await transitionTrip(
      { db, logger, clock },
      { tripId, event: 'closeSubmissions', actorUserId: organiser },
    );
    expect(r.to).toBe('ready_for_recommendation');
    const [excluded] = await db
      .select()
      .from(tripMember)
      .where(sql`${tripMember.tripId} = ${tripId} and ${tripMember.userId} = ${p1}`);
    expect(excluded!.status).toBe('excluded');
    const [stillActive] = await db
      .select()
      .from(tripMember)
      .where(sql`${tripMember.tripId} = ${tripId} and ${tripMember.userId} = ${s1}`);
    expect(stillActive!.status).toBe('active');
  });

  it('packageAccepted in collecting_preferences is 409 ILLEGAL_TRANSITION', async () => {
    const { tripId, organiser } = await makeTrip('collecting_preferences');
    await expect(
      transitionTrip(
        { db, logger, clock },
        { tripId, event: 'packageAccepted', actorUserId: organiser },
      ),
    ).rejects.toMatchObject({ status: 409, code: 'ILLEGAL_TRANSITION' });
  });

  it('two concurrent inviteMembers give one success, one 409, one T2 row', async () => {
    const { tripId, organiser } = await makeTrip('draft');
    const other = createDb(process.env.DATABASE_URL ?? '');
    try {
      const results = await Promise.allSettled([
        transitionTrip(
          { db, logger, clock },
          { tripId, event: 'inviteMembers', actorUserId: organiser },
        ),
        transitionTrip(
          { db: other.db, logger, clock },
          { tripId, event: 'inviteMembers', actorUserId: organiser },
        ),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const bad = results.filter((r) => r.status === 'rejected');
      expect(ok).toHaveLength(1);
      expect(bad).toHaveLength(1);
      expect((bad[0] as PromiseRejectedResult).reason).toMatchObject({
        status: 409,
        code: 'ILLEGAL_TRANSITION',
      });
      expect(await transitionsOf(tripId)).toHaveLength(1);
    } finally {
      await other.pool.end();
    }
  });

  it('a missing trip is 404', async () => {
    await expect(
      transitionTrip(
        { db, logger, clock },
        {
          tripId: '00000000-0000-0000-0000-000000000000',
          event: 'inviteMembers',
          actorUserId: 'x',
        },
      ),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
