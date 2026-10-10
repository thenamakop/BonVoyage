import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRootEnv } from '@bonvoyage/shared/node';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/client';
import { describeTarget } from '../src/target';

const migrationsFolder = resolve(import.meta.dirname, '../migrations');

export async function runMigrations(url: string): Promise<void> {
  console.log(`Migrating ${describeTarget(url)}`);
  if (!existsSync(resolve(migrationsFolder, 'meta/_journal.json'))) {
    console.log('No migrations yet (the schema arrives in S0-5)');
    return;
  }
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  loadRootEnv(import.meta.dirname);
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  await runMigrations(url);
}
