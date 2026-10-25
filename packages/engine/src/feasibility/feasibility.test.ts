import { describe, expect, it } from 'vitest';
import {
  buildDiagnostic,
  capSource,
  evaluateCandidate,
  monthShift,
  windowDays,
  windowMonths,
} from '../index';
import type {
  CandidateFacts,
  CostedDestination,
  DiagnosticInput,
  Evaluation,
  FeasibilityContext,
} from '../index';
import type { CostRules } from '../costs/costs';

const rules: CostRules = {
  fuelPriceInrPerLitre: 95,
  carKmPerLitre: 15,
  tollInrPerKm: 1.8,
  personsPerCar: 4,
  carRentalInrPerDay: 2000,
};

const destination = (overrides: Partial<CostedDestination> = {}): CostedDestination => ({
  id: 'd1',
  slug: 'd1',
  types: ['mountain'],
  activities: ['trekking'],
  climate: 'cold',
  bestMonths: [11],
  minNights: 2,
  stayBudgetInr: 1800,
  foodPerDayInr: 600,
  localPerDayInr: 300,
  ...overrides,
});

const facts = (overrides: Partial<CandidateFacts> = {}): CandidateFacts => ({
  destination: destination(),
  distanceKm: 250,
  distanceProvenance: 'curated',
  fares: { busInr: null, trainInr: null },
  costRules: rules,
  ...overrides,
});

const ctx = (overrides: Partial<FeasibilityContext> = {}): FeasibilityContext => ({
  n: 3,
  durationNights: 2,
  radiusKm: 300,
  groupCapInr: 30000,
  capSource: 'trip',
  perPersonCapInr: 10000,
  commonWindow: { start: '2026-11-10', end: '2026-11-14' },
  ...overrides,
});

const evaluation = (id: string, failures: Evaluation['failures'], slug = id): Evaluation => ({
  destinationId: id,
  slug,
  feasible: failures.length === 0,
  estimatedGroupCostInr: 10000,
  cheapest: { inr: 500, mode: 'car' },
  failures,
});
const failure = (
  id: Evaluation['failures'][number]['id'],
  actual: number,
  relative = actual / 10,
) => ({ id, limit: 0, actual, relaxation: actual, relative, unit: 'km' as const });
// F2 as evaluateCandidate builds it: limit = the destination's minimum nights,
// actual = the trip's nights.
const f2 = (minNights: number, tripNights = 2) => ({
  id: 'F2' as const,
  limit: minNights,
  actual: tripNights,
  relaxation: minNights - tripNights,
  relative: (minNights - tripNights) / tripNights,
  unit: 'nights' as const,
});

const profile = (blocking: boolean): DiagnosticInput['profile'] => ({
  conflicts: blocking ? [{ code: 'NO_COMMON_WINDOW' as const, blocking: true }] : [],
});
const diagnosticInput = (
  evaluations: Evaluation[],
  overrides: Partial<DiagnosticInput> = {},
): DiagnosticInput => ({
  evaluations,
  ctx: ctx(),
  profile: profile(false),
  incomplete: [],
  ...overrides,
});

describe('capSource and windowDays', () => {
  it('trip cap wins on a tie because the organiser can change it', () => {
    expect(capSource(9000, 3, 3000)).toBe('trip');
    expect(capSource(8000, 3, 3000)).toBe('trip');
    expect(capSource(9001, 3, 3000)).toBe('members');
  });

  it('counts window days inclusively', () => {
    expect(windowDays('2026-11-01', '2026-11-05')).toBe(5);
    expect(windowDays('2026-11-01', '2026-11-01')).toBe(1);
  });
});

describe('windowMonths and monthShift', () => {
  it('lists inclusive months across a year end', () => {
    expect(windowMonths('2026-11-10', '2026-11-14')).toEqual([11]);
    expect(windowMonths('2026-12-20', '2027-01-05')).toEqual([12, 1]);
    expect(windowMonths('2027-01-05', '2026-12-20')).toEqual([]);
    expect(windowMonths('nonsense', '2027-01-05')).toEqual([]);
    expect(windowMonths('2026-12-20', 'nonsense')).toEqual([]);
  });

  it('computes the smallest circular shift, capped at 6', () => {
    expect(monthShift([12, 1], [1])).toBe(0);
    expect(monthShift([1], [3])).toBe(2);
    expect(monthShift([1], [12])).toBe(1);
    expect(monthShift([1], [7])).toBe(6);
    expect(monthShift([1], [])).toBe(6);
    expect(monthShift([], [1])).toBe(6);
  });
});

