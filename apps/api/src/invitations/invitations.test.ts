import { createDb } from '@bonvoyage/db';
import { invitation, trip, tripMember, tripTransition } from '@bonvoyage/db/schema';
import { user } from '@bonvoyage/db/schema/auth';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  AcceptInvitationResponse,
  ActiveInvitationResponse,
  InvitationPreview,
  InvitationResponse,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser, createTripAs, ensureHub, setTripStatus } from '../test/helpers';

// S1-3: invitation link, preview and accept. Sign-up goes through the real
// auth route; extra roster rows and non-draft states are arranged directly.

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger, auth });
// Same database, clock 15 days ahead: every link made "now" has expired.
const later = createApp({
  db,
  pool,
  logger,
  auth,
  clock: () => new Date(Date.now() + 15 * 86_400_000),
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };
const PASSWORD = 'test-password-12+';

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
});

afterAll(async () => {
  await pool.end();
});

const codeOf = (res: request.Response) => (res.body as ErrorEnvelope).error.code;

let seq = 0;
/** Roster filler: a user row plus an active member row, no session needed. */
async function addMembers(tripId: string, n: number, name = 'Filler') {
  for (let i = 0; i < n; i++) {
    const id = `inv-filler-${Date.now().toString(36)}-${seq++}`;
    await db.insert(user).values({ id, name, email: `${id}@test.bv` });
    await db.insert(tripMember).values({ tripId, userId: id, role: 'member' });
  }
}

async function organiserWithTrip(overrides: Parameters<typeof createTripAs>[1] = {}) {
  const org = await createTestUser(app, 'Asha Organiser');
  const detail = await createTripAs(org.agent, overrides);
  return { ...org, tripId: detail.id };
}

const invite = (agent: request.Agent, tripId: string) =>
  agent.post(`/api/trips/${tripId}/invitations`).set(H);

async function openTrip() {
  const org = await organiserWithTrip();
  const res = await invite(org.agent, org.tripId);
  const inv = InvitationResponse.parse(res.body);
  return { ...org, token: inv.token };
}

const transitionsOf = (tripId: string) =>
  db.select().from(tripTransition).where(eq(tripTransition.tripId, tripId));

const accept = (agent: request.Agent, token: string) =>
  agent.post(`/api/invitations/${token}/accept`).set(H);

