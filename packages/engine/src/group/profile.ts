import { nightsBetween } from '@bonvoyage/shared';
import type { Activity, ClimatePreference, DestinationType } from '@bonvoyage/shared';
import { countValues } from '../scoring/counts';
import type { MemberInput, ValueCount } from '../scoring/types';

export interface GroupConflict {
  code: 'NO_COMMON_WINDOW' | 'WINDOW_TOO_SHORT' | 'BUDGET_BANDS_DISJOINT';
  blocking: boolean;
}

export interface GroupProfile {
  memberCount: number;
  commonWindow: { start: string; end: string; days: number } | null;
  windowFits: boolean;
  budgetBand: { minInr: number; maxInr: number; overlaps: boolean };
  perPersonCapInr: number;
  groupCapInr: number;
  typeVotes: ValueCount<DestinationType>[];
  activityVotes: ValueCount<Activity>[];
  climateVotes: ValueCount<ClimatePreference>[];
  conflicts: GroupConflict[];
}

export function groupProfile(
  members: readonly MemberInput[],
  trip: { durationNights: number; budgetTotalInr: number },
): GroupProfile {
  const first = members[0];
  if (!first) throw new RangeError('Group profile requires at least one member.');
  const start = members.reduce(
    (latest, member) => (member.dateStart > latest ? member.dateStart : latest),
    first.dateStart,
  );
  const end = members.reduce(
    (earliest, member) => (member.dateEnd < earliest ? member.dateEnd : earliest),
    first.dateEnd,
  );
  const commonWindow = start <= end ? { start, end, days: nightsBetween(start, end) + 1 } : null;
  const windowFits = commonWindow !== null && commonWindow.days >= trip.durationNights + 1;
  const minInr = Math.max(...members.map((member) => member.budgetMinInr));
  const maxInr = Math.min(...members.map((member) => member.budgetMaxInr));
  const overlaps = minInr <= maxInr;
  const conflicts: GroupConflict[] = [];
  if (commonWindow === null) conflicts.push({ code: 'NO_COMMON_WINDOW', blocking: true });
  else if (!windowFits) conflicts.push({ code: 'WINDOW_TOO_SHORT', blocking: true });
  if (!overlaps) conflicts.push({ code: 'BUDGET_BANDS_DISJOINT', blocking: false });
  return {
    memberCount: members.length,
    commonWindow,
    windowFits,
    budgetBand: { minInr, maxInr, overlaps },
    perPersonCapInr: maxInr,
    groupCapInr: Math.min(trip.budgetTotalInr, members.length * maxInr),
    typeVotes: countValues(members.map((member) => member.types)),
    activityVotes: countValues(members.map((member) => member.activities)),
    climateVotes: countValues(members.map((member) => [member.climate])),
    conflicts,
  };
}
