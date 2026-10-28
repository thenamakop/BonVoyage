import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../client';
import { costRule, destination, fareFallback, hub, poi } from '../schema';
import { loadCatalogue, type Catalogue } from './load';

// S0-5 step 5: imports packages/db/catalogue into Postgres. Refuses when the
// loader reports any error-level issue; upserts by natural key so re-runs
// update in place. Never decides review_status: it writes exactly what the
// files say (decision 0002). It deletes nothing, except with prune: places of
// interest that have left pois.csv (S3-8) and fares that have left fares.csv
// (S4-8, #126), each only for destinations (and, for fares, hubs) the files
// list.

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const CATALOGUE_TABLES = [
  'hub',
  'destination',
  'poi',
  'fare_fallback',
  'cost_rule',
] as const;
export type CatalogueTable = (typeof CATALOGUE_TABLES)[number];

/** Per table: rows added, rows whose values changed, rows already identical. */
export type ParsedImportCounts = Record<
  CatalogueTable,
  { inserted: number; updated: number; unchanged: number }
>;

/** The CLI's counts (S0-5): "updated" means an existing row was matched. */
export interface ImportCounts {
  inserted: Record<string, number>;
  updated: Record<string, number>;
  /** S3-8: places of interest the prune deleted (empty without it). */
  pruned: StalePoi[];
  /** S4-8: fares the prune deleted (empty without it). */
  prunedFares: StaleFare[];
}

export interface StalePoi {
  destinationSlug: string;
  poiKey: string;
  name: string;
}

export interface StaleFare {
  hubSlug: string;
  destinationSlug: string;
  mode: string;
  reviewStatus: string;
}

type Outcome = 'inserted' | 'updated' | 'unchanged';