describe('POST /api/trips/:id/invitations', () => {
  it('201 in draft: one T2 row, trip collecting; a second POST returns the same token', async () => {
    const { agent, tripId } = await organiserWithTrip();
    const before = Date.now();
    const first = await invite(agent, tripId);
    expect(first.status).toBe(201);
    const inv = InvitationResponse.parse(first.body);
    expect(inv.status).toBe('active');
    expect(inv.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const ttl = new Date(inv.expiresAt).getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(14 * 86_400_000 - 5_000);
    expect(ttl).toBeLessThanOrEqual(14 * 86_400_000 + 5_000);

    const [t] = await db.select().from(trip).where(eq(trip.id, tripId));
    expect(t!.status).toBe('collecting_preferences');
    const t2 = (await transitionsOf(tripId)).filter((r) => r.transitionId === 'T2');
    expect(t2).toHaveLength(1);

    const second = await invite(agent, tripId);
    expect(second.status).toBe(200);
    expect(InvitationResponse.parse(second.body).token).toBe(inv.token);
    expect((await transitionsOf(tripId)).filter((r) => r.transitionId === 'T2')).toHaveLength(1);
  });

  it('two concurrent first POSTs give one T2 row and the same token', async () => {
    const org = await organiserWithTrip();
    const second = request.agent(app);
    await second.post('/api/auth/sign-in/email').set(H).send({
      email: org.email,
      password: PASSWORD,
    });
    const results = await Promise.allSettled([
      invite(org.agent, org.tripId),
      invite(second, org.tripId),
    ]);
    const responses = results.map((r) => {
      if (r.status !== 'fulfilled') throw new Error('request failed');
      return r.value;
    });
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    const tokens = responses.map((r) => InvitationResponse.parse(r.body).token);
    expect(tokens[0]).toBe(tokens[1]);
    expect((await transitionsOf(org.tripId)).filter((r) => r.transitionId === 'T2')).toHaveLength(
      1,
    );
    expect(
      await db.select().from(invitation).where(eq(invitation.tripId, org.tripId)),
    ).toHaveLength(1);
  });

  it('201 with a new token after the link was turned off, and no new transition', async () => {
    const { agent, tripId, token } = await openTrip();
    await agent.delete(`/api/trips/${tripId}/invitations/active`).set(H);
    const res = await invite(agent, tripId);
    expect(res.status).toBe(201);
    expect(InvitationResponse.parse(res.body).token).not.toBe(token);
    expect(await transitionsOf(tripId)).toHaveLength(2); // T1, T2
  });

  it('409 INVITATIONS_CLOSED once preferences have closed', async () => {
    const { agent, tripId } = await openTrip();
    await setTripStatus(db, tripId, 'shortlisted');
    const res = await invite(agent, tripId);
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('INVITATIONS_CLOSED');
    expect((res.body as ErrorEnvelope).error.message).toBe(
      'This trip is no longer taking new members.',
    );
  });

  it('400 for a bad id, 401 without a session, 404 for a non-member, 403 for a member', async () => {
    const { tripId, token } = await openTrip();
    const outsider = await createTestUser(app);
    const bad = await invite(outsider.agent, 'not-a-uuid');
    expect(bad.status).toBe(400);
    expect((bad.body as ErrorEnvelope).error.fields).toEqual({ id: 'must be a uuid' });
    expect((await request(app).post(`/api/trips/${tripId}/invitations`).set(H)).status).toBe(401);
    const nonMember = await invite(outsider.agent, tripId);
    expect(nonMember.status).toBe(404);
    expect(codeOf(nonMember)).toBe('NOT_FOUND');
    await accept(outsider.agent, token);
    const member = await invite(outsider.agent, tripId);
    expect(member.status).toBe(403);
    expect(codeOf(member)).toBe('FORBIDDEN');
  });
});

describe('GET and DELETE /api/trips/:id/invitations/active', () => {
  it('null in draft, the link once created, null again after turning it off (twice is fine)', async () => {
    const { agent, tripId } = await organiserWithTrip();
    const path = `/api/trips/${tripId}/invitations/active`;
    const empty = await agent.get(path).set(H);
    expect(empty.status).toBe(200);
    expect(ActiveInvitationResponse.parse(empty.body)).toEqual({ invitation: null });

    const created = InvitationResponse.parse((await invite(agent, tripId)).body);
    const active = ActiveInvitationResponse.parse((await agent.get(path).set(H)).body);
    expect(active.invitation?.token).toBe(created.token);

    expect((await agent.delete(path).set(H)).status).toBe(204);
    expect((await agent.delete(path).set(H)).status).toBe(204);
    const after = ActiveInvitationResponse.parse((await agent.get(path).set(H)).body);
    expect(after.invitation).toBeNull();
    const rows = await db.select().from(invitation).where(eq(invitation.tripId, tripId));
    expect(rows.map((r) => r.status)).toEqual(['revoked']);
  });

  it('an expired link is not active', async () => {
    const { tripId, email } = await openTrip();
    const agent = request.agent(later);
    await agent.post('/api/auth/sign-in/email').set(H).send({ email, password: PASSWORD });
    const res = await agent.get(`/api/trips/${tripId}/invitations/active`).set(H);
    expect(ActiveInvitationResponse.parse(res.body)).toEqual({ invitation: null });
  });

  it('401, 400, 404 for a non-member and 403 for a member on both verbs', async () => {
    const { tripId, token } = await openTrip();
    const path = `/api/trips/${tripId}/invitations/active`;
    expect((await request(app).get(path).set(H)).status).toBe(401);
    expect((await request(app).delete(path).set(H)).status).toBe(401);
    const outsider = await createTestUser(app);
    expect((await outsider.agent.get('/api/trips/nope/invitations/active').set(H)).status).toBe(
      400,
    );
    expect((await outsider.agent.get(path).set(H)).status).toBe(404);
    expect((await outsider.agent.delete(path).set(H)).status).toBe(404);
    await accept(outsider.agent, token);
    expect((await outsider.agent.get(path).set(H)).status).toBe(403);
    expect((await outsider.agent.delete(path).set(H)).status).toBe(403);
  });
});

describe('GET /api/invitations/:token', () => {
  it('previews an open link signed out, with no budget, dates, emails or member names', async () => {
    const { tripId, token, email } = await openTrip();
    await addMembers(tripId, 1, 'Zephyrine Quill');
    const res = await request(app).get(`/api/invitations/${token}`).set(H);
    expect(res.status).toBe(200);
    expect(InvitationPreview.parse(res.body)).toEqual({
      tripTitle: 'Test trip',
      organiserName: 'Asha Organiser',
      memberCount: 2,
      maxMembers: 8,
      state: 'open',
      alreadyMember: false,
    });
    const raw = res.text;
    for (const leak of [
      'budget',
      '20000',
      'Date',
      'date',
      email,
      '@',
      'Zephyrine',
      'Filler',
      'userId',
    ]) {
      expect(raw).not.toContain(leak);
    }
  });

  it('alreadyMember is true for a signed-in active member', async () => {
    const { agent, token } = await openTrip();
    const res = await agent.get(`/api/invitations/${token}`).set(H);
    expect(InvitationPreview.parse(res.body).alreadyMember).toBe(true);
  });

  it('states: revoked, expired, closed and full', async () => {
    const revoked = await openTrip();
    await revoked.agent.delete(`/api/trips/${revoked.tripId}/invitations/active`).set(H);
    const r1 = await request(app).get(`/api/invitations/${revoked.token}`).set(H);
    expect(InvitationPreview.parse(r1.body).state).toBe('revoked');

    const expired = await openTrip();
    const r2 = await request(later).get(`/api/invitations/${expired.token}`).set(H);
    expect(InvitationPreview.parse(r2.body).state).toBe('expired');

    const closed = await openTrip();
    await setTripStatus(db, closed.tripId, 'ready_for_recommendation');
    const r3 = await request(app).get(`/api/invitations/${closed.token}`).set(H);
    expect(InvitationPreview.parse(r3.body).state).toBe('closed');

    const full = await openTrip();
    await addMembers(full.tripId, 7);
    const r4 = await request(app).get(`/api/invitations/${full.token}`).set(H);
    expect(InvitationPreview.parse(r4.body)).toMatchObject({ state: 'full', memberCount: 8 });
  });

  it('404 "This invitation link is not valid." for an unknown or malformed token', async () => {
    for (const token of ['A'.repeat(32), 'bad token!']) {
      const res = await request(app)
        .get(`/api/invitations/${encodeURIComponent(token)}`)
        .set(H);
      expect(res.status).toBe(404);
      expect((res.body as ErrorEnvelope).error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'This invitation link is not valid.',
      });
    }
  });
});

