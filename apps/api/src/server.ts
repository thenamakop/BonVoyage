import { createDb } from '@bonvoyage/db';
import { pino } from 'pino';
import { createApp } from './app';
import { baseUrlOptions, createAuth } from './auth/auth';
import { env } from './env';

const logger = pino({ level: env.LOG_LEVEL });
const { db, pool } = createDb(env.DATABASE_URL);
pool.on('error', (err) => {
  logger.warn({ message: err.message }, 'idle database client error');
});
const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: baseUrlOptions(env.APP_URL),
});
const app = createApp({ db, pool, logger, auth, adminEmails: env.ADMIN_EMAILS });

const server = app.listen(env.PORT, () => {
  logger.info(`api listening on http://localhost:${env.PORT}`);
});

function shutdown(): void {
  const forceExit = setTimeout(() => process.exit(1), 5_000);
  forceExit.unref();
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