describe('evaluateCandidate', () => {
  it('passes every constraint at exactly its limit', () => {
    const result = evaluateCandidate(facts(), ctx());
    expect(result).toMatchObject({
      destinationId: 'd1',
      slug: 'd1',
      feasible: true,
      failures: [],
      cheapest: { inr: 1678, mode: 'car' },
    });
    expect(result.estimatedGroupCostInr).toBe(25367);
  });

  it('computes the group cost from unrounded values, not chained rounded ones', () => {
    const result = evaluateCandidate(
      facts({
        destination: destination({ stayBudgetInr: 0, foodPerDayInr: 0, localPerDayInr: 0 }),
      }),
      ctx(),
    );
    // 6 x 1677.778 -> 10067; chaining the rounded share (1678) would give 10068.
    expect(result.cheapest.inr).toBe(1678);
    expect(result.estimatedGroupCostInr).toBe(10067);
  });

  it('fails F1 by one km over the radius', () => {
    const result = evaluateCandidate(facts({ distanceKm: 301 }), ctx());
    expect(result.feasible).toBe(false);
    expect(result.failures).toEqual([
      { id: 'F1', limit: 300, actual: 301, relaxation: 1, relative: 1 / 300, unit: 'km' },
    ]);
  });

  it('fails F2 by one night short', () => {
    const result = evaluateCandidate(facts(), ctx({ durationNights: 1 }));
    expect(result.failures).toEqual([
      { id: 'F2', limit: 2, actual: 1, relaxation: 1, relative: 1, unit: 'nights' },
    ]);
  });

  it('fails F4 with the month shift and passes when a window month is in season', () => {
    const winter = ctx({ commonWindow: { start: '2026-12-20', end: '2027-01-05' } });
    expect(evaluateCandidate(facts(), winter).failures.map((f) => f.id)).toEqual(['F4']);
    const inSeason = evaluateCandidate(
      facts({ destination: destination({ bestMonths: [1] }) }),
      winter,
    );
    expect(inSeason.feasible).toBe(true);
    const six = evaluateCandidate(facts({ destination: destination({ bestMonths: [5] }) }), ctx());
    expect(six.failures).toEqual([
      { id: 'F4', limit: 0, actual: 6, relaxation: 6, relative: 0.5, unit: 'months' },
    ]);
  });

  it('fails F5 by one rupee over the cap', () => {
    const result = evaluateCandidate(facts(), ctx({ groupCapInr: 25366 }));
    expect(result.failures).toEqual([
      { id: 'F5', limit: 25366, actual: 25367, relaxation: 1, relative: 1 / 25366, unit: 'inr' },
    ]);
  });

  it('collects multiple failures', () => {
    const result = evaluateCandidate(
      facts({ distanceKm: 400, destination: destination({ minNights: 5 }) }),
      ctx(),
    );
    expect(result.feasible).toBe(false);
    expect(result.failures.map((f) => f.id)).toEqual(['F1', 'F2']);
  });

  it('uses the cheapest mode in the group cost', () => {
    const result = evaluateCandidate(facts({ fares: { busInr: 400, trainInr: null } }), ctx());
    expect(result.cheapest).toEqual({ inr: 400, mode: 'bus' });
    // 6 x 400 = 2400 transport instead of 6 x 1677.778.
    expect(result.estimatedGroupCostInr).toBe(17700);
  });
});