describe('POST /api/invitations/:token/accept', () => {
  it('200 joins as an active member; accepting again is idempotent', async () => {
    const { tripId, token } = await openTrip();
    const guest = await createTestUser(app, 'Rohan');
    const first = await accept(guest.agent, token);
    expect(first.status).toBe(200);
    expect(AcceptInvitationResponse.parse(first.body)).toEqual({ tripId });
    const again = await accept(guest.agent, token);
    expect(again.status).toBe(200);
    const rows = await db
      .select()
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, guest.userId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'member', status: 'active' });
    // Joining is not a state-machine event.
    expect(await transitionsOf(tripId)).toHaveLength(2);
  });

  it('410 INVITATION_EXPIRED for a revoked link and for a link past its expiry', async () => {
    const revoked = await openTrip();
    await revoked.agent.delete(`/api/trips/${revoked.tripId}/invitations/active`).set(H);
    const guest = await createTestUser(app);
    const r1 = await accept(guest.agent, revoked.token);
    expect(r1.status).toBe(410);
    expect((r1.body as ErrorEnvelope).error).toMatchObject({
      code: 'INVITATION_EXPIRED',
      message: 'This link has expired or was turned off. Ask the organiser for a new one.',
    });

    const expired = await openTrip();
    const lateGuest = request.agent(later);
    await lateGuest
      .post('/api/auth/sign-in/email')
      .set(H)
      .send({ email: guest.email, password: PASSWORD });
    const r2 = await accept(lateGuest, expired.token);
    expect(r2.status).toBe(410);
    expect(codeOf(r2)).toBe('INVITATION_EXPIRED');
  });

  it('409 INVITATIONS_CLOSED when the trip is no longer collecting preferences', async () => {
    const { tripId, token } = await openTrip();
    await setTripStatus(db, tripId, 'shortlisted');
    const guest = await createTestUser(app);
    const res = await accept(guest.agent, token);
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('INVITATIONS_CLOSED');
  });

  it('409 MEMBER_EXCLUDED for a removed member', async () => {
    const { agent, tripId, token } = await openTrip();
    const guest = await createTestUser(app);
    await accept(guest.agent, token);
    await agent.delete(`/api/trips/${tripId}/members/${guest.userId}`).set(H);
    const res = await accept(guest.agent, token);
    expect(res.status).toBe(409);
    expect(codeOf(res)).toBe('MEMBER_EXCLUDED');
  });

  it('with 7 active members, two users accepting at once: one 200 and one 422 TRIP_FULL', async () => {
    const { tripId, token } = await openTrip();
    await addMembers(tripId, 6);
    const a = await createTestUser(app);
    const b = await createTestUser(app);
    const results = await Promise.allSettled([accept(a.agent, token), accept(b.agent, token)]);
    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 0));
    expect(statuses.sort()).toEqual([200, 422]);
    const loser = results
      .map((r) => (r.status === 'fulfilled' ? r.value : undefined))
      .find((r) => r?.status === 422);
    expect((loser!.body as ErrorEnvelope).error.code).toBe('TRIP_FULL');
    const active = await db
      .select()
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.status, 'active')));
    expect(active).toHaveLength(8);
  });

  it('401 without a session and 404 for an unknown token', async () => {
    const { token } = await openTrip();
    expect((await request(app).post(`/api/invitations/${token}/accept`).set(H)).status).toBe(401);
    const guest = await createTestUser(app);
    const res = await accept(guest.agent, 'B'.repeat(32));
    expect(res.status).toBe(404);
    expect(codeOf(res)).toBe('NOT_FOUND');
  });
});
