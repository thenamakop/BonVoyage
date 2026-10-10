import { loadRootEnv } from '@bonvoyage/shared/node';
import { createDb } from '../src/client';
import { describeTarget, isLocalHost } from '../src/target';
import { runMigrations } from './migrate';

loadRootEnv(import.meta.dirname);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
if (!isLocalHost(url)) {
  console.error(
    `Refusing to reset ${describeTarget(url)}: db:reset runs against a local database only.`,
  );
  process.exit(1);
}

console.log(`Resetting ${describeTarget(url)}`);
const { pool } = createDb(url);
try {
  await pool.query('drop schema if exists public cascade');
  await pool.query('drop schema if exists drizzle cascade');
  await pool.query('create schema public');
} finally {
  await pool.end();
}
await runMigrations(url);
