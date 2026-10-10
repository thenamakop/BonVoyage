import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

export function createDb(url: string) {
  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  // An idle client whose connection drops emits 'error' on the pool; unhandled, it crashes the
  // process. probeDb reports the outage and later queries reconnect.
  pool.on('error', () => undefined);
  const db = drizzle({ client: pool, casing: 'snake_case', schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];

export async function probeDb(pool: pg.Pool, timeoutMs = 2_000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const query = pool.query('select 1').then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
