import { describe, expect, it } from 'vitest';
import { TRIP_STATUSES } from '../domain-values';
import {
  CloseSubmissionsInput,
  CreateTripInput,
  EVENT_SUMMARIES,
  TRIP_STATUS_LABELS,
  TripEventName,
  UpdateTripInput,
  summarizeEvent,
} from './trips';

describe('TRIP_STATUS_LABELS', () => {
  it('has a label and an explanation for every status', () => {
    for (const status of TRIP_STATUSES) {
      const entry = TRIP_STATUS_LABELS[status];
      expect(entry, status).toBeDefined();
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.explanation.endsWith('.')).toBe(true);
    }
    expect(Object.keys(TRIP_STATUS_LABELS).sort()).toEqual([...TRIP_STATUSES].sort());
  });
});

describe('CreateTripInput', () => {
  const valid = {
    title: 'Test weekend',
    originHubSlug: 'delhi',
    durationNights: 2,
    budgetTotalInr: 30000,
    radiusKm: 300,
  };

  it('accepts a valid input and trims the title', () => {
    const parsed = CreateTripInput.parse({ ...valid, title: '  Test weekend  ' });
    expect(parsed.title).toBe('Test weekend');
  });

  it.each([
    [{ title: '' }, 'title'],
    [{ durationNights: 0 }, 'durationNights'],
    [{ durationNights: 15 }, 'durationNights'],
    [{ budgetTotalInr: 999 }, 'budgetTotalInr'],
    [{ budgetTotalInr: -1 }, 'budgetTotalInr'],
    [{ radiusKm: 49 }, 'radiusKm'],
    [{ radiusKm: 0 }, 'radiusKm'],
    [{ radiusKm: 1501 }, 'radiusKm'],
    [{ originHubSlug: '' }, 'originHubSlug'],
  ])('rejects %o on field %s', (patch, field) => {
    const result = CreateTripInput.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === field)).toBe(true);
    }
  });
});

describe('UpdateTripInput', () => {
  it('requires at least one field', () => {
    expect(UpdateTripInput.safeParse({}).success).toBe(false);
    expect(UpdateTripInput.safeParse({ radiusKm: 400 }).success).toBe(true);
  });
});

describe('TripEventName', () => {
  it('covers createTrip for the web to render buttons from legalEvents', () => {
    expect(TripEventName.safeParse('inviteMembers').success).toBe(true);
    expect(TripEventName.safeParse('bogus').success).toBe(false);
  });
});

describe('EVENT_SUMMARIES', () => {
  it('has a sentence naming the actor for every trip event', () => {
    for (const event of TripEventName.options) {
      const sentence = EVENT_SUMMARIES[event]('Asha');
      expect(sentence.startsWith('Asha '), event).toBe(true);
    }
    expect(Object.keys(EVENT_SUMMARIES).sort()).toEqual([...TripEventName.options].sort());
  });

  it('reads the spec examples, "Someone" without an actor, and survives an unknown event', () => {
    expect(summarizeEvent('createTrip', 'Asha')).toBe('Asha created the trip');
    expect(summarizeEvent('inviteMembers', 'Asha')).toBe('Asha opened the trip for preferences');
    expect(summarizeEvent('preferenceSubmitted', 'Meera')).toBe('Meera submitted preferences');
    expect(summarizeEvent('preferenceRevised', 'Rohan')).toBe('Rohan updated preferences');
    expect(summarizeEvent('closeSubmissions', 'Asha')).toBe('Asha closed submissions');
    expect(summarizeEvent('cancelTrip', null)).toBe('Someone cancelled the trip');
    // T21 (S5-2b-1)
    expect(summarizeEvent('shortlistReopened', 'Asha')).toBe('Asha asked for new recommendations');
    expect(summarizeEvent('somethingNew', 'Asha')).toBe('Asha changed the trip');
  });
});

describe('CloseSubmissionsInput', () => {
  it('accepts only an empty object', () => {
    expect(CloseSubmissionsInput.safeParse({}).success).toBe(true);
    expect(CloseSubmissionsInput.safeParse({ force: true }).success).toBe(false);
  });
});
