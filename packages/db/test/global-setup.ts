import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/client';
import { describeTarget, isLocalHost } from '../src/target';

const DEFAULT_URL = 'postgres://bonvoyage:bonvoyage@localhost:5433/bonvoyage_test';

export default async function setup(): Promise<() => Promise<void>> {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_URL;
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!isLocalHost(url) || !database.endsWith('_test')) {
    throw new Error(`Refusing to reset ${describeTarget(url)}: not a local *_test database.`);
  }
  const { db, pool } = createDb(url);
  await pool.query('drop schema if exists public cascade');
  await pool.query('drop schema if exists drizzle cascade');
  await pool.query('create schema public');
  const migrationsFolder = resolve(import.meta.dirname, '../migrations');
  if (existsSync(resolve(migrationsFolder, 'meta/_journal.json'))) {
    await migrate(db, { migrationsFolder });
  }
  return async () => {
    await pool.end();
  };
}
