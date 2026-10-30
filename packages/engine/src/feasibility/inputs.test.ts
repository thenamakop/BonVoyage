import { describe, expect, it } from 'vitest';
import { groupProfile } from '../group/profile';
import { curatedRoadKm, estimateRoadKm, offlineRoadKm } from '../geo';
import {
  feasibilityContext,
  splitByCosts,
  toCosted,
  toCostRules,
  toDestinationInput,
  toMemberInput,
  toPublicFares,
  type DestinationFields,
  type PreferenceFields,
} from './inputs';

// S5-5 (#140): the row-to-engine mapping the API and the offline harness share.

const preference = (over: Partial<PreferenceFields> = {}): PreferenceFields => ({
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  budgetMinInr: 8000,
  budgetMaxInr: 12000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
  ...over,
});

const destination = (over: Partial<DestinationFields> = {}): DestinationFields => ({
  id: 'd1',
  slug: 'one',
  types: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  bestMonths: [11, 12],
  minNights: 2,
  stayBudgetInr: 1500,
  foodPerDayInr: 500,
  localPerDayInr: 300,
  ...over,
});

const member = (over: Partial<PreferenceFields> = {}, id = 'm1') =>
  toMemberInput(id, preference(over), []);

describe('toMemberInput', () => {
  it('maps a preference row, with the liked past types beside it', () => {
    expect(toMemberInput('m1', preference(), ['hill_station'])).toEqual({
      memberId: 'm1',
      types: ['mountain'],
      activities: ['trekking'],
      climate: 'mild',
      likedPastTypes: ['hill_station'],
      budgetMinInr: 8000,
      budgetMaxInr: 12000,
      dateStart: '2026-11-13',
      dateEnd: '2026-11-16',
    });
  });
});

describe('toDestinationInput and toCosted', () => {
  it('toDestinationInput keeps only what scoring reads', () => {
    expect(toDestinationInput(destination())).toEqual({
      id: 'd1',
      slug: 'one',
      types: ['mountain'],
      activities: ['trekking'],
      climate: 'mild',
      bestMonths: [11, 12],
      minNights: 2,
    });
  });

  it('toCosted adds the three costs a candidate needs', () => {
    expect(toCosted(destination())).toMatchObject({
      slug: 'one',
      stayBudgetInr: 1500,
      foodPerDayInr: 500,
      localPerDayInr: 300,
    });
  });

  it('a cost of 0 is a cost', () => {
    expect(toCosted(destination({ localPerDayInr: 0 }))?.localPerDayInr).toBe(0);
  });

  it.each(['stayBudgetInr', 'foodPerDayInr', 'localPerDayInr'] as const)(
    'toCosted is null when %s is missing (0004 e)',
    (field) => {
      expect(toCosted(destination({ [field]: null }))).toBeNull();
    },
  );
});

describe('splitByCosts', () => {
  it('keeps each row with its candidate and lists the rest by slug, in order', () => {
    const rows = [
      destination({ id: 'a', slug: 'a' }),
      destination({ id: 'b', slug: 'b', foodPerDayInr: null }),
      destination({ id: 'c', slug: 'c' }),
    ];
    const { costed, incomplete } = splitByCosts(rows);
    expect(costed.map((c) => c.row)).toEqual([rows[0], rows[2]]);
    expect(costed.map((c) => c.destination.slug)).toEqual(['a', 'c']);
    expect(incomplete).toEqual(['b']);
  });

  it('an empty catalogue gives two empty lists', () => {
    expect(splitByCosts([])).toEqual({ costed: [], incomplete: [] });
  });
});

