// Golden test data from docs/specs/scoring.md, section 7 "Worked example"
// (the spec calls it 6.7 in the S0-6 prompt). Scoring itself lands in Sprint 2
// (R6); this file commits the expected values so the S2 work is testable.

import type { Activity, Climate, ClimatePreference, DestinationType } from '@bonvoyage/shared';

export const GOLDEN_WEIGHTS = { alpha: 0.5, beta: 0.3, gamma: 0.2 } as const;

export interface GoldenMember {
  id: string;
  types: DestinationType[];
  activities: Activity[];
  climate: ClimatePreference;
}

export interface GoldenDestination {
  id: string;
  types: DestinationType[];
  activities: Activity[];
  climate: Climate;
  memberScores: number[];
  expected: { mean: number; min: number; sd: number; gfs: number };
}

export const GOLDEN_MEMBERS: GoldenMember[] = [
  {
    id: 'm1',
    types: ['mountain', 'adventure'],
    activities: ['trekking', 'rafting', 'camping'],
    climate: 'cold',
  },
  {
    id: 'm2',
    types: ['heritage', 'city'],
    activities: ['museums', 'food_trails', 'shopping'],
    climate: 'warm',
  },
  {
    id: 'm3',
    types: ['mountain', 'spiritual'],
    activities: ['yoga_wellness', 'temples', 'trekking'],
    climate: 'mild',
  },
];

export const GOLDEN_DESTINATIONS: GoldenDestination[] = [
  {
    id: 'd1',
    types: ['spiritual', 'adventure', 'mountain'],
    activities: ['rafting', 'yoga_wellness', 'temples', 'camping'],
    climate: 'mild',
    memberScores: [0.453333, 0, 0.653333],
    expected: { mean: 0.368889, min: 0, sd: 0.273324, gfs: 0.12978 },
  },
  {
    id: 'd2',
    types: ['heritage', 'city'],
    activities: ['forts_palaces', 'museums', 'food_trails', 'shopping'],
    climate: 'warm',
    memberScores: [0, 0.925, 0],
    expected: { mean: 0.308333, min: 0, sd: 0.436049, gfs: 0.066957 },
  },
  {
    id: 'd3',
    types: ['mountain', 'adventure', 'hill_station'],
    activities: ['trekking', 'paragliding', 'camping', 'skiing'],
    climate: 'cold',
    memberScores: [0.653333, 0, 0.175],
    expected: { mean: 0.276111, min: 0, sd: 0.276138, gfs: 0.082828 },
  },
];

export const GOLDEN_GFS_ORDER = ['d1', 'd3', 'd2'] as const;
export const GOLDEN_MEAN_ORDER = ['d1', 'd2', 'd3'] as const;
