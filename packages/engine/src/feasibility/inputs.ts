import type { Activity, Climate, ClimatePreference, DestinationType } from '@bonvoyage/shared';
import type { CostRules } from '../costs/costs';
import type { GroupProfile } from '../group/profile';
import type { DestinationInput, MemberInput } from '../scoring/types';
import { capSource } from './context';
import type { CostedDestination, FeasibilityContext } from './types';

// S5-5 (#140): plain rows to engine inputs, shared by the API and the offline harness so
// the harness measures the app and not a copy. The engine cannot import packages/db, so
// each row is described here by the fields it needs.

export interface PreferenceFields {
  destinationTypes: readonly string[];
  activities: readonly string[];
  climate: ClimatePreference;
  budgetMinInr: number;
  budgetMaxInr: number;
  dateStart: string;
  dateEnd: string;
}

export interface DestinationFields {
  id: string;
  slug: string;
  types: readonly string[];
  activities: readonly string[];
  climate: Climate;
  bestMonths: number[];
  minNights: number;
  stayBudgetInr: number | null;
  foodPerDayInr: number | null;
  localPerDayInr: number | null;
}

export function toMemberInput(
  memberId: string,
  preference: PreferenceFields,
  likedPastTypes: readonly string[],
): MemberInput {
  return {
    memberId,
    types: preference.destinationTypes as DestinationType[],
    activities: preference.activities as Activity[],
    climate: preference.climate,
    likedPastTypes: likedPastTypes as DestinationType[],
    budgetMinInr: preference.budgetMinInr,
    budgetMaxInr: preference.budgetMaxInr,
    dateStart: preference.dateStart,
    dateEnd: preference.dateEnd,
  };
}

export function toDestinationInput(d: DestinationFields): DestinationInput {
  return {
    id: d.id,
    slug: d.slug,
    types: d.types as DestinationType[],
    activities: d.activities as Activity[],
    climate: d.climate,
    bestMonths: d.bestMonths,
    minNights: d.minNights,
  };
}

/** 0004 e: a candidate needs its budget stay, food and local costs. */
export function toCosted(d: DestinationFields): CostedDestination | null {
  if (d.stayBudgetInr === null || d.foodPerDayInr === null || d.localPerDayInr === null) {
    return null;
  }
  return {
    ...toDestinationInput(d),
    stayBudgetInr: d.stayBudgetInr,
    foodPerDayInr: d.foodPerDayInr,
    localPerDayInr: d.localPerDayInr,
  };
}

/** 0004 e: the rows that can be candidates, and the slugs left out for missing costs. */
export function splitByCosts<R extends DestinationFields>(
  rows: readonly R[],
): { costed: { row: R; destination: CostedDestination }[]; incomplete: string[] } {
  const costed: { row: R; destination: CostedDestination }[] = [];
  const incomplete: string[] = [];
  for (const row of rows) {
    const destination = toCosted(row);
    if (destination) costed.push({ row, destination });
    else incomplete.push(row.slug);
  }
  return { costed, incomplete };
}

/**
 * The context F1, F2, F4 and F5 are evaluated in. Null when the window blocks (F3, 0004 c):
 * the group goes back with no candidate evaluated.
 */
export function feasibilityContext(
  trip: { durationNights: number; budgetTotalInr: number; radiusKm: number },
  profile: GroupProfile,
): FeasibilityContext | null {
  if (profile.commonWindow === null || profile.conflicts.some((c) => c.blocking)) return null;
  return {
    n: profile.memberCount,
    durationNights: trip.durationNights,
    radiusKm: trip.radiusKm,
    groupCapInr: profile.groupCapInr,
    capSource: capSource(trip.budgetTotalInr, profile.memberCount, profile.perPersonCapInr),
    perPersonCapInr: profile.perPersonCapInr,
    commonWindow: { start: profile.commonWindow.start, end: profile.commonWindow.end },
  };
}

/** Bus and train fares per destination, from fare rows of one origin hub. */
export function toPublicFares(
  rows: readonly { destinationId: string; mode: string; fare: number | null }[],
): Map<string, { busInr: number | null; trainInr: number | null }> {
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

/** The five car-cost inputs, or null when any is missing (the catalogue is not imported). */
export function toCostRules(rows: readonly { key: string; value: number }[]): CostRules | null {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out: Partial<CostRules> = {};
  for (const [field, key] of Object.entries(COST_RULE_KEYS) as [keyof CostRules, string][]) {
    const value = byKey.get(key);
    if (value === undefined) return null;
    out[field] = value;
  }
  return out as CostRules;
}
