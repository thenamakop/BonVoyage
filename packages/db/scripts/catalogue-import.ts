import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { loadRootEnv } from '@bonvoyage/shared/node';
import { createDb } from '../src/client';
import { describeTarget } from '../src/target';
import { findStalePois, importCatalogue, loadCatalogueOrThrow } from '../src/catalogue/import';
import { requireLocalUrl, resolveRemoteTarget } from './lib/remote-target';

// S0-5: pnpm catalogue:import --target local|preview|production
// local uses DATABASE_URL (must be a local host); preview and production read
// .env.neon. Production asks for the typed confirmation "import production".
// S3-8: --prune also deletes places of interest that have left pois.csv,
// listing them before the confirmation; nothing else is ever pruned.

const USAGE =
  'Usage: pnpm catalogue:import --target local|preview|production [--today YYYY-MM-DD] [--prune]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({
  options: { target: { type: 'string' }, today: { type: 'string' }, prune: { type: 'boolean' } },
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

const prune = values.prune ?? false;
console.log(`Importing catalogue into ${describeTarget(url)}${prune ? ' (with --prune)' : ''}`);
const { db, pool } = createDb(url);
try {
  if (prune) {
    const stale = await findStalePois(db, loadCatalogueOrThrow(dir, { today }));
    console.log(`  places of interest no longer in pois.csv: ${stale.length}`);
    for (const p of stale) console.log(`    ${p.destinationSlug}/${p.poiKey}  ${p.name}`);
  }

  if (targetArg === 'production') {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "import production" to continue: ');
    rl.close();
    if (answer.trim() !== 'import production') fail('Aborted.');
  }

  const counts = await importCatalogue(db, dir, { today, prune });
  for (const table of ['hub', 'destination', 'fare_fallback', 'poi', 'cost_rule']) {
    console.log(
      `  ${table}: ${counts.inserted[table] ?? 0} inserted, ${counts.updated[table] ?? 0} updated`,
    );
  }
  if (prune) {
    console.log(`  poi: ${counts.pruned.length} pruned`);
    for (const p of counts.pruned) console.log(`    ${p.destinationSlug}/${p.poiKey}  ${p.name}`);
  }
} finally {
  await pool.end();
}
