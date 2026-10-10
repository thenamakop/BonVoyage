import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs, parseEnv } from 'node:util';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';
import { createDb } from '../src/client';
import {
  assertDirectRemote,
  countPending,
  imageMajor,
  isRemoteTarget,
  pickRemoteUrl,
  serverMajor,
} from '../src/remote';
import { describeTarget } from '../src/target';

const USAGE = 'Usage: pnpm db:migrate:remote --target preview|production [--status]';
const packageDir = resolve(import.meta.dirname, '..');
const repoRoot = resolve(packageDir, '../..');
const journalFile = resolve(packageDir, 'migrations/meta/_journal.json');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function journalCount(): number | null {
  if (!existsSync(journalFile)) return null;
  const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries?: unknown[] };
  return journal.entries?.length ?? 0;
}

async function recordedCount(pool: Pool): Promise<number> {
  try {
    const result = await pool.query<{ count: number }>(
      'select count(*)::int as count from drizzle.__drizzle_migrations',
    );
    return result.rows[0]?.count ?? 0;
  } catch (error) {
    if (
      (error as { code?: string }).code === '42P01' ||
      (error as { code?: string }).code === '3F000'
    ) {
      return 0;
    }
    throw error;
  }
}

async function confirmProduction(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Type "migrate production" to continue: ');
    return answer.trim() === 'migrate production';
  } finally {
    rl.close();
  }
}

const { values } = parseArgs({
  options: { target: { type: 'string' }, status: { type: 'boolean', default: false } },
  strict: false,
});
const target = typeof values.target === 'string' ? values.target : undefined;
if (!isRemoteTarget(target)) fail(USAGE);

const envFile = resolve(repoRoot, '.env.neon');
if (!existsSync(envFile)) fail('.env.neon was not found at the repository root.');

let url: string;
try {
  url = pickRemoteUrl(parseEnv(readFileSync(envFile, 'utf8')), target);
  assertDirectRemote(url);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Invalid remote configuration.');
}

console.log(`Target: ${target} (${describeTarget(url)})`);
const { db, pool } = createDb(url);
try {
  const versionResult = await pool.query<{ server_version: string }>('show server_version');
  const serverVersion = versionResult.rows[0]?.server_version ?? 'unknown';
  console.log(`Postgres ${serverVersion}`);
  const expected = imageMajor(readFileSync(resolve(repoRoot, 'docker-compose.yml'), 'utf8'));
  const actual = serverMajor(serverVersion);
  if (expected !== null && actual !== null && expected !== actual) {
    console.warn(
      `Warning: the server is Postgres ${actual} but docker-compose.yml uses Postgres ${expected}.`,
    );
  }

  const total = journalCount();
  if (total === null) {
    console.log('No migrations yet');
  } else if (values.status) {
    const recorded = await recordedCount(pool);
    console.log(
      `Journal: ${total} migration(s); recorded: ${recorded}; pending: ${countPending(total, recorded)}`,
    );
  } else {
    if (target === 'production' && !(await confirmProduction())) fail('Aborted.');
    const before = await recordedCount(pool);
    await migrate(db, { migrationsFolder: resolve(packageDir, 'migrations') });
    const after = await recordedCount(pool);
    console.log(`Applied ${after - before} migration(s).`);
  }
} finally {
  await pool.end();
}
