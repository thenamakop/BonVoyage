import { describe, expect, it } from 'vitest';
import { groupFit, memberScore, rankDestinations } from '../index';
import { compareRankedDestinations } from './rank';
import type { DestinationInput, MemberInput, RankedDestination } from './types';

const member = (overrides: Partial<MemberInput> = {}): MemberInput => ({
  memberId: 'm1',
  types: ['mountain'],
  activities: ['trekking'],
  climate: 'cold',
  likedPastTypes: [],
  budgetMinInr: 100,
  budgetMaxInr: 1000,
  dateStart: '2026-11-01',
  dateEnd: '2026-11-05',
  ...overrides,
});
const destination = (overrides: Partial<DestinationInput> = {}): DestinationInput => ({
  id: 'a',
  slug: 'a',
  types: ['mountain'],
  activities: ['trekking'],
  climate: 'cold',
  bestMonths: [11],
  minNights: 1,
  ...overrides,
});
const weights = { alpha: 0.5, beta: 0.3, gamma: 0.2 };
const ranked = (overrides: Partial<RankedDestination> = {}): RankedDestination => ({
  destinationId: 'a',
  slug: 'a',
  gfs: 0,
  mean: 0,
  min: 0,
  max: 0,
  sd: 0,
  memberScores: [],
  ...overrides,
});

describe('memberScore', () => {
  it('uses all three components, including any, matching and mismatching climates', () => {
    expect(memberScore(member(), destination())).toBe(1);
    expect(memberScore(member({ climate: 'any' }), destination({ climate: 'warm' }))).toBe(1);
    expect(memberScore(member({ climate: 'warm' }), destination())).toBe(0.8);
    expect(memberScore(member({ types: [], activities: [], climate: 'warm' }), destination())).toBe(
      0,
    );
    expect(memberScore(member({ types: [], activities: [], climate: 'any' }), destination())).toBe(
      0.2,
    );
  });

  it('uses half-weight liked types without changing the stated type weight', () => {
    expect(
      memberScore(
        member({ likedPastTypes: ['heritage'], activities: [], climate: 'warm' }),
        destination({ types: ['mountain', 'heritage', 'city'], activities: [] }),
      ),
    ).toBe(0.25);
    expect(memberScore(member({ likedPastTypes: ['mountain'] }), destination())).toBe(1);
  });
});

describe('groupFit', () => {
  it('uses the population deviation and the supplied weights without rounding', () => {
    expect(groupFit([0, 1], { alpha: 1, beta: 2, gamma: 0.5 })).toEqual({
      mean: 0.5,
      min: 0,
      sd: 0.5,
      gfs: 0.25,
    });
    expect(groupFit([0.4], weights)).toEqual({ mean: 0.4, min: 0.4, sd: 0, gfs: 0.32 });
    expect(groupFit([0, 1], { alpha: 0, beta: 0, gamma: 2 }).gfs).toBe(-1);
  });

  it('rejects empty scores as a caller bug', () => {
    expect(() => groupFit([], weights)).toThrow(RangeError);
  });
});

describe('ranking', () => {
  it('ranks computed scores and preserves the inputs and member order', () => {
    const members = [
      member(),
      member({ memberId: 'm2', types: ['heritage'], activities: [], climate: 'warm' }),
    ];
    const destinations = [
      destination({ id: 'low', slug: 'low', types: ['city'], activities: [] }),
      destination(),
    ];
    const before = JSON.stringify({ members, destinations, weights });
    const result = rankDestinations(members, destinations, weights);
    expect(result.map((d) => d.destinationId)).toEqual(['a', 'low']);
    expect(result[0]).toMatchObject({
      slug: 'a',
      min: 0,
      max: 1,
      memberScores: [
        { memberId: 'm1', score: 1 },
        { memberId: 'm2', score: 0 },
      ],
    });
    expect(JSON.stringify({ members, destinations, weights })).toBe(before);
    expect(rankDestinations(members, [], weights)).toEqual([]);
    expect(() => rankDestinations([], destinations, weights)).toThrow(RangeError);
  });

  it('breaks an equal GFS by mean, then an equal mean by slug', () => {
    const members = [
      member({ activities: [], climate: 'any' }),
      member({ memberId: 'm2', types: ['heritage'], activities: [], climate: 'any' }),
    ];
    const input = [
      destination({ id: 'b', slug: 'b', types: ['city'], activities: [] }),
      destination({ id: 'z', slug: 'z', activities: [] }),
      destination({ id: 'a', slug: 'a', activities: [] }),
    ];
    expect(
      rankDestinations(members, input, { alpha: 0, beta: 1, gamma: 0 }).map((d) => d.slug),
    ).toEqual(['a', 'z', 'b']);
  });

  it('applies the 1e-12 tolerance at each numeric key and a deterministic text order', () => {
    expect(compareRankedDestinations(ranked({ gfs: 0.5 }), ranked({ gfs: 0.2 }))).toBeLessThan(0);
    expect(compareRankedDestinations(ranked({ gfs: 0.2 }), ranked({ gfs: 0.5 }))).toBeGreaterThan(
      0,
    );
    expect(
      compareRankedDestinations(ranked({ mean: 0.5 }), ranked({ gfs: 1e-13, mean: 0.2 })),
    ).toBeLessThan(0);
    expect(compareRankedDestinations(ranked({ slug: 'z', mean: 1e-13 }), ranked())).toBeGreaterThan(
      0,
    );
    expect(compareRankedDestinations(ranked(), ranked({ slug: 'z' }))).toBeLessThan(0);
    expect(compareRankedDestinations(ranked(), ranked())).toBe(0);
    expect(
      compareRankedDestinations(ranked({ slug: 'z', gfs: 1e-12, mean: 1e-12 }), ranked()),
    ).toBeGreaterThan(0);
    expect(compareRankedDestinations(ranked({ slug: 'z', mean: 2e-12 }), ranked())).toBeLessThan(0);
  });
});