describe('buildDiagnostic', () => {
  it('returns binding null when three destinations are feasible', () => {
    const result = buildDiagnostic(
      diagnosticInput(
        [
          evaluation('a', []),
          evaluation('b', []),
          evaluation('c', []),
          evaluation('near', [failure('F1', 310, 0.1)]),
        ],
        { incomplete: ['half-costed'] },
      ),
    );
    expect(result).toMatchObject({
      feasibleCount: 3,
      feasible: ['a', 'b', 'c'],
      bindingConstraint: null,
      incomplete: ['half-costed'],
    });
    expect(result.nearMisses).toHaveLength(1);
    expect(result.suggestions).toEqual([{ constraint: 'F1', newRadiusKm: 310, unlocks: ['near'] }]);
  });

  it('F5 wins a near-miss tie over F1', () => {
    const result = buildDiagnostic(
      diagnosticInput([
        evaluation('by-km', [failure('F1', 310, 0.02)]),
        evaluation('by-cost', [failure('F5', 18180, 0.01)]),
        evaluation('double', [failure('F1', 400), failure('F2', 4)]),
      ]),
    );
    expect(result.feasibleCount).toBe(0);
    expect(result.bindingConstraint).toBe('F5');
    expect(result.alternatives.map((e) => e.slug)).toEqual(['by-cost', 'by-km']);
    expect(result.suggestions).toEqual([
      { constraint: 'F1', newRadiusKm: 310, unlocks: ['by-km'] },
      {
        constraint: 'F5',
        newGroupCapInr: 18500,
        capSource: 'trip',
        newPerPersonMaxInr: undefined,
        unlocks: ['by-cost'],
      },
    ]);
  });

  it('reports binding F3 with no alternatives or suggestions on a blocking window conflict', () => {
    const result = buildDiagnostic(
      diagnosticInput([evaluation('near', [failure('F5', 99999)])], { profile: profile(true) }),
    );
    expect(result).toMatchObject({
      bindingConstraint: 'F3',
      alternatives: [],
      suggestions: [],
      feasibleCount: 0,
    });
    expect(result.nearMisses).toHaveLength(1);
  });

  it('picks the constraint with the most near misses', () => {
    const result = buildDiagnostic(
      diagnosticInput([
        evaluation('x', [failure('F1', 310)]),
        evaluation('y', [failure('F1', 320)]),
        evaluation('z', [failure('F5', 9999)]),
      ]),
    );
    expect(result.bindingConstraint).toBe('F1');
    expect(result.suggestions[0]).toEqual({
      constraint: 'F1',
      newRadiusKm: 310,
      unlocks: ['x'],
    });
  });

  it('suggests a members-side cap with newPerPersonMaxInr', () => {
    const result = buildDiagnostic(
      diagnosticInput([evaluation('pricey', [failure('F5', 18180)])], {
        ctx: ctx({ capSource: 'members', n: 3 }),
      }),
    );
    expect(result.suggestions).toEqual([
      {
        constraint: 'F5',
        newGroupCapInr: 18500,
        capSource: 'members',
        newPerPersonMaxInr: 6500,
        unlocks: ['pricey'],
      },
    ]);
  });

  it('suggests new nights but drops F2 when it would break the window (F3)', () => {
    const fits = buildDiagnostic(diagnosticInput([evaluation('long-stay', [f2(3)])]));
    expect(fits.suggestions).toEqual([{ constraint: 'F2', newNights: 3, unlocks: ['long-stay'] }]);
    const tooLong = buildDiagnostic(
      diagnosticInput([evaluation('long-stay', [f2(6)])], {
        ctx: ctx({ commonWindow: { start: '2026-11-10', end: '2026-11-15' } }),
      }),
    );
    expect(tooLong.suggestions).toEqual([]);
  });

  it('suggests the smallest minimum stay, not the current nights, and unlocks only those', () => {
    const result = buildDiagnostic(
      diagnosticInput([evaluation('three', [f2(3)]), evaluation('four', [f2(4)])]),
    );
    expect(result.suggestions).toEqual([{ constraint: 'F2', newNights: 3, unlocks: ['three'] }]);
  });

  it('suggests the smallest season shift that unlocks a near miss', () => {
    const result = buildDiagnostic(
      diagnosticInput([
        evaluation('season-a', [failure('F4', 2, 2 / 12)]),
        evaluation('season-b', [failure('F4', 5, 5 / 12)]),
      ]),
    );
    expect(result.suggestions).toEqual([
      { constraint: 'F4', shiftMonths: 2, unlocks: ['season-a'] },
    ]);
  });

  it('orders alternatives by relative relaxation then slug on a tie', () => {
    const result = buildDiagnostic(
      diagnosticInput([
        evaluation('b-slug', [failure('F1', 310, 0.1)]),
        evaluation('a-slug', [failure('F5', 999, 0.1)]),
      ]),
    );
    expect(result.alternatives.map((e) => e.slug)).toEqual(['a-slug', 'b-slug']);
    expect(result.bindingConstraint).toBe('F5');
  });

  it('returns a clean empty diagnostic when everything is feasible', () => {
    const result = buildDiagnostic(
      diagnosticInput([evaluation('a', []), evaluation('b', []), evaluation('c', [])]),
    );
    expect(result).toMatchObject({
      feasibleCount: 3,
      bindingConstraint: null,
      nearMisses: [],
      alternatives: [],
      suggestions: [],
    });
  });
});
