import { createDb } from '@bonvoyage/db';
import { pino } from 'pino';
import { TripDetail, type ErrorEnvelope } from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser, createTripAs, ensureHub } from '../test/helpers';

// S1-6 step 5: POST, PUT and PATCH under /api accept only JSON, before any
// route or session check, so a cross-site form post never reaches a handler.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger: pino({ level: 'silent' }), auth });
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };
const BODY = {
  title: 'JSON trip',
  originHubSlug: 'test-hub',
  durationNights: 2,
  budgetTotalInr: 20000,
  radiusKm: 300,
};

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
});

afterAll(async () => {
  await pool.end();
});

const expect415 = (res: request.Response) => {
  expect(res.status).toBe(415);
  expect((res.body as ErrorEnvelope).error).toEqual({
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Send JSON with the header Content-Type: application/json.',
  });
};

describe('JSON-only writes', () => {
  it('415 for text/plain and form-encoded POSTs, even signed in', async () => {
    const { agent } = await createTestUser(app);
    expect415(await agent.post('/api/trips').set(H).set('Content-Type', 'text/plain').send('x'));
    expect415(await agent.post('/api/trips').set(H).type('form').send({ title: 'Form trip' }));
  });

  it('415 for a POST with no body at all, and for PUT and PATCH as text', async () => {
    const { agent } = await createTestUser(app);
    const trip = await createTripAs(agent);
    expect415(await agent.post(`/api/trips/${trip.id}/cancel`).set(H));
    expect415(
      await agent.patch(`/api/trips/${trip.id}`).set(H).set('Content-Type', 'text/plain').send('x'),
    );
    expect415(
      await agent
        .put(`/api/trips/${trip.id}/preferences/me`)
        .set(H)
        .set('Content-Type', 'text/plain')
        .send('x'),
    );
  });

  it('runs before the session check: an anonymous text/plain POST is 415, not 401', async () => {
    expect415(
      await request(app).post('/api/trips').set(H).set('Content-Type', 'text/plain').send('x'),
    );
  });

  it('accepts JSON, with or without a charset, and DELETE without a body', async () => {
    const { agent } = await createTestUser(app);
    const plain = await agent.post('/api/trips').set(H).send(BODY);
    expect(plain.status).toBe(201);
    const charset = await agent
      .post('/api/trips')
      .set(H)
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(JSON.stringify(BODY));
    expect(charset.status).toBe(201);
    const trip = TripDetail.parse(plain.body);
    await agent.post(`/api/trips/${trip.id}/invitations`).set(H).send({});
    expect((await agent.delete(`/api/trips/${trip.id}/invitations/active`).set(H)).status).toBe(
      204,
    );
  });

  it('leaves /api/auth to Better Auth (it takes form posts, which this rule would refuse)', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .set(H)
      .type('form')
      .send({ email: 'nobody@test.bv', password: 'wrong-password-123' });
    expect(res.status).not.toBe(415);
    expect(res.status).toBe(401);
  });
});
