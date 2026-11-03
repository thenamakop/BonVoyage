import { loadCatalogue } from '@bonvoyage/db/catalogue';
import {
  COST_RULE_KEYS,
  offlineRoadKm,
  splitByCosts,
  toCostRules,
  type CandidateFacts,
  type PackageSource,
} from '@bonvoyage/engine';
import { fileURLToPath } from 'node:url';
import type { Scenario } from './generator';

export function readCatalogue(today: string) {
  const catalogue = loadCatalogue(
    fileURLToPath(new URL('../../packages/db/catalogue/', import.meta.url)),
    { today },
  );
  const errors = catalogue.issues.filter((i) => i.severity === 'error');
  if (errors.length) throw new Error(JSON.stringify(errors));
  if (!catalogue.costRules) throw new Error('The catalogue has no cost rules.');
  const rules = Object.values(COST_RULE_KEYS).map((key) => {
    const row = catalogue.costRules?.[key];
    if (!row) throw new Error(`Missing cost rule: ${key}`);
    return { key, value: row.value, verified: row.review_status };
  });
  const costRules = toCostRules(rules);
  if (!costRules) throw new Error('Incomplete cost rules.');
  const destinations = catalogue.destinations.map((d) => ({
    id: d.slug,
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
    costReviewStatus: d.cost_review_status,
  }));
  const { costed, incomplete } = splitByCosts(destinations);
  return { catalogue, rules, costRules, costed, incomplete };
}

export type EvaluationCatalogue = ReturnType<typeof readCatalogue>;

export function scenarioFacts(data: EvaluationCatalogue, scenario: Scenario) {
  const hub = data.catalogue.hubs.find((h) => h.slug === scenario.origin);
  if (!hub) throw new Error(`Missing origin: ${scenario.origin}`);
  return data.costed.map(({ row, destination }) => {
    const fares = data.catalogue.fares
      .filter((f) => f.origin_hub === hub.slug && f.destination_slug === row.slug)
      .map((f) => ({
        mode: f.mode,
        farePerPersonInr: f.fare_per_person_inr ?? null,
        distanceKm: f.distance_km,
        durationMinutes: f.duration_minutes,
        reviewStatus: f.review_status,
      }));
    const car = fares.find((f) => f.mode === 'car');
    const road = offlineRoadKm(car, hub, row);
    const facts: CandidateFacts = {
      destination,
      distanceKm: road.distanceKm,
      distanceProvenance: road.provenance,
      fares: {
        busInr: fares.find((f) => f.mode === 'bus')?.farePerPersonInr ?? null,
        trainInr: fares.find((f) => f.mode === 'train')?.farePerPersonInr ?? null,
      },
      costRules: data.costRules,
    };
    const source: PackageSource = {
      trip: scenario,
      members: scenario.members,
      hub,
      destination: row,
      fares,
      rules: data.rules,
      pois: data.catalogue.pois
        .filter((p) => p.destination_slug === row.slug)
        .map((p) => ({
          poiKey: p.poi_key,
          name: p.name,
          category: p.category,
          typicalMinutes: p.typical_minutes,
          openTime: p.open_time ?? null,
          closeTime: p.close_time ?? null,
          closedDays: p.closed_days ?? [],
          entryFeeInr: p.entry_fee_inr,
          reviewStatus: p.review_status,
        })),
    };
    return { facts, source, row };
  });
}
