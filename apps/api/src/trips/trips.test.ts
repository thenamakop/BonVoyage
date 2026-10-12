import { createDb } from '@bonvoyage/db';
import { tripMember, tripTransition } from '@bonvoyage/db/schema';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import type { ErrorEnvelope } from '@bonvoyage/shared';
import { HubsResponse, TripDetail, TripsResponse } from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser, createTripAs, ensureHub, setTripStatus } from '../test/helpers';

// S1-2: trips and hubs endpoints, the conventions rule-10 matrix. Sign-up goes
// through the real auth route; non-draft states are arranged with setTripStatus.

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

const fieldsOf = (res: request.Response) => (res.body as ErrorEnvelope).error.fields ?? {};

describe('GET /api/hubs', () => {
  it('returns the hubs ordered by name', async () => {
    await ensureHub(db, 'zzz-hub');
    const { agent } = await createTestUser(app);
    const res = await agent.get('/api/hubs').set(H);
    expect(res.status).toBe(200);
    const { hubs } = HubsResponse.parse(res.body);
    expect(hubs.length).toBeGreaterThanOrEqual(2);
    const names = hubs.map((h) => h.name);
    expect([...names].sort()).toEqual(names);
  });

  it('401 without a session', async () => {
    const res = await request(app).get('/api/hubs').set(H);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/trips', () => {
  it('201: creates a draft trip with one organiser member and one T1 row', async () => {
    const { agent, userId } = await createTestUser(app);
    const res = await agent.post('/api/trips').set(H).send({
      title: 'Test weekend',
      originHubSlug: 'test-hub',
      durationNights: 2,
      budgetTotalInr: 30000,
      radiusKm: 300,
    });
    expect(res.status).toBe(201);
    const detail = TripDetail.parse(res.body);
    expect(detail.status).toBe('draft');
    expect(detail.myRole).toBe('organiser');
    expect(detail.members).toHaveLength(1);
    expect(detail.members[0]).toMatchObject({ userId, role: 'organiser', status: 'active' });
    expect(detail.members[0]).not.toHaveProperty('email');
    expect(detail.legalEvents).toContain('inviteMembers');

    const members = await db
      .select()
      .from(tripMember)
      .where(and(eq(tripMember.tripId, detail.id), eq(tripMember.status, 'active')));
    expect(members).toHaveLength(1);
    const transitions = await db
      .select()
      .from(tripTransition)
      .where(eq(tripTransition.tripId, detail.id));
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      transitionId: 'T1',
      event: 'createTrip',
      fromStatus: null,
      toStatus: 'draft',
      actorUserId: userId,
    });
  });

  it('400 fields.title on an empty title', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.post('/api/trips').set(H).send({
      title: '   ',
      originHubSlug: 'test-hub',
      durationNights: 2,
      budgetTotalInr: 30000,
      radiusKm: 300,
    });
    expect(res.status).toBe(400);
    expect(fieldsOf(res).title).toBeTruthy();
  });

  it('400 fields.durationNights for 15 nights', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.post('/api/trips').set(H).send({
      title: 'T',
      originHubSlug: 'test-hub',
      durationNights: 15,
      budgetTotalInr: 30000,
      radiusKm: 300,
    });
    expect(res.status).toBe(400);
    expect(fieldsOf(res).durationNights).toBeTruthy();
  });

  it('400 fields.budgetTotalInr for ₹999', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.post('/api/trips').set(H).send({
      title: 'T',
      originHubSlug: 'test-hub',
      durationNights: 2,
      budgetTotalInr: 999,
      radiusKm: 300,
    });
    expect(res.status).toBe(400);
    expect(fieldsOf(res).budgetTotalInr).toBeTruthy();
  });

  it('400 fields.originHubSlug for an unknown hub', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.post('/api/trips').set(H).send({
      title: 'T',
      originHubSlug: 'no-such-hub',
      durationNights: 2,
      budgetTotalInr: 30000,
      radiusKm: 300,
    });
    expect(res.status).toBe(400);
    expect(fieldsOf(res).originHubSlug).toBe('Choose a starting city from the list.');
  });

  it('401 without a session', async () => {
    const res = await request(app).post('/api/trips').set(H).send({
      title: 'T',
      originHubSlug: 'test-hub',
      durationNights: 2,
      budgetTotalInr: 30000,
      radiusKm: 300,
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/me/trips', () => {
  it("lists only the caller's trips, newest updated first", async () => {
    const { agent } = await createTestUser(app);
    const other = await createTestUser(app);
    const mine = await createTripAs(agent, { title: 'Mine' });
    await createTripAs(agent, { title: 'Mine two' });
    await createTripAs(other.agent, { title: 'Not mine' });
    const res = await agent.get('/api/me/trips').set(H);
    expect(res.status).toBe(200);
    const { trips } = TripsResponse.parse(res.body);
    const mine_ = trips.filter((t) => ['Mine', 'Mine two'].includes(t.title));
    expect(mine_.map((t) => t.title)).toEqual(['Mine two', 'Mine']);
    expect(trips.some((t) => t.title === 'Not mine')).toBe(false);
    for (const t of mine_) {
      expect(t).toMatchObject({ myRole: 'organiser', memberCount: 1 });
    }
    expect(mine_.some((t) => t.id === mine.id)).toBe(true);
  });

  it('401 without a session', async () => {
    const res = await request(app).get('/api/me/trips').set(H);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/trips/:id', () => {
  it('200 for a member', async () => {
    const { agent } = await createTestUser(app);
    const detail = await createTripAs(agent);
    const res = await agent.get(`/api/trips/${detail.id}`).set(H);
    expect(res.status).toBe(200);
    expect(TripDetail.parse(res.body).id).toBe(detail.id);
  });

  it('404 for a signed-in non-member ("Trip not found.")', async () => {
    const { agent } = await createTestUser(app);
    const outsider = await createTestUser(app);
    const detail = await createTripAs(agent);
    const res = await outsider.agent.get(`/api/trips/${detail.id}`).set(H);
    expect(res.status).toBe(404);
    expect((res.body as ErrorEnvelope).error.message).toBe('Trip not found.');
  });

  it('404 for a missing trip gives the same message', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.get('/api/trips/00000000-0000-4000-8000-000000000000').set(H);
    expect(res.status).toBe(404);
    expect((res.body as ErrorEnvelope).error.message).toBe('Trip not found.');
  });

  it('400 for "not-a-uuid"', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.get('/api/trips/not-a-uuid').set(H);
    expect(res.status).toBe(400);
    expect((res.body as ErrorEnvelope).error.fields).toEqual({ id: 'must be a uuid' });
  });

  it('401 without a session', async () => {
    const { agent } = await createTestUser(app);
    const detail = await createTripAs(agent);
    const res = await request(app).get(`/api/trips/${detail.id}`).set(H);
    expect(res.status).toBe(401);
  });

  it('an excluded member can still read the trip', async () => {
    const { agent } = await createTestUser(app);
    const excluded = await createTestUser(app);
    const detail = await createTripAs(agent);
    await db
      .insert(tripMember)
      .values({ tripId: detail.id, userId: excluded.userId, role: 'member', status: 'excluded' });
    const res = await excluded.agent.get(`/api/trips/${detail.id}`).set(H);
    expect(res.status).toBe(200);
    expect(TripDetail.parse(res.body).myStatus).toBe('excluded');
  });
});

describe('PATCH /api/trips/:id', () => {
  it('200: the organiser edits a draft trip', async () => {
    const { agent } = await createTestUser(app);
    const detail = await createTripAs(agent);
    const res = await agent
      .patch(`/api/trips/${detail.id}`)
      .set(H)
      .send({ budgetTotalInr: 36000, radiusKm: 400 });
    expect(res.status).toBe(200);
    const updated = TripDetail.parse(res.body);
    expect(updated.budgetTotalInr).toBe(36000);
    expect(updated.radiusKm).toBe(400);
    expect(updated.title).toBe(detail.title);
  });

  it('403 for a plain member', async () => {
    const { agent } = await createTestUser(app);
    const member = await createTestUser(app);
    const detail = await createTripAs(agent);
    await db
      .insert(tripMember)
      .values({ tripId: detail.id, userId: member.userId, role: 'member' });
    const res = await member.agent
      .patch(`/api/trips/${detail.id}`)
      .set(H)
      .send({ title: 'Hijack' });
    expect(res.status).toBe(403);
    expect((res.body as ErrorEnvelope).error.code).toBe('FORBIDDEN');
  });

  it('403 for an excluded member with the removed message', async () => {
    const { agent } = await createTestUser(app);
    const excluded = await createTestUser(app);
    const detail = await createTripAs(agent);
    await db
      .insert(tripMember)
      .values({ tripId: detail.id, userId: excluded.userId, role: 'member', status: 'excluded' });
    const res = await excluded.agent
      .patch(`/api/trips/${detail.id}`)
      .set(H)
      .send({ title: 'Nope' });
    expect(res.status).toBe(403);
    expect((res.body as ErrorEnvelope).error.message).toBe(
      'You were removed from this trip, so you can only view it.',
    );
  });

  it('404 for a non-member', async () => {
    const { agent } = await createTestUser(app);
    const outsider = await createTestUser(app);
    const detail = await createTripAs(agent);
    const res = await outsider.agent
      .patch(`/api/trips/${detail.id}`)
      .set(H)
      .send({ title: 'Nope' });
    expect(res.status).toBe(404);
    expect((res.body as ErrorEnvelope).error.code).toBe('NOT_FOUND');
  });

  it('409 TRIP_NOT_EDITABLE once the trip is collecting_preferences', async () => {
    const { agent } = await createTestUser(app);
    const detail = await createTripAs(agent);
    await setTripStatus(db, detail.id, 'collecting_preferences');
    const res = await agent.patch(`/api/trips/${detail.id}`).set(H).send({ title: 'Too late' });
    expect(res.status).toBe(409);
    expect((res.body as ErrorEnvelope).error).toMatchObject({
      code: 'TRIP_NOT_EDITABLE',
      message: 'Trip details can be changed only before anyone is invited.',
    });
  });

  it('400 for an empty body', async () => {
    const { agent } = await createTestUser(app);
    const detail = await createTripAs(agent);
    const res = await agent.patch(`/api/trips/${detail.id}`).set(H).send({});
    expect(res.status).toBe(400);
    expect((res.body as ErrorEnvelope).error.code).toBe('VALIDATION_ERROR');
  });

  it('401 without a session', async () => {
    const { agent } = await createTestUser(app);
    const detail = await createTripAs(agent);
    const res = await request(app).patch(`/api/trips/${detail.id}`).set(H).send({ title: 'Nope' });
    expect(res.status).toBe(401);
  });
});