// One upsert. The row is rewritten only when some value differs
// (IS DISTINCT FROM), so an identical row is left alone; xmax = 0 marks a
// freshly inserted row, so the RETURNING row tells inserted from updated.
async function upsert(
  tx: Tx,
  table: PgTable,
  target: PgColumn | PgColumn[],
  values: Record<string, unknown>,
  set: Record<string, unknown>,
  stamp: boolean,
): Promise<Outcome> {
  const cols = table as unknown as Record<string, PgColumn>;
  const keys = Object.keys(set);
  const current = sql.join(
    keys.map((k) => sql`${cols[k]!}`),
    sql`, `,
  );
  const incoming = sql.join(
    keys.map((k) => sql.raw(`excluded."${cols[k]!.name}"`)),
    sql`, `,
  );
  const changed: SQL = sql`(${current}) is distinct from (${incoming})`;
  const rows = await tx
    .insert(table)
    .values(values)
    .onConflictDoUpdate({
      target,
      set: stamp ? { ...set, updatedAt: new Date() } : set,
      setWhere: changed,
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` });
  if (rows.length === 0) return 'unchanged';
  return rows[0]!.inserted ? 'inserted' : 'updated';
}

/**
 * Writes a parsed catalogue (with no error-level issues) inside the caller's
 * transaction and returns what changed. The administrator page runs it for a
 * dry run too, then rolls the transaction back (S1-7).
 */
export async function importParsedCatalogue(
  tx: Tx,
  parsed: Pick<Catalogue, 'hubs' | 'destinations' | 'fares' | 'pois' | 'costRules'>,
): Promise<ParsedImportCounts> {
  const counts = Object.fromEntries(
    CATALOGUE_TABLES.map((t) => [t, { inserted: 0, updated: 0, unchanged: 0 }]),
  ) as ParsedImportCounts;
  const tally = (table: CatalogueTable, outcome: Outcome) => {
    counts[table][outcome] += 1;
  };

  for (const h of parsed.hubs) {
    const set = {
      name: h.name,
      state: h.state,
      lat: h.lat,
      lng: h.lng,
      sourceUrl: h.source_url ?? null,
      collectedOn: h.collected_on,
      reviewStatus: h.review_status,
    };
    tally('hub', await upsert(tx, hub, hub.slug, { slug: h.slug, ...set }, set, true));
  }

  for (const d of parsed.destinations) {
    const set = {
      name: d.name,
      state: d.state,
      lat: d.lat,
      lng: d.lng,
      types: d.types,
      activities: d.activities,
      climate: d.climate,
      bestMonths: d.best_months,
      minNights: d.min_nights,
      stayBudgetInr: d.stay_budget_inr ?? null,
      stayMidInr: d.stay_mid_inr ?? null,
      stayPremiumInr: d.stay_premium_inr ?? null,
      foodPerDayInr: d.food_per_day_inr ?? null,
      localPerDayInr: d.local_per_day_inr ?? null,
      sourceUrl: d.source_url ?? null,
      collectedOn: d.collected_on,
      reviewStatus: d.review_status,
      costSourceUrl: d.cost_source_url ?? null,
      costCollectedOn: d.cost_collected_on ?? null,
      costReviewStatus: d.cost_review_status,
    };
    tally(
      'destination',
      await upsert(tx, destination, destination.slug, { slug: d.slug, ...set }, set, true),
    );
  }

  const hubIds = new Map(
    (await tx.select({ id: hub.id, slug: hub.slug }).from(hub)).map((r) => [r.slug, r.id]),
  );
  const destIds = new Map(
    (await tx.select({ id: destination.id, slug: destination.slug }).from(destination)).map((r) => [
      r.slug,
      r.id,
    ]),
  );

  for (const p of parsed.pois) {
    const destId = destIds.get(p.destination_slug);
    if (!destId) throw new Error(`POI references unknown destination "${p.destination_slug}"`);
    const set = {
      name: p.name,
      category: p.category,
      typicalMinutes: p.typical_minutes,
      openTime: p.open_time ?? null,
      closeTime: p.close_time ?? null,
      closedDays: p.closed_days ?? [],
      entryFeeInr: p.entry_fee_inr,
      lat: p.lat,
      lng: p.lng,
      sourceUrl: p.source_url ?? null,
      collectedOn: p.collected_on,
      reviewStatus: p.review_status,
    };
    tally(
      'poi',
      await upsert(
        tx,
        poi,
        [poi.destinationId, poi.poiKey],
        { destinationId: destId, poiKey: p.poi_key, ...set },
        set,
        false,
      ),
    );
  }

  for (const f of parsed.fares) {
    const hubId = hubIds.get(f.origin_hub);
    const destId = destIds.get(f.destination_slug);
    if (!hubId) throw new Error(`fare references unknown hub "${f.origin_hub}"`);
    if (!destId) throw new Error(`fare references unknown destination "${f.destination_slug}"`);
    const set = {
      farePerPersonInr: f.fare_per_person_inr ?? null,
      durationMinutes: f.duration_minutes,
      distanceKm: f.distance_km,
      sourceUrl: f.source_url ?? null,
      collectedOn: f.collected_on,
      reviewStatus: f.review_status,
    };
    tally(
      'fare_fallback',
      await upsert(
        tx,
        fareFallback,
        [fareFallback.originHubId, fareFallback.destinationId, fareFallback.mode],
        { originHubId: hubId, destinationId: destId, mode: f.mode, ...set },
        set,
        false,
      ),
    );
  }

  for (const [key, entry] of Object.entries(parsed.costRules ?? {})) {
    const set = {
      value: entry.value,
      unit: entry.unit,
      sourceUrl: entry.source_url || null,
      collectedOn: entry.collected_on,
      reviewStatus: entry.review_status,
    };
    tally('cost_rule', await upsert(tx, costRule, costRule.key, { key, ...set }, set, false));
  }

  return counts;
}

/**
 * S3-8: places of interest in the database whose (destination, poi_key) is no
 * longer in pois.csv. Only destinations the files list are looked at, so a
 * destination outside the files keeps its places (destinations are never
 * pruned).
 */
export async function findStalePois(
  db: Db | Tx,
  parsed: Pick<Catalogue, 'destinations' | 'pois'>,
): Promise<(StalePoi & { id: string })[]> {
  const slugs = parsed.destinations.map((d) => d.slug);
  if (slugs.length === 0) return [];
  const keep = new Set(parsed.pois.map((p) => `${p.destination_slug}/${p.poi_key}`));
  const rows = await db
    .select({
      id: poi.id,
      destinationSlug: destination.slug,
      poiKey: poi.poiKey,
      name: poi.name,
    })
    .from(poi)
    .innerJoin(destination, eq(destination.id, poi.destinationId))
    .where(inArray(destination.slug, slugs))
    .orderBy(asc(destination.slug), asc(poi.poiKey));
  return rows.filter((r) => !keep.has(`${r.destinationSlug}/${r.poiKey}`));
}

/**
 * S4-8 (#126): fares in the database whose (hub, destination, mode) is no
 * longer in fares.csv. Only rows whose hub and destination the files both list
 * are looked at, so a hub or destination outside the files keeps its fares.
 */
export async function findStaleFares(
  db: Db | Tx,
  parsed: Pick<Catalogue, 'hubs' | 'destinations' | 'fares'>,
): Promise<(StaleFare & { id: string })[]> {
  const hubSlugs = parsed.hubs.map((h) => h.slug);
  const destSlugs = parsed.destinations.map((d) => d.slug);
  if (hubSlugs.length === 0 || destSlugs.length === 0) return [];
  const keep = new Set(parsed.fares.map((f) => `${f.origin_hub}/${f.destination_slug}/${f.mode}`));
  const rows = await db
    .select({
      id: fareFallback.id,
      hubSlug: hub.slug,
      destinationSlug: destination.slug,
      mode: fareFallback.mode,
      reviewStatus: fareFallback.reviewStatus,
    })
    .from(fareFallback)
    .innerJoin(hub, eq(hub.id, fareFallback.originHubId))
    .innerJoin(destination, eq(destination.id, fareFallback.destinationId))
    .where(and(inArray(hub.slug, hubSlugs), inArray(destination.slug, destSlugs)))
    .orderBy(asc(hub.slug), asc(destination.slug), asc(fareFallback.mode));
  return rows.filter((r) => !keep.has(`${r.hubSlug}/${r.destinationSlug}/${r.mode}`));
}

/** Load a directory and refuse on any error-level issue. */
export function loadCatalogueOrThrow(dir: string, opts: { today: string }): Catalogue {
  const parsed = loadCatalogue(dir, opts);
  const errors = parsed.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Catalogue import refused: ${errors.length} error(s), first: ${errors[0]!.file} ${errors[0]!.message}`,
    );
  }
  return parsed;
}

