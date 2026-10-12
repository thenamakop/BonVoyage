import { describe, expect, it } from 'vitest';
import {
  GOLDEN_DESTINATIONS,
  GOLDEN_GFS_ORDER,
  GOLDEN_MEAN_ORDER,
  GOLDEN_WEIGHTS,
} from './golden.fixture';

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

  it.todo('memberScore reproduces the 6.7 member scores (S2, R6)');
  it.todo('rankDestinations orders d1, d3, d2 (S2, R6)');
});
