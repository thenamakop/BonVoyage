import { randomUUID } from 'node:crypto';
import { createDb } from '@bonvoyage/db';
import { llmCache, providerUsage } from '@bonvoyage/db/schema';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FixtureLlmClient } from '../src/llm/fixture';
import { createGuardedLlmClient } from '../src/llm/guarded';
import type { LlmRequest, LlmResult } from '../src/llm/types';
import { QuotaExceededError } from '../src/quota/quota';

// #121: the guarded client puts every model call behind the daily quota (and,
// from migration 0003, the cache). A fixture client counts the calls that
// reach it; no test talks to a real model.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
afterAll(async () => {
  await pool.end();
});

const Words = z.object({ text: z.string() });
type Words = z.infer<typeof Words>;

class CountingClient extends FixtureLlmClient {
  calls = 0;
  constructor(private readonly fail = false) {
    super({ Words: { text: 'Hello' } });
  }
  override generateStructured<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
    this.calls += 1;
    if (this.fail) return Promise.reject(new Error('provider down'));
    return super.generateStructured(request);
  }
}

const request = (prompt: string): LlmRequest<Words> => ({
  system: 'Write words only.',
  prompt,
  schema: Words,
  schemaName: 'Words',
});
/** A provider name of its own per test, so provider_usage rows never mix. */
const providerName = () => `gemini-test-${randomUUID().slice(0, 8)}`;
const usedOn = async (provider: string, day: string) =>
  (
    await db
      .select({ calls: providerUsage.calls })
      .from(providerUsage)
      .where(and(eq(providerUsage.provider, provider), eq(providerUsage.day, day)))
  )[0]?.calls ?? 0;

// 06:30 UTC is noon in India; 20:00 UTC is already the next India day.
const NOV_3 = new Date('2026-11-03T06:30:00Z');
const NOV_4 = new Date('2026-11-03T20:00:00Z');

describe('createGuardedLlmClient: the daily quota', () => {
  it('a limit of 0 refuses every call before it reaches the model', async () => {
    const inner = new CountingClient();
    const guarded = createGuardedLlmClient(inner, {
      db,
      provider: providerName(),
      dailyLimit: 0,
      clock: () => NOV_3,
    });
    await expect(guarded.generateStructured(request('a'))).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
    expect(inner.calls).toBe(0);
  });

  it('a limit of 1 allows one call per India day; the next India day allows another', async () => {
    const inner = new CountingClient();
    const provider = providerName();
    let now = NOV_3;
    const guarded = createGuardedLlmClient(inner, {
      db,
      provider,
      dailyLimit: 1,
      clock: () => now,
    });
    const first = await guarded.generateStructured(request('first trip'));
    expect(first.data).toEqual({ text: 'Hello' });
    await expect(guarded.generateStructured(request('second trip'))).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
    expect(inner.calls).toBe(1);
    expect(await usedOn(provider, '2026-11-03')).toBe(1);

    now = NOV_4;
    await guarded.generateStructured(request('third trip'));
    expect(inner.calls).toBe(2);
    expect(await usedOn(provider, '2026-11-04')).toBe(1);
  });

  it('a model failure still counts against the quota (the call was made)', async () => {
    const inner = new CountingClient(true);
    const provider = providerName();
    const guarded = createGuardedLlmClient(inner, {
      db,
      provider,
      dailyLimit: 5,
      clock: () => NOV_3,
    });
    await expect(guarded.generateStructured(request('a'))).rejects.toThrow('provider down');
    expect(inner.calls).toBe(1);
    expect(await usedOn(provider, '2026-11-03')).toBe(1);
  });

  it('passes the inner model id through, for the stored itinerary and the cache key', () => {
    const guarded = createGuardedLlmClient(new CountingClient(), {
      db,
      provider: providerName(),
      dailyLimit: 1,
      clock: () => NOV_3,
    });
    expect(guarded.modelId).toBe('fixture');
  });
});

