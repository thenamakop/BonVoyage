import { createDb } from '@bonvoyage/db';
import { preference, trip, tripMember, tripTransition } from '@bonvoyage/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  InvitationResponse,
  MyPreferenceResponse,
  SavePreferenceResponse,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser, createTripAs, ensureHub, setTripStatus } from '../test/helpers';

// S1-4: GET and PUT /api/trips/:id/preferences/me. Every state-machine case
// asserts the trip_transition row it wrote. The clock is fixed at 1 Nov 2026
// (India), so the dates below are always in the future for the server.

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const clock = () => new Date('2026-11-01T06:30:00Z');
const app = createApp({ db, pool, logger, auth, clock });
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
});

afterAll(async () => {
  await pool.end();
});

const prefs = (overrides: Record<string, unknown> = {}) => ({
  destinationTypes: ['mountain', 'spiritual'],
  activities: ['trekking', 'temples'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 8000,
  budgetMaxInr: 12000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
  ...overrides,
});

type Agent = request.Agent;
const put = (agent: Agent, tripId: string, body: object) =>
  agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(body);
const get = (agent: Agent, tripId: string) =>
  agent.get(`/api/trips/${tripId}/preferences/me`).set(H);
const codeOf = (res: request.Response) => (res.body as ErrorEnvelope).error.code;
const fieldsOf = (res: request.Response) => (res.body as ErrorEnvelope).error.fields ?? {};

const transitionsOf = async (tripId: string) =>
  (
    await db
      .select({ id: tripTransition.transitionId })
      .from(tripTransition)
      .where(eq(tripTransition.tripId, tripId))
      .orderBy(asc(tripTransition.createdAt))
  ).map((r) => r.id);
const statusOf = async (tripId: string) =>
  (await db.select({ s: trip.status }).from(trip).where(eq(trip.id, tripId)))[0]!.s;

/** An open trip (T2 done) with the organiser plus `extra` joined members. */
async function openTrip(extra: number) {
  const org = await createTestUser(app, 'Asha');
  const { id: tripId } = await createTripAs(org.agent, { durationNights: 2 });
  const { token } = InvitationResponse.parse(
    (await org.agent.post(`/api/trips/${tripId}/invitations`).set(H)).body,
  );
  const members = [];
  for (let i = 0; i < extra; i++) {
    const m = await createTestUser(app, `Member ${i}`);
    await m.agent.post(`/api/invitations/${token}/accept`).set(H);
    members.push(m);
  }
  return { org, members, tripId };
}

describe('PUT /api/trips/:id/preferences/me: the state machine', () => {
  it('three members: the first submission is I1, the third is T3 (ready_for_recommendation)', async () => {
    const { org, members, tripId } = await openTrip(2);
    const first = await put(org.agent, tripId, prefs());
    expect(first.status).toBe(200);
    const saved = SavePreferenceResponse.parse(first.body);
    expect(saved.transition).toEqual({
      transitionId: 'I1',
      kind: 'internal',
      to: 'collecting_preferences',
    });
    expect(saved.preference.budgetMaxInr).toBe(12000);
    expect(saved.submittedAt).toBe('2026-11-01T06:30:00.000Z');
    expect(await statusOf(tripId)).toBe('collecting_preferences');

    expect(
      SavePreferenceResponse.parse((await put(members[0]!.agent, tripId, prefs())).body).transition
        .transitionId,
    ).toBe('I1');
    const last = SavePreferenceResponse.parse((await put(members[1]!.agent, tripId, prefs())).body);
    expect(last.transition).toEqual({
      transitionId: 'T3',
      kind: 'external',
      to: 'ready_for_recommendation',
    });
    expect(await statusOf(tripId)).toBe('ready_for_recommendation');
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1', 'I1', 'T3']);
  });

  it('a lone organiser submitting gives I1, not T3 (0001 a)', async () => {
    const { org, tripId } = await openTrip(0);
    const res = await put(org.agent, tripId, prefs());
    expect(SavePreferenceResponse.parse(res.body).transition.transitionId).toBe('I1');
    expect(await statusOf(tripId)).toBe('collecting_preferences');
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1']);
  });

  it('a revision while collecting is I2; a revision when ready is T5 and the status stays', async () => {
    const { org, members, tripId } = await openTrip(1);
    await put(org.agent, tripId, prefs());
    const revised = SavePreferenceResponse.parse(
      (await put(org.agent, tripId, prefs({ budgetMaxInr: 15000 }))).body,
    );
    expect(revised.transition).toEqual({
      transitionId: 'I2',
      kind: 'internal',
      to: 'collecting_preferences',
    });
    expect(revised.preference.budgetMaxInr).toBe(15000);

    await put(members[0]!.agent, tripId, prefs()); // T3
    const t5 = SavePreferenceResponse.parse(
      (await put(org.agent, tripId, prefs({ budgetMaxInr: 16000 }))).body,
    );
    expect(t5.transition).toEqual({
      transitionId: 'T5',
      kind: 'external',
      to: 'ready_for_recommendation',
    });
    expect(await statusOf(tripId)).toBe('ready_for_recommendation');
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1', 'I2', 'T3', 'T5']);
  });

  it('a double-clicked last submission: both 200, one T3, the second becomes a T5 revision', async () => {
    const { org, members, tripId } = await openTrip(1);
    await put(org.agent, tripId, prefs());
    const results = await Promise.allSettled([
      put(members[0]!.agent, tripId, prefs()),
      put(members[0]!.agent, tripId, prefs()),
    ]);
    const ids = results.map((r) => {
      if (r.status !== 'fulfilled' || r.value.status !== 200) throw new Error('a click failed');
      return SavePreferenceResponse.parse(r.value.body).transition.transitionId;
    });
    expect(ids.sort()).toEqual(['T3', 'T5']);
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1', 'T3', 'T5']);
  });

  it('shortlisted: 409 PREFERENCES_LOCKED, the stored preference unchanged, no new row', async () => {
    const { org, tripId } = await openTrip(0);
    await put(org.agent, tripId, prefs());
    await setTripStatus(db, tripId, 'shortlisted');
    const res = await put(org.agent, tripId, prefs({ budgetMaxInr: 99000 }));
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('PREFERENCES_LOCKED');
    const stored = MyPreferenceResponse.parse((await get(org.agent, tripId)).body);
    expect(stored.preference?.budgetMaxInr).toBe(12000);
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1']);
  });

  it('draft: 409 ILLEGAL_TRANSITION and no preference row is written', async () => {
    const org = await createTestUser(app, 'Asha');
    const { id: tripId } = await createTripAs(org.agent, { durationNights: 2 });
    const res = await put(org.agent, tripId, prefs());
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('ILLEGAL_TRANSITION');
    const rows = await db
      .select()
      .from(preference)
      .innerJoin(tripMember, eq(tripMember.id, preference.tripMemberId))
      .where(eq(tripMember.tripId, tripId));
    expect(rows).toHaveLength(0);
    const [m] = await db.select().from(tripMember).where(eq(tripMember.tripId, tripId));
    expect(m!.submittedAt).toBeNull();
    expect(await transitionsOf(tripId)).toEqual(['T1']);
  });
});

describe('PUT /api/trips/:id/preferences/me: validation and access', () => {
  it('400 with the field for each rule; nothing is written', async () => {
    const { org, tripId } = await openTrip(0);
    const cases: [Record<string, unknown>, string, string][] = [
      [{ destinationTypes: [] }, 'destinationTypes', 'Pick at least one kind of place.'],
      [
        { budgetMinInr: 8000, budgetMaxInr: 6000 },
        'budgetMaxInr',
        'Maximum must be at least the minimum.',
      ],
      [
        { dateStart: '2026-10-31', dateEnd: '2026-11-05' },
        'dateStart',
        'Choose a start date from today onwards.',
      ],
      [
        { dateStart: '2026-11-13', dateEnd: '2026-11-14' },
        'dateEnd',
        'Your dates must cover at least 2 nights for this trip.',
      ],
    ];
    for (const [patch, field, message] of cases) {
      const res = await put(org.agent, tripId, prefs(patch));
      expect(res.status, field).toBe(400);
      expect(codeOf(res)).toBe('VALIDATION_ERROR');
      expect(fieldsOf(res)[field]).toBe(message);
    }
    expect(MyPreferenceResponse.parse((await get(org.agent, tripId)).body).preference).toBeNull();
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2']);
  });

  it('401 without a session, 400 for a bad id, 404 for a non-member', async () => {
    const { tripId } = await openTrip(0);
    expect(
      (await request(app).put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefs())).status,
    ).toBe(401);
    expect((await request(app).get(`/api/trips/${tripId}/preferences/me`).set(H)).status).toBe(401);
    const outsider = await createTestUser(app);
    const bad = await put(outsider.agent, 'not-a-uuid', prefs());
    expect(bad.status).toBe(400);
    expect(fieldsOf(bad)).toEqual({ id: 'must be a uuid' });
    expect((await put(outsider.agent, tripId, prefs())).status).toBe(404);
    expect((await get(outsider.agent, tripId)).status).toBe(404);
  });

  it('403 for an excluded member, whose GET answers null', async () => {
    const { org, members, tripId } = await openTrip(1);
    const removed = members[0]!;
    await put(removed.agent, tripId, prefs());
    await org.agent.delete(`/api/trips/${tripId}/members/${removed.userId}`).set(H);
    const res = await put(removed.agent, tripId, prefs());
    expect(res.status).toBe(403);
    expect(codeOf(res)).toBe('FORBIDDEN');
    expect(MyPreferenceResponse.parse((await get(removed.agent, tripId)).body)).toEqual({
      preference: null,
      submittedAt: null,
    });
  });
});

