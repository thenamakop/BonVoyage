import type { Db } from '@bonvoyage/db';
import { indiaDate } from '@bonvoyage/shared';
import { readDistanceCache, writeDistanceCache } from '../cache/distance-cache';
import { QuotaExceededError, withQuota } from '../quota/quota';
import type { DistanceResult, Routing, RoutingLogger, RoutingProvider } from '../types';
import { estimateProvider } from './estimate';

export interface RoutingDeps {
  db: Db;
  providers: readonly RoutingProvider[];
  clock: () => Date;
  ttlDays: number;
  logger: RoutingLogger;
}

export function createRouting({ db, providers, clock, ttlDays, logger }: RoutingDeps): Routing {
  const last = providers.at(-1);
  if (!last || last.name !== 'estimate' || last.dailyLimit !== null || last.cacheable) {
    throw new RangeError('Routing must end with an unlimited, non-cacheable estimate provider.');
  }
  if (!Number.isFinite(ttlDays) || ttlDays <= 0)
    throw new RangeError('Cache TTL must be positive.');
  const fallback = estimateProvider();
  return {
    async getDistances(origin, destinations) {
      const results = new Map<string, DistanceResult>();
      const now = clock();
      for (const provider of providers) {
        let missing = destinations.filter((destination) => !results.has(destination.id));
        if (missing.length === 0) break;
        try {
          if (provider.cacheable) {
            const cached = await readDistanceCache(db, {
              originKey: origin.key,
              provider: provider.name,
              destinationIds: missing.map((destination) => destination.id),
              now,
            });
            for (const [id, result] of cached) results.set(id, result);
            missing = missing.filter((destination) => !results.has(destination.id));
          }
          if (missing.length === 0) continue;
          const answers = await withQuota(
            db,
            {
              provider: provider.name,
              limit: provider.dailyLimit,
              calls: 1,
              day: indiaDate(now),
            },
            () => provider.getDistances(origin, missing),
          );
          const fresh = missing.flatMap((destination) => {
            const answer = answers.get(destination.id);
            return answer
              ? [
                  {
                    ...answer,
                    destinationId: destination.id,
                    provider: provider.name,
                    km: Math.ceil(answer.km),
                    fromCache: false,
                  },
                ]
              : [];
          });
          for (const result of fresh) results.set(result.destinationId, result);
          if (provider.cacheable)
            await writeDistanceCache(db, {
              originKey: origin.key,
              provider: provider.name,
              results: fresh,
              now,
              ttlDays,
            });
        } catch (error) {
          logger.warn(
            {
              provider: provider.name,
              reason: error instanceof QuotaExceededError ? 'quota_exceeded' : 'provider_error',
            },
            'Routing provider unavailable',
          );
        }
      }
      const missing = destinations.filter((destination) => !results.has(destination.id));
      if (missing.length > 0) {
        for (const [id, result] of await fallback.getDistances(origin, missing))
          results.set(id, result);
      }
      return results;
    },
  };
}