// Thrown at the end of a dry run's transaction so that it rolls back on purpose.
class DryRunRollback extends Error {}

/**
 * The CLI and seed entry point: load a directory, refuse on errors, import.
 * With `prune`, places of interest that left pois.csv and fares that left
 * fares.csv are deleted after the upsert, in the same transaction; day-plan
 * items that pointed at a pruned place keep their text (itinerary_item.poi_id
 * is ON DELETE SET NULL). With `dryRun` everything runs and is reported, then
 * rolled back: nothing is written or deleted.
 */
export async function importCatalogue(
  db: Db,
  dir: string,
  opts: { today: string; prune?: boolean; dryRun?: boolean },
): Promise<ImportCounts> {
  const parsed = loadCatalogueOrThrow(dir, opts);
  let result:
    { counts: ParsedImportCounts; pruned: StalePoi[]; prunedFares: StaleFare[] } | undefined;
  try {
    await db.transaction(async (tx) => {
      const counts = await importParsedCatalogue(tx, parsed);
      if (!opts.prune) {
        result = { counts, pruned: [], prunedFares: [] };
      } else {
        const stale = await findStalePois(tx, parsed);
        if (stale.length > 0) {
          await tx.delete(poi).where(
            inArray(
              poi.id,
              stale.map((p) => p.id),
            ),
          );
        }
        const staleFares = await findStaleFares(tx, parsed);
        if (staleFares.length > 0) {
          await tx.delete(fareFallback).where(
            inArray(
              fareFallback.id,
              staleFares.map((f) => f.id),
            ),
          );
        }
        result = {
          counts,
          pruned: stale.map(({ destinationSlug, poiKey, name }) => ({
            destinationSlug,
            poiKey,
            name,
          })),
          prunedFares: staleFares.map(({ hubSlug, destinationSlug, mode, reviewStatus }) => ({
            hubSlug,
            destinationSlug,
            mode,
            reviewStatus,
          })),
        };
      }
      if (opts.dryRun) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  // Set in the transaction, which either finished or rolled back on purpose.
  const { counts, pruned, prunedFares } = result!;
  // Keep the CLI's S0-5 meaning: "updated" counts every existing row matched,
  // changed or not. Tables with no rows in the files are left out, as before.
  const out: ImportCounts = { inserted: {}, updated: {}, pruned, prunedFares };
  for (const table of CATALOGUE_TABLES) {
    const c = counts[table];
    if (c.inserted + c.updated + c.unchanged === 0) continue;
    out.inserted[table] = c.inserted;
    out.updated[table] = c.updated + c.unchanged;
  }
  return out;
}
