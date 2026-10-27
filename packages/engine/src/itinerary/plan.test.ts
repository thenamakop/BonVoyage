import { describe, expect, it } from 'vitest';
import type { Activity } from '@bonvoyage/shared';
import {
  addDaysUtc,
  planDays,
  placeFits,
  unusedPlacesFitting,
  weekdayOf,
  type PlannerPlace,
  type PlanInput,
} from './plan';

function place(overrides: Partial<PlannerPlace> & { key: string }): PlannerPlace {
  return {
    name: overrides.key,
    category: 'sight',
    typicalMinutes: 60,
    openTime: null,
    closeTime: null,
    closedDays: [],
    entryFeeInr: 0,
    verified: true,
    ...overrides,
  };
}

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    startDate: '2026-11-06', // a Friday
    nights: 2,
    onward: { mode: 'train', durationMinutes: 300 },
    ret: { mode: 'train', durationMinutes: 300 },
    stayTier: 'mid',
    places: [],
    groupInterests: [],
    ...overrides,
  };
}

describe('addDaysUtc and weekdayOf', () => {
  it('moves across a month boundary on the UTC calendar', () => {
    expect(addDaysUtc('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDaysUtc('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('returns the UTC weekday (0 is Sunday)', () => {
    expect(weekdayOf('2026-11-06')).toBe(5);
    expect(weekdayOf('2026-11-08')).toBe(0);
  });
});

describe('placeFits', () => {
  it('accepts a place with no hours in any slot', () => {
    const p = place({ key: 'open' });
    expect(placeFits(p, 60, 1300, 2)).toBe(true);
  });

  it('rejects a slot ending past 23:59', () => {
    expect(placeFits(place({ key: 'x' }), 1380, 1440, 2)).toBe(false);
  });

  it('rejects a place closed on the slot weekday', () => {
    expect(placeFits(place({ key: 'x', closedDays: [1] }), 600, 660, 1)).toBe(false);
    expect(placeFits(place({ key: 'x', closedDays: [1] }), 600, 660, 2)).toBe(true);
  });

  it('rejects a slot that runs past the closing time or before opening', () => {
    const p = place({ key: 'x', openTime: '10:00', closeTime: '16:00' });
    expect(placeFits(p, 900, 961, 2)).toBe(false); // ends after 16:00
    expect(placeFits(p, 540, 600, 2)).toBe(false); // starts before 10:00
    expect(placeFits(p, 840, 960, 2)).toBe(true); // ending exactly at close is inside
  });
});

describe('planDays legs', () => {
  it('departs onward at 06:00 and clamps the return into 06:00 to 16:00', () => {
    const plan = planDays(input());
    expect(plan.legs[0]).toMatchObject({ depart: '06:00', arrive: '11:00' });
    // 22:00 - 300 = 17:00, clamped down to 16:00.
    expect(plan.legs[1]).toMatchObject({ depart: '16:00', arrive: '21:00' });
  });

  it('clamps a long return leg to 06:00', () => {
    const plan = planDays(input({ ret: { mode: 'bus', durationMinutes: 1200 } }));
    expect(plan.legs[1]).toMatchObject({ depart: '06:00', arrive: '23:59' });
  });

  it('clamps a short return leg to 16:00', () => {
    const plan = planDays(input({ ret: { mode: 'car', durationMinutes: 120 } }));
    expect(plan.legs[1]).toMatchObject({ depart: '16:00', arrive: '18:00' });
  });
});

describe('planDays day 1', () => {
  it('adds a 60-minute check-in after arrival, then activities until 19:00', () => {
    const plan = planDays(
      input({
        places: [place({ key: 'a', typicalMinutes: 60 }), place({ key: 'b', typicalMinutes: 60 })],
      }),
    );
    const day1 = plan.days[0];
    expect(day1?.items[0]).toMatchObject({
      kind: 'travel',
      legId: 'onward',
      start: '06:00',
      end: '11:00',
    });
    expect(day1?.items[1]).toMatchObject({ kind: 'stay', start: '11:00', end: '12:00' });
    expect(day1?.items[2]).toMatchObject({
      kind: 'activity',
      placeKey: 'a',
      start: '12:00',
      end: '13:00',
    });
    expect(day1?.items[3]).toMatchObject({
      kind: 'activity',
      placeKey: 'b',
      start: '13:00',
      end: '14:00',
    });
  });

  it('leaves no activities when a 13-hour onward leg ends at 19:00', () => {
    const plan = planDays(input({ onward: { mode: 'car', durationMinutes: 780 } }));
    const day1 = plan.days[0];
    expect(day1?.items.map((item) => item.kind)).toEqual(['travel', 'stay']);
    expect(plan.scheduledPlaceKeys).toEqual([]);
  });

  it('caps the arrival and check-in at 23:59 for a leg longer than a day', () => {
    const plan = planDays(input({ onward: { mode: 'bus', durationMinutes: 1200 } }));
    const day1 = plan.days[0];
    expect(day1?.items[0]).toMatchObject({ end: '23:59' });
    expect(day1?.items[1]).toMatchObject({ kind: 'stay', start: '23:59', end: '23:59' });
  });
});

describe('planDays middle day', () => {
  const places = [
    place({ key: 'p1', typicalMinutes: 120 }),
    place({ key: 'p2', typicalMinutes: 120 }),
    place({ key: 'p3', typicalMinutes: 120 }),
    place({ key: 'p4', typicalMinutes: 60 }),
    place({ key: 'p5', typicalMinutes: 60 }),
  ];

  it('schedules at most 3 activities with a meal from 13:00 and 30-minute gaps', () => {
    // Use a 4-night trip so day 2 is a middle day, and no places fit day 1
    // because every place is closed on Friday.
    const closedFriday = places.map((p) => ({ ...p, closedDays: [5] }));
    const plan = planDays(input({ nights: 3, places: closedFriday }));
    const day2 = plan.days[1];
    const activities = day2?.items.filter((item) => item.kind === 'activity') ?? [];
    const meal = day2?.items.find((item) => item.kind === 'meal');
    expect(activities).toHaveLength(3);
    // Shorter places go first (all scores tie); the third runs through 13:00,
    // so the meal follows it at 14:00.
    expect(meal).toMatchObject({ start: '14:00', end: '15:00' });
    expect(activities[0]).toMatchObject({ start: '09:00', end: '10:00' });
    expect(activities[1]).toMatchObject({ start: '10:30', end: '11:30' });
    expect(activities[2]).toMatchObject({ start: '12:00', end: '14:00' });
  });

  it('places the meal at 13:00 when earlier activities end before lunch', () => {
    const early = [
      place({ key: 'a', category: 'museum', typicalMinutes: 230, closedDays: [5] }), // 09:00-12:50
      place({ key: 'b', typicalMinutes: 60, closedDays: [5] }),
    ];
    const plan = planDays(input({ nights: 3, places: early, groupInterests: ['museums'] }));
    const day2 = plan.days[1];
    const meal = day2?.items.find((item) => item.kind === 'meal');
    // a ends 12:50, cursor drifts to 13:20; lunch is placed at 13:00 before b.
    expect(meal).toMatchObject({ start: '13:00', end: '14:00' });
    expect(day2?.items.at(-1)).toMatchObject({ kind: 'activity', start: '14:30', end: '15:30' });
  });

  it('puts the meal straight after an activity running at 13:00', () => {
    const late = [place({ key: 'a', typicalMinutes: 270, closedDays: [5] })]; // 09:00-13:30
    const plan = planDays(input({ nights: 3, places: late }));
    const day2 = plan.days[1];
    const meal = day2?.items.find((item) => item.kind === 'meal');
    expect(day2?.items[0]).toMatchObject({ kind: 'activity', start: '09:00', end: '13:30' });
    expect(meal).toMatchObject({ start: '13:30', end: '14:30' });
  });
});

describe('planDays choice order and fit', () => {
  it('prefers interest matches, then verified, then shorter, then key', () => {
    const places = [
      place({ key: 'z-last', typicalMinutes: 30, verified: true }), // score 1
      place({ key: 'b-museum', category: 'museum', typicalMinutes: 60, verified: false }), // 2
      place({ key: 'a-museum', category: 'museum', typicalMinutes: 60, verified: true }), // 3
      place({ key: 'c-museum', category: 'museum', typicalMinutes: 30, verified: false }), // 2
    ];
    const interests: Activity[] = ['museums'];
    const plan = planDays(input({ places, groupInterests: interests }));
    expect(plan.scheduledPlaceKeys).toEqual(['a-museum', 'c-museum', 'b-museum', 'z-last']);
  });

  it('schedules each place at most once across the trip', () => {
    const many = Array.from({ length: 6 }, (_, i) => place({ key: `p${i}`, typicalMinutes: 45 }));
    const plan = planDays(input({ places: many }));
    expect(new Set(plan.scheduledPlaceKeys).size).toBe(plan.scheduledPlaceKeys.length);
    const day1Count = plan.days[0]?.items.filter((item) => item.kind === 'activity').length ?? 0;
    expect(day1Count).toBeGreaterThan(0);
    const middleCount = plan.days[1]?.items.filter((item) => item.kind === 'activity').length ?? 0;
    expect(middleCount).toBeLessThanOrEqual(3);
  });
});

describe('planDays last day and free time', () => {
  it('schedules activities until an hour before the return leg, then the leg', () => {
    const plan = planDays(
      input({
        places: [
          place({ key: 'a', typicalMinutes: 120, closedDays: [5, 6] }),
          place({ key: 'b', typicalMinutes: 240, closedDays: [5, 6] }),
        ],
      }),
    );
    const last = plan.days.at(-1);
    const activities = last?.items.filter((item) => item.kind === 'activity') ?? [];
    // Return departs 16:00, so the activity window ends at 15:00.
    expect(activities.at(-1)?.end).toBe('15:00');
    expect(last?.items.at(-1)).toMatchObject({ kind: 'travel', legId: 'return', start: '16:00' });
  });

  it('adds a free item when a day has fewer than 2 activities and 2+ hours left', () => {
    const plan = planDays(input({ places: [place({ key: 'only', typicalMinutes: 60 })] }));
    const day1 = plan.days[0];
    // Day 1: one activity, then free time to 19:00.
    const free = day1?.items.find((item) => item.kind === 'free');
    expect(free).toMatchObject({ end: '19:00' });
    const last = plan.days.at(-1);
    const lastFree = last?.items.find((item) => item.kind === 'free');
    expect(lastFree).toMatchObject({ start: '09:00', end: '15:00' });
  });

  it('adds no free item when the day has 2 or more activities', () => {
    const plan = planDays(
      input({
        places: [place({ key: 'a', typicalMinutes: 60 }), place({ key: 'b', typicalMinutes: 60 })],
      }),
    );
    expect(plan.days[0]?.items.some((item) => item.kind === 'free')).toBe(false);
  });
});

describe('unusedPlacesFitting', () => {
  it('returns unused places that fit the slot, in choice order', () => {
    const places = [
      place({ key: 'used', typicalMinutes: 60 }),
      place({ key: 'open-late', typicalMinutes: 60, closeTime: '12:00', closedDays: [5, 6] }),
      place({
        key: 'anytime',
        typicalMinutes: 45,
        openTime: '16:00',
        closeTime: '19:00',
        closedDays: [5, 6],
      }),
    ];
    const plan = planDays(input({ places }));
    const fits = unusedPlacesFitting(plan, input({ places }), 3, {
      start: '16:00',
      end: '17:00',
    });
    expect(fits.map((p) => p.key)).toEqual(['anytime']);
  });

  it('returns an empty list for a day outside the plan', () => {
    const plan = planDays(input());
    expect(unusedPlacesFitting(plan, input(), 9, { start: '09:00', end: '10:00' })).toEqual([]);
  });
});
