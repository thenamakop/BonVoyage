import type { Db } from '@bonvoyage/db';
import { preference, tripMember } from '@bonvoyage/db/schema';
import type { PreferenceInput } from '@bonvoyage/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { MembershipRow } from '../trips/access';
import type { Tx } from '../trips/transition-trip';

export type PreferenceRow = typeof preference.$inferSelect;

export async function findPreference(
  db: Db | Tx,
  tripMemberId: string,
): Promise<PreferenceRow | undefined> {
  const rows = await db
    .select()
    .from(preference)
    .where(eq(preference.tripMemberId, tripMemberId))
    .limit(1);
  return rows[0];
}

export async function findMembership(
  db: Db | Tx,
  tripId: string,
  userId: string,
): Promise<MembershipRow | undefined> {
  const rows = await db
    .select()
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)))
    .limit(1);
  return rows[0];
}

/** One preference per trip member: insert, or replace every answer. */
export async function upsertPreference(
  tx: Tx,
  tripMemberId: string,
  input: PreferenceInput,
  now: Date,
): Promise<void> {
  const values = {
    destinationTypes: input.destinationTypes,
    activities: input.activities,
    climate: input.climate,
    travelStyle: input.travelStyle,
    budgetMinInr: input.budgetMinInr,
    budgetMaxInr: input.budgetMaxInr,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd,
  };
  await tx
    .insert(preference)
    .values({ tripMemberId, ...values, updatedAt: now })
    .onConflictDoUpdate({ target: preference.tripMemberId, set: { ...values, updatedAt: now } });
}

/** Stamp the first submission only; a later write never moves submitted_at. */
export async function markSubmitted(tx: Tx, tripMemberId: string, at: Date): Promise<void> {
  await tx
    .update(tripMember)
    .set({ submittedAt: at })
    .where(and(eq(tripMember.id, tripMemberId), isNull(tripMember.submittedAt)));
}
