import { createHash } from 'node:crypto';
import type { Db } from '@bonvoyage/db';
import { indiaDate } from '@bonvoyage/shared';
import { readLlmCache, writeLlmCache } from '../cache/llm-cache';
import { withQuota } from '../quota/quota';
import type { LlmClient, LlmRequest, LlmResult } from './types';

// #121, AGENTS.md rule 4: every model call is cached and goes through the
// daily quota guard. The guard wraps the client itself, so the itinerary
// service and the prompt it builds stay as they are. An identical request
// (provider, model, schema name, system and prompt) within the TTL is answered
// from llm_cache with no model call and no quota. QuotaExceededError
// propagates; composeItineraryWording turns any failure into the templates.

export interface GuardedLlmLogger {
  warn(details: { provider: string; reason: string }, message: string): void;
}

export interface GuardedLlmOptions {
  db: Db;
  provider: string;
  /** Calls allowed per India day; 0 refuses every call (the default). */
  dailyLimit: number;
  clock: () => Date;
  /** How long a cached reply is reused (30 days in production). */
  ttlDays?: number;
  logger?: GuardedLlmLogger;
}

// NUL cannot occur in a schema name, a system text or a prompt, so two
// different requests can never join into the same string.
const SEPARATOR = '\u0000';

export function cacheKeyOf(provider: string, model: string, request: LlmRequest<unknown>): string {
  return createHash('sha256')
    .update([provider, model, request.schemaName, request.system, request.prompt].join(SEPARATOR))
    .digest('hex');
}

export function createGuardedLlmClient(inner: LlmClient, options: GuardedLlmOptions): LlmClient {
  const { db, provider, dailyLimit, clock, ttlDays = 30, logger } = options;
  const model = inner.modelId ?? 'unknown';
  const warn = (reason: string, message: string) => logger?.warn({ provider, reason }, message);
  return {
    modelId: model,
    async generateStructured<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
      const key = cacheKeyOf(provider, model, request);
      const now = clock();
      let cached: Awaited<ReturnType<typeof readLlmCache>> = null;
      try {
        cached = await readLlmCache(db, key, now);
      } catch {
        // A cache that cannot be read falls through to the model path.
        warn('cache_read_failed', 'LLM cache read failed');
      }
      if (cached) {
        const parsed = request.schema.safeParse(cached.response);
        if (parsed.success) {
          return {
            data: parsed.data,
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: 0,
            model: cached.model,
            fromCache: true,
          };
        }
        warn('cache_corrupt', 'LLM cache entry failed its schema; asking the model');
      }

      const result = await withQuota(
        db,
        { provider, limit: dailyLimit, calls: 1, day: indiaDate(now) },
        () => inner.generateStructured(request),
      );
      try {
        await writeLlmCache(db, {
          key,
          provider,
          model: result.model,
          response: result.data,
          now,
          ttlDays,
        });
      } catch {
        // A reply the plan can use is never lost to a cache failure.
        warn('cache_write_failed', 'LLM cache write failed');
      }
      return { ...result, fromCache: false };
    },
  };
}
