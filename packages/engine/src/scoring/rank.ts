import { compareText } from './counts';
import { groupFit } from './group-fit';
import { memberScore } from './member-score';
import type { DestinationInput, MemberInput, RankedDestination, Weights } from './types';

export function compareRankedDestinations(a: RankedDestination, b: RankedDestination): number {
  const gfsDelta = b.gfs - a.gfs;
  if (Math.abs(gfsDelta) > 1e-12) return gfsDelta;
  const meanDelta = b.mean - a.mean;
  if (Math.abs(meanDelta) > 1e-12) return meanDelta;
  return compareText(a.slug, b.slug);
}

export function rankDestinations(
  members: readonly MemberInput[],
  destinations: readonly DestinationInput[],
  weights: Weights,
): RankedDestination[] {
  return destinations
    .map((destination) => {
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
    })
    .sort(compareRankedDestinations);
}
