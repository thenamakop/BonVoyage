import { describe, expect, it } from 'vitest';
import { jaccard, memberTypeWeights, weightedJaccard } from './similarity';
import type { MemberInput } from './types';

const member: MemberInput = {
  memberId: 'm1',
  types: ['mountain'],
  likedPastTypes: ['heritage', 'mountain', 'heritage'],
  activities: [],
  climate: 'any',
  budgetMinInr: 0,
  budgetMaxInr: 1000,
  dateStart: '2026-11-01',
  dateEnd: '2026-11-05',
};

describe('similarity', () => {
  it('handles empty, identical, disjoint and partially overlapping sets', () => {
    expect(jaccard([], [])).toBe(0);
    expect(jaccard([], ['mountain'])).toBe(0);
    expect(jaccard(['mountain'], [])).toBe(0);
    expect(jaccard(['mountain'], ['city'])).toBe(0);
    expect(jaccard(['mountain', 'mountain'], ['mountain'])).toBe(1);
    expect(jaccard(new Set(['mountain', 'heritage']), new Set(['mountain', 'city']))).toBeCloseTo(
      1 / 3,
    );
  });

  it('gives stated types full weight without boosting repeated past-trip types', () => {
    const before = JSON.stringify(member);
    expect([...memberTypeWeights(member)]).toEqual([
      ['heritage', 0.5],
      ['mountain', 1],
    ]);
    expect(JSON.stringify(member)).toBe(before);
    expect(memberTypeWeights({ ...member, types: [], likedPastTypes: [] })).toEqual(new Map());
  });

  it('reproduces the weighted hand-check and reduces to ordinary Jaccard without past trips', () => {
    const destination = new Set(['mountain', 'heritage', 'city']);
    expect(weightedJaccard(memberTypeWeights(member), destination)).toBe(0.5);
    expect(jaccard(member.types, destination)).toBeCloseTo(1 / 3);
    const stated = { ...member, likedPastTypes: [] };
    expect(weightedJaccard(memberTypeWeights(stated), destination)).toBe(
      jaccard(stated.types, destination),
    );
  });

  it('handles zero weights, missing keys, member-only keys and identical weights', () => {
    expect(weightedJaccard(new Map(), new Set())).toBe(0);
    expect(weightedJaccard(new Map([['mountain', 0]]), new Set())).toBe(0);
    expect(weightedJaccard(new Map(), new Set(['city']))).toBe(0);
    expect(weightedJaccard(new Map([['mountain', 1]]), new Set())).toBe(0);
    expect(weightedJaccard(new Map([['mountain', 1]]), new Set(['mountain']))).toBe(1);
  });
});
