import { createDb } from '@bonvoyage/db';
import { destination, distanceCache, fareFallback, hub, providerUsage } from '@bonvoyage/db/schema';
import { indiaDate } from '@bonvoyage/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, assert, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createRouting,
  curatedProvider,
  estimateProvider,
  QuotaExceededError,
  readDistanceCache,
  withQuota,
  writeDistanceCache,
} from '../src/routing';
import type {
  DistanceResult,
  RoutingDestination,
  RoutingLogger,
  RoutingProvider,
} from '../src/types';

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const origin = { key: 'routing-test-origin', lat: 28.6139, lng: 77.209 };
const fixed = new Date('2026-11-01T06:30:00Z');
const logger = { warn: vi.fn<RoutingLogger['warn']>() };
let destinations: RoutingDestination[] = [];

const makeRouting = (providers: readonly RoutingProvider[], clock = () => fixed) =>
  createRouting({ db, providers, clock, ttlDays: 30, logger });
function dest(index: number): RoutingDestination {
  const value = destinations[index];
  assert(value);
  return value;
}
function answer(destinationId: string, provider: string, km = 100): DistanceResult {
  return { destinationId, km, durationMin: 120, provenance: 'live', provider, fromCache: false };
}
function liveProvider(name: string, dailyLimit: number | null = 2) {
  return {
    name,
    dailyLimit,
    cacheable: true,
    getDistances: vi.fn<RoutingProvider['getDistances']>((_origin, requested) =>
      Promise.resolve(
        new Map(requested.map((destination) => [destination.id, answer(destination.id, name)])),
      ),
    ),
  };
}
async function usage(provider: string) {
  return db
    .select({ day: providerUsage.day, calls: providerUsage.calls })
    .from(providerUsage)
    .where(eq(providerUsage.provider, provider))
    .orderBy(providerUsage.day);
}

beforeAll(async () => {
  const [originHub] = await db
    .insert(hub)
    .values({
      slug: origin.key,
      name: 'Routing test hub',
      state: 'Delhi',
      lat: origin.lat,
      lng: origin.lng,
      collectedOn: '2026-10-24',
      reviewStatus: 'draft',
    })
    .returning();
  assert(originHub);
  destinations = await db
    .insert(destination)
    .values(
      Array.from({ length: 44 }, (_, index) => ({
        slug: `routing-test-${index}`,
        name: `Routing test ${index}`,
        state: 'Uttarakhand',
        lat: 29 + index / 100,
        lng: 78,
        types: ['mountain'],
        activities: ['trekking'],
        climate: 'mild' as const,
        bestMonths: [11],
        minNights: 1,
        collectedOn: '2026-10-24',
        reviewStatus: 'draft' as const,
        costReviewStatus: 'draft' as const,
      })),
    )
    .returning({ id: destination.id, lat: destination.lat, lng: destination.lng });
  await db.insert(fareFallback).values([
    {
      originHubId: originHub.id,
      destinationId: dest(0).id,
      mode: 'car',
      durationMinutes: 180,
      distanceKm: 210,
      collectedOn: '2026-10-24',
      reviewStatus: 'draft',
    },
    {
      originHubId: originHub.id,
      destinationId: dest(1).id,
      mode: 'car',
      durationMinutes: 240,
      distanceKm: 250,
      collectedOn: '2026-10-24',
      reviewStatus: 'verified',
    },
    {
      originHubId: originHub.id,
      destinationId: dest(2).id,
      mode: 'bus',
      durationMinutes: 300,
      distanceKm: 300,
      farePerPersonInr: 500,
      collectedOn: '2026-10-24',
      reviewStatus: 'verified',
    },
  ]);
});
afterEach(() => {
  vi.restoreAllMocks();
  logger.warn.mockClear();
});
afterAll(() => pool.end());

