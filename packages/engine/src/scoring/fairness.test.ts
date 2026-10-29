import { describe, expect, it } from 'vitest';
import { fairnessWeights, groupFit, memberDeficits, rankDestinations } from '../index';
import type { DestinationInput, MemberInput } from './types';

// R17, scoring.md section 8: deficits from earlier shortlists' top choices,
// weights normalised to mean 1, and the weighted group fit.

const weights = { alpha: 0.5, beta: 0.3, gamma: 0.2 };

describe('memberDeficits', () => {
  it('is 0 for everyone with no earlier round', () => {
    expect(memberDeficits([], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });

  it('measures how far each member fell below the round mean, never above it', () => {
    // Mean 0.5: a is 0.4 below it, b is above and gets 0.
    expect(memberDeficits([{ topChoiceScores: { a: 0.1, b: 0.9 } }], ['a', 'b'])).toEqual({
      a: 0.4,
      b: 0,
    });
  });

  it('gives every member 0 when the top choice served them equally', () => {
    expect(
      memberDeficits([{ topChoiceScores: { a: 0.6, b: 0.6, c: 0.6 } }], ['a', 'b', 'c']),
    ).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('averages over all earlier rounds', () => {
    const deficits = memberDeficits(
      [{ topChoiceScores: { a: 0, b: 1 } }, { topChoiceScores: { a: 0.6, b: 0.2 } }],
      ['a', 'b'],
    );
    // a: (0.5 + 0) / 2; b: (0 + 0.2) / 2.
    expect(deficits.a).toBeCloseTo(0.25, 12);
    expect(deficits.b).toBeCloseTo(0.1, 12);
  });

  it('counts 0 for a round that did not score the member (joined later)', () => {
    const deficits = memberDeficits(
      [{ topChoiceScores: { a: 0, b: 1 } }, { topChoiceScores: { a: 0, b: 1, c: 0.2 } }],
      ['a', 'b', 'c'],
    );
    // Round 2's mean (0.4) includes c; c was not in round 1, so c's 0.2 is halved.
    expect(deficits.a).toBeCloseTo((0.5 + 0.4) / 2, 12);
    expect(deficits.b).toBe(0);
    expect(deficits.c).toBeCloseTo(0.2 / 2, 12);
  });

  it('works for one member, whose deficit is always 0', () => {
    expect(memberDeficits([{ topChoiceScores: { a: 0.3 } }], ['a'])).toEqual({ a: 0 });
  });
});

describe('fairnessWeights', () => {
  it('is 1 for everyone when lambda is 0', () => {
    expect(fairnessWeights({ a: 0.4, b: 0 }, 0)).toEqual({ a: 1, b: 1 });
  });

  it('is 1 for everyone when every deficit is 0', () => {
    expect(fairnessWeights({ a: 0, b: 0, c: 0 }, 1)).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('normalises to a mean weight of 1 for 2 members', () => {
    // Raw 1.5 and 1, mean 1.25.
    const w = fairnessWeights({ a: 0.5, b: 0 }, 1);
    expect(w.a).toBeCloseTo(1.2, 12);
    expect(w.b).toBeCloseTo(0.8, 12);
    expect((w.a ?? 0) + (w.b ?? 0)).toBeCloseTo(2, 12);
  });

  it('gives a single member weight 1', () => {
    expect(fairnessWeights({ a: 0.7 }, 2)).toEqual({ a: 1 });
  });

  it('returns no weights for no members', () => {
    expect(fairnessWeights({}, 1)).toEqual({});
  });

  it('rejects a negative or non-finite lambda as a caller bug', () => {
    expect(() => fairnessWeights({ a: 0 }, -0.1)).toThrow(RangeError);
    expect(() => fairnessWeights({ a: 0 }, Number.NaN)).toThrow(RangeError);
    expect(() => fairnessWeights({ a: 0 }, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('groupFit with member weights', () => {
  it('weights the mean and the sd but not the min', () => {
    // Weights 1.5 and 0.5: mean_w = (0 + 0.5) / 2 = 0.25;
    // sd_w = sqrt((1.5 x 0.0625 + 0.5 x 0.5625) / 2) = sqrt(0.1875).
    const fit = groupFit([0, 1], weights, [1.5, 0.5]);
    expect(fit.mean).toBeCloseTo(0.25, 12);
    expect(fit.min).toBe(0);
    expect(fit.sd).toBeCloseTo(Math.sqrt(0.1875), 12);
    expect(fit.gfs).toBeCloseTo(0.5 * 0.25 - 0.2 * Math.sqrt(0.1875), 12);
  });

  it('equals the unweighted group fit exactly when every weight is 1', () => {
    const scores = [0.453333, 0, 0.653333];
    expect(groupFit(scores, weights, [1, 1, 1])).toEqual(groupFit(scores, weights));
  });

  it('rejects a weight list of the wrong length as a caller bug', () => {
    expect(() => groupFit([0, 1], weights, [1])).toThrow(RangeError);
  });
});

describe('rankDestinations with member weights', () => {
  const member = (memberId: string, types: MemberInput['types']): MemberInput => ({
    memberId,
    types,
    activities: [],
    climate: 'any',
    likedPastTypes: [],
    budgetMinInr: 100,
    budgetMaxInr: 1000,
    dateStart: '2026-11-01',
    dateEnd: '2026-11-05',
  });
  const destination = (slug: string, types: DestinationInput['types']): DestinationInput => ({
    id: slug,
    slug,
    types,
    activities: [],
    climate: 'cold',
    bestMonths: [11],
    minNights: 1,
  });
  // Two members want mountains, one wants a beach; unweighted, the mountain wins.
  const members = [member('a', ['mountain']), member('b', ['mountain']), member('c', ['beach'])];
  const destinations = [destination('hills', ['mountain']), destination('coast', ['beach'])];

  it('ranks as today without weights', () => {
    expect(rankDestinations(members, destinations, weights).map((r) => r.slug)).toEqual([
      'hills',
      'coast',
    ]);
  });

  it('ranks by the weighted GFS but returns the unweighted figures (E1)', () => {
    const plain = rankDestinations(members, destinations, weights);
    const fair = rankDestinations(members, destinations, weights, { a: 0.5, b: 0.5, c: 2 });
    expect(fair.map((r) => r.slug)).toEqual(['coast', 'hills']);
    for (const result of fair) {
      const same = plain.find((r) => r.slug === result.slug);
      expect(result).toEqual(same);
    }
  });

  it('rejects weights that miss a member as a caller bug', () => {
    expect(() => rankDestinations(members, destinations, weights, { a: 1, b: 1 })).toThrow(
      RangeError,
    );
  });
});
