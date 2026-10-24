import { assert, describe, expect, it } from 'vitest';
import {
  GOLDEN_DESTINATIONS,
  GOLDEN_GFS_ORDER,
  GOLDEN_MEAN_ORDER,
  GOLDEN_MEMBERS,
  GOLDEN_WEIGHTS,
} from './golden.fixture';
import { memberScore } from './member-score';
import { rankDestinations } from './rank';
import type { DestinationInput, MemberInput } from './types';

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

// Self-check on the golden fixture: recompute mean, population sd and GFS from
// the member scores and match section 7's expected values within 1e-6.

const { alpha, beta, gamma } = GOLDEN_WEIGHTS;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
const gfs = (xs: number[]) => alpha * mean(xs) + beta * Math.min(...xs) - gamma * sd(xs);

describe('golden fixture self-check', () => {
  for (const d of GOLDEN_DESTINATIONS) {
    it(`${d.id}: recomputed aggregates match the spec`, () => {
      expect(mean(d.memberScores)).toBeCloseTo(d.expected.mean, 6);
      expect(Math.min(...d.memberScores)).toBeCloseTo(d.expected.min, 6);
      expect(sd(d.memberScores)).toBeCloseTo(d.expected.sd, 6);
      expect(gfs(d.memberScores)).toBeCloseTo(d.expected.gfs, 6);
    });
  }

  it('GFS order is d1, d3, d2 while mean order is d1, d2, d3', () => {
    const byGfs = [...GOLDEN_DESTINATIONS]
      .sort((a, b) => gfs(b.memberScores) - gfs(a.memberScores))
      .map((d) => d.id);
    const byMean = [...GOLDEN_DESTINATIONS]
      .sort((a, b) => mean(b.memberScores) - mean(a.memberScores))
      .map((d) => d.id);
    expect(byGfs).toEqual([...GOLDEN_GFS_ORDER]);
    expect(byMean).toEqual([...GOLDEN_MEAN_ORDER]);
  });

  it('memberScore reproduces the 6.7 member scores (S2, R6)', () => {
    GOLDEN_DESTINATIONS.forEach((destination) => {
      members.forEach((member, index) => {
        const score = memberScore(member, {
          ...destination,
          slug: destination.id,
          bestMonths: [11],
          minNights: 1,
        });
        const expected = destination.memberScores[index];
        assert(expected !== undefined);
        expect(score).toBeCloseTo(expected, 6);
      });
    });
  });

  it('rankDestinations orders d1, d3, d2 (S2, R6)', () => {
    const ranked = rankDestinations(members, destinations, GOLDEN_WEIGHTS);
    expect(ranked.map((d) => d.destinationId)).toEqual([...GOLDEN_GFS_ORDER]);
    for (const destination of GOLDEN_DESTINATIONS) {
      const result = ranked.find((d) => d.destinationId === destination.id);
      assert(result);
      for (const key of ['mean', 'min', 'sd', 'gfs'] as const) {
        expect(result[key]).toBeCloseTo(destination.expected[key], 6);
      }
      expect(result.max).toBeCloseTo(Math.max(...destination.memberScores), 6);
      expect(result.memberScores.map((s) => s.memberId)).toEqual(members.map((m) => m.memberId));
      result.memberScores.forEach(({ score }, index) => {
        const expected = destination.memberScores[index];
        assert(expected !== undefined);
        expect(score).toBeCloseTo(expected, 6);
      });
    }
  });
});
