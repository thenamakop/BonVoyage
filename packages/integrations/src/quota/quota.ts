import type { Db } from '@bonvoyage/db';
import { providerUsage } from '@bonvoyage/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export class QuotaExceededError extends Error {
  constructor(readonly provider: string) {
    super(`Daily quota exhausted for ${provider}.`);
    this.name = 'QuotaExceededError';
  }
}

export async function withQuota<T>(
  db: Db,
  options: {
    provider: string;
    limit: number | null;
    calls: number;
    day: string;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const { provider, limit, calls, day } = options;
  if (
    !Number.isSafeInteger(calls) ||
    calls <= 0 ||
    (limit !== null && (!Number.isSafeInteger(limit) || limit < 0))
  ) {
    throw new RangeError('Quota calls must be positive integers and limits nonnegative integers.');
  }
  if (limit === null) return fn();
  const allowed = await db.transaction(async (tx) => {
    const [usage] = await tx
      .insert(providerUsage)
      .values({ provider, day, calls })
      .onConflictDoUpdate({
        target: [providerUsage.provider, providerUsage.day],
        set: { calls: sql`${providerUsage.calls} + ${calls}` },
      })
      .returning({ calls: providerUsage.calls });
    if (!usage) throw new Error('Quota reservation returned no usage row.');
    if (usage.calls <= limit) return true;
    await tx
      .update(providerUsage)
      .set({ calls: sql`${providerUsage.calls} - ${calls}` })
      .where(and(eq(providerUsage.provider, provider), eq(providerUsage.day, day)));
    return false;
  });
  if (!allowed) throw new QuotaExceededError(provider);
  return fn();
}
