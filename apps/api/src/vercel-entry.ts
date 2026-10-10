import { createDb } from '@bonvoyage/db';
import { attachDatabasePool } from '@vercel/functions';
import { pino } from 'pino';
import { createApp } from './app';
import { env } from './env';

const logger = pino({ level: env.LOG_LEVEL });
const { db, pool } = createDb(env.DATABASE_URL);
// Releases idle clients before Vercel suspends the instance.
attachDatabasePool(pool);

// An Express app is a (req, res) handler, so this serves every /api request.
export default createApp({ db, pool, logger });
