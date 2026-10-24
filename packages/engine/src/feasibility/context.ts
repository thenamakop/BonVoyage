import { nightsBetween } from '@bonvoyage/shared';

// 0004 c: tells the diagnostic whose limit binds. A tie counts as trip because the
// organiser can raise the trip budget but cannot raise members' maxima.
export function capSource(
  tripBudgetInr: number,
  memberCount: number,
  perPersonCapInr: number,
): 'trip' | 'members' {
  return tripBudgetInr <= memberCount * perPersonCapInr ? 'trip' : 'members';
}

// Inclusive days in a common window; the same convention as groupProfile.
export function windowDays(start: string, end: string): number {
  return nightsBetween(start, end) + 1;
}
