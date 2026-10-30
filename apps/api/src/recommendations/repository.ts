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
  tripPackage,
  vote,
} from '@bonvoyage/db/schema';
import type { CostRules } from '@bonvoyage/engine';
import { and, asc, desc, eq, gte, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { Tx } from '../trips/transition-trip';
import type { PackageMark, RunMark, TopChoiceCandidate } from './earlier-rounds';

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

export async function findLatestRun(db: Db | Tx, tripId: string): Promise<RunRow | undefined> {
  const rows = await db
    .select()
    .from(recommendationRun)
    .where(eq(recommendationRun.tripId, tripId))
    .orderBy(desc(recommendationRun.round), desc(recommendationRun.createdAt))
    .limit(1);
  return rows[0];
}

/**
 * R17: what earlierRounds needs, in three queries whatever the number of rounds
 * (rule S6). Items are read only where they can be a top choice: rank 1, or a
 * destination some package (T9) was built for.
 */
export async function readRoundHistory(
  db: Db,
  tripId: string,
): Promise<{ runs: RunMark[]; candidates: TopChoiceCandidate[]; packages: PackageMark[] }> {
  const [runs, packages] = await Promise.all([
    db
      .select({
        id: recommendationRun.id,
        round: recommendationRun.round,
        kind: recommendationRun.kind,
        createdAt: recommendationRun.createdAt,
      })
      .from(recommendationRun)
      .where(eq(recommendationRun.tripId, tripId))
      .orderBy(asc(recommendationRun.round)),
    db
      .select({ destinationId: tripPackage.destinationId, createdAt: tripPackage.createdAt })
      .from(tripPackage)
      .where(eq(tripPackage.tripId, tripId)),
  ]);
  const shortlistIds = runs.filter((r) => r.kind === 'shortlist').map((r) => r.id);
  if (shortlistIds.length === 0) return { runs, candidates: [], packages };
  const chosenIds = [...new Set(packages.map((p) => p.destinationId))];
  const rows = await db
    .select({
      runId: recommendationItem.runId,
      destinationId: recommendationItem.destinationId,
      rank: recommendationItem.rank,
      reasons: recommendationItem.reasons,
    })
    .from(recommendationItem)
    .where(
      and(
        inArray(recommendationItem.runId, shortlistIds),
        chosenIds.length > 0
          ? or(eq(recommendationItem.rank, 1), inArray(recommendationItem.destinationId, chosenIds))
          : eq(recommendationItem.rank, 1),
      ),
    );
  const candidates = rows.map(({ reasons, ...row }) => ({
    ...row,
    scores: (reasons as { members: { tripMemberId: string; score: number }[] }).members.map(
      ({ tripMemberId, score }) => ({ tripMemberId, score }),
    ),
  }));
  return { runs, candidates, packages };
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
  db: Db | Tx,
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

export interface VoteRow {
  tripMemberId: string;
  slug: string;
}

/** R18: the run's votes by active members. Member ids stay in the service. */
export async function listRunVotes(db: Db, runId: string): Promise<VoteRow[]> {
  return db
    .select({ tripMemberId: vote.tripMemberId, slug: destination.slug })
    .from(vote)
    .innerJoin(destination, eq(destination.id, vote.destinationId))
    .innerJoin(
      tripMember,
      and(eq(tripMember.id, vote.tripMemberId), eq(tripMember.status, 'active')),
    )
    .where(eq(vote.runId, runId));
}

export async function upsertVote(
  tx: Tx,
  values: { runId: string; tripMemberId: string; destinationId: string },
): Promise<void> {
  await tx
    .insert(vote)
    .values(values)
    .onConflictDoUpdate({
      target: [vote.runId, vote.tripMemberId],
      set: { destinationId: values.destinationId, updatedAt: new Date() },
    });
}

export async function deleteVote(tx: Tx, runId: string, tripMemberId: string): Promise<void> {
  await tx.delete(vote).where(and(eq(vote.runId, runId), eq(vote.tripMemberId, tripMemberId)));
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
