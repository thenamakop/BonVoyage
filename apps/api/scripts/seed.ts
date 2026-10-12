import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createDb } from '@bonvoyage/db';
import { requireLocalUrl, resolveRemoteTarget } from '@bonvoyage/db/remote-target';
import { createAuth } from '../src/auth/auth';
import { env } from '../src/env';
import { runSeed } from '../src/seed/run-seed';

// S0-5: pnpm db:seed [--target preview]. local by default; never production.

const { values } = parseArgs({
  options: { target: { type: 'string' } },
  strict: true,
});

const target = values.target ?? 'local';
if (target === 'production') {
  console.error('Refusing to seed production.');
  process.exit(1);
}

let url: string;
try {
  url =
    target === 'local'
      ? requireLocalUrl(env.DATABASE_URL, 'seed')
      : resolveRemoteTarget(target).url;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid target.');
  process.exit(1);
}

const password = env.SEED_DEMO_PASSWORD;
if (!password || password.length < 12) {
  console.error('SEED_DEMO_PASSWORD is missing or shorter than 12 characters.');
  process.exit(1);
}

const catalogueDir = resolve(import.meta.dirname, '../../../packages/db/catalogue');
const { db, pool } = createDb(url);
try {
  const auth = createAuth({ db, secret: env.BETTER_AUTH_SECRET, baseURL: 'http://localhost:4000' });
  await runSeed({ db, auth, catalogueDir, password });
} finally {
  await pool.end();
}
