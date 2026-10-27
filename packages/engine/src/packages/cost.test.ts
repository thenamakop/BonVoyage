import { describe, expect, it } from 'vitest';
import type { PlannerPlace } from '../itinerary/plan';
import {
  costPackage,
  durationMinutes,
  farePerPerson,
  modeAvailable,
  type PackageInput,
} from './cost';

const PLACES: PlannerPlace[] = [
  {
    key: 'triveni-ghat',
    name: 'Triveni Ghat',
    category: 'sight',
    typicalMinutes: 45,
    openTime: null,
    closeTime: null,
    closedDays: [],
    entryFeeInr: 0,
    verified: true,
  },
  {
    key: 'museum-x',
    name: 'Museum X',
    category: 'museum',
    typicalMinutes: 60,
    openTime: '09:00',
    closeTime: '17:00',
    closedDays: [],
    entryFeeInr: 100,
    verified: true,
  },
  {
    key: 'beatles-ashram',
    name: 'The Beatles Ashram',
    category: 'sight',
    typicalMinutes: 120,
    openTime: '10:00',
    closeTime: '18:00',
    closedDays: [],
    entryFeeInr: 600,
    verified: true,
  },
];

export function goldenInput(overrides: Partial<PackageInput> = {}): PackageInput {
  return {
    n: 3,
    nights: 2,
    startDate: '2026-11-06',
    groupCapInr: 20000,
    originName: 'Gurugram',
    destinationName: 'Rishikesh',
    hubSlug: 'gurugram',
    destinationSlug: 'rishikesh',
    modes: {
      bus: { farePerPersonInr: 550, durationMinutes: 390, verified: true },
      train: { farePerPersonInr: 400, durationMinutes: 300, verified: true },
      car: { km: 250, durationMinutes: 270, verified: true },
    },
    costRules: {
      fuelPriceInrPerLitre: 105,
      carKmPerLitre: 12,
      tollInrPerKm: 2,
      personsPerCar: 4,
      carRentalInrPerDay: 2500,
      verified: true,
    },
    stay: { budget: 900, mid: 1500, premium: 3000 },
    costVerified: true,
    foodPerDayInr: 500,
    localPerDayInr: 200,
    places: PLACES,
    groupInterests: [],
    ...overrides,
  };
}

describe('fare helpers', () => {
  const input = goldenInput();

  it('returns the fare row for bus and train and the 0004 d car share for car', () => {
    expect(farePerPerson(input, 'train')).toBe(400);
    expect(farePerPerson(input, 'bus')).toBe(550);
    // car: cars = ceil(3/4) = 1; perKm = 105/12 + 2 = 10.75; 250*10.75 = 2687.5;
    // rental half = 2500*3/2 = 3750; share = (2687.5+3750)/3 = 2145.83 -> 2146.
    expect(farePerPerson(input, 'car')).toBe(2146);
  });

  it('returns null for an unavailable mode', () => {
    const noBus = goldenInput({ modes: { ...input.modes, bus: null } });
    expect(farePerPerson(noBus, 'bus')).toBeNull();
    expect(durationMinutes(noBus, 'bus')).toBeNull();
    expect(modeAvailable(noBus, 'bus')).toBe(false);
    expect(modeAvailable(noBus, 'car')).toBe(true);
    expect(costPackage(noBus, { label: 'X', mode: 'bus', tier: 'mid' })).toBeNull();
  });

  it('returns null for a missing stay rate', () => {
    expect(
      costPackage(goldenInput({ stay: { budget: 900, mid: null, premium: 3000 } }), {
        label: 'X',
        mode: 'train',
        tier: 'mid',
      }),
    ).toBeNull();
  });
});

