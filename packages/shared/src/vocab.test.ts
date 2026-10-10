import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  ACTIVITY_LABELS,
  CLIMATE_LABELS,
  CLIMATE_PREFERENCE_LABELS,
  CLIMATE_PREFERENCES,
  CLIMATES,
  DESTINATION_TYPE_LABELS,
  DESTINATION_TYPES,
  POI_CATEGORIES,
  POI_CATEGORY_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  TRANSPORT_MODE_LABELS,
  TRANSPORT_MODES,
  TRAVEL_STYLE_LABELS,
  TRAVEL_STYLES,
} from './vocab';

const VOCABS: ReadonlyArray<{
  name: string;
  values: readonly string[];
  labels: Record<string, string>;
}> = [
  { name: 'DESTINATION_TYPES', values: DESTINATION_TYPES, labels: DESTINATION_TYPE_LABELS },
  { name: 'ACTIVITIES', values: ACTIVITIES, labels: ACTIVITY_LABELS },
  { name: 'CLIMATES', values: CLIMATES, labels: CLIMATE_LABELS },
  { name: 'CLIMATE_PREFERENCES', values: CLIMATE_PREFERENCES, labels: CLIMATE_PREFERENCE_LABELS },
  { name: 'TRAVEL_STYLES', values: TRAVEL_STYLES, labels: TRAVEL_STYLE_LABELS },
  { name: 'TRANSPORT_MODES', values: TRANSPORT_MODES, labels: TRANSPORT_MODE_LABELS },
  { name: 'POI_CATEGORIES', values: POI_CATEGORIES, labels: POI_CATEGORY_LABELS },
  { name: 'REVIEW_STATUSES', values: REVIEW_STATUSES, labels: REVIEW_STATUS_LABELS },
];

describe('vocabularies', () => {
  for (const { name, values, labels } of VOCABS) {
    it(`${name} has no duplicates`, () => {
      expect(new Set(values).size).toBe(values.length);
    });

    it(`${name} values are snake_case`, () => {
      for (const value of values) expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
    });

    it(`${name} has a label for every value`, () => {
      for (const value of values) expect(labels[value]).toBeTruthy();
    });
  }

  it('covers every value used in the scoring spec worked example', () => {
    // docs/specs/scoring.md section 7
    const specTypes = ['mountain', 'adventure', 'heritage', 'city', 'spiritual', 'hill_station'];
    const specActivities = [
      'trekking',
      'rafting',
      'camping',
      'museums',
      'food_trails',
      'shopping',
      'yoga_wellness',
      'temples',
      'paragliding',
      'skiing',
    ];
    const specClimates = ['cold', 'mild', 'warm', 'any'];
    const specStyles = ['budget', 'comfort', 'premium'];
    for (const t of specTypes) expect(DESTINATION_TYPES).toContain(t);
    for (const a of specActivities) expect(ACTIVITIES).toContain(a);
    for (const c of specClimates) expect(CLIMATE_PREFERENCES).toContain(c);
    for (const s of specStyles) expect(TRAVEL_STYLES).toContain(s);
  });
});
