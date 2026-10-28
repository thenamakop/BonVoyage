import type { Db } from '@bonvoyage/db';
import { llmCache } from '@bonvoyage/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';

// #121: model replies cached by a hash of the exact request, mirroring the
// distance cache. A row is fresh while expires_at is after now.

export interface LlmCacheEntry {
  provider: string;
  model: string;
  response: unknown;
}

export async function readLlmCache(db: Db, key: string, now: Date): Promise<LlmCacheEntry | null> {
  const [row] = await db
    .select({ provider: llmCache.provider, model: llmCache.model, response: llmCache.response })
    .from(llmCache)
    .where(and(eq(llmCache.cacheKey, key), gt(llmCache.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export async function writeLlmCache(
  db: Db,
  entry: LlmCacheEntry & { key: string; now: Date; ttlDays: number },
): Promise<void> {
  const expiresAt = new Date(entry.now.getTime() + entry.ttlDays * 86_400_000);
  await db
    .insert(llmCache)
    .values({
      cacheKey: entry.key,
      provider: entry.provider,
      model: entry.model,
      response: entry.response,
      createdAt: entry.now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: llmCache.cacheKey,
      set: {
        provider: sql`excluded.provider`,
        model: sql`excluded.model`,
        response: sql`excluded.response`,
        createdAt: sql`excluded.created_at`,
        expiresAt: sql`excluded.expires_at`,
      },
    });
}
