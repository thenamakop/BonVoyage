import { compareText } from './counts';
import { groupFit } from './group-fit';
import { memberScore } from './member-score';
import type { DestinationInput, MemberInput, RankedDestination, Weights } from './types';

export function sortRankedDestinations(results: readonly RankedDestination[]): RankedDestination[] {
  return results
    .map((result) => ({
      result,
      gfsKey: Math.round(result.gfs * 1e9),
      meanKey: Math.round(result.mean * 1e9),
    }))
    .sort(
      (a, b) =>
        b.gfsKey - a.gfsKey || b.meanKey - a.meanKey || compareText(a.result.slug, b.result.slug),
    )
    .map(({ result }) => result);
}

export function rankDestinations(
  members: readonly MemberInput[],
  destinations: readonly DestinationInput[],
  weights: Weights,
): RankedDestination[] {
  const results = destinations.map((destination) => {
    const memberScores = members.map((member) => ({
      memberId: member.memberId,
      score: memberScore(member, destination),
    }));
    const scores = memberScores.map(({ score }) => score);
    return {
      destinationId: destination.id,
      slug: destination.slug,
      ...groupFit(scores, weights),
      max: Math.max(...scores),
      memberScores,
    };
  });
  return sortRankedDestinations(results);
}
