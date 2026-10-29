import { assert, describe, expect, it } from 'vitest';
import { fairnessWeights, memberDeficits } from './fairness';
import {
  GOLDEN_DESTINATIONS,
  GOLDEN_GFS_ORDER,
  GOLDEN_MEMBERS,
  GOLDEN_WEIGHTS,
} from './golden.fixture';
import { groupFit } from './group-fit';
import { rankDestinations } from './rank';
import type { DestinationInput, MemberInput } from './types';

// Golden test for docs/specs/scoring.md section 8 "Fairness across rounds (R17)":
// round 1 is section 7's example and chose d1; round 2 ranks the same three
// destinations with the weights round 1 produces. Every value to within 1e-6.

const members: MemberInput[] = GOLDEN_MEMBERS.map((m) => ({
  ...m,
  memberId: m.id,
  likedPastTypes: [],
  budgetMinInr: 0,
  budgetMaxInr: 10000,
  dateStart: '2026-11-01',
  dateEnd: '2026-11-05',
}));
const destinations: DestinationInput[] = GOLDEN_DESTINATIONS.map((d) => ({
  ...d,
  slug: d.id,
  bestMonths: [11],
  minNights: 1,
}));
const memberIds = members.map((m) => m.memberId);

const ROUND_2 = [
  {
    lambda: 0.5,
    weights: [0.94208, 1.115841, 0.94208],
    gfs: { d1: 0.117974, d2: 0.08261, d3: 0.074925 },
    order: ['d1', 'd2', 'd3'],
  },
  {
    lambda: 1,
    weights: [0.890501, 1.218997, 0.890501],
    gfs: { d1: 0.107752, d2: 0.097066, d3: 0.068044 },
    order: ['d1', 'd2', 'd3'],
  },
  {
    lambda: 2,
    weights: [0.802616, 1.394768, 0.802616],
    gfs: { d1: 0.090935, d2: 0.122755, d3: 0.056665 },
    order: ['d2', 'd1', 'd3'],
  },
] as const;

function round1() {
  const ranked = rankDestinations(members, destinations, GOLDEN_WEIGHTS);
  const top = ranked[0];
  assert(top);
  return { ranked, top };
}

describe('fairness across rounds: worked example (scoring.md section 8)', () => {
  it('round 1 is section 7 unchanged: d1, d3, d2, and d1 is the top choice', () => {
    const { ranked, top } = round1();
    expect(ranked.map((r) => r.slug)).toEqual([...GOLDEN_GFS_ORDER]);
    expect(top.slug).toBe('d1');
    expect(top.gfs).toBeCloseTo(0.12978, 6);
  });

  it('round 1 leaves m2 0.368889 below the mean on d1, and nobody else below it', () => {
    const { top } = round1();
    const topChoiceScores = Object.fromEntries(top.memberScores.map((s) => [s.memberId, s.score]));
    const deficits = memberDeficits([{ topChoiceScores }], memberIds);
    expect(deficits.m1).toBe(0);
    expect(deficits.m2).toBeCloseTo(0.368889, 6);
    expect(deficits.m3).toBe(0);
  });

  for (const example of ROUND_2) {
    it(`round 2 at lambda ${example.lambda}: weights, GFS and order`, () => {
      const { top } = round1();
      const topChoiceScores = Object.fromEntries(
        top.memberScores.map((s) => [s.memberId, s.score]),
      );
      const weights = fairnessWeights(
        memberDeficits([{ topChoiceScores }], memberIds),
        example.lambda,
      );
      memberIds.forEach((id, i) => expect(weights[id]).toBeCloseTo(example.weights[i] ?? NaN, 6));

      const ranked = rankDestinations(members, destinations, GOLDEN_WEIGHTS, weights);
      expect(ranked.map((r) => r.slug)).toEqual([...example.order]);
      const weightList = memberIds.map((id) => weights[id] ?? NaN);
      for (const result of ranked) {
        const scores = result.memberScores.map((s) => s.score);
        const fairGfs = groupFit(scores, GOLDEN_WEIGHTS, weightList).gfs;
        expect(fairGfs).toBeCloseTo(example.gfs[result.slug as keyof typeof example.gfs], 6);
        // The returned figures stay section 7's unweighted ones (E1).
        const golden = GOLDEN_DESTINATIONS.find((d) => d.id === result.slug);
        assert(golden);
        expect(result.gfs).toBeCloseTo(golden.expected.gfs, 6);
        expect(result.mean).toBeCloseTo(golden.expected.mean, 6);
        expect(result.sd).toBeCloseTo(golden.expected.sd, 6);
      }
    });
  }

  it('round 2 at lambda 0 ranks exactly as round 1', () => {
    const { ranked: first, top } = round1();
    const topChoiceScores = Object.fromEntries(top.memberScores.map((s) => [s.memberId, s.score]));
    const weights = fairnessWeights(memberDeficits([{ topChoiceScores }], memberIds), 0);
    expect(rankDestinations(members, destinations, GOLDEN_WEIGHTS, weights)).toEqual(first);
  });
});
