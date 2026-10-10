import { createDb } from '@bonvoyage/db';
import type { Db } from '@bonvoyage/db';
import { ErrorEnvelope } from '@bonvoyage/shared';
import type { Pool } from 'pg';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app';

const logger = pino({ level: 'silent' });
const live = createDb(process.env.DATABASE_URL ?? '');
const dead = createDb('postgres://bonvoyage:bonvoyage@127.0.0.1:1/x');

function appWith(handle: { db: Db; pool: Pool }) {
  return createApp({ db: handle.db, pool: handle.pool, logger });
}

afterAll(async () => {
  await live.pool.end();
  await dead.pool.end();
});

describe('GET /api/health', () => {
  it('returns 200 with the exact body and a request id', async () => {
    const res = await request(appWith(live)).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a valid incoming x-request-id', async () => {
    const res = await request(appWith(live)).get('/api/health').set('x-request-id', 'abc-12345678');
    expect(res.headers['x-request-id']).toBe('abc-12345678');
  });

  it('replaces an invalid incoming x-request-id', async () => {
    const res = await request(appWith(live)).get('/api/health').set('x-request-id', 'bad id!');
    expect(res.headers['x-request-id']).not.toBe('bad id!');
    expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('returns 503 DB_UNAVAILABLE when the database is unreachable', async () => {
    const res = await request(appWith(dead)).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'DB_UNAVAILABLE', message: 'The database is not reachable.' },
    });
  });
});

describe('error handling', () => {
  it('returns the 404 envelope for unknown routes', async () => {
    const res = await request(appWith(live)).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'No route for GET /api/nope.' },
    });
  });

  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await request(appWith(live))
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(ErrorEnvelope.parse(res.body).error.code).toBe('INVALID_JSON');
  });

  it('returns 413 PAYLOAD_TOO_LARGE for a 150 kB body', async () => {
    const res = await request(appWith(live))
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(150_000) }));
    expect(res.status).toBe(413);
    expect(ErrorEnvelope.parse(res.body).error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
