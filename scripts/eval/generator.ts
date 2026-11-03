import type { Catalogue } from '@bonvoyage/db/catalogue';
import { addDaysUtc, toMemberInput, type MemberInput } from '@bonvoyage/engine';
import { PreferenceInput, TRAVEL_STYLES } from '@bonvoyage/shared';

export interface Scenario {
  seed: number;
  index: number;
  origin: 'gurugram' | 'delhi';
  durationNights: number;
  radiusKm: number;
  budgetTotalInr: number;
  tight: boolean;
  preferences: PreferenceInput[];
  members: MemberInput[];
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateScenario(catalogue: Catalogue, seed: number, index: number): Scenario {
  const random = mulberry32((seed + Math.imul(index, 0x9e3779b9)) >>> 0);
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T>(values: readonly T[]): T => {
    const value = values[integer(0, values.length - 1)];
    if (value === undefined) throw new Error('The catalogue vocabulary is empty.');
    return value;
  };
  const sample = <T>(values: readonly T[], count: number): T[] => {
    const pool = [...values];
    const out: T[] = [];
    while (out.length < count && pool.length) {
      const [value] = pool.splice(integer(0, pool.length - 1), 1);
      if (value !== undefined) out.push(value);
    }
    return out;
  };
  const vocabulary = <T>(values: T[]) => [...new Set(values)].sort();
  const types = vocabulary(catalogue.destinations.flatMap((d) => d.types));
  const activities = vocabulary(catalogue.destinations.flatMap((d) => d.activities));
  const climates = vocabulary(catalogue.destinations.map((d) => d.climate));
  const size = integer(2, 8);
  const origin = pick(['gurugram', 'delhi'] as const);
  const durationNights = integer(1, 3);
  const radiusKm = integer(150, 400);
  const start = addDaysUtc('2026-11-01', integer(0, 116));
  const end = addDaysUtc(start, durationNights);
  const tight = random() < 1 / 3;
  const targetPerPerson = tight ? integer(1500, 3500) : integer(6000, 14000);
  const budgetTotalInr = size * targetPerPerson * pick([1, 2]);
  const preferences = Array.from({ length: size }, () => {
    const budgetMaxInr = integer(targetPerPerson, targetPerPerson * 2);
    return PreferenceInput.parse({
      destinationTypes: sample(types, integer(1, 3)),
      activities: sample(activities, integer(1, 4)),
      climate: pick(climates),
      travelStyle: pick(TRAVEL_STYLES),
      budgetMinInr: integer(0, Math.floor(budgetMaxInr / 2)),
      budgetMaxInr,
      dateStart: start,
      dateEnd: end,
    });
  });
  return {
    seed,
    index,
    origin,
    durationNights,
    radiusKm,
    budgetTotalInr,
    tight,
    preferences,
    members: preferences.map((p, i) => toMemberInput(`m${i}`, p, [])),
  };
}