describe('routing providers and fresh local facts', () => {
  it('uses draft/verified car provenance and estimates missing car rows', async () => {
    const routing = makeRouting([curatedProvider(db), estimateProvider()]);
    const results = await routing.getDistances(origin, [dest(0), dest(1), dest(2)]);
    expect(results.get(dest(0).id)).toMatchObject({
      km: 210,
      durationMin: 180,
      provenance: 'estimated',
      provider: 'curated',
      fromCache: false,
    });
    expect(results.get(dest(1).id)).toMatchObject({
      km: 250,
      durationMin: 240,
      provenance: 'curated',
      provider: 'curated',
      fromCache: false,
    });
    expect(results.get(dest(2).id)).toMatchObject({
      durationMin: null,
      provenance: 'estimated',
      provider: 'estimate',
      fromCache: false,
    });
    expect(
      (await db.select().from(distanceCache).where(eq(distanceCache.originKey, origin.key))).length,
    ).toBe(0);
    const unknown = await curatedProvider(db).getDistances(
      { ...origin, key: 'unknown-hub' },
      destinations,
    );
    expect(unknown.size).toBe(0);
  });

  it('changes provenance immediately after a car row is verified, without a local cache', async () => {
    const provider = curatedProvider(db);
    const routing = makeRouting([provider, estimateProvider()]);
    expect((await routing.getDistances(origin, [dest(0)])).get(dest(0).id)?.provenance).toBe(
      'estimated',
    );
    await db
      .update(fareFallback)
      .set({ reviewStatus: 'verified' })
      .where(and(eq(fareFallback.destinationId, dest(0).id), eq(fareFallback.mode, 'car')));
    expect((await routing.getDistances(origin, [dest(0)])).get(dest(0).id)).toMatchObject({
      provenance: 'curated',
      fromCache: false,
    });
    await db
      .update(fareFallback)
      .set({ reviewStatus: 'draft' })
      .where(and(eq(fareFallback.destinationId, dest(0).id), eq(fareFallback.mode, 'car')));
  });

  it('continues in strict provider order for partial answers and ignores unrequested IDs', async () => {
    const live = liveProvider('partial-live');
    live.getDistances.mockResolvedValue(
      new Map([
        [dest(0).id, answer(dest(0).id, live.name, 10.2)],
        ['unrequested', answer('unrequested', live.name)],
      ]),
    );
    const results = await makeRouting([live, curatedProvider(db), estimateProvider()]).getDistances(
      origin,
      [dest(0), dest(1), dest(2)],
    );
    expect(results.size).toBe(3);
    expect(results.get(dest(0).id)?.km).toBe(11);
    expect(results.get(dest(1).id)?.provider).toBe('curated');
    expect(results.get(dest(2).id)?.provider).toBe('estimate');
    expect(results.has('unrequested')).toBe(false);
  });

  it('returns no results and performs no SQL/provider work for no destinations', async () => {
    const live = liveProvider('empty-live');
    const query = vi.spyOn(pool, 'query');
    expect(await makeRouting([live, estimateProvider()]).getDistances(origin, [])).toEqual(
      new Map(),
    );
    expect(query).not.toHaveBeenCalled();
    expect(live.getDistances).not.toHaveBeenCalled();
  });

  it('logs a provider failure once without coordinates or raw error messages and falls back', async () => {
    const live = liveProvider('failed-live');
    live.getDistances.mockRejectedValue(new Error('Do not log coordinates: 28.6139,77.209'));
    const results = await makeRouting([live, estimateProvider()]).getDistances(origin, [dest(3)]);
    expect(results.get(dest(3).id)?.provider).toBe('estimate');
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      { provider: live.name, reason: 'provider_error' },
      'Routing provider unavailable',
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('28.6139');
    expect(await usage(live.name)).toEqual([{ day: indiaDate(fixed), calls: 1 }]);
  });

  it('requires an unlimited uncached final estimate and completes a faulty injected terminal provider', async () => {
    expect(() => makeRouting([])).toThrow(RangeError);
    expect(() => makeRouting([liveProvider('not-terminal')])).toThrow(RangeError);
    expect(() => makeRouting([{ ...estimateProvider(), dailyLimit: 1 }])).toThrow(RangeError);
    expect(() => makeRouting([{ ...estimateProvider(), cacheable: true }])).toThrow(RangeError);
    expect(() =>
      createRouting({
        db,
        providers: [estimateProvider()],
        clock: () => fixed,
        ttlDays: 0,
        logger,
      }),
    ).toThrow(RangeError);
    const broken = {
      ...estimateProvider(),
      getDistances: vi
        .fn<RoutingProvider['getDistances']>()
        .mockRejectedValue(new Error('offline')),
    };
    expect(
      (await makeRouting([broken]).getDistances(origin, [dest(4)])).get(dest(4).id)?.provider,
    ).toBe('estimate');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('external-provider distance cache', () => {
  it('serves a repeat from cache with its original provenance, and calls no provider or quota', async () => {
    const live = liveProvider('cached-live');
    const routing = makeRouting([live, estimateProvider()]);
    const first = await routing.getDistances(origin, [dest(5)]);
    const second = await routing.getDistances(origin, [dest(5)]);
    expect(second.get(dest(5).id)).toEqual({ ...first.get(dest(5).id), fromCache: true });
    expect(second.get(dest(5).id)?.provenance).toBe('live');
    expect(live.getDistances).toHaveBeenCalledTimes(1);
    expect(await usage(live.name)).toEqual([{ day: indiaDate(fixed), calls: 1 }]);
  });

  it('ignores a row at exact expiry and upserts its replacement without duplicates', async () => {
    let now = fixed;
    const live = liveProvider('expired-live');
    const routing = makeRouting([live, estimateProvider()], () => now);
    await routing.getDistances(origin, [dest(6)]);
    now = new Date(fixed.getTime() + 30 * 86_400_000);
    live.getDistances.mockResolvedValue(
      new Map([[dest(6).id, answer(dest(6).id, live.name, 999)]]),
    );
    const refreshed = await routing.getDistances(origin, [dest(6)]);
    expect(refreshed.get(dest(6).id)).toMatchObject({ km: 999, fromCache: false });
    expect(live.getDistances).toHaveBeenCalledTimes(2);
    const rows = await db.select().from(distanceCache).where(eq(distanceCache.provider, live.name));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.fetchedAt).toEqual(now);
    expect(rows[0]?.expiresAt).toEqual(new Date(now.getTime() + 30 * 86_400_000));
  });

  it('isolates origin and provider keys and makes empty cache operations query-free', async () => {
    await writeDistanceCache(db, {
      originKey: origin.key,
      provider: 'isolated-cache',
      results: [answer(dest(7).id, 'isolated-cache')],
      now: fixed,
      ttlDays: 30,
    });
    expect(
      (
        await readDistanceCache(db, {
          originKey: 'other-origin',
          provider: 'isolated-cache',
          destinationIds: [dest(7).id],
          now: fixed,
        })
      ).size,
    ).toBe(0);
    expect(
      (
        await readDistanceCache(db, {
          originKey: origin.key,
          provider: 'other-provider',
          destinationIds: [dest(7).id],
          now: fixed,
        })
      ).size,
    ).toBe(0);
    const query = vi.spyOn(pool, 'query');
    expect(
      await readDistanceCache(db, {
        originKey: origin.key,
        provider: 'isolated-cache',
        destinationIds: [],
        now: fixed,
      }),
    ).toEqual(new Map());
    await writeDistanceCache(db, {
      originKey: origin.key,
      provider: 'isolated-cache',
      results: [],
      now: fixed,
      ttlDays: 30,
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('India-day quotas', () => {
  it('allows two live calls, falls back on the third, and resets at the next India midnight', async () => {
    let now = new Date('2026-11-01T18:29:59Z');
    const live = liveProvider('daily-live', 2);
    const routing = makeRouting([live, estimateProvider()], () => now);
    expect((await routing.getDistances(origin, [dest(8)])).get(dest(8).id)?.provider).toBe(
      live.name,
    );
    expect((await routing.getDistances(origin, [dest(9)])).get(dest(9).id)?.provider).toBe(
      live.name,
    );
    expect((await routing.getDistances(origin, [dest(10)])).get(dest(10).id)?.provider).toBe(
      'estimate',
    );
    expect(live.getDistances).toHaveBeenCalledTimes(2);
    expect(await usage(live.name)).toEqual([{ day: '2026-11-01', calls: 2 }]);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      { provider: live.name, reason: 'quota_exceeded' },
      'Routing provider unavailable',
    );
    expect((await routing.getDistances(origin, [dest(8)])).get(dest(8).id)?.fromCache).toBe(true);
    now = new Date('2026-11-01T18:30:00Z');
    expect((await routing.getDistances(origin, [dest(11)])).get(dest(11).id)?.provider).toBe(
      live.name,
    );
    expect(await usage(live.name)).toEqual([
      { day: '2026-11-01', calls: 2 },
      { day: '2026-11-02', calls: 1 },
    ]);
  });

  it('runs exactly one of two parallel reservations with limit one', async () => {
    const fn = vi.fn(() => Promise.resolve('ok'));
    const options = { provider: 'parallel-quota', limit: 1, calls: 1, day: indiaDate(fixed) };
    const outcomes = await Promise.allSettled([
      withQuota(db, options, fn),
      withQuota(db, options, fn),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      outcomes.some(
        (result) => result.status === 'rejected' && result.reason instanceof QuotaExceededError,
      ),
    ).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await usage(options.provider)).toEqual([{ day: options.day, calls: 1 }]);
  });

  it('commits reservations before invoking slow work and counts attempts even if they fail', async () => {
    const options = { provider: 'outside-lock', limit: 2, calls: 1, day: indiaDate(fixed) };
    await withQuota(db, options, () => withQuota(db, options, () => Promise.resolve('nested')));
    expect(await usage(options.provider)).toEqual([{ day: options.day, calls: 2 }]);
    await expect(
      withQuota(db, { ...options, provider: 'failed-attempt' }, () =>
        Promise.reject(new Error('attempt failed')),
      ),
    ).rejects.toThrow('attempt failed');
    expect(await usage('failed-attempt')).toEqual([{ day: options.day, calls: 1 }]);
  });

  it('has no SQL for unlimited quotas, restores overshoots, and rejects invalid counters', async () => {
    const fn = vi.fn(() => Promise.resolve(42));
    const options = { provider: 'quota-options', day: indiaDate(fixed), calls: 1, limit: null };
    const query = vi.spyOn(pool, 'query');
    expect(await withQuota(db, options, fn)).toBe(42);
    expect(query).not.toHaveBeenCalled();
    await expect(withQuota(db, { ...options, limit: 0 }, fn)).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
    expect(await usage(options.provider)).toEqual([{ day: options.day, calls: 0 }]);
    await expect(
      withQuota(db, { ...options, provider: 'large-reservation', limit: 1, calls: 2 }, fn),
    ).rejects.toBeInstanceOf(QuotaExceededError);
    expect(await usage('large-reservation')).toEqual([{ day: options.day, calls: 0 }]);
    for (const invalid of [
      { calls: 0 },
      { calls: -1 },
      { calls: 0.5 },
      { limit: -1 },
      { limit: 0.5 },
    ]) {
      await expect(withQuota(db, { ...options, ...invalid }, fn)).rejects.toBeInstanceOf(
        RangeError,
      );
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('batched 44-destination query counts', () => {
  it('uses one SQL query for all 44 default curated/estimate results', async () => {
    const routing = makeRouting([curatedProvider(db), estimateProvider()]);
    const query = vi.spyOn(pool, 'query');
    const results = await routing.getDistances(origin, destinations);
    expect(results.size).toBe(44);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('batches all 44 external cache reads/writes and needs only one warm read', async () => {
    const live = liveProvider('batch-live', null);
    const routing = makeRouting([live, estimateProvider()]);
    const query = vi.spyOn(pool, 'query');
    expect((await routing.getDistances(origin, destinations)).size).toBe(44);
    expect(query).toHaveBeenCalledTimes(2);
    query.mockClear();
    const cached = await routing.getDistances(origin, destinations);
    expect([...cached.values()].every((result) => result.fromCache)).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(live.getDistances).toHaveBeenCalledTimes(1);
  });
});
