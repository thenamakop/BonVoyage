import { createDb } from '@bonvoyage/db';
import { attachDatabasePool } from '@vercel/functions';
import { pino } from 'pino';
import { createApp } from './app';
import { baseUrlOptions, createAuth } from './auth/auth';
import { env } from './env';
import { createLlmFromEnv } from './llm';

const logger = pino({ level: env.LOG_LEVEL });
const { db, pool } = createDb(env.DATABASE_URL);
// Releases idle clients before Vercel suspends the instance.
attachDatabasePool(pool);
const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: baseUrlOptions(env.APP_URL),
});

// #121: until now no deployment could word a day plan with the model. Built
// after the database and auth, as in server.ts; it never throws at cold start.
const llm = createLlmFromEnv(env, { db, clock: () => new Date(), logger });

// An Express app is a (req, res) handler, so this serves every /api request.
export default createApp({
  db,
  pool,
  logger,
  auth,
  adminEmails: env.ADMIN_EMAILS,
  ...(llm ? { llm } : {}),
});
