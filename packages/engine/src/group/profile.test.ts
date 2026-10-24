import { describe, expect, it } from 'vitest';
import { groupProfile } from '../index';
import type { MemberInput } from '../scoring/types';

const member = (overrides: Partial<MemberInput> = {}): MemberInput => ({
  memberId: 'm1',
  types: ['mountain'],
  activities: ['trekking'],
  climate: 'cold',
  likedPastTypes: ['heritage'],
  budgetMinInr: 1000,
  budgetMaxInr: 5000,
  dateStart: '2026-11-01',
  dateEnd: '2026-11-05',
  ...overrides,
});
const trip = { durationNights: 2, budgetTotalInr: 20000 };

describe('groupProfile', () => {
  it('intersects inclusive windows, budgets and votes without mutating members', () => {
    const members = [
      member({ types: ['mountain', 'city', 'mountain'], activities: ['trekking', 'rafting'] }),
      member({
        memberId: 'm2',
        dateStart: '2026-11-02',
        dateEnd: '2026-11-04',
        budgetMinInr: 2000,
        budgetMaxInr: 4000,
        climate: 'any',
      }),
    ];
    const before = JSON.stringify({ members, trip });
    expect(groupProfile(members, trip)).toEqual({
      memberCount: 2,
      commonWindow: { start: '2026-11-02', end: '2026-11-04', days: 3 },
      windowFits: true,
      budgetBand: { minInr: 2000, maxInr: 4000, overlaps: true },
      perPersonCapInr: 4000,
      groupCapInr: 8000,
      typeVotes: [
        { value: 'mountain', count: 2 },
        { value: 'city', count: 1 },
      ],
      activityVotes: [
        { value: 'trekking', count: 2 },
        { value: 'rafting', count: 1 },
      ],
      climateVotes: [
        { value: 'any', count: 1 },
        { value: 'cold', count: 1 },
      ],
      conflicts: [],
    });
    expect(JSON.stringify({ members, trip })).toBe(before);
    expect(groupProfile([...members].reverse(), trip)).toEqual(groupProfile(members, trip));
  });

  it('uses the trip cap when lower and accepts touching budget bands', () => {
    const members = [
      member({ budgetMinInr: 5000 }),
      member({ memberId: 'm2', budgetMaxInr: 5000 }),
    ];
    const result = groupProfile(members, { ...trip, budgetTotalInr: 6000 });
    expect(result.groupCapInr).toBe(6000);
    expect(result.budgetBand).toEqual({ minInr: 5000, maxInr: 5000, overlaps: true });
    expect(result.conflicts).toEqual([]);
    expect(result.climateVotes).toEqual([{ value: 'cold', count: 2 }]);
  });

  it('marks a two-day common window as too short for two nights', () => {
    const result = groupProfile([member(), member({ dateEnd: '2026-11-02' })], trip);
    expect(result.commonWindow).toEqual({ start: '2026-11-01', end: '2026-11-02', days: 2 });
    expect(result.windowFits).toBe(false);
    expect(result.conflicts).toEqual([{ code: 'WINDOW_TOO_SHORT', blocking: true }]);
  });

  it('returns no common window for disjoint ranges and only a warning for disjoint budgets', () => {
    const members = [
      member({ budgetMaxInr: 2000 }),
      member({ dateStart: '2026-11-06', dateEnd: '2026-11-08', budgetMinInr: 3000 }),
    ];
    const result = groupProfile(members, trip);
    expect(result.commonWindow).toBeNull();
    expect(result.windowFits).toBe(false);
    expect(result.groupCapInr).toBe(4000);
    expect(result.budgetBand).toEqual({ minInr: 3000, maxInr: 2000, overlaps: false });
    expect(result.conflicts).toEqual([
      { code: 'NO_COMMON_WINDOW', blocking: true },
      { code: 'BUDGET_BANDS_DISJOINT', blocking: false },
    ]);
    const warningOnly = groupProfile(
      [member({ budgetMaxInr: 2000 }), member({ budgetMinInr: 3000 })],
      trip,
    );
    expect(warningOnly.windowFits).toBe(true);
    expect(warningOnly.conflicts).toEqual([{ code: 'BUDGET_BANDS_DISJOINT', blocking: false }]);
  });

  it.each([
    ['2026-12-31', '2027-01-02', 3],
    ['2028-02-28', '2028-03-01', 3],
    ['2026-03-07', '2026-03-09', 3],
    ['2026-11-01', '2026-11-01', 1],
  ])(
    'counts calendar days from %s to %s without local time-zone arithmetic',
    (dateStart, dateEnd, days) => {
      expect(groupProfile([member({ dateStart, dateEnd })], trip).commonWindow).toEqual({
        start: dateStart,
        end: dateEnd,
        days,
      });
    },
  );

  it('handles empty preference lists and rejects an empty participating group', () => {
    const result = groupProfile(
      [member({ types: [], activities: [], budgetMinInr: 0, budgetMaxInr: 0 })],
      trip,
    );
    expect(result.typeVotes).toEqual([]);
    expect(result.activityVotes).toEqual([]);
    expect(result.perPersonCapInr).toBe(0);
    expect(result.groupCapInr).toBe(0);
    expect(() => groupProfile([], trip)).toThrow(RangeError);
  });
});
