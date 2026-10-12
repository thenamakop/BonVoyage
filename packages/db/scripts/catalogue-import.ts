import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { loadRootEnv } from '@bonvoyage/shared/node';
import { createDb } from '../src/client';
import { describeTarget } from '../src/target';
import { importCatalogue } from '../src/catalogue/import';
import { requireLocalUrl, resolveRemoteTarget } from './lib/remote-target';

// S0-5: pnpm catalogue:import --target local|preview|production
// local uses DATABASE_URL (must be a local host); preview and production read
// .env.neon. Production asks for the typed confirmation "import production".

const USAGE = 'Usage: pnpm catalogue:import --target local|preview|production [--today YYYY-MM-DD]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({
  options: { target: { type: 'string' }, today: { type: 'string' } },
  strict: true,
});

loadRootEnv(import.meta.dirname);
const targetArg = values.target;

let url: string;
try {
  if (targetArg === 'local' || targetArg === undefined) {
    url = requireLocalUrl(process.env.DATABASE_URL, 'catalogue import');
  } else {
    ({ url } = resolveRemoteTarget(targetArg));
  }
} catch (error) {
  fail(`${error instanceof Error ? error.message : 'Invalid target.'} ${USAGE}`);
}

const today = values.today ?? new Date().toISOString().slice(0, 10);
const dir = resolve(import.meta.dirname, '../catalogue');

if (targetArg === 'production') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "import production" to continue: ');
  rl.close();
  if (answer.trim() !== 'import production') fail('Aborted.');
}

console.log(`Importing catalogue into ${describeTarget(url)}`);
const { db, pool } = createDb(url);
try {
  const counts = await importCatalogue(db, dir, { today });
  for (const table of ['hub', 'destination', 'fare_fallback', 'poi', 'cost_rule']) {
    console.log(
      `  ${table}: ${counts.inserted[table] ?? 0} inserted, ${counts.updated[table] ?? 0} updated`,
    );
  }
} finally {
  await pool.end();
}
