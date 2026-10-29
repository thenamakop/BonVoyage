import { describe, expect, it } from 'vitest';
import {
  earlierRounds,
  roundWeights,
  type PackageMark,
  type RunMark,
  type TopChoiceCandidate,
} from './earlier-rounds';

// S5-2b-2 (R17, notes 1 and 2 of 29 October): which destination is each earlier
// shortlist's top choice, and when the weights are left out entirely.

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 6, minute));
const run = (round: number, minute: number, kind: RunMark['kind'] = 'shortlist'): RunMark => ({
  id: `run-${round}`,
  round,
  kind,
  createdAt: at(minute),
});
/** Rank 1 is d1 (m2 scores 0), rank 2 is d3 (m2 and m3 low). */
const ITEMS: TopChoiceCandidate[] = [
  {
    runId: 'run-1',
    destinationId: 'd1',
    rank: 1,
    scores: [
      { tripMemberId: 'm1', score: 0.6 },
      { tripMemberId: 'm2', score: 0 },
      { tripMemberId: 'm3', score: 0.6 },
    ],
  },
  {
    runId: 'run-1',
    destinationId: 'd3',
    rank: 2,
    scores: [
      { tripMemberId: 'm1', score: 0.9 },
      { tripMemberId: 'm2', score: 0 },
      { tripMemberId: 'm3', score: 0.3 },
    ],
  },
];
const pkg = (destinationId: string, minute: number): PackageMark => ({
  destinationId,
  createdAt: at(minute),
});
const D1 = { topChoiceScores: { m1: 0.6, m2: 0, m3: 0.6 } };
const D3 = { topChoiceScores: { m1: 0.9, m2: 0, m3: 0.3 } };

describe('earlierRounds', () => {
  it('no runs, or only diagnostics, give no round', () => {
    expect(earlierRounds([], [], [], Infinity)).toEqual([]);
    expect(earlierRounds([run(1, 0, 'diagnostic')], ITEMS, [], Infinity)).toEqual([]);
  });

  it('never chosen: the top choice is rank 1', () => {
    expect(earlierRounds([run(1, 0)], ITEMS, [], Infinity)).toEqual([D1]);
  });

  it('chosen then rejected (T9, T10): the packages still name the choice', () => {
    expect(earlierRounds([run(1, 0)], ITEMS, [pkg('d3', 5)], Infinity)).toEqual([D3]);
  });

  it('the latest T9 on the run wins', () => {
    const twice = [pkg('d3', 5), pkg('d3', 5), pkg('d1', 9)];
    expect(earlierRounds([run(1, 0)], ITEMS, twice, Infinity)).toEqual([D1]);
    const reversed = [pkg('d1', 5), pkg('d3', 9)];
    expect(earlierRounds([run(1, 0)], ITEMS, reversed, Infinity)).toEqual([D3]);
  });

  it("a T9 belongs to the run that was latest: a later run's packages never count", () => {
    const runs = [run(1, 0), run(2, 10, 'diagnostic'), run(3, 20)];
    // d3 chosen after round 3 (minute 25) is round 3's choice, not round 1's.
    expect(earlierRounds(runs, ITEMS, [pkg('d3', 25)], Infinity)).toEqual([D1]);
    // A package before the run existed is not its choice either.
    expect(earlierRounds([run(1, 10)], ITEMS, [pkg('d3', 5)], Infinity)).toEqual([D1]);
  });

  it('a package for a destination outside the run is ignored', () => {
    expect(earlierRounds([run(1, 0)], ITEMS, [pkg('elsewhere', 5)], Infinity)).toEqual([D1]);
  });

  it('only runs before beforeRound count, so a run never weighs itself', () => {
    const runs = [run(1, 0), run(2, 10)];
    const items = [...ITEMS, { ...ITEMS[0]!, runId: 'run-2' }];
    expect(earlierRounds(runs, items, [], 2)).toEqual([D1]);
    expect(earlierRounds(runs, items, [], 1)).toEqual([]);
    expect(earlierRounds(runs, items, [], Infinity)).toEqual([D1, D1]);
  });

  it('a shortlist run with no stored items is skipped', () => {
    expect(earlierRounds([run(1, 0)], [], [], Infinity)).toEqual([]);
  });
});

describe('roundWeights', () => {
  const ids = ['m1', 'm2', 'm3'];

  it('is undefined with no earlier round, with lambda 0, or when nobody fell short', () => {
    expect(roundWeights([], ids, 1)).toBeUndefined();
    expect(roundWeights([D1], ids, 0)).toBeUndefined();
    expect(roundWeights([{ topChoiceScores: { m1: 0.4, m2: 0.4, m3: 0.4 } }], ids, 1)).toBe(
      undefined,
    );
    // Equal deficits normalise back to 1 (here m1, m2 and m3 all missing).
    expect(roundWeights([{ topChoiceScores: { m9: 0.5 } }], ids, 2)).toBeUndefined();
  });

  it('weights the member the top choice served least, with mean 1', () => {
    const w = roundWeights([D1], ids, 1)!;
    expect(w.m2).toBeGreaterThan(1);
    expect(w.m1).toBeCloseTo(w.m3!, 12);
    expect((w.m1! + w.m2! + w.m3!) / 3).toBeCloseTo(1, 12);
  });

  it('a member scored before but excluded now gets no weight; the round mean still counts them', () => {
    // m3 left after round 1: only m1 and m2 are scored now (note 2).
    const w = roundWeights([D1], ['m1', 'm2'], 1)!;
    expect(Object.keys(w).sort()).toEqual(['m1', 'm2']);
    // Round mean 0.4: m1 has no deficit, m2 has 0.4; 1 and 1.4 normalised.
    expect(w.m1).toBeCloseTo(1 / 1.2, 12);
    expect(w.m2).toBeCloseTo(1.4 / 1.2, 12);
  });

  it('a member who joined after the earlier round has no deficit', () => {
    const w = roundWeights([D1], ['m1', 'm2', 'm3', 'm4'], 1)!;
    expect(w.m4).toBeCloseTo(w.m1!, 12);
  });
});
