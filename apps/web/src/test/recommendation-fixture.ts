import type {
  DiagnosticEvaluation,
  GroupProfileReady,
  LatestRecommendationResponse,
  RecommendationItem,
  RecommendationRun,
} from '@bonvoyage/shared';

// S2-7 web tests: the shapes the S2-6 API sends (recommendations.ts), with
// demo-seed values. A test states only what it changes.

export function profileReady(over: Partial<GroupProfileReady> = {}): GroupProfileReady {
  return {
    ready: true,
    memberCount: 3,
    commonWindow: { start: '2026-11-13', end: '2026-11-15', days: 3 },
    windowFits: true,
    budgetBand: { minInr: 12000, maxInr: 16000, overlaps: true },
    perPersonCapInr: 16000,
    groupCapInr: 48000,
    typeVotes: [{ value: 'mountain', count: 3 }],
    activityVotes: [{ value: 'trekking', count: 2 }],
    climateVotes: [{ value: 'mild', count: 2 }],
    otherInterestCount: 2,
    conflicts: [],
    ...over,
  };
}

/** D1, #116: 2 contributors and a cap set by members' maxima: no budget figures arrive. */
export function profileTwoMembers(over: Partial<GroupProfileReady> = {}): GroupProfileReady {
  return profileReady({
    memberCount: 2,
    budgetBand: { minInr: null, maxInr: null, overlaps: true },
    perPersonCapInr: null,
    groupCapInr: null,
    typeVotes: [{ value: 'mountain', count: 2 }],
    activityVotes: [],
    climateVotes: [],
    ...over,
  });
}

export function item(rank: number, over: Partial<RecommendationItem> = {}): RecommendationItem {
  return {
    rank,
    destination: { slug: `place-${rank}`, name: `Place ${rank}`, state: 'Uttarakhand' },
    gfs: 0.5 - rank / 100,
    mean: 0.5,
    min: 0.4,
    sd: 0.1,
    estimatedCostInr: 27000,
    perPersonInr: 9000,
    cheapestMode: 'train',
    distanceKm: 250,
    distanceProvenance: 'estimated',
    group: {
      memberCount: 3,
      climateMetCount: 2,
      sharedTypes: [{ value: 'mountain', count: 3 }],
      sharedActivities: [{ value: 'rafting', count: 2 }],
      lowestScore10: 6,
      highestScore10: 9,
    },
    mine: {
      score10: 7.5,
      metTypes: ['mountain'],
      missedTypes: [],
      metActivities: ['trekking'],
      missedActivities: ['rafting'],
      climateMet: true,
    },
    ...over,
  };
}

export function run(over: Partial<RecommendationRun> = {}): RecommendationRun {
  return {
    id: 'run-1',
    round: 1,
    kind: 'shortlist',
    createdAt: '2026-10-26T06:00:00.000Z',
    weights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
    memberCount: 3,
    feasibleCount: 3,
    bindingConstraint: null,
    weakMatch: false,
    favoursLessServed: false,
    incomplete: [],
    diagnostic: null,
    groupProfile: profileReady(),
    ...over,
  };
}

export function nearMiss(slug: string, name: string, over: Partial<DiagnosticEvaluation> = {}) {
  return {
    slug,
    name,
    estimatedCostInr: 30000,
    cheapestMode: 'car' as const,
    failures: [
      {
        id: 'F1' as const,
        limit: 450,
        actual: 490,
        relaxation: 40,
        relative: 0.09,
        unit: 'km' as const,
      },
    ],
    ...over,
  };
}

/** A diagnostic run: 1 feasible destination, two F1 near misses and an F1 suggestion. */
export function diagnosticRun(over: Partial<RecommendationRun> = {}): RecommendationRun {
  const misses = [nearMiss('alwar', 'Alwar'), nearMiss('vrindavan', 'Vrindavan')];
  return run({
    kind: 'diagnostic',
    feasibleCount: 1,
    bindingConstraint: 'F1',
    diagnostic: {
      feasible: ['place-1'],
      nearMisses: misses,
      alternatives: misses,
      suggestions: [{ constraint: 'F1', newRadiusKm: 500, unlocks: ['alwar', 'vrindavan'] }],
      incomplete: [],
    },
    ...over,
  });
}

export function latest(
  r: RecommendationRun | null,
  items: RecommendationItem[] = [],
): LatestRecommendationResponse {
  return { run: r, items };
}

/** TripDetail.latestRecommendation for a run. */
export function summaryOf(r: RecommendationRun) {
  return { round: r.round, kind: r.kind, feasibleCount: r.feasibleCount, createdAt: r.createdAt };
}
