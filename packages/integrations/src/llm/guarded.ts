import type { Db } from '@bonvoyage/db';
import { indiaDate } from '@bonvoyage/shared';
import { withQuota } from '../quota/quota';
import type { LlmClient, LlmRequest, LlmResult } from './types';

// #121, AGENTS.md rule 4: every model call goes through the daily quota guard.
// The guard wraps the client itself, so the itinerary service and the prompt
// it builds stay as they are. QuotaExceededError propagates; the caller
// (composeItineraryWording) turns any failure into the template path.

export interface GuardedLlmOptions {
  db: Db;
  provider: string;
  /** Calls allowed per India day; 0 refuses every call (the default). */
  dailyLimit: number;
  clock: () => Date;
}

export function createGuardedLlmClient(inner: LlmClient, options: GuardedLlmOptions): LlmClient {
  const { db, provider, dailyLimit, clock } = options;
  return {
    ...(inner.modelId !== undefined ? { modelId: inner.modelId } : {}),
    generateStructured<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
      return withQuota(db, { provider, limit: dailyLimit, calls: 1, day: indiaDate(clock()) }, () =>
        inner.generateStructured(request),
      );
    },
  };
}
