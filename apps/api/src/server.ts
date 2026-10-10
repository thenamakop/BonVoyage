import { createDb } from '@bonvoyage/db';
import { pino } from 'pino';
import { createApp } from './app';
import { env } from './env';

const logger = pino({ level: env.LOG_LEVEL });
const { db, pool } = createDb(env.DATABASE_URL);
pool.on('error', (err) => {
  logger.warn({ message: err.message }, 'idle database client error');
});
const app = createApp({ db, pool, logger });

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

const unused = 1;
