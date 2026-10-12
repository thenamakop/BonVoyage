import { createDb } from '@bonvoyage/db';
import { hub, trip, tripMember, tripTransition } from '@bonvoyage/db/schema';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { indiaDate, type ErrorEnvelope } from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';

// POST /api/trips/:id/cancel (RUNBOOK B3: T15/T16). Sign-up goes through the
// real auth route; trip rows are written directly to arrange states.

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger, auth });

let seq = 0;
// Both dates are India dates, as the T16 guard compares them (rule 7); a UTC
// "tomorrow" equals India's "today" between 18:30 and 24:00 UTC.
const tomorrow = () => indiaDate(new Date(Date.now() + 86_400_000));
const today = () => indiaDate(new Date());

async function signUp() {
  const a = request.agent(app);
  const email = `cancel-${seq++}@test.bv`;
  await a
    .post('/api/auth/sign-up/email')
    .set('Host', 'localhost:5173')
    .set('Origin', 'http://localhost:5173')
    .send({ email, password: 'test-password-12+', name: 'T' });
  const me = await a
    .get('/api/me')
    .set('Host', 'localhost:5173')
    .set('Origin', 'http://localhost:5173');
  return { agent: a, userId: (me.body as { id: string }).id };
}

async function makeTrip(
  status: string,
  opts: { organiserId?: string; startDate?: string } = {},
): Promise<string> {
  const [h] = await db
    .insert(hub)
    .values({
      slug: `cx-hub-${seq}`,
      name: 'H',
      state: 'S',
      lat: 28,
      lng: 77,
      collectedOn: '2026-10-12',
      reviewStatus: 'draft',
    })
    .returning({ id: hub.id });
  seq++;
  const [t] = await db
    .insert(trip)
    .values({
      title: 'T',
      organiserId: opts.organiserId ?? (await signUp()).userId,
      originHubId: h!.id,
      durationNights: 2,
      budgetTotalInr: 10000,
      radiusKm: 400,
      status: status as 'draft',
      startDate: opts.startDate,
    })
    .returning({ id: trip.id });
  return t!.id;
}

const cancel = (a: request.Agent, id: string) =>
  a
    .post(`/api/trips/${id}/cancel`)
    .set('Host', 'localhost:5173')
    .set('Origin', 'http://localhost:5173')
    .send({});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/trips/:id/cancel', () => {
  it('the organiser cancels a draft trip (T15), a second call is 409 TRIP_CLOSED', async () => {
    const { agent, userId } = await signUp();
    const tripId = await makeTrip('draft', { organiserId: userId });
    await db.insert(tripMember).values({ tripId, userId, role: 'organiser' });
    const first = await cancel(agent, tripId);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ id: tripId, status: 'cancelled' });
    const rows = await db.select().from(tripTransition).where(eq(tripTransition.tripId, tripId));
    expect(rows.map((r) => r.transitionId)).toEqual(['T15']);
    const second = await cancel(agent, tripId);
    expect(second.status).toBe(409);
    expect((second.body as ErrorEnvelope).error.code).toBe('TRIP_CLOSED');
  });

  it('a plain member gets 403', async () => {
    const { userId: organiserId } = await signUp();
    const tripId = await makeTrip('draft', { organiserId });
    const member = await signUp();
    await db.insert(tripMember).values({ tripId, userId: member.userId, role: 'member' });
    const res = await cancel(member.agent, tripId);
    expect(res.status).toBe(403);
    expect((res.body as ErrorEnvelope).error.code).toBe('FORBIDDEN');
  });

  it('a signed-in non-member gets 404', async () => {
    const tripId = await makeTrip('draft');
    const outsider = await signUp();
    const res = await cancel(outsider.agent, tripId);
    expect(res.status).toBe(404);
    expect((res.body as ErrorEnvelope).error.code).toBe('NOT_FOUND');
  });

  it('a bad id gives 400', async () => {
    const { agent } = await signUp();
    const res = await cancel(agent, 'not-a-uuid');
    expect(res.status).toBe(400);
    expect((res.body as ErrorEnvelope).error).toMatchObject({
      code: 'VALIDATION_ERROR',
      fields: { id: 'must be a uuid' },
    });
  });

  it('a finalised trip starting tomorrow cancels through T16', async () => {
    const { agent, userId } = await signUp();
    const tripId = await makeTrip('finalised', { organiserId: userId, startDate: tomorrow() });
    await db.insert(tripMember).values({ tripId, userId, role: 'organiser' });
    const res = await cancel(agent, tripId);
    expect(res.status).toBe(200);
    const rows = await db.select().from(tripTransition).where(eq(tripTransition.tripId, tripId));
    expect(rows[0]!.transitionId).toBe('T16');
  });

  it('a finalised trip starting today is 409 GUARD_FAILED', async () => {
    const { agent, userId } = await signUp();
    const tripId = await makeTrip('finalised', { organiserId: userId, startDate: today() });
    await db.insert(tripMember).values({ tripId, userId, role: 'organiser' });
    const res = await cancel(agent, tripId);
    expect(res.status).toBe(409);
    expect((res.body as ErrorEnvelope).error.code).toBe('GUARD_FAILED');
  });
});
