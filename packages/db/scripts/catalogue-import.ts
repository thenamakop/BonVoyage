import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { loadRootEnv } from '@bonvoyage/shared/node';
import { createDb } from '../src/client';
import { describeTarget } from '../src/target';
import {
  findStaleFares,
  findStalePois,
  importCatalogue,
  loadCatalogueOrThrow,
} from '../src/catalogue/import';
import { requireLocalUrl, resolveRemoteTarget } from './lib/remote-target';

// S0-5: pnpm catalogue:import --target local|preview|production
// local uses DATABASE_URL (must be a local host); preview and production read
// .env.neon. Production asks for the typed confirmation "import production".
// S3-8: --prune also deletes places of interest that have left pois.csv, and
// (S4-8, #126) fares that have left fares.csv, each listed before the
// confirmation; no other table is ever pruned. --dry-run imports and prunes
// inside a transaction that is rolled back, so it lists without writing.

const USAGE =
  'Usage: pnpm catalogue:import --target local|preview|production [--today YYYY-MM-DD] [--prune] [--dry-run]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    today: { type: 'string' },
    prune: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
  },
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
const dryRun = values['dry-run'] ?? false;
const flags = [prune ? '--prune' : '', dryRun ? '--dry-run' : ''].filter(Boolean).join(' ');
console.log(`Importing catalogue into ${describeTarget(url)}${flags ? ` (with ${flags})` : ''}`);
const { db, pool } = createDb(url);
try {
  if (prune) {
    const parsed = loadCatalogueOrThrow(dir, { today });
    const stale = await findStalePois(db, parsed);
    console.log(`  places of interest no longer in pois.csv: ${stale.length}`);
    for (const p of stale) console.log(`    ${p.destinationSlug}/${p.poiKey}  ${p.name}`);
    const staleFares = await findStaleFares(db, parsed);
    console.log(`  fares no longer in fares.csv: ${staleFares.length}`);
    for (const f of staleFares) {
      console.log(`    ${f.hubSlug}/${f.destinationSlug}/${f.mode}  ${f.reviewStatus}`);
    }
  }

  // A dry run writes nothing, so it needs no confirmation.
  if (targetArg === 'production' && !dryRun) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "import production" to continue: ');
    rl.close();
    if (answer.trim() !== 'import production') fail('Aborted.');
  }

  const counts = await importCatalogue(db, dir, { today, prune, dryRun });
  for (const table of ['hub', 'destination', 'fare_fallback', 'poi', 'cost_rule']) {
    console.log(
      `  ${table}: ${counts.inserted[table] ?? 0} inserted, ${counts.updated[table] ?? 0} updated`,
    );
  }
  if (prune) {
    console.log(`  poi: ${counts.pruned.length} pruned`);
    for (const p of counts.pruned) console.log(`    ${p.destinationSlug}/${p.poiKey}  ${p.name}`);
    console.log(`  fare_fallback: ${counts.prunedFares.length} pruned`);
    for (const f of counts.prunedFares) {
      console.log(`    ${f.hubSlug}/${f.destinationSlug}/${f.mode}  ${f.reviewStatus}`);
    }
  }
  if (dryRun) console.log('Dry run: rolled back, nothing was written or deleted.');
} finally {
  await pool.end();
}
