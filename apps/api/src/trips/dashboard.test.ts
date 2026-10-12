import { createDb } from '@bonvoyage/db';
import { trip, tripMember, tripTransition } from '@bonvoyage/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  ActivityResponse,
  InvitationResponse,
  TripDetail,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser, createTripAs, ensureHub } from '../test/helpers';

// S1-5: the enriched TripDetail, POST /api/trips/:id/close-submissions (T3b)
// and GET /api/trips/:id/activity. The clock is fixed at 1 Nov 2026 (India).

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger, auth, clock: () => new Date('2026-11-01T06:30:00Z') });
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
});

afterAll(async () => {
  await pool.end();
});

type Agent = request.Agent;
const prefs = (budgetMaxInr = 12000) => ({
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 8000,
  budgetMaxInr,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
});
const submit = (agent: Agent, tripId: string, max?: number) =>
  agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefs(max));
const close = (agent: Agent, tripId: string, body: object = {}) =>
  agent.post(`/api/trips/${tripId}/close-submissions`).set(H).send(body);
const codeOf = (res: request.Response) => (res.body as ErrorEnvelope).error.code;
const transitionsOf = async (tripId: string) =>
  (
    await db
      .select({ id: tripTransition.transitionId })
      .from(tripTransition)
      .where(eq(tripTransition.tripId, tripId))
      .orderBy(asc(tripTransition.createdAt))
  ).map((r) => r.id);

/** Organiser Asha plus Rohan and Meera, trip open for preferences (T1, T2). */
async function threeMembers() {
  const asha = await createTestUser(app, 'Asha');
  const { id: tripId } = await createTripAs(asha.agent, { durationNights: 2 });
  const { token } = InvitationResponse.parse(
    (await asha.agent.post(`/api/trips/${tripId}/invitations`).set(H)).body,
  );
  const rohan = await createTestUser(app, 'Rohan');
  const meera = await createTestUser(app, 'Meera');
  for (const m of [rohan, meera]) await m.agent.post(`/api/invitations/${token}/accept`).set(H);
  return { asha, rohan, meera, tripId };
}

describe('POST /api/trips/:id/close-submissions (T3b)', () => {
  it('2 of 3 submitted: 200, ready_for_recommendation, one T3b row, the non-submitter excluded', async () => {
    const { asha, rohan, meera, tripId } = await threeMembers();
    await submit(asha.agent, tripId);
    await submit(rohan.agent, tripId);
    const res = await close(asha.agent, tripId);
    expect(res.status).toBe(200);
    const detail = TripDetail.parse(res.body);
    expect(detail.status).toBe('ready_for_recommendation');
    expect(detail.progress).toEqual({
      activeCount: 2,
      submittedCount: 2,
      pendingCount: 0,
      excludedCount: 1,
      maxMembers: 8,
    });
    expect(detail.members.find((m) => m.name === 'Meera')?.status).toBe('excluded');
    const [m] = await db
      .select()
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, meera.userId)));
    expect(m!.status).toBe('excluded');
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1', 'I1', 'T3b']);
  });

  it('1 submitted: 409 GUARD_FAILED and nothing changes', async () => {
    const { asha, tripId } = await threeMembers();
    await submit(asha.agent, tripId);
    const res = await close(asha.agent, tripId);
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('GUARD_FAILED');
    const [t] = await db.select().from(trip).where(eq(trip.id, tripId));
    expect(t!.status).toBe('collecting_preferences');
    const statuses = await db
      .select({ s: tripMember.status })
      .from(tripMember)
      .where(eq(tripMember.tripId, tripId));
    expect(statuses.every((r) => r.s === 'active')).toBe(true);
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1']);
  });

  it('a draft trip: 409 ILLEGAL_TRANSITION', async () => {
    const asha = await createTestUser(app, 'Asha');
    const { id: tripId } = await createTripAs(asha.agent);
    const res = await close(asha.agent, tripId);
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('ILLEGAL_TRANSITION');
    expect(await transitionsOf(tripId)).toEqual(['T1']);
  });

  it('403 for a member, 404 for a non-member, 401 without a session, 400 for a bad id or body', async () => {
    const { asha, rohan, tripId } = await threeMembers();
    await submit(asha.agent, tripId);
    await submit(rohan.agent, tripId);
    const member = await close(rohan.agent, tripId);
    expect(member.status).toBe(403);
    expect(codeOf(member)).toBe('FORBIDDEN');
    const outsider = await createTestUser(app);
    expect((await close(outsider.agent, tripId)).status).toBe(404);
    expect(
      (await request(app).post(`/api/trips/${tripId}/close-submissions`).set(H).send({})).status,
    ).toBe(401);
    expect((await close(asha.agent, 'not-a-uuid')).status).toBe(400);
    const body = await close(asha.agent, tripId, { force: true });
    expect(body.status).toBe(400);
    expect(codeOf(body)).toBe('VALIDATION_ERROR');
    expect(await transitionsOf(tripId)).toEqual(['T1', 'T2', 'I1', 'I1']);
  });
});

