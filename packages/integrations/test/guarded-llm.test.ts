import { randomUUID } from 'node:crypto';
import { createDb } from '@bonvoyage/db';
import { providerUsage } from '@bonvoyage/db/schema';
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
