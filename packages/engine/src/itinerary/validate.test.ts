import { describe, expect, it } from 'vitest';
import type { FactSheet, ItineraryOutput } from '@bonvoyage/shared';
import { validateItinerary } from './validate';

const facts: FactSheet = {
  trip: {
    nights: 2,
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    groupSize: 4,
    interests: ['rafting', 'temples'],
  },
  destination: { slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' },
  legs: [
    {
      id: 'onward',
      mode: 'bus',
      from: 'Gurugram',
      to: 'Rishikesh',
      depart: '06:00',
      arrive: '13:00',
      durationMinutes: 390,
      farePerPersonInr: 550,
    },
    {
      id: 'return',
      mode: 'bus',
      from: 'Rishikesh',
      to: 'Gurugram',
      depart: '16:00',
      arrive: '23:00',
      durationMinutes: 390,
      farePerPersonInr: 550,
    },
  ],
  stay: { tier: 'budget', perRoomPerNightInr: 900, rooms: 2 },
  pois: [
    {
      id: 'laxman-jhula',
      name: 'Laxman Jhula',
      category: 'sight',
      typicalMinutes: 45,
      openTime: null,
      closeTime: null,
      closedDays: [],
      entryFeeInr: 0,
    },
    {
      id: 'beatles-ashram',
      name: 'The Beatles Ashram',
      category: 'sight',
      typicalMinutes: 120,
      openTime: '10:00',
      closeTime: '16:00',
      closedDays: [1],
      entryFeeInr: 600,
    },
  ],
  costs: {
    totalInr: 12800,
    perPersonInr: 3200,
    items: [{ category: 'stay', amountInr: 3600 }],
  },
  limits: { maxDayHours: 10 },
};

const validOutput: ItineraryOutput = {
  days: [
    {
      day: 1,
      date: '2026-11-06',
      items: [
        {
          start: '06:00',
          end: '13:00',
          kind: 'travel',
          legId: 'onward',
          note: 'Bus from Gurugram, 550 per person.',
        },
        {
          start: '14:00',
          end: '15:00',
          kind: 'activity',
          poiId: 'laxman-jhula',
          note: 'Walk the bridge.',
        },
        { start: '15:00', end: '16:00', kind: 'meal', note: 'Lunch near the ghat.' },
      ],
    },
    {
      day: 2,
      date: '2026-11-07',
      items: [
        {
          start: '10:00',
          end: '12:00',
          kind: 'activity',
          poiId: 'beatles-ashram',
          note: 'Murals, entry 600.',
        },
        { start: '13:00', end: '14:00', kind: 'meal', note: 'Cafe lunch.' },
      ],
    },
    {
      day: 3,
      date: '2026-11-08',
      items: [
        {
          start: '16:00',
          end: '23:00',
          kind: 'travel',
          legId: 'return',
          note: 'Bus back to Gurugram.',
        },
      ],
    },
  ],
  summary: 'A short Rishikesh break for 4, total 12800.',
  reasons: ['Riverside sights on day 1.', 'Ashram visit inside opening hours.'],
};

function mutate(fn: (draft: ItineraryOutput) => void): ItineraryOutput {
  const draft = JSON.parse(JSON.stringify(validOutput)) as ItineraryOutput;
  fn(draft);
  return draft;
}

describe('validateItinerary', () => {
  it('passes a valid itinerary with verifiedRatio 1', () => {
    const result = validateItinerary(validOutput, facts);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.verifiedRatio).toBe(1);
  });

  it('flags an unknown poiId as unverified', () => {
    const output = mutate((draft) => {
      draft.days[0]!.items[1]!.poiId = 'made-up-place';
    });
    const result = validateItinerary(output, facts);
    const item = result.items.find((entry) => entry.day === 1 && entry.index === 1);
    expect(item?.verified).toBe(false);
    expect(item?.reasons.join()).toContain('made-up-place');
    expect(result.ok).toBe(true);
  });

  it('flags ₹9,999 in a note as unverified', () => {
    const output = mutate((draft) => {
      draft.days[1]!.items[0]!.note = 'Murals, entry ₹9,999.';
    });
    const result = validateItinerary(output, facts);
    const item = result.items.find((entry) => entry.day === 2 && entry.index === 0);
    expect(item?.verified).toBe(false);
    expect(item?.reasons.join()).toContain('9,999');
  });

  it('flags an unknown time in a note as unverified', () => {
    const output = mutate((draft) => {
      draft.days[1]!.items[0]!.note = 'Meet at 07:30 sharp.';
    });
    const result = validateItinerary(output, facts);
    const item = result.items.find((entry) => entry.day === 2 && entry.index === 0);
    expect(item?.verified).toBe(false);
    expect(item?.reasons.join()).toContain('07:30');
  });

  it('errors on an unknown number in the summary', () => {
    const output = mutate((draft) => {
      draft.summary = 'A short break for 4 costing 50000.';
    });
    const result = validateItinerary(output, facts);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === 'UNVERIFIED_NUMBER')).toBe(true);
  });

  it('errors on the wrong day count', () => {
    const output = mutate((draft) => {
      draft.days.pop();
    });
    const result = validateItinerary(output, facts);
    expect(result.errors.some((error) => error.code === 'WRONG_DAY_COUNT')).toBe(true);
  });

  it('errors when the return leg is missing', () => {
    const output = mutate((draft) => {
      draft.days[2]!.items[0]!.legId = undefined;
    });
    const result = validateItinerary(output, facts);
    expect(result.errors.some((error) => error.code === 'MISSING_RETURN_LEG')).toBe(true);
  });

  it('flags an activity that starts before opening', () => {
    const output = mutate((draft) => {
      draft.days[1]!.items[0]!.start = '09:00';
      draft.days[1]!.items[0]!.end = '10:00';
    });
    const result = validateItinerary(output, facts);
    const item = result.items.find((entry) => entry.day === 2 && entry.index === 0);
    expect(item?.verified).toBe(false);
    expect(item?.reasons.join()).toContain('10:00');
  });

  it('flags an activity on a closed day', () => {
    const output = mutate((draft) => {
      // Shift the whole trip so day 2 falls on Monday, when the ashram is closed.
      draft.days[0]!.date = '2026-11-08';
      draft.days[1]!.date = '2026-11-09';
      draft.days[2]!.date = '2026-11-10';
    });
    const movedFacts = JSON.parse(JSON.stringify(facts)) as FactSheet;
    movedFacts.trip.startDate = '2026-11-08';
    movedFacts.trip.endDate = '2026-11-10';
    const result = validateItinerary(output, movedFacts);
    const item = result.items.find((entry) => entry.day === 2 && entry.index === 0);
    expect(item?.verified).toBe(false);
    expect(item?.reasons.join()).toContain('closed');
  });

  it('errors when a day exceeds the hour limit', () => {
    const output = mutate((draft) => {
      draft.days[1]!.items.push({
        start: '14:30',
        end: '22:00',
        kind: 'free',
        note: 'Long evening stroll.',
      });
    });
    const result = validateItinerary(output, facts);
    expect(result.errors.some((error) => error.code === 'DAY_TOO_LONG')).toBe(true);
  });

  it('errors on overlapping items', () => {
    const output = mutate((draft) => {
      draft.days[1]!.items[1]!.start = '11:30';
    });
    const result = validateItinerary(output, facts);
    expect(result.errors.some((error) => error.code === 'OVERLAP')).toBe(true);
  });
});
