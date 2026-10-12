import { Writable } from 'node:stream';
import { createDb } from '@bonvoyage/db';
import { pino } from 'pino';
import { InvitationResponse } from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { ensureHub } from '../test/helpers';

// S1-6 step 4 (SRS 3.5): request logs never hold a password, a cookie, an
// email or a budget. The log is captured into memory at info level.

const lines: string[] = [];
const sink = new Writable({
  write(chunk: Buffer, _enc, done) {
    lines.push(chunk.toString('utf8'));
    done();
  },
});

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({
  db,
  pool,
  logger: pino({ level: 'info' }, sink),
  auth,
  clock: () => new Date('2026-11-01T06:30:00Z'),
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

const EMAIL = `logcheck-${Date.now().toString(36)}@test.bv`;
const PASSWORD = 'log-check-password-42';
const BUDGET = 987653;
let cookie = '';
let userId = '';

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
  const agent = request.agent(app);
  await agent
    .post('/api/auth/sign-up/email')
    .set(H)
    .send({ email: EMAIL, password: PASSWORD, name: 'Log Check' });
  await agent.post('/api/auth/sign-out').set(H).send({});
  const signIn = await agent
    .post('/api/auth/sign-in/email')
    .set(H)
    .send({ email: EMAIL, password: PASSWORD });
  const setCookie = signIn.headers['set-cookie'] as unknown as string[] | undefined;
  // The session token itself: name=value, without the attributes.
  cookie = (setCookie?.[0] ?? '').split(';')[0]!.split('=').slice(1).join('=');
  userId = ((await agent.get('/api/me').set(H)).body as { id: string }).id;

  const trip = await agent.post('/api/trips').set(H).send({
    title: 'Log trip',
    originHubSlug: 'test-hub',
    durationNights: 2,
    budgetTotalInr: 20000,
    radiusKm: 300,
  });
  const tripId = (trip.body as { id: string }).id;
  InvitationResponse.parse(
    (await agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  );
  const saved = await agent
    .put(`/api/trips/${tripId}/preferences/me`)
    .set(H)
    .send({
      destinationTypes: ['mountain'],
      activities: ['trekking'],
      climate: 'cold',
      travelStyle: 'budget',
      budgetMinInr: 1000,
      budgetMaxInr: BUDGET,
      dateStart: '2026-11-13',
      dateEnd: '2026-11-16',
    });
  expect(saved.status).toBe(200);
});

afterAll(async () => {
  await pool.end();
});

describe('request logs', () => {
  it('captured the requests it is checking', () => {
    const output = lines.join('');
    expect(output).toContain('/api/auth/sign-in/email');
    expect(output).toContain('/preferences/me');
    expect(cookie.length).toBeGreaterThan(10);
  });

  it('hold no password, cookie, email or budget', () => {
    const output = lines.join('');
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain(cookie);
    expect(output).not.toContain(EMAIL);
    expect(output).not.toContain(String(BUDGET));
    expect(output.toLowerCase()).not.toContain('set-cookie');
  });

  it('name the signed-in user by id', () => {
    const own = lines.map((l) => JSON.parse(l) as { userId?: string; req?: { url?: string } });
    const prefLine = own.find((l) => l.req?.url?.includes('/preferences/me'));
    expect(prefLine?.userId).toBe(userId);
  });
});
