import { describe, expect, it } from 'vitest';
import { explainMatch, groupSummary } from '../index';
import type { DestinationInput, MatchExplanation, MemberInput } from './types';

const member: MemberInput = {
  memberId: 'private-id',
  types: ['mountain', 'city', 'mountain'],
  activities: ['trekking', 'shopping'],
  climate: 'cold',
  likedPastTypes: ['heritage'],
  budgetMinInr: 100,
  budgetMaxInr: 1000,
  dateStart: '2026-11-01',
  dateEnd: '2026-11-05',
};
const destination: DestinationInput = {
  id: 'd1',
  slug: 'd1',
  types: ['mountain', 'heritage'],
  activities: ['trekking'],
  climate: 'cold',
  bestMonths: [11],
  minNights: 1,
};
const explanation = (overrides: Partial<MatchExplanation> = {}): MatchExplanation => ({
  metTypes: [],
  missedTypes: ['city'],
  metActivities: [],
  missedActivities: ['shopping'],
  climateMet: false,
  ...overrides,
});

describe('private match explanations', () => {
  it('lists met and missed stated wants once, never past-trip-only types or member identifiers', () => {
    const before = JSON.stringify({ member, destination });
    expect(explainMatch(member, destination)).toEqual({
      metTypes: ['mountain'],
      missedTypes: ['city'],
      metActivities: ['trekking'],
      missedActivities: ['shopping'],
      climateMet: true,
    });
    expect(JSON.stringify({ member, destination })).toBe(before);
  });

  it('handles any climate, a mismatch and no stated wants', () => {
    expect(explainMatch({ ...member, climate: 'any' }, destination).climateMet).toBe(true);
    expect(explainMatch({ ...member, climate: 'warm' }, destination).climateMet).toBe(false);
    expect(explainMatch({ ...member, types: [], activities: [] }, destination)).toEqual({
      metTypes: [],
      missedTypes: [],
      metActivities: [],
      missedActivities: [],
      climateMet: true,
    });
  });
});

describe('groupSummary', () => {
  it('counts distinct members, hides singleton values and sorts by count then value', () => {
    const explanations = [
      explanation({
        metTypes: ['mountain', 'heritage'],
        metActivities: ['trekking', 'rafting'],
        climateMet: true,
      }),
      explanation({
        metTypes: ['heritage', 'mountain', 'mountain'],
        metActivities: ['rafting'],
        climateMet: true,
      }),
      explanation({ metTypes: ['mountain'], metActivities: ['trekking'] }),
      explanation({ metTypes: ['lake'], metActivities: ['camping'], climateMet: true }),
    ];
    const before = JSON.stringify(explanations);
    expect(groupSummary(explanations, 4)).toEqual({
      memberCount: 4,
      climateMetCount: 3,
      sharedTypes: [
        { value: 'mountain', count: 3 },
        { value: 'heritage', count: 2 },
      ],
      sharedActivities: [
        { value: 'rafting', count: 2 },
        { value: 'trekking', count: 2 },
      ],
    });
    expect(JSON.stringify(explanations)).toBe(before);
  });

  it('returns an empty aggregate for no explanations', () => {
    expect(groupSummary([], 0)).toEqual({
      memberCount: 0,
      climateMetCount: 0,
      sharedTypes: [],
      sharedActivities: [],
    });
    expect(groupSummary([explanation()], 1)).toEqual({
      memberCount: 1,
      climateMetCount: 0,
      sharedTypes: [],
      sharedActivities: [],
    });
  });
});
