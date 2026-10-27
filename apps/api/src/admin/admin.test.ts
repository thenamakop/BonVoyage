import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import { createDb } from '@bonvoyage/db';
import { destination } from '@bonvoyage/db/schema';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  CatalogueImportResponse,
  CatalogueInvalidDetails,
  CatalogueStatusResponse,
  MeResponse,
  type CatalogueFiles,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser } from '../test/helpers';

// S1-7: POST /api/admin/catalogue/import and GET /api/admin/catalogue/status.
// The tests import the real catalogue first, so they do not depend on what
// the shared test database already holds.

const ADMIN_EMAIL = `cat-admin-${Date.now().toString(36)}@test.bv`;
const logLines: string[] = [];
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({
  db,
  pool,
  logger: pino(
    { level: 'info' },
    new Writable({
      write(chunk: Buffer, _enc, done) {
        logLines.push(chunk.toString('utf8'));
        done();
      },
    }),
  ),
  auth,
  // As parseEnv leaves it: trimmed and lowercased.
  adminEmails: [ADMIN_EMAIL],
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

const DIR = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
const read = (f: string) => readFileSync(resolve(DIR, f), 'utf8');
const REAL: CatalogueFiles = {
  hubs: read('hubs.csv'),
  destinations: read('destinations.csv'),
  fares: read('fares.csv'),
  pois: read('pois.csv'),
  costRules: read('cost-rules.json'),
};
// The second data row of destinations.csv is "auli,Auli,..." or similar: take
// whatever the first destination is and give it a new name.
const firstDest = REAL.destinations.split('\n')[1]!.split(',');
const SLUG = firstDest[0]!;
const NAME = firstDest[1]!;
const RENAMED: CatalogueFiles = {
  ...REAL,
  destinations: REAL.destinations.replace(`\n${SLUG},${NAME},`, `\n${SLUG},${NAME} Renamed,`),
};

let admin: request.Agent;
let other: request.Agent;

const importFiles = (agent: request.Agent, files: CatalogueFiles, dryRun: boolean) =>
  agent.post('/api/admin/catalogue/import').set(H).send({ files, dryRun });
const nameInDb = async () =>
  (
    await db.select({ name: destination.name }).from(destination).where(eq(destination.slug, SLUG))
  )[0]?.name;

beforeAll(async () => {
  // Mixed case on sign-up: the allowlist match ignores case.
  admin = (await createTestUser(app, 'Catalogue Admin', ADMIN_EMAIL.toUpperCase())).agent;
  other = (await createTestUser(app, 'Not An Admin')).agent;
  const first = await importFiles(admin, REAL, false);
  expect(first.status).toBe(200);
});

afterAll(async () => {
  await importFiles(admin, REAL, false);
  await pool.end();
});

describe('who may use the administrator routes', () => {
  it('anonymous 401, a signed-in non-administrator 403, the administrator 200', async () => {
    for (const [method, path] of [
      ['get', '/api/admin/catalogue/status'],
      ['post', '/api/admin/catalogue/import'],
    ] as const) {
      const body = { files: REAL, dryRun: true };
      const anon = await request(app)[method](path).set(H).send(body);
      expect(anon.status, `${path} anonymous`).toBe(401);
      const denied = await other[method](path).set(H).send(body);
      expect(denied.status, `${path} non-admin`).toBe(403);
      expect((denied.body as ErrorEnvelope).error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Only administrators can do this.',
      });
      expect((await admin[method](path).set(H).send(body)).status, `${path} admin`).toBe(200);
    }
  });

  it('GET /api/me says isAdmin true only for the listed email, whatever its case', async () => {
    expect(MeResponse.parse((await admin.get('/api/me').set(H)).body).isAdmin).toBe(true);
    expect(MeResponse.parse((await other.get('/api/me').set(H)).body).isAdmin).toBe(false);
  });

  it('a non-JSON POST still gets 415 before anything else', async () => {
    const res = await admin
      .post('/api/admin/catalogue/import')
      .set(H)
      .set('Content-Type', 'text/plain')
      .send('x');
    expect(res.status).toBe(415);
  });
});

describe('POST /api/admin/catalogue/import', () => {
  it('re-importing the same files changes nothing: 0 inserted, 0 updated', async () => {
    const res = await importFiles(admin, REAL, false);
    const body = CatalogueImportResponse.parse(res.body);
    for (const c of Object.values(body.counts)) expect(c).toEqual({ inserted: 0, updated: 0 });
    expect(body.issues.every((i) => i.severity !== 'error')).toBe(true);
    expect(body.stages.map((s) => s.stage)).toEqual(['a', 'b1', 'b2', 'c']);
  });

  it('a dry run with one renamed destination reports updated 1 and writes nothing', async () => {
    const res = await importFiles(admin, RENAMED, true);
    const body = CatalogueImportResponse.parse(res.body);
    expect(body.dryRun).toBe(true);
    expect(body.counts.destination).toEqual({ inserted: 0, updated: 1 });
    expect(body.counts.hub).toEqual({ inserted: 0, updated: 0 });
    expect(await nameInDb()).toBe(NAME);
  });

  it('the same files with dryRun false change the value; again gives 0 updated', async () => {
    const first = CatalogueImportResponse.parse((await importFiles(admin, RENAMED, false)).body);
    expect(first.counts.destination.updated).toBe(1);
    expect(await nameInDb()).toBe(`${NAME} Renamed`);
    const again = CatalogueImportResponse.parse((await importFiles(admin, RENAMED, false)).body);
    expect(again.counts.destination.updated).toBe(0);
    await importFiles(admin, REAL, false);
    expect(await nameInDb()).toBe(NAME);
  });

  it('a bad destinations header is 422 CATALOGUE_INVALID with an issue on line 1', async () => {
    const res = await importFiles(admin, { ...REAL, destinations: 'slug,name\nx,y\n' }, true);
    expect(res.status).toBe(422);
    const envelope = res.body as ErrorEnvelope;
    expect(envelope.error.code).toBe('CATALOGUE_INVALID');
    expect(envelope.error.message).toBe('The files have errors. Fix them and check again.');
    const { issues } = CatalogueInvalidDetails.parse(envelope.error.details);
    expect(issues).toContainEqual(
      expect.objectContaining({ file: 'destinations.csv', line: 1, severity: 'error' }),
    );
  });

  it('an out-of-range latitude is reported with its line number, errors first', async () => {
    const lines = REAL.hubs.split('\n');
    const cells = lines[2]!.split(',');
    cells[3] = '99.9';
    lines[2] = cells.join(',');
    const res = await importFiles(admin, { ...REAL, hubs: lines.join('\n') }, true);
    expect(res.status).toBe(422);
    const { issues } = CatalogueInvalidDetails.parse((res.body as ErrorEnvelope).error.details);
    expect(issues[0]).toMatchObject({
      file: 'hubs.csv',
      line: 3,
      column: 'lat',
      severity: 'error',
    });
  });

  it('logs the admin and the counts, never the file contents', () => {
    const lines = logLines.filter((l) => l.includes('"catalogue import"'));
    expect(lines.length).toBeGreaterThan(0);
    const last = JSON.parse(lines.at(-1)!) as {
      adminUserId?: string;
      dryRun?: boolean;
      counts?: object;
    };
    expect(last.adminUserId).toBeTruthy();
    expect(typeof last.dryRun).toBe('boolean');
    expect(last.counts).toBeTruthy();
    expect(logLines.join('')).not.toContain(NAME + ' Renamed');
    expect(logLines.join('')).not.toContain('source_url');
  });
});

describe('body size limits', () => {
  it('over 2 MB to the import is 413 PAYLOAD_TOO_LARGE in the envelope', async () => {
    const big = { ...REAL, pois: 'x'.repeat(2_200_000) };
    const res = await importFiles(admin, big, true);
    expect(res.status).toBe(413);
    expect((res.body as ErrorEnvelope).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('200 KB to any other route still meets the global limit (413)', async () => {
    const res = await admin
      .post('/api/trips')
      .set(H)
      .send({ title: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect((res.body as ErrorEnvelope).error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('GET /api/admin/catalogue/status', () => {
  it('counts rows, reports stage progress and the last update', async () => {
    const res = await admin.get('/api/admin/catalogue/status').set(H);
    const status = CatalogueStatusResponse.parse(res.body);
    expect(status.tables.hub).toBeGreaterThanOrEqual(6);
    expect(status.tables.destination).toBeGreaterThanOrEqual(44);
    expect(status.stages).toEqual([
      expect.objectContaining({ stage: 'a', dueDate: '2026-10-26' }),
      expect.objectContaining({ stage: 'b1', dueDate: '2026-11-01' }),
      expect.objectContaining({ stage: 'b2', dueDate: '2026-11-05' }),
      expect.objectContaining({ stage: 'c', dueDate: '2026-11-01' }),
    ]);
    for (const s of status.stages) expect(s.verified).toBeLessThanOrEqual(s.total);
    expect(status.lastUpdatedAt).not.toBeNull();
  });
});
