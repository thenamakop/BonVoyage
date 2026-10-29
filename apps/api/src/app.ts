import { randomUUID } from 'node:crypto';
import type { Db } from '@bonvoyage/db';
import { probeDb } from '@bonvoyage/db';
import {
  createRouting,
  curatedProvider,
  estimateProvider,
  type Routing,
} from '@bonvoyage/integrations/routing';
import type { Weights } from '@bonvoyage/engine';
import { ERROR_CODES } from '@bonvoyage/shared';
import type { HealthOk } from '@bonvoyage/shared';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Auth } from './auth/auth';
import { FAIRNESS_LAMBDA, SCORING_WEIGHTS } from './config/scoring';
import { AppError, errorHandler, notFoundHandler } from './http/errors';
import { requireJson } from './http/json-only';
import type { SessionUser } from './http/session';
import { createApiRouter } from './modules';
import type { RecommendationHooks } from './recommendations/service';
import type { LlmClient } from '@bonvoyage/integrations';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export interface AppDeps {
  db: Db;
  pool: Pool;
  logger: Logger;
  auth: Auth;
  /** Defaults to the wall clock; tests inject one to reach expiry (S1-3). */
  clock?: () => Date;
  /** Lowercased administrator emails from ADMIN_EMAILS (S1-7); none by default. */
  adminEmails?: readonly string[];
  routing?: Routing;
  /** Group-fit weights; defaults to apps/api/config/scoring.json (0004 h). */
  scoringWeights?: Weights;
  /** R17 fairness lambda; defaults to apps/api/config/scoring.json (decision E1). */
  fairnessLambda?: number;
  /** Test-only seams around the recommendation request (S2-6 staleness test). */
  recommendationHooks?: RecommendationHooks;
  /** Present when LIVE_APIS=on; tests inject a FixtureLlmClient (S3-6). */
  llm?: LlmClient;
  /** Shortens the wording timeout in tests (S3-6). */
  wordingTimeoutMs?: number;
}

export function createApp({
  db,
  pool,
  logger,
  auth,
  clock,
  adminEmails = [],
  routing,
  scoringWeights = SCORING_WEIGHTS,
  fairnessLambda = FAIRNESS_LAMBDA,
  recommendationHooks,
  llm,
  wordingTimeoutMs,
}: AppDeps): Express {
  const app = express();
  const appRouting =
    routing ??
    createRouting({
      db,
      providers: [curatedProvider(db), estimateProvider()],
      clock: clock ?? (() => new Date()),
      ttlDays: 30,
      logger,
    });
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
      // S1-6 (SRS 3.5): a request line logs the id, method, path and status
      // only. Bodies (passwords, budgets) and headers (cookies) are never
      // serialised; the redact list is a second guard if a serializer changes.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body',
          'res.body',
        ],
        censor: '[redacted]',
      },
      // The signed-in user by id, never by email.
      customProps: (_req, res) => {
        const user = (res as { locals?: { sessionUser?: SessionUser } }).locals?.sessionUser;
        return user ? { userId: user.userId } : {};
      },
    }),
  );

  // Better Auth reads the raw body, so it mounts BEFORE express.json.
  app.all('/api/auth/*splat', toNodeHandler(auth));

  // S1-7: the catalogue upload (five files, up to 2 MB) gets its own parser,
  // mounted BEFORE the global one; body-parser then skips the parsed body.
  app.use('/api/admin/catalogue/import', express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', requireJson);

  app.get('/api/health', async (_req, res) => {
    if (await probeDb(pool)) {
      const body: HealthOk = { status: 'ok', db: 'ok' };
      res.json(body);
      return;
    }
    throw new AppError(503, ERROR_CODES.DB_UNAVAILABLE, 'The database is not reachable.');
  });

  app.use(
    '/api',
    createApiRouter({
      db,
      auth,
      adminEmails,
      routing: appRouting,
      scoringWeights,
      fairnessLambda,
      ...(recommendationHooks ? { recommendationHooks } : {}),
      ...(llm ? { llm } : {}),
      ...(wordingTimeoutMs !== undefined ? { wordingTimeoutMs } : {}),
      ...(clock ? { clock } : {}),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
