import { countValues } from './counts';
import type { DestinationInput, GroupSummary, MatchExplanation, MemberInput } from './types';

export function explainMatch(member: MemberInput, destination: DestinationInput): MatchExplanation {
  const types = new Set(destination.types);
  const activities = new Set(destination.activities);
  const wantedTypes = [...new Set(member.types)];
  const wantedActivities = [...new Set(member.activities)];
  return {
    metTypes: wantedTypes.filter((value) => types.has(value)),
    missedTypes: wantedTypes.filter((value) => !types.has(value)),
    metActivities: wantedActivities.filter((value) => activities.has(value)),
    missedActivities: wantedActivities.filter((value) => !activities.has(value)),
    climateMet: member.climate === 'any' || member.climate === destination.climate,
  };
}

export function groupSummary(
  explanations: readonly MatchExplanation[],
  memberCount: number,
): GroupSummary {
  return {
    memberCount,
    climateMetCount: explanations.filter((explanation) => explanation.climateMet).length,
    sharedTypes: countValues(explanations.map((explanation) => explanation.metTypes)).filter(
      ({ count }) => count >= 2,
    ),
    sharedActivities: countValues(
      explanations.map((explanation) => explanation.metActivities),
    ).filter(({ count }) => count >= 2),
  };
}
