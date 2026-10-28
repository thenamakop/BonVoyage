import type { Db } from '@bonvoyage/db';
import { createGuardedLlmClient, createLlmClient, type LlmClient } from '@bonvoyage/integrations';
import type { Logger } from 'pino';
import type { Env } from './env';

// #121: the one place both entry points (server.ts, vercel-entry.ts) build the
// model client. Off means the catalogue templates; on means Gemini behind the
// daily quota guard. A missing key or model on a deployment must not crash the
// function at cold start for every route, so it logs which variable is missing
// (never a value) and falls back to the templates.

type LlmEnv = Pick<Env, 'LIVE_APIS' | 'GEMINI_API_KEY' | 'GEMINI_MODEL' | 'GEMINI_DAILY_LIMIT'>;

export function createLlmFromEnv(
  env: LlmEnv,
  { db, clock, logger }: { db: Db; clock: () => Date; logger: Logger },
): LlmClient | undefined {
  if (env.LIVE_APIS !== 'on') return undefined;
  const missing = !env.GEMINI_API_KEY
    ? 'GEMINI_API_KEY'
    : !env.GEMINI_MODEL
      ? 'GEMINI_MODEL'
      : null;
  if (missing) {
    logger.warn({ missing }, 'LIVE_APIS=on without a model setting; day plans use the templates');
    return undefined;
  }
  const inner = createLlmClient({
    liveApis: env.LIVE_APIS,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
  });
  return createGuardedLlmClient(inner, {
    db,
    provider: 'gemini',
    dailyLimit: env.GEMINI_DAILY_LIMIT,
    clock,
  });
}
