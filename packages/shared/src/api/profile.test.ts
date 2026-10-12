import { describe, expect, it } from 'vitest';
import { AddPastTripInput, UpdateProfileInput } from './profile';

const pathsOf = (input: unknown) => {
  const r = AddPastTripInput.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('AddPastTripInput', () => {
  it('accepts a catalogue destination or a free place name', () => {
    expect(pathsOf({ destinationSlug: 'rishikesh', rating: 4 })).toEqual([]);
    expect(pathsOf({ placeName: 'Grandma’s village', visitedOn: '2025-05-01', rating: 5 })).toEqual(
      [],
    );
  });

  it('needs exactly one of destinationSlug and placeName', () => {
    expect(pathsOf({ destinationSlug: 'rishikesh', placeName: 'X', rating: 4 })).toEqual([
      'placeName',
    ]);
    expect(pathsOf({ rating: 4 })).toEqual(['destinationSlug']);
  });

  it('keeps the rating between 1 and 5', () => {
    expect(pathsOf({ placeName: 'X', rating: 6 })).toEqual(['rating']);
    expect(pathsOf({ placeName: 'X', rating: 0 })).toEqual(['rating']);
  });
});

describe('UpdateProfileInput', () => {
  it('accepts a slug or null', () => {
    expect(UpdateProfileInput.safeParse({ homeHubSlug: 'delhi' }).success).toBe(true);
    expect(UpdateProfileInput.safeParse({ homeHubSlug: null }).success).toBe(true);
    expect(UpdateProfileInput.safeParse({}).success).toBe(false);
  });
});