describe('GET /api/trips/:id/preferences/me: privacy (R10)', () => {
  it("member A never receives member B's values, here or on the trip page", async () => {
    const { org, members, tripId } = await openTrip(1);
    const b = members[0]!;
    await put(
      b.agent,
      tripId,
      prefs({ destinationTypes: ['heritage'], budgetMinInr: 70123, budgetMaxInr: 77777 }),
    );

    const own = await get(org.agent, tripId);
    expect(own.status).toBe(200);
    expect(MyPreferenceResponse.parse(own.body)).toEqual({ preference: null, submittedAt: null });
    const trip = await org.agent.get(`/api/trips/${tripId}`).set(H);
    for (const raw of [own.text, trip.text]) {
      expect(raw).not.toContain('77777');
      expect(raw).not.toContain('70123');
      expect(raw).not.toContain('heritage');
    }

    await put(org.agent, tripId, prefs());
    const mine = MyPreferenceResponse.parse((await get(org.agent, tripId)).body);
    expect(mine.preference?.budgetMaxInr).toBe(12000);
    expect(mine.submittedAt).not.toBeNull();
    const theirs = MyPreferenceResponse.parse((await get(b.agent, tripId)).body);
    expect(theirs.preference?.budgetMaxInr).toBe(77777);
    const [row] = await db
      .select()
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, b.userId)));
    expect(row!.submittedAt).not.toBeNull();
  });
});