describe('GET /api/trips/:id: progress and availableActions', () => {
  it('the organiser and a member each get their own actions; lastActivityAt moves', async () => {
    const { asha, rohan, tripId } = await threeMembers();
    const before = TripDetail.parse((await asha.agent.get(`/api/trips/${tripId}`).set(H)).body);
    await submit(asha.agent, tripId);
    const org = TripDetail.parse((await asha.agent.get(`/api/trips/${tripId}`).set(H)).body);
    expect(org.progress).toEqual({
      activeCount: 3,
      submittedCount: 1,
      pendingCount: 2,
      excludedCount: 0,
      maxMembers: 8,
    });
    expect(org.availableActions).toEqual([
      { action: 'invite', enabled: true },
      { action: 'editPreferences', enabled: true },
      {
        action: 'closeSubmissions',
        enabled: false,
        reason: 'At least 2 members need to submit first.',
      },
      { action: 'cancelTrip', enabled: true },
    ]);
    expect(org.lastActivityAt).not.toBeNull();
    expect(Date.parse(org.lastActivityAt!)).toBeGreaterThan(Date.parse(before.lastActivityAt!));

    const mem = TripDetail.parse((await rohan.agent.get(`/api/trips/${tripId}`).set(H)).body);
    expect(mem.progress.submittedCount).toBe(1);
    expect(mem.availableActions).toEqual([
      { action: 'editPreferences', enabled: true },
      { action: 'leaveTrip', enabled: true },
    ]);
  });
});

describe('GET /api/trips/:id/activity', () => {
  it('newest first, at most 20, names and summaries, never an email', async () => {
    const { asha, rohan, tripId } = await threeMembers();
    await submit(asha.agent, tripId);
    await submit(rohan.agent, tripId);
    // 20 revisions (I2) make 24 rows in all.
    for (let i = 0; i < 20; i++) await submit(rohan.agent, tripId, 13000 + i);
    const res = await asha.agent.get(`/api/trips/${tripId}/activity`).set(H);
    expect(res.status).toBe(200);
    const { items } = ActivityResponse.parse(res.body);
    expect(items).toHaveLength(20);
    const times = items.map((i) => Date.parse(i.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(items[0]).toMatchObject({
      transitionId: 'I2',
      event: 'preferenceRevised',
      actorName: 'Rohan',
      summary: 'Rohan updated preferences',
    });
    expect(res.text).not.toContain('@');
  });

  it('the organiser opening the trip reads in words; an excluded member can still read it', async () => {
    const { asha, rohan, meera, tripId } = await threeMembers();
    await submit(asha.agent, tripId);
    await submit(rohan.agent, tripId);
    await close(asha.agent, tripId);
    const res = await meera.agent.get(`/api/trips/${tripId}/activity`).set(H);
    expect(res.status).toBe(200);
    const summaries = ActivityResponse.parse(res.body).items.map((i) => i.summary);
    expect(summaries).toEqual([
      'Asha closed submissions',
      'Rohan submitted preferences',
      'Asha submitted preferences',
      'Asha opened the trip for preferences',
      'Asha created the trip',
    ]);
    expect(res.text).not.toContain('@');
  });

  it('404 for a non-member, 401 without a session, 400 for a bad id', async () => {
    const { tripId } = await threeMembers();
    const outsider = await createTestUser(app);
    expect((await outsider.agent.get(`/api/trips/${tripId}/activity`).set(H)).status).toBe(404);
    expect((await request(app).get(`/api/trips/${tripId}/activity`).set(H)).status).toBe(401);
    expect((await outsider.agent.get('/api/trips/nope/activity').set(H)).status).toBe(400);
  });
});
