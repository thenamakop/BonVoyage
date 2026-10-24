import type { Db } from '@bonvoyage/db';
import { distanceCache } from '@bonvoyage/db/schema';
import { Provenance } from '@bonvoyage/shared';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import type { DistanceResult } from '../types';

export async function readDistanceCache(
  db: Db,
  options: {
    originKey: string;
    provider: string;
    destinationIds: readonly string[];
    now: Date;
  },
): Promise<Map<string, DistanceResult>> {
  if (options.destinationIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(distanceCache)
    .where(
      and(
        eq(distanceCache.originKey, options.originKey),
        eq(distanceCache.provider, options.provider),
        inArray(distanceCache.destinationId, [...options.destinationIds]),
        gt(distanceCache.expiresAt, options.now),
      ),
    );
  return new Map(
    rows.map((row) => [
      row.destinationId,
      {
        destinationId: row.destinationId,
        km: row.distanceKm,
        durationMin: row.durationMin,
        provenance: Provenance.parse(row.provenance),
        provider: row.provider,
        fromCache: true,
      },
    ]),
  );
}

export async function writeDistanceCache(
  db: Db,
  options: {
    originKey: string;
    provider: string;
    results: readonly DistanceResult[];
    now: Date;
    ttlDays: number;
  },
): Promise<void> {
  if (options.results.length === 0) return;
  const expiresAt = new Date(options.now.getTime() + options.ttlDays * 86_400_000);
  await db
    .insert(distanceCache)
    .values(
      options.results.map((result) => ({
        originKey: options.originKey,
        destinationId: result.destinationId,
        provider: options.provider,
        distanceKm: Math.ceil(result.km),
        durationMin: result.durationMin,
        provenance: result.provenance,
        fetchedAt: options.now,
        expiresAt,
      })),
    )
    .onConflictDoUpdate({
      target: [distanceCache.originKey, distanceCache.destinationId, distanceCache.provider],
      set: {
        distanceKm: sql`excluded.distance_km`,
        durationMin: sql`excluded.duration_min`,
        provenance: sql`excluded.provenance`,
        fetchedAt: sql`excluded.fetched_at`,
        expiresAt: sql`excluded.expires_at`,
      },
    });
}
