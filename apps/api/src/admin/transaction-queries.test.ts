import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb } from '@bonvoyage/db';
import type { CatalogueFiles } from '@bonvoyage/shared';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importCatalogueFiles } from './service';

// #118: pg deprecates a second query on a client that is still busy, and pg 9
// makes it an error. A transaction is one client, so the import must never run
// its queries in parallel. Node prints a deprecation once per process, and each
// integration file runs in its own process, so this file imports first.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const DIR = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
const read = (f: string) => readFileSync(resolve(DIR, f), 'utf8');
const REAL: CatalogueFiles = {
  hubs: read('hubs.csv'),
  destinations: read('destinations.csv'),
  fares: read('fares.csv'),
  pois: read('pois.csv'),
  costRules: read('cost-rules.json'),
};

const warnings: string[] = [];
const onWarning = (w: Error) => warnings.push(`${w.name}: ${w.message}`);

beforeEach(() => {
  warnings.length = 0;
  process.on('warning', onWarning);
});
afterEach(() => {
  process.off('warning', onWarning);
});
afterAll(async () => {
  await pool.end();
});

describe('queries on a transaction client run one after another (#118)', () => {
  it('a catalogue import raises no "already executing" warning', async () => {
    const deps = { db, logger: pino({ level: 'silent' }), clock: () => new Date() };
    // A dry run rolls back, so the shared test database is left as it was.
    const res = await importCatalogueFiles(deps, 'guard-test', { files: REAL, dryRun: true });
    expect(res.stages).toHaveLength(4);
    // process.emitWarning dispatches on a later tick.
    await new Promise((r) => setImmediate(r));
    expect(warnings.filter((w) => w.includes('already executing'))).toEqual([]);
  });
});
