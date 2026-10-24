import { describe, expect, it } from 'vitest';
import {
  carSharePerPersonOneWay,
  cheapestOneWay,
  composeEstimate,
  estimatedGroupCost,
} from '../index';
import type { CostRules } from '../index';

const rules: CostRules = {
  fuelPriceInrPerLitre: 95,
  carKmPerLitre: 15,
  tollInrPerKm: 1.8,
  personsPerCar: 4,
  carRentalInrPerDay: 2000,
};

describe('carSharePerPersonOneWay', () => {
  it.each([
    [3, 1678],
    [5, 2014],
  ])('n=%d gives %i (hand-checked 0004 d)', (n, expected) => {
    expect(carSharePerPersonOneWay({ km: 250, n, nights: 2, rules })).toBe(expected);
  });

  it('rounds a fractional share up', () => {
    expect(
      carSharePerPersonOneWay({
        km: 100,
        n: 3,
        nights: 1,
        rules: {
          fuelPriceInrPerLitre: 100,
          carKmPerLitre: 10,
          tollInrPerKm: 0,
          personsPerCar: 4,
          carRentalInrPerDay: 0,
        },
      }),
    ).toBe(334);
  });
});

describe('cheapestOneWay', () => {
  it('ties prefer train, then bus, then car', () => {
    expect(cheapestOneWay({ busInr: 500, trainInr: 500, carShareInr: 500 }).mode).toBe('train');
    expect(cheapestOneWay({ busInr: 500, trainInr: null, carShareInr: 500 }).mode).toBe('bus');
    expect(cheapestOneWay({ busInr: 500, trainInr: 600, carShareInr: 500 }).mode).toBe('bus');
    expect(cheapestOneWay({ busInr: null, trainInr: null, carShareInr: 500 }).mode).toBe('car');
    expect(cheapestOneWay({ busInr: 400, trainInr: 300, carShareInr: 500 }).mode).toBe('train');
  });

  it('rounds the chosen fare up', () => {
    expect(cheapestOneWay({ busInr: null, trainInr: null, carShareInr: 500.2 })).toEqual({
      inr: 501,
      mode: 'car',
    });
  });
});

describe('estimatedGroupCost', () => {
  it('hand-checked: n 3, nights 2, one-way 480, stay 1800, food 600, local 300 gives 18180', () => {
    expect(
      estimatedGroupCost({
        n: 3,
        nights: 2,
        oneWayPerPersonInr: 480,
        stayBudgetInr: 1800,
        foodPerDayInr: 600,
        localPerDayInr: 300,
      }),
    ).toBe(18180);
  });

  it('rounds a fractional total up', () => {
    expect(
      estimatedGroupCost({
        n: 1,
        nights: 0,
        oneWayPerPersonInr: 333.3,
        stayBudgetInr: 0,
        foodPerDayInr: 0,
        localPerDayInr: 0,
      }),
    ).toBe(667);
  });
});

describe('composeEstimate (S8: no chained rounding)', () => {
  it('differs from chaining the rounded functions', () => {
    const input = {
      km: 250,
      n: 3,
      nights: 2,
      rules,
      busInr: null,
      trainInr: null,
      stayBudgetInr: 0,
      foodPerDayInr: 0,
      localPerDayInr: 0,
    };
    const result = composeEstimate(input);
    // Raw share is 1677.7778; cheapest.inr rounds to 1678 for display, but the
    // group total is computed from the unrounded share: 6 x 1677.778 -> 10067,
    // not 6 x 1678 = 10068.
    expect(result.cheapest).toEqual({ inr: 1678, mode: 'car' });
    expect(result.estimatedGroupCostInr).toBe(10067);
    const chained = estimatedGroupCost({
      n: 3,
      nights: 2,
      oneWayPerPersonInr: carSharePerPersonOneWay(input),
      stayBudgetInr: 0,
      foodPerDayInr: 0,
      localPerDayInr: 0,
    });
    expect(chained).toBe(10068);
    expect(result.estimatedGroupCostInr).not.toBe(chained);
  });
});