describe('createGuardedLlmClient: the cache (migration 0003)', () => {
  const warnings: { provider: string; reason: string }[] = [];
  const logger = {
    warn: (details: { provider: string; reason: string }) => warnings.push(details),
  };
  const guarded = (
    inner: CountingClient,
    provider: string,
    opts: { now?: () => Date; cacheDb?: typeof db } = {},
  ) =>
    createGuardedLlmClient(inner, {
      db: opts.cacheDb ?? db,
      provider,
      dailyLimit: 5,
      clock: opts.now ?? (() => NOV_3),
      ttlDays: 30,
      logger,
    });
  const rowsFor = async (provider: string) =>
    db.select().from(llmCache).where(eq(llmCache.provider, provider));

  it('an identical request twice: one model call, the second from the cache, quota up by 1 only', async () => {
    const inner = new CountingClient();
    const provider = providerName();
    const client = guarded(inner, provider);
    const first = await client.generateStructured(request('same trip'));
    const second = await client.generateStructured(request('same trip'));
    expect(first).toMatchObject({ data: { text: 'Hello' }, model: 'fixture', fromCache: false });
    expect(second).toMatchObject({ data: { text: 'Hello' }, model: 'fixture', fromCache: true });
    expect(inner.calls).toBe(1);
    expect(await usedOn(provider, '2026-11-03')).toBe(1);
    // The table holds a hash, never the prompt.
    const [row] = await rowsFor(provider);
    expect(row?.cacheKey).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain('same trip');
  });

  it('a different request misses', async () => {
    const inner = new CountingClient();
    const client = guarded(inner, providerName());
    await client.generateStructured(request('trip one'));
    const other = await client.generateStructured(request('trip two'));
    expect(other.fromCache).toBe(false);
    expect(inner.calls).toBe(2);
  });

  it('an expired row is a miss', async () => {
    const inner = new CountingClient();
    const provider = providerName();
    let now = NOV_3;
    const client = guarded(inner, provider, { now: () => now });
    await client.generateStructured(request('old trip'));
    now = new Date(NOV_3.getTime() + 31 * 86_400_000);
    const later = await client.generateStructured(request('old trip'));
    expect(later.fromCache).toBe(false);
    expect(inner.calls).toBe(2);
  });

  it('a stored reply that fails the schema is a miss, logged with a fixed code', async () => {
    const inner = new CountingClient();
    const provider = providerName();
    const client = guarded(inner, provider);
    await client.generateStructured(request('corrupt'));
    await db
      .update(llmCache)
      .set({ response: { nope: 1 } })
      .where(eq(llmCache.provider, provider));
    const again = await client.generateStructured(request('corrupt'));
    expect(again).toMatchObject({ data: { text: 'Hello' }, fromCache: false });
    expect(inner.calls).toBe(2);
    expect(warnings).toContainEqual({ provider, reason: 'cache_corrupt' });
  });

  it('a cache write that fails still returns the reply, logged with a fixed code', async () => {
    const inner = new CountingClient();
    const provider = providerName();
    // The quota still uses the real database (inside its own transaction);
    // only a direct insert, the cache write, throws.
    const failingInsert = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'insert') {
          return () => {
            throw new Error('insert refused');
          };
        }
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });
    const client = guarded(inner, provider, { cacheDb: failingInsert });
    const result = await client.generateStructured(request('no cache'));
    expect(result).toMatchObject({ data: { text: 'Hello' }, fromCache: false });
    expect(await rowsFor(provider)).toEqual([]);
    expect(warnings).toContainEqual({ provider, reason: 'cache_write_failed' });
  });

  it('a cache read that fails falls through to the model', async () => {
    const inner = new CountingClient();
    const provider = providerName();
    const failingSelect = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'select') {
          return () => {
            throw new Error('select refused');
          };
        }
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });
    const client = guarded(inner, provider, { cacheDb: failingSelect });
    const result = await client.generateStructured(request('unreadable'));
    expect(result).toMatchObject({ data: { text: 'Hello' }, fromCache: false });
    expect(inner.calls).toBe(1);
    expect(warnings).toContainEqual({ provider, reason: 'cache_read_failed' });
  });
});
