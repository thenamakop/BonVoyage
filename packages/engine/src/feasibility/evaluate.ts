import { composeEstimate } from '../costs/costs';
import type { CandidateFacts, Evaluation, Failure, FeasibilityContext } from './types';

// Months touched by the common window, start to end inclusive, across year ends.
export function windowMonths(start: string, end: string): number[] {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const months: number[] = [];
  let y = s.getUTCFullYear();
  let m = s.getUTCMonth() + 1;
  const ey = e.getUTCFullYear();
  const em = e.getUTCMonth() + 1;
  while (y < ey || (y === ey && m <= em)) {
    months.push(m);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

// Smallest circular distance (0 to 6) between any window month and any best month;
// 0 means in season. December to January is 1 month.
export function monthShift(months: readonly number[], bestMonths: readonly number[]): number {
  let shift = 6;
  for (const m of months) {
    for (const best of bestMonths) {
      const diff = Math.abs(m - best);
      shift = Math.min(shift, Math.min(diff, 12 - diff));
    }
  }
  return shift;
}

// F1 radius, F2 duration, F4 season, F5 budget. F3 is the group gate handled by
// buildDiagnostic before evaluation (a null common window never reaches here).
export function evaluateCandidate(facts: CandidateFacts, ctx: FeasibilityContext): Evaluation {
  const { destination } = facts;
  const { cheapest, estimatedGroupCostInr } = composeEstimate({
    km: facts.distanceKm,
    n: ctx.n,
    nights: ctx.durationNights,
    rules: facts.costRules,
    busInr: facts.fares.busInr,
    trainInr: facts.fares.trainInr,
    stayBudgetInr: destination.stayBudgetInr,
    foodPerDayInr: destination.foodPerDayInr,
    localPerDayInr: destination.localPerDayInr,
  });
  const failures: Failure[] = [];
  if (facts.distanceKm > ctx.radiusKm) {
    const relaxation = facts.distanceKm - ctx.radiusKm;
    failures.push({
      id: 'F1',
      limit: ctx.radiusKm,
      actual: facts.distanceKm,
      relaxation,
      relative: relaxation / ctx.radiusKm,
      unit: 'km',
    });
  }
  if (ctx.durationNights < destination.minNights) {
    const relaxation = destination.minNights - ctx.durationNights;
    failures.push({
      id: 'F2',
      limit: destination.minNights,
      actual: ctx.durationNights,
      relaxation,
      relative: relaxation / ctx.durationNights,
      unit: 'nights',
    });
  }
  const shift = monthShift(
    windowMonths(ctx.commonWindow.start, ctx.commonWindow.end),
    destination.bestMonths,
  );
  if (shift > 0) {
    failures.push({
      id: 'F4',
      limit: 0,
      actual: shift,
      relaxation: shift,
      relative: shift / 12,
      unit: 'months',
    });
  }
  if (estimatedGroupCostInr > ctx.groupCapInr) {
    const relaxation = estimatedGroupCostInr - ctx.groupCapInr;
    failures.push({
      id: 'F5',
      limit: ctx.groupCapInr,
      actual: estimatedGroupCostInr,
      relaxation,
      relative: relaxation / ctx.groupCapInr,
      unit: 'inr',
    });
  }
  return {
    destinationId: destination.id,
    slug: destination.slug,
    feasible: failures.length === 0,
    estimatedGroupCostInr,
    cheapest,
    failures,
  };
}
