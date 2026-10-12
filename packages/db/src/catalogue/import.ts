import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../client';
import { costRule, destination, fareFallback, hub, poi } from '../schema';
import { loadCatalogue, type Catalogue } from './load';

// S0-5 step 5: imports packages/db/catalogue into Postgres. Refuses when the
// loader reports any error-level issue; upserts by natural key so re-runs
// update in place. Never deletes a row and never decides review_status: it
// writes exactly what the files say (decision 0002).

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

/** The CLI and seed entry point: load a directory, refuse on errors, import. */
export async function importCatalogue(
  db: Db,
  dir: string,
  opts: { today: string },
): Promise<ImportCounts> {
  const parsed = loadCatalogue(dir, opts);
  const errors = parsed.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Catalogue import refused: ${errors.length} error(s), first: ${errors[0]!.file} ${errors[0]!.message}`,
    );
  }
  const counts = await db.transaction((tx) => importParsedCatalogue(tx, parsed));
  // Keep the CLI's S0-5 meaning: "updated" counts every existing row matched,
  // changed or not. Tables with no rows in the files are left out, as before.
  const out: ImportCounts = { inserted: {}, updated: {} };
  for (const table of CATALOGUE_TABLES) {
    const c = counts[table];
    if (c.inserted + c.updated + c.unchanged === 0) continue;
    out.inserted[table] = c.inserted;
    out.updated[table] = c.updated + c.unchanged;
  }
  return out;
}
