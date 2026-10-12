import type { Db } from '../client';
import { costRule, destination, fareFallback, hub, poi } from '../schema';
import { loadCatalogue } from './load';

// S0-5 step 5: imports packages/db/catalogue into Postgres. Refuses when the
// loader reports any error-level issue; upserts so re-runs update in place.

export interface ImportCounts {
  inserted: Record<string, number>;
  updated: Record<string, number>;
}

export async function importCatalogue(
  db: Db,
  dir: string,
  opts: { today: string },
): Promise<ImportCounts> {
  const { hubs, destinations, fares, pois, costRules, issues } = loadCatalogue(dir, opts);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Catalogue import refused: ${errors.length} error(s), first: ${errors[0]!.file} ${errors[0]!.message}`,
    );
  }

  return db.transaction(async (tx) => {
    const counts: ImportCounts = { inserted: {}, updated: {} };

    const existingHubs = new Set(
      (await tx.select({ slug: hub.slug }).from(hub)).map((r) => r.slug),
    );
    for (const h of hubs) {
      await tx
        .insert(hub)
        .values({
          slug: h.slug,
          name: h.name,
          state: h.state,
          lat: h.lat,
          lng: h.lng,
          sourceUrl: h.source_url ?? null,
          collectedOn: h.collected_on,
          reviewStatus: h.review_status,
        })
        .onConflictDoUpdate({
          target: hub.slug,
          set: {
            name: h.name,
            state: h.state,
            lat: h.lat,
            lng: h.lng,
            sourceUrl: h.source_url ?? null,
            collectedOn: h.collected_on,
            reviewStatus: h.review_status,
          },
        });
      counts.inserted.hub = (counts.inserted.hub ?? 0) + (existingHubs.has(h.slug) ? 0 : 1);
      counts.updated.hub = (counts.updated.hub ?? 0) + (existingHubs.has(h.slug) ? 1 : 0);
    }

    const existingDests = new Set(
      (await tx.select({ slug: destination.slug }).from(destination)).map((r) => r.slug),
    );
    for (const d of destinations) {
      await tx
        .insert(destination)
        .values({
          slug: d.slug,
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
        })
        .onConflictDoUpdate({
          target: destination.slug,
          set: {
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
          },
        });
      counts.inserted.destination =
        (counts.inserted.destination ?? 0) + (existingDests.has(d.slug) ? 0 : 1);
      counts.updated.destination =
        (counts.updated.destination ?? 0) + (existingDests.has(d.slug) ? 1 : 0);
    }

    const hubIds = new Map(
      (await tx.select({ id: hub.id, slug: hub.slug }).from(hub)).map((r) => [r.slug, r.id]),
    );
    const destIds = new Map(
      (await tx.select({ id: destination.id, slug: destination.slug }).from(destination)).map(
        (r) => [r.slug, r.id],
      ),
    );

    const existingPois = new Set(
      (await tx.select({ destId: poi.destinationId, key: poi.poiKey }).from(poi)).map(
        (r) => `${r.destId}|${r.key}`,
      ),
    );
    for (const p of pois) {
      const destId = destIds.get(p.destination_slug);
      if (!destId) throw new Error(`POI references unknown destination "${p.destination_slug}"`);
      const key = `${destId}|${p.poi_key}`;
      await tx
        .insert(poi)
        .values({
          destinationId: destId,
          poiKey: p.poi_key,
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
        })
        .onConflictDoUpdate({
          target: [poi.destinationId, poi.poiKey],
          set: {
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
          },
        });
      counts.inserted.poi = (counts.inserted.poi ?? 0) + (existingPois.has(key) ? 0 : 1);
      counts.updated.poi = (counts.updated.poi ?? 0) + (existingPois.has(key) ? 1 : 0);
    }

    const existingFares = new Set(
      (
        await tx
          .select({
            hubId: fareFallback.originHubId,
            destId: fareFallback.destinationId,
            mode: fareFallback.mode,
          })
          .from(fareFallback)
      ).map((r) => `${r.hubId}|${r.destId}|${r.mode}`),
    );
    for (const f of fares) {
      const hubId = hubIds.get(f.origin_hub);
      const destId = destIds.get(f.destination_slug);
      if (!hubId) throw new Error(`fare references unknown hub "${f.origin_hub}"`);
      if (!destId) throw new Error(`fare references unknown destination "${f.destination_slug}"`);
      const key = `${hubId}|${destId}|${f.mode}`;
      await tx
        .insert(fareFallback)
        .values({
          originHubId: hubId,
          destinationId: destId,
          mode: f.mode,
          farePerPersonInr: f.fare_per_person_inr ?? null,
          durationMinutes: f.duration_minutes,
          distanceKm: f.distance_km,
          sourceUrl: f.source_url ?? null,
          collectedOn: f.collected_on,
          reviewStatus: f.review_status,
        })
        .onConflictDoUpdate({
          target: [fareFallback.originHubId, fareFallback.destinationId, fareFallback.mode],
          set: {
            farePerPersonInr: f.fare_per_person_inr ?? null,
            durationMinutes: f.duration_minutes,
            distanceKm: f.distance_km,
            sourceUrl: f.source_url ?? null,
            collectedOn: f.collected_on,
            reviewStatus: f.review_status,
          },
        });
      counts.inserted.fare_fallback =
        (counts.inserted.fare_fallback ?? 0) + (existingFares.has(key) ? 0 : 1);
      counts.updated.fare_fallback =
        (counts.updated.fare_fallback ?? 0) + (existingFares.has(key) ? 1 : 0);
    }

    if (costRules) {
      const existingRules = new Set(
        (await tx.select({ key: costRule.key }).from(costRule)).map((r) => r.key),
      );
      for (const [key, entry] of Object.entries(costRules)) {
        await tx
          .insert(costRule)
          .values({
            key,
            value: entry.value,
            unit: entry.unit,
            sourceUrl: entry.source_url || null,
            collectedOn: entry.collected_on,
            reviewStatus: entry.review_status,
          })
          .onConflictDoUpdate({
            target: costRule.key,
            set: {
              value: entry.value,
              unit: entry.unit,
              sourceUrl: entry.source_url || null,
              collectedOn: entry.collected_on,
              reviewStatus: entry.review_status,
            },
          });
        counts.inserted.cost_rule =
          (counts.inserted.cost_rule ?? 0) + (existingRules.has(key) ? 0 : 1);
        counts.updated.cost_rule =
          (counts.updated.cost_rule ?? 0) + (existingRules.has(key) ? 1 : 0);
      }
    }

    return counts;
  });
}