describe('feasibilityContext', () => {
  const trip = { durationNights: 2, budgetTotalInr: 100000, radiusKm: 300 };

  it('takes the limits from the trip and the profile', () => {
    const members = [member(), member({ budgetMaxInr: 10000 }, 'm2')];
    expect(feasibilityContext(trip, groupProfile(members, trip))).toEqual({
      n: 2,
      durationNights: 2,
      radiusKm: 300,
      groupCapInr: 20000,
      capSource: 'members',
      perPersonCapInr: 10000,
      commonWindow: { start: '2026-11-13', end: '2026-11-16' },
    });
  });

  it('a trip budget at the limit counts as the trip (0004 c)', () => {
    const tied = { ...trip, budgetTotalInr: 24000 };
    const members = [member(), member({}, 'm2')];
    expect(feasibilityContext(tied, groupProfile(members, tied))?.capSource).toBe('trip');
  });

  it('is null with no common window (F3)', () => {
    const members = [member(), member({ dateStart: '2026-12-01', dateEnd: '2026-12-05' }, 'm2')];
    expect(feasibilityContext(trip, groupProfile(members, trip))).toBeNull();
  });

  it('is null when the window is too short for the trip (F3)', () => {
    const long = { ...trip, durationNights: 10 };
    expect(feasibilityContext(long, groupProfile([member()], long))).toBeNull();
  });

  it('disjoint budgets do not block: they are F5, not F3', () => {
    const members = [member(), member({ budgetMinInr: 13000, budgetMaxInr: 20000 }, 'm2')];
    const profile = groupProfile(members, trip);
    expect(profile.conflicts.map((c) => c.code)).toEqual(['BUDGET_BANDS_DISJOINT']);
    expect(feasibilityContext(trip, profile)).not.toBeNull();
  });
});

describe('toPublicFares', () => {
  it('groups bus and train per destination; a car row adds no fare', () => {
    const fares = toPublicFares([
      { destinationId: 'a', mode: 'bus', fare: 400 },
      { destinationId: 'a', mode: 'train', fare: 300 },
      { destinationId: 'b', mode: 'train', fare: null },
      { destinationId: 'c', mode: 'car', fare: null },
    ]);
    expect(fares.get('a')).toEqual({ busInr: 400, trainInr: 300 });
    expect(fares.get('b')).toEqual({ busInr: null, trainInr: null });
    expect(fares.get('c')).toEqual({ busInr: null, trainInr: null });
    expect(fares.has('d')).toBe(false);
  });
});

describe('toCostRules', () => {
  const rows = [
    { key: 'fuel_price_inr_per_litre', value: 100 },
    { key: 'car_km_per_litre', value: 15 },
    { key: 'toll_inr_per_km', value: 2 },
    { key: 'persons_per_car', value: 4 },
    { key: 'car_rental_inr_per_day', value: 3000 },
    { key: 'something_else', value: 1 },
  ];

  it('maps the five keys and ignores any other', () => {
    expect(toCostRules(rows)).toEqual({
      fuelPriceInrPerLitre: 100,
      carKmPerLitre: 15,
      tollInrPerKm: 2,
      personsPerCar: 4,
      carRentalInrPerDay: 3000,
    });
  });

  it('is null when one is missing, and with no rows', () => {
    expect(toCostRules(rows.filter((r) => r.key !== 'toll_inr_per_km'))).toBeNull();
    expect(toCostRules([])).toBeNull();
  });
});

describe('road distances (ADR-007)', () => {
  const a = { lat: 28.4, lng: 77 };
  const b = { lat: 30.4, lng: 78 };

  it('a verified car row is curated; any other is an estimate; km rounds up', () => {
    expect(curatedRoadKm({ distanceKm: 250, reviewStatus: 'verified' })).toEqual({
      distanceKm: 250,
      provenance: 'curated',
    });
    expect(curatedRoadKm({ distanceKm: 250.2, reviewStatus: 'draft' })).toEqual({
      distanceKm: 251,
      provenance: 'estimated',
    });
  });

  it('offline: the car row first, else the straight-line estimate', () => {
    const row = { distanceKm: 250, reviewStatus: 'verified' };
    expect(offlineRoadKm(row, a, b)).toEqual({ distanceKm: 250, provenance: 'curated' });
    expect(offlineRoadKm(undefined, a, b)).toEqual(estimateRoadKm(a, b));
  });
});
