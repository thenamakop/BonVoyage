import { createDb } from '@bonvoyage/db';
import { preference, tripMember } from '@bonvoyage/db/schema';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  CLIMATE_PREFERENCES,
  InvitationResponse,
  TRAVEL_STYLES,
  TripDetail,
  TripsResponse,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser, createTripAs, ensureHub, setTripStatus } from '../test/helpers';

// S1-3: leaving and removing members. The removal test writes the preference
// row directly because PUT preferences/me arrives in S1-4.

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger, auth });
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
});

afterAll(async () => {
  await pool.end();
});

const codeOf = (res: request.Response) => (res.body as ErrorEnvelope).error.code;

/** An organiser, an open trip and one joined member. */
async function tripWithMember() {
  const org = await createTestUser(app, 'Kabir');
  const { id: tripId } = await createTripAs(org.agent);
  const { token } = InvitationResponse.parse(
    (await org.agent.post(`/api/trips/${tripId}/invitations`).set(H)).body,
  );
  const member = await createTestUser(app, 'Rohan');
  await member.agent.post(`/api/invitations/${token}/accept`).set(H);
  return { org, member, tripId };
}

async function membershipOf(tripId: string, userId: string) {
  const rows = await db
    .select()
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)));
  return rows[0];
}

const leave = (agent: request.Agent, tripId: string) =>
  agent.delete(`/api/trips/${tripId}/members/me`).set(H);
const remove = (agent: request.Agent, tripId: string, userId: string) =>
  agent.delete(`/api/trips/${tripId}/members/${userId}`).set(H);

describe('DELETE /api/trips/:id/members/me', () => {
  it('204: the member row goes and the trip leaves their list', async () => {
    const { member, tripId } = await tripWithMember();
    const res = await leave(member.agent, tripId);
    expect(res.status).toBe(204);
    expect(await membershipOf(tripId, member.userId)).toBeUndefined();
    const list = TripsResponse.parse((await member.agent.get('/api/me/trips').set(H)).body);
    expect(list.trips.map((t) => t.id)).not.toContain(tripId);
    expect((await member.agent.get(`/api/trips/${tripId}`).set(H)).status).toBe(404);
  });

  it('422 ORGANISER_CANNOT_LEAVE for the organiser (and "me" is not read as a user id)', async () => {
    const { org, tripId } = await tripWithMember();
    const res = await leave(org.agent, tripId);
    expect(res.status).toBe(422);
    expect((res.body as ErrorEnvelope).error).toMatchObject({
      code: 'ORGANISER_CANNOT_LEAVE',
      message: 'Organisers cannot leave. Cancel the trip instead.',
    });
  });

  it('409 TRIP_LOCKED once preferences have closed', async () => {
    const { member, tripId } = await tripWithMember();
    await setTripStatus(db, tripId, 'ready_for_recommendation');
    const res = await leave(member.agent, tripId);
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('TRIP_LOCKED');
  });

  it('401 without a session, 400 for a bad id, 404 for a non-member', async () => {
    const { tripId } = await tripWithMember();
    expect((await request(app).delete(`/api/trips/${tripId}/members/me`).set(H)).status).toBe(401);
    const outsider = await createTestUser(app);
    expect((await leave(outsider.agent, 'not-a-uuid')).status).toBe(400);
    const res = await leave(outsider.agent, tripId);
    expect(res.status).toBe(404);
    expect(codeOf(res)).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/trips/:id/members/:userId', () => {
  it('204: excluded, submitted_at cleared, preference deleted; read-only afterwards', async () => {
    const { org, member, tripId } = await tripWithMember();
    const row = await membershipOf(tripId, member.userId);
    await db.insert(preference).values({
      tripMemberId: row!.id,
      destinationTypes: [],
      activities: [],
      climate: CLIMATE_PREFERENCES[0],
      travelStyle: TRAVEL_STYLES[0],
      budgetMinInr: 1000,
      budgetMaxInr: 5000,
      dateStart: '2026-11-13',
      dateEnd: '2026-11-15',
    });
    await db.update(tripMember).set({ submittedAt: new Date() }).where(eq(tripMember.id, row!.id));

    const res = await remove(org.agent, tripId, member.userId);
    expect(res.status).toBe(204);
    expect(await membershipOf(tripId, member.userId)).toMatchObject({
      status: 'excluded',
      submittedAt: null,
    });
    expect(
      await db.select().from(preference).where(eq(preference.tripMemberId, row!.id)),
    ).toHaveLength(0);

    const view = await member.agent.get(`/api/trips/${tripId}`).set(H);
    expect(view.status).toBe(200);
    expect(TripDetail.parse(view.body).myStatus).toBe('excluded');
    const leaveRes = await leave(member.agent, tripId);
    expect(leaveRes.status).toBe(403);
    expect(codeOf(leaveRes)).toBe('FORBIDDEN');
  });

  it('403 for a plain member', async () => {
    const { org, member, tripId } = await tripWithMember();
    const res = await remove(member.agent, tripId, org.userId);
    expect(res.status).toBe(403);
    expect(codeOf(res)).toBe('FORBIDDEN');
  });

  it('404 when the target is not a member, 422 CANNOT_REMOVE_ORGANISER for the organiser', async () => {
    const { org, tripId } = await tripWithMember();
    const stranger = await createTestUser(app);
    const missing = await remove(org.agent, tripId, stranger.userId);
    expect(missing.status).toBe(404);
    expect(codeOf(missing)).toBe('NOT_FOUND');
    const self = await remove(org.agent, tripId, org.userId);
    expect(self.status).toBe(422);
    expect(codeOf(self)).toBe('CANNOT_REMOVE_ORGANISER');
  });

  it('409 TRIP_LOCKED once preferences have closed', async () => {
    const { org, member, tripId } = await tripWithMember();
    await setTripStatus(db, tripId, 'shortlisted');
    const res = await remove(org.agent, tripId, member.userId);
    expect(res.status).toBe(409);
    expect((res.body as ErrorEnvelope).error).toMatchObject({
      code: 'TRIP_LOCKED',
      message: 'Members cannot change after preferences close.',
    });
  });

  it('401 without a session, 400 for a bad id, 404 for a non-member caller', async () => {
    const { member, tripId } = await tripWithMember();
    expect(
      (await request(app).delete(`/api/trips/${tripId}/members/${member.userId}`).set(H)).status,
    ).toBe(401);
    const outsider = await createTestUser(app);
    const bad = await remove(outsider.agent, 'not-a-uuid', member.userId);
    expect(bad.status).toBe(400);
    expect((bad.body as ErrorEnvelope).error.fields).toEqual({ id: 'must be a uuid' });
    expect((await remove(outsider.agent, tripId, member.userId)).status).toBe(404);
  });
});
