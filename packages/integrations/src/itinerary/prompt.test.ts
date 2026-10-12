import { describe, expect, it } from 'vitest';
import type { FactSheet } from '@bonvoyage/shared';
import { IntegrationError } from '../errors';
import { assertNoPersonalData, buildItineraryPrompt } from './prompt';

const facts: FactSheet = {
  trip: {
    nights: 2,
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    groupSize: 4,
    interests: ['rafting'],
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
  ],
  costs: { totalInr: 12800, perPersonInr: 3200, items: [] },
  limits: { maxDayHours: 10 },
};

describe('buildItineraryPrompt', () => {
  it('embeds the fact sheet and the grounding rules', () => {
    const { system, prompt } = buildItineraryPrompt(facts);
    expect(prompt).toContain('rishikesh');
    expect(prompt).toContain('laxman-jhula');
    expect(system).toContain('never invent');
    expect(system).toContain('poiId');
    expect(system).toContain('maxDayHours');
  });
});

describe('assertNoPersonalData', () => {
  it('passes clean text', () => {
    expect(() => assertNoPersonalData('Rishikesh, entry 600 rupees.')).not.toThrow();
  });

  it.each([
    ['an email', 'Contact asha@example.com for details.'],
    ['a phone number', 'Call +91 98111 22233 now.'],
    ['a key-like string', 'token AIzaSyD4iE2xVSpkLvkcey3x_FdO1'],
  ])('throws on %s', (_name, text) => {
    expect(() => assertNoPersonalData(text)).toThrow(IntegrationError);
  });
});
