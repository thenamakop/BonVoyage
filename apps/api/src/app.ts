import { randomUUID } from 'node:crypto';
import type { Db } from '@bonvoyage/db';
import { probeDb } from '@bonvoyage/db';
import { ERROR_CODES } from '@bonvoyage/shared';
import type { HealthOk } from '@bonvoyage/shared';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { AppError, errorHandler, notFoundHandler } from './http/errors';
import { apiRouter } from './modules';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export interface AppDeps {
  db: Db;
  pool: Pool;
  logger: Logger;
}

export function createApp({ pool, logger }: AppDeps): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[redacted]',
      },
    }),
  );

  // S0-5 mounts Better Auth here: app.all('/api/auth/*splat', toNodeHandler(auth)).
  // It must come BEFORE express.json because Better Auth reads the raw body.

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    if (await probeDb(pool)) {
      const body: HealthOk = { status: 'ok', db: 'ok' };
      res.json(body);
      return;
    }
    throw new AppError(503, ERROR_CODES.DB_UNAVAILABLE, 'The database is not reachable.');
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