describe('costPackage golden: Saver (train, budget), 3 members, 2 nights', () => {
  const pkg = costPackage(goldenInput(), { label: 'Saver', mode: 'train', tier: 'budget' });

  it('schedules all three places and costs their fees', () => {
    expect(pkg?.scheduledPlaceKeys).toEqual(['triveni-ghat', 'museum-x', 'beatles-ashram']);
  });

  it('writes every line by hand', () => {
    expect(pkg?.lines).toEqual([
      // 3 people x Rs 400 train fare
      {
        category: 'onward',
        label: 'Train, 3 people, one way',
        amountInr: 1200,
        provenance: 'curated',
        sourceRef: 'fares:gurugram/rishikesh/train',
      },
      {
        category: 'return',
        label: 'Train, 3 people, return',
        amountInr: 1200,
        provenance: 'curated',
        sourceRef: 'fares:gurugram/rishikesh/train',
      },
      // 2 rooms x 2 nights x Rs 900
      {
        category: 'stay',
        label: 'Budget stay, 2 rooms x 2 nights',
        amountInr: 3600,
        provenance: 'curated',
        sourceRef: 'destinations:rishikesh',
      },
      // 3 people x 3 days x Rs 500
      {
        category: 'food',
        label: 'Food, 3 people x 3 days',
        amountInr: 4500,
        provenance: 'curated',
        sourceRef: 'destinations:rishikesh',
      },
      // 3 people x (0 + 100 + 600)
      {
        category: 'activities',
        label: 'Entry fees, 3 people, 3 places',
        amountInr: 2100,
        provenance: 'curated',
        sourceRef: 'pois:triveni-ghat,museum-x,beatles-ashram',
      },
      // 3 people x 3 days x Rs 200
      {
        category: 'local',
        label: 'Local travel, 3 people x 3 days',
        amountInr: 1800,
        provenance: 'curated',
        sourceRef: 'destinations:rishikesh',
      },
    ]);
  });

  it('totals the rounded lines and flags the budget', () => {
    // 1200 + 1200 + 3600 + 4500 + 2100 + 1800 = 14400; per person 4800.
    expect(pkg).toMatchObject({
      totalInr: 14400,
      perPersonInr: 4800,
      overBudget: false,
      overByInr: 0,
      rooms: 2,
      startDate: '2026-11-06',
      endDate: '2026-11-08',
    });
  });
});

describe('costPackage golden: Quickest (car, mid)', () => {
  const pkg = costPackage(goldenInput(), { label: 'Quickest', mode: 'car', tier: 'mid' });

  it('costs the car share per person both ways', () => {
    // legs: 2 x 3 x 2146 = 12876; stay 2x2x1500 = 6000; food 4500; fees 2100; local 1800.
    expect(pkg?.lines[0]).toMatchObject({
      category: 'onward',
      label: 'Car, 3 people, one way',
      amountInr: 6438,
      provenance: 'curated',
      sourceRef: 'fares:gurugram/rishikesh/car,cost-rules',
    });
    expect(pkg).toMatchObject({
      totalInr: 27276,
      perPersonInr: 9092,
      overBudget: true,
      overByInr: 7276,
    });
  });
});

describe('costPackage budget flag and provenance', () => {
  it('is not over budget at exactly the cap, and is over by one rupee', () => {
    const atCap = goldenInput({ groupCapInr: 14400 });
    expect(costPackage(atCap, { label: 'S', mode: 'train', tier: 'budget' })?.overBudget).toBe(
      false,
    );
    const oneOver = goldenInput({ groupCapInr: 14399 });
    const pkg = costPackage(oneOver, { label: 'S', mode: 'train', tier: 'budget' });
    expect(pkg).toMatchObject({ overBudget: true, overByInr: 1 });
  });

  it('marks both legs estimated when the fare row is draft', () => {
    const input = goldenInput();
    input.modes.train = { farePerPersonInr: 400, durationMinutes: 300, verified: false };
    const pkg = costPackage(input, { label: 'S', mode: 'train', tier: 'budget' });
    expect(pkg?.lines[0]?.provenance).toBe('estimated');
    expect(pkg?.lines[1]?.provenance).toBe('estimated');
  });

  it('marks car legs estimated when a cost rule is unverified', () => {
    const input = goldenInput({ costRules: { ...goldenInput().costRules, verified: false } });
    const pkg = costPackage(input, { label: 'C', mode: 'car', tier: 'mid' });
    expect(pkg?.lines[0]?.provenance).toBe('estimated');
  });

  it('marks the destination lines estimated when cost_review_status is draft', () => {
    const pkg = costPackage(goldenInput({ costVerified: false }), {
      label: 'S',
      mode: 'train',
      tier: 'budget',
    });
    for (const category of ['stay', 'food', 'local'] as const) {
      expect(pkg?.lines.find((line) => line.category === category)?.provenance).toBe('estimated');
    }
  });

  it('writes pois:none and a curated activities line when nothing is scheduled', () => {
    const input = goldenInput({ places: [] });
    const pkg = costPackage(input, { label: 'S', mode: 'train', tier: 'budget' });
    const activities = pkg?.lines.find((line) => line.category === 'activities');
    expect(activities).toMatchObject({
      amountInr: 0,
      provenance: 'curated',
      sourceRef: 'pois:none',
      label: 'Entry fees, 3 people, 0 places',
    });
  });

  it('marks activities estimated when a scheduled place is draft', () => {
    const input = goldenInput({
      places: PLACES.map((place) =>
        place.key === 'triveni-ghat' ? { ...place, verified: false } : place,
      ),
    });
    const pkg = costPackage(input, { label: 'S', mode: 'train', tier: 'budget' });
    expect(pkg?.lines.find((line) => line.category === 'activities')?.provenance).toBe('estimated');
  });
});
