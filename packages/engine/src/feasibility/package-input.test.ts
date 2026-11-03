import { describe, expect, it } from 'vitest';
import { toPackageInput, type PackageSource } from './package-input';
import { COST_RULE_KEYS } from './inputs';

const source: PackageSource = {
  trip: { durationNights: 2, budgetTotalInr: 20000 },
  members: ['m1', 'm2'].map((memberId) => ({
    memberId,
    types: ['heritage'],
    activities: ['museums'],
    climate: 'any',
    likedPastTypes: [],
    budgetMinInr: 1000,
    budgetMaxInr: 8000,
    dateStart: '2026-11-14',
    dateEnd: '2026-11-16',
  })),
  hub: { name: 'Delhi', slug: 'delhi' },
  destination: {
    name: 'Agra',
    slug: 'agra',
    stayBudgetInr: 800,
    stayMidInr: 1200,
    stayPremiumInr: null,
    foodPerDayInr: 400,
    localPerDayInr: 200,
    costReviewStatus: 'verified',
  },
  fares: [
    {
      mode: 'bus',
      farePerPersonInr: 500,
      distanceKm: 200,
      durationMinutes: 240,
      reviewStatus: 'verified',
    },
    {
      mode: 'car',
      farePerPersonInr: null,
      distanceKm: 210,
      durationMinutes: 250,
      reviewStatus: 'draft',
    },
  ],
  rules: Object.values(COST_RULE_KEYS).map((key) => ({ key, value: 10, verified: 'verified' })),
  pois: [
    {
      poiKey: 'museum',
      name: 'Museum',
      category: 'museum',
      typicalMinutes: 60,
      openTime: null,
      closeTime: null,
      closedDays: [],
      entryFeeInr: 50,
      reviewStatus: 'draft',
    },
  ],
};

describe('toPackageInput', () => {
  it('maps catalogue facts, caps, seasons and shared interests without I/O', () => {
    const input = toPackageInput(source);
    expect(input).toMatchObject({
      n: 2,
      nights: 2,
      startDate: '2026-11-14',
      groupCapInr: 16000,
      hubSlug: 'delhi',
      destinationSlug: 'agra',
      groupInterests: ['museums'],
      modes: {
        bus: { farePerPersonInr: 500, durationMinutes: 240, verified: true },
        train: null,
        car: { km: 210, durationMinutes: 250, verified: false },
      },
      costRules: { personsPerCar: 10, verified: true },
      places: [{ key: 'agra/museum', verified: false }],
    });
    expect(toPackageInput(source)).toEqual(input);
  });
  it('preserves API defaults for absent facts and unverified rules', () => {
    const input = toPackageInput({
      ...source,
      hub: undefined,
      fares: [
        {
          ...source.fares[0],
          mode: 'train',
          farePerPersonInr: null,
          distanceKm: 0,
          durationMinutes: 0,
          reviewStatus: 'draft',
        },
      ],
      rules: [{ key: 'unknown', value: 20, verified: 'draft' }],
      destination: { ...source.destination, foodPerDayInr: null, localPerDayInr: null },
    });
    expect(input).toMatchObject({
      originName: '',
      hubSlug: '',
      foodPerDayInr: 0,
      localPerDayInr: 0,
      costRules: { personsPerCar: 4, verified: false },
      modes: { bus: null, train: null, car: { km: 0, durationMinutes: 0, verified: false } },
    });
  });
});
