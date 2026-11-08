import { describe, expect, it } from 'vitest';
import {
  buildDiagnostic,
  SHORTLIST_SIZE,
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
  tripBudgetInr: 30000,
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
    // #132: one budget miss cannot make three feasible, so no budget suggestion.
    expect(result.suggestions).toEqual([
      { constraint: 'F1', newRadiusKm: 310, unlocks: ['by-km'] },
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
      diagnosticInput(
        [
          evaluation('cheap', [failure('F5', 16000)]),
          evaluation('mid', [failure('F5', 17000)]),
          evaluation('pricey', [failure('F5', 18180)]),
        ],
        { ctx: ctx({ capSource: 'members', n: 3 }) },
      ),
    );
    expect(result.suggestions).toEqual([
      {
        constraint: 'F5',
        newGroupCapInr: 18500,
        capSource: 'members',
        newPerPersonMaxInr: 6500,
        unlocks: ['cheap', 'mid', 'pricey'],
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

  // #132, modelled on the Tight budget trip without the Gurugram trains: the
  // cheapest miss alone (₹14,000 would add Bikaner only) leaves round 2 a diagnostic.
  it('the F5 amount reaches a shortlist: one cheap miss, two expensive ones (#132)', () => {
    const result = buildDiagnostic(
      diagnosticInput([
        evaluation('bikaner', [failure('F5', 13860)]),
        evaluation('mathura', [failure('F5', 14650)]),
        evaluation('vrindavan', [failure('F5', 15008)]),
      ]),
    );
    expect(result.suggestions).toEqual([
      {
        constraint: 'F5',
        newGroupCapInr: 15500,
        capSource: 'trip',
        newPerPersonMaxInr: undefined,
        unlocks: ['bikaner', 'mathura', 'vrindavan'],
      },
    ]);
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

// #132 (0004, amended 2026-11-03): the F5 amount is the smallest ₹500 step at which the
// places already feasible plus the budget misses it covers reach SHORTLIST_SIZE.
describe('the F5 suggestion reaches a shortlist (#132)', () => {
  const ok = (slug: string) => evaluation(slug, []);
  const over = (slug: string, cost: number) => evaluation(slug, [failure('F5', cost)]);
  const f5Of = (evaluations: Evaluation[], overrides: Partial<DiagnosticInput> = {}) =>
    buildDiagnostic(diagnosticInput(evaluations, overrides)).suggestions.find(
      (s) => s.constraint === 'F5',
    );

  it('SHORTLIST_SIZE is the T6 guard, 3', () => {
    expect(SHORTLIST_SIZE).toBe(3);
  });

  it('0 budget misses: no budget suggestion', () => {
    expect(f5Of([evaluation('far', [failure('F1', 310)])])).toBeUndefined();
  });

  it('1 or 2 budget misses with nothing feasible: no budget suggestion, F5 still binds', () => {
    expect(f5Of([over('a', 9000)])).toBeUndefined();
    const two = buildDiagnostic(diagnosticInput([over('a', 9000), over('b', 9500)]));
    expect(two.suggestions).toEqual([]);
    expect(two.bindingConstraint).toBe('F5');
  });

  it('3 or more budget misses: covers the third cheapest, not the fourth', () => {
    expect(
      f5Of([over('d', 16200), over('c', 15800), over('a', 9000), over('b', 12100)]),
    ).toMatchObject({ newGroupCapInr: 16000, unlocks: ['a', 'b', 'c'] });
  });

  it('places already feasible count towards the three', () => {
    // 2 feasible: the cheapest miss is enough.
    expect(f5Of([ok('x'), ok('y'), over('a', 9000), over('b', 12100)])).toMatchObject({
      newGroupCapInr: 9000,
      unlocks: ['a'],
    });
    // 1 feasible: the second cheapest; 2 budget misses suffice.
    expect(f5Of([ok('x'), over('a', 9000), over('b', 12100)])).toMatchObject({
      newGroupCapInr: 12500,
      unlocks: ['a', 'b'],
    });
    // 1 feasible and 1 budget miss: still short of three, so none.
    expect(f5Of([ok('x'), over('a', 9000)])).toBeUndefined();
  });

  it('already a shortlist: the amount still adds at least one place', () => {
    expect(f5Of([ok('x'), ok('y'), ok('z'), over('a', 9000), over('b', 12100)])).toMatchObject({
      newGroupCapInr: 9000,
      unlocks: ['a'],
    });
  });

  it('ties: every miss at the covered cost is added', () => {
    expect(
      f5Of([over('a', 9000), over('b', 11000), over('c', 11000), over('d', 11000)]),
    ).toMatchObject({ newGroupCapInr: 11000, unlocks: ['a', 'b', 'c', 'd'] });
  });

  it('a place failing another constraint never counts, however cheap', () => {
    const cheapButFar = evaluation('far', [failure('F1', 310), failure('F5', 5000)]);
    expect(f5Of([cheapButFar, over('a', 9000), over('b', 9500)])).toBeUndefined();
    expect(f5Of([cheapButFar, over('a', 9000), over('b', 9500), over('c', 9800)])).toMatchObject({
      newGroupCapInr: 10000,
      unlocks: ['a', 'b', 'c'],
    });
  });

  it('rounds up to ₹500 and lists every miss under the rounded amount', () => {
    // Exactly on a step: no rounding.
    expect(f5Of([over('a', 9000), over('b', 9500), over('c', 15000)])).toMatchObject({
      newGroupCapInr: 15000,
    });
    // One rupee over a step goes to the next; a fourth miss inside the step is added too.
    expect(
      f5Of([
        over('a', 9000),
        over('b', 9500),
        over('c', 15001),
        over('d', 15400),
        over('e', 15501),
      ]),
    ).toMatchObject({ newGroupCapInr: 15500, unlocks: ['a', 'b', 'c', 'd'] });
  });

  it('a trip cap: never above n × the lowest maximum, which the trip budget cannot pass', () => {
    // 3 × 4000 = 12000 is as far as raising the trip budget can take the cap.
    const capped = { ctx: ctx({ capSource: 'trip', n: 3, perPersonCapInr: 4000 }) };
    expect(f5Of([over('a', 9000), over('b', 9500), over('c', 12000)], capped)).toMatchObject({
      newGroupCapInr: 12000,
    });
    // #163: crossing the members' side is marked, not dropped.
    expect(f5Of([over('a', 9000), over('b', 9500), over('c', 12100)], capped)).toMatchObject({
      newGroupCapInr: 12500,
      capSource: 'trip',
      raisesBoth: true,
      unlocks: ['a', 'b', 'c'],
    });
  });

  it('a members cap: never above the trip budget; "adds" follows the cap really reached', () => {
    const members = (tripBudgetInr: number) => ({
      ctx: ctx({ capSource: 'members', n: 4, tripBudgetInr }),
    });
    const four = [over('a', 9000), over('b', 9500), over('c', 15001), over('d', 15900)];
    // 15500 / 4 rounds up to 4000 each, so the cap reaches 16000 and adds d too.
    expect(f5Of(four, members(40000))).toMatchObject({
      newGroupCapInr: 15500,
      newPerPersonMaxInr: 4000,
      unlocks: ['a', 'b', 'c', 'd'],
    });
    // A trip budget of 15800 stops it there, so d stays out.
    expect(f5Of(four, members(15800))).toMatchObject({ unlocks: ['a', 'b', 'c'] });
    // #163: below the new cap both sides must rise; the per-person target stays.
    expect(f5Of(four, members(15000))).toMatchObject({
      newGroupCapInr: 15500,
      capSource: 'members',
      newPerPersonMaxInr: 4000,
      raisesBoth: true,
      unlocks: ['a', 'b', 'c'],
    });
  });

  it("raisesBoth: the trip budget binds and members' maxima would be crossed (#163)", () => {
    const capped = { ctx: ctx({ capSource: 'trip', n: 3, perPersonCapInr: 4000 }) };
    const s = f5Of([over('a', 9000), over('b', 9500), over('c', 12100)], capped);
    expect(s).toMatchObject({
      newGroupCapInr: 12500,
      capSource: 'trip',
      raisesBoth: true,
      unlocks: ['a', 'b', 'c'],
    });
  });

  it('fewer budget misses than the shortlist needs: still no suggestion (#163)', () => {
    const capped = { ctx: ctx({ capSource: 'trip', n: 3, perPersonCapInr: 4000 }) };
    expect(f5Of([over('a', 99000)], capped)).toBeUndefined();
    expect(f5Of([over('a', 9000), over('b', 9500)], capped)).toBeUndefined();
  });

  it('members set the cap: the per-person maximum follows the new group cap', () => {
    expect(
      f5Of([over('a', 9000), over('b', 9500), over('c', 15001)], {
        ctx: ctx({ capSource: 'members', n: 4 }),
      }),
    ).toEqual({
      constraint: 'F5',
      newGroupCapInr: 15500,
      capSource: 'members',
      newPerPersonMaxInr: 4000,
      unlocks: ['a', 'b', 'c'],
    });
  });
});
