import type { TransportMode } from '@bonvoyage/shared';

// 0004 d / scoring section 2: all figures are estimates; money rounds up to whole
// rupees only at an exported boundary (S8), never between intermediate steps.

export interface CostRules {
  fuelPriceInrPerLitre: number;
  carKmPerLitre: number;
  tollInrPerKm: number;
  personsPerCar: number;
  carRentalInrPerDay: number;
}

export interface OneWayFares {
  busInr: number | null;
  trainInr: number | null;
  carShareInr: number;
}

export interface CheapestOneWay {
  inr: number;
  mode: TransportMode;
}

interface CarShareInput {
  km: number;
  n: number;
  nights: number;
  rules: CostRules;
}

interface GroupCostInput {
  n: number;
  nights: number;
  oneWayPerPersonInr: number;
  stayBudgetInr: number;
  foodPerDayInr: number;
  localPerDayInr: number;
}

function rawCarShare({ km, n, nights, rules }: CarShareInput): number {
  const cars = Math.ceil(n / rules.personsPerCar);
  const perKm = rules.fuelPriceInrPerLitre / rules.carKmPerLitre + rules.tollInrPerKm;
  return (cars * (km * perKm + (rules.carRentalInrPerDay * (nights + 1)) / 2)) / n;
}

// Ties prefer the public modes over a private car: train, then bus, then car.
function rawCheapest({ busInr, trainInr, carShareInr }: OneWayFares): {
  inr: number;
  mode: TransportMode;
} {
  let best = { inr: carShareInr, mode: 'car' as TransportMode };
  if (trainInr !== null && trainInr <= best.inr) best = { inr: trainInr, mode: 'train' };
  if (busInr !== null && busInr <= best.inr && best.mode !== 'train')
    best = { inr: busInr, mode: 'bus' };
  return best;
}

function rawGroupCost({
  n,
  nights,
  oneWayPerPersonInr,
  stayBudgetInr,
  foodPerDayInr,
  localPerDayInr,
}: GroupCostInput): number {
  const rooms = Math.ceil(n / 2);
  return (
    n * 2 * oneWayPerPersonInr +
    rooms * nights * stayBudgetInr +
    n * (nights + 1) * (foodPerDayInr + localPerDayInr)
  );
}

export function carSharePerPersonOneWay(input: CarShareInput): number {
  return Math.ceil(rawCarShare(input));
}

export function cheapestOneWay(fares: OneWayFares): CheapestOneWay {
  const best = rawCheapest(fares);
  return { inr: Math.ceil(best.inr), mode: best.mode };
}

export function estimatedGroupCost(input: GroupCostInput): number {
  return Math.ceil(rawGroupCost(input));
}

// S8 boundary for evaluateCandidate: compose the unrounded pieces, then round
// cheapest.inr and estimatedGroupCostInr once each at the end.
export function composeEstimate(input: {
  km: number;
  n: number;
  nights: number;
  rules: CostRules;
  busInr: number | null;
  trainInr: number | null;
  stayBudgetInr: number;
  foodPerDayInr: number;
  localPerDayInr: number;
}): { cheapest: CheapestOneWay; estimatedGroupCostInr: number } {
  const car = rawCarShare(input);
  const best = rawCheapest({ busInr: input.busInr, trainInr: input.trainInr, carShareInr: car });
  const total = rawGroupCost({
    n: input.n,
    nights: input.nights,
    oneWayPerPersonInr: best.inr,
    stayBudgetInr: input.stayBudgetInr,
    foodPerDayInr: input.foodPerDayInr,
    localPerDayInr: input.localPerDayInr,
  });
  return {
    cheapest: { inr: Math.ceil(best.inr), mode: best.mode },
    estimatedGroupCostInr: Math.ceil(total),
  };
}
