import type { Db } from '@bonvoyage/db';
import {
  costRule,
  destination,
  fareFallback,
  pastTrip,
  preference,
  recommendationItem,
  recommendationRun,
  trip,
  tripMember,
} from '@bonvoyage/db/schema';
import type { CostRules } from '@bonvoyage/engine';
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Tx } from '../trips/transition-trip';

// S2-6: the queries behind recommendation runs. Every list is one query
// (rule S6 and the R15 speed target): no per-destination or per-member loops.

export type PreferenceRow = typeof preference.$inferSelect;
export type DestinationRow = typeof destination.$inferSelect;
export type RunRow = typeof recommendationRun.$inferSelect;
export type ItemRow = typeof recommendationItem.$inferSelect;

export interface Participant {
  tripMemberId: string;
  userId: string;
  preference: PreferenceRow;
}

/** Active members who have submitted, with their preference (0004 a), oldest member first. */
export async function listParticipants(db: Db | Tx, tripId: string): Promise<Participant[]> {
  return db
    .select({ tripMemberId: tripMember.id, userId: tripMember.userId, preference })
    .from(tripMember)
    .innerJoin(preference, eq(preference.tripMemberId, tripMember.id))
    .where(
      and(
        eq(tripMember.tripId, tripId),
        eq(tripMember.status, 'active'),
        isNotNull(tripMember.submittedAt),
      ),
    )
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));
}

/**
 * Destination types each user rated 4 or 5 on a past trip to a catalogue
 * destination (0004 b, scoring.md section 3). Free-text places carry no types.
 */
export async function listLikedPastTypes(
  db: Db,
  userIds: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({ userId: pastTrip.userId, types: destination.types })
    .from(pastTrip)
    .innerJoin(destination, eq(destination.id, pastTrip.destinationId))
    .where(and(inArray(pastTrip.userId, [...userIds]), gte(pastTrip.rating, 4)));
  for (const row of rows) {
    const types = out.get(row.userId) ?? [];
    for (const t of row.types) if (!types.includes(t)) types.push(t);
    out.set(row.userId, types);
  }
  return out;
}

/**
 * Everything a recommendation depends on, as one comparable string: the trip's
 * parameters (updated_at) and each participant with their preference's
 * updated_at. Read before computing and again under the trip lock (rule S7).
 */
export async function readStalenessStamp(db: Db | Tx, tripId: string): Promise<string> {
  const [tripRow] = await db
    .select({ updatedAt: trip.updatedAt })
    .from(trip)
    .where(eq(trip.id, tripId))
    .limit(1);
  const members = await db
    .select({ id: tripMember.id, updatedAt: preference.updatedAt })
    .from(tripMember)
    .innerJoin(preference, eq(preference.tripMemberId, tripMember.id))
    .where(
      and(
        eq(tripMember.tripId, tripId),
        eq(tripMember.status, 'active'),
        isNotNull(tripMember.submittedAt),
      ),
    )
    .orderBy(asc(tripMember.id));
  const parts = members.map((m) => `${m.id}@${m.updatedAt.toISOString()}`);
  return `${tripRow?.updatedAt.toISOString() ?? 'missing'}|${parts.join(',')}`;
}

export async function listActiveDestinationRows(db: Db): Promise<DestinationRow[]> {
  return db
    .select()
    .from(destination)
    .where(eq(destination.active, true))
    .orderBy(asc(destination.slug));
}

/** Bus and train fares per destination from one origin hub (one query). */
export async function listPublicFares(
  db: Db,
  originHubId: string,
): Promise<Map<string, { busInr: number | null; trainInr: number | null }>> {
  const rows = await db
    .select({
      destinationId: fareFallback.destinationId,
      mode: fareFallback.mode,
      fare: fareFallback.farePerPersonInr,
    })
    .from(fareFallback)
    .where(
      and(eq(fareFallback.originHubId, originHubId), inArray(fareFallback.mode, ['bus', 'train'])),
    );
  const out = new Map<string, { busInr: number | null; trainInr: number | null }>();
  for (const row of rows) {
    const fares = out.get(row.destinationId) ?? { busInr: null, trainInr: null };
    if (row.mode === 'bus') fares.busInr = row.fare;
    if (row.mode === 'train') fares.trainInr = row.fare;
    out.set(row.destinationId, fares);
  }
  return out;
}

const COST_RULE_KEYS = {
  fuelPriceInrPerLitre: 'fuel_price_inr_per_litre',
  carKmPerLitre: 'car_km_per_litre',
  tollInrPerKm: 'toll_inr_per_km',
  personsPerCar: 'persons_per_car',
  carRentalInrPerDay: 'car_rental_inr_per_day',
} as const satisfies Record<keyof CostRules, string>;

/** The five car-cost inputs, or null when the catalogue has not been imported. */
export async function readCostRules(db: Db): Promise<CostRules | null> {
  const rows = await db.select({ key: costRule.key, value: costRule.value }).from(costRule);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out: Partial<CostRules> = {};
  for (const [field, key] of Object.entries(COST_RULE_KEYS) as [keyof CostRules, string][]) {
    const value = byKey.get(key);
    if (value === undefined) return null;
    out[field] = value;
  }
  return out as CostRules;
}

export async function nextRound(tx: Tx, tripId: string): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(${recommendationRun.round})` })
    .from(recommendationRun)
    .where(eq(recommendationRun.tripId, tripId));
  return (row?.max ?? 0) + 1;
}

export async function insertRun(
  tx: Tx,
  values: typeof recommendationRun.$inferInsert,
): Promise<RunRow> {
  const rows = await tx.insert(recommendationRun).values(values).returning();
  // Safe: an INSERT ... RETURNING of one row returns that row or throws.
  return rows[0]!;
}

export async function insertItems(
  tx: Tx,
  values: (typeof recommendationItem.$inferInsert)[],
): Promise<void> {
  if (values.length === 0) return;
  await tx.insert(recommendationItem).values(values);
}

export async function findLatestRun(db: Db, tripId: string): Promise<RunRow | undefined> {
  const rows = await db
    .select()
    .from(recommendationRun)
    .where(eq(recommendationRun.tripId, tripId))
    .orderBy(desc(recommendationRun.round), desc(recommendationRun.createdAt))
    .limit(1);
  return rows[0];
}

export interface ItemWithDestination {
  item: ItemRow;
  destination: { slug: string; name: string; state: string };
}

export async function listRunItems(db: Db, runId: string): Promise<ItemWithDestination[]> {
  return db
    .select({
      item: recommendationItem,
      destination: { slug: destination.slug, name: destination.name, state: destination.state },
    })
    .from(recommendationItem)
    .innerJoin(destination, eq(destination.id, recommendationItem.destinationId))
    .where(eq(recommendationItem.runId, runId))
    .orderBy(asc(recommendationItem.rank));
}

/** The destination id of `slug` when it is an item of `runId`. */
export async function findRunItemDestination(
  db: Db,
  runId: string,
  slug: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ id: destination.id })
    .from(recommendationItem)
    .innerJoin(destination, eq(destination.id, recommendationItem.destinationId))
    .where(and(eq(recommendationItem.runId, runId), eq(destination.slug, slug)))
    .limit(1);
  return rows[0]?.id;
}

export async function setSelectedDestination(
  tx: Tx,
  tripId: string,
  destinationId: string,
): Promise<void> {
  await tx
    .update(trip)
    .set({ selectedDestinationId: destinationId, updatedAt: new Date() })
    .where(eq(trip.id, tripId));
}
