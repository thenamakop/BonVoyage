import type { Db } from '@bonvoyage/db';
import { fareFallback, hub } from '@bonvoyage/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { DistanceResult, RoutingProvider } from '../types';

export function curatedProvider(db: Db): RoutingProvider {
  return {
    name: 'curated',
    dailyLimit: null,
    cacheable: false,
    async getDistances(origin, destinations) {
      if (destinations.length === 0) return new Map();
      const rows = await db
        .select({
          destinationId: fareFallback.destinationId,
          km: fareFallback.distanceKm,
          durationMin: fareFallback.durationMinutes,
          reviewStatus: fareFallback.reviewStatus,
        })
        .from(fareFallback)
        .innerJoin(hub, eq(hub.id, fareFallback.originHubId))
        .where(
          and(
            eq(hub.slug, origin.key),
            eq(fareFallback.mode, 'car'),
            inArray(
              fareFallback.destinationId,
              destinations.map((destination) => destination.id),
            ),
          ),
        );
      return new Map(
        rows.map((row): [string, DistanceResult] => [
          row.destinationId,
          {
            destinationId: row.destinationId,
            km: Math.ceil(row.km),
            durationMin: row.durationMin,
            provenance: row.reviewStatus === 'verified' ? 'curated' : 'estimated',
            provider: 'curated',
            fromCache: false,
          },
        ]),
      );
    },
  };
}
