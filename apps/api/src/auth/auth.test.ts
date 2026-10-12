import { createDb } from '@bonvoyage/db';
import { account, user } from '@bonvoyage/db/schema/auth';
import { ERROR_CODES } from '@bonvoyage/shared';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from './auth';

// S0-5: auth round trip through the same allowedHosts the server uses; the
// Host/Origin pair matches what the Vite proxy sends.

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger, auth });

const PASSWORD = 'test-password-12+';
const agent = () => {
  const a = request.agent(app);
  return {
    post: (path: string) =>
      a.post(path).set('Host', 'localhost:5173').set('Origin', 'http://localhost:5173'),
    get: (path: string) =>
      a.get(path).set('Host', 'localhost:5173').set('Origin', 'http://localhost:5173'),
  };
};

const EMAIL = `auth-${Date.now()}@test.bv`;

afterAll(async () => {
  await pool.end();
});

describe('auth + /api/me', () => {
  it('signs up, then GET /api/me returns the user', async () => {
    const a = agent();
    const signUp = await a.post('/api/auth/sign-up/email').send({
      email: EMAIL,
      password: PASSWORD,
      name: 'Tester',
    });
    expect(signUp.status).toBe(200);
    const me = await a.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: EMAIL, name: 'Tester', homeHubSlug: null });
  });

  it('after sign out GET /api/me is 401 with the UNAUTHENTICATED envelope', async () => {
    const a = agent();
    await a.post('/api/auth/sign-up/email').send({
      email: `auth2-${Date.now()}@test.bv`,
      password: PASSWORD,
      name: 'Second',
    });
    await a.post('/api/auth/sign-out');
    const me = await a.get('/api/me');
    expect(me.status).toBe(401);
    expect(me.body).toEqual({
      error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Sign in to continue.' },
    });
  });

  it('refuses a duplicate email and stores no second user', async () => {
    const a = agent();
    const again = await a.post('/api/auth/sign-up/email').send({
      email: EMAIL,
      password: PASSWORD,
      name: 'Dup',
    });
    expect(again.status).toBeGreaterThanOrEqual(400);
    const rows = await db.select().from(user).where(eq(user.email, EMAIL));
    expect(rows).toHaveLength(1);
  });

  it('the stored password differs from the plain text', async () => {
    const rows = await db.select().from(account).where(eq(account.providerId, 'credential'));
    const mine = rows.find((r) => r.accountId !== null);
    expect(mine?.password).toBeTruthy();
    expect(mine?.password).not.toBe(PASSWORD);
  });

  it('GET /api/me with no cookie is 401', async () => {
    const res = await agent().get('/api/me');
    expect(res.status).toBe(401);
  });
});
