import { compareText } from './counts';
import { groupFit } from './group-fit';
import { memberScore } from './member-score';
import type { DestinationInput, MemberInput, RankedDestination, Weights } from './types';

export function sortRankedDestinations(results: readonly RankedDestination[]): RankedDestination[] {
  return sortByRankScore(results.map((result) => ({ result, rankScore: result.gfs })));
}

function sortByRankScore(
  entries: readonly { result: RankedDestination; rankScore: number }[],
): RankedDestination[] {
  return entries
    .map(({ result, rankScore }) => ({
      result,
      gfsKey: Math.round(rankScore * 1e9),
      meanKey: Math.round(result.mean * 1e9),
    }))
    .sort(
      (a, b) =>
        b.gfsKey - a.gfsKey || b.meanKey - a.meanKey || compareText(a.result.slug, b.result.slug),
    )
    .map(({ result }) => result);
}

/**
 * With memberWeights (R17, section 8) the order follows the weighted GFS, but each
 * result keeps the unweighted gfs, mean, min and sd: weights never leave the engine
 * in a figure a member could read (decision E1).
 */
export function rankDestinations(
  members: readonly MemberInput[],
  destinations: readonly DestinationInput[],
  weights: Weights,
  memberWeights?: Readonly<Record<string, number>>,
): RankedDestination[] {
  const weightList = memberWeights && members.map((m) => weightFor(memberWeights, m.memberId));
  const entries = destinations.map((destination) => {
    const memberScores = members.map((member) => ({
      memberId: member.memberId,
      score: memberScore(member, destination),
    }));
    const scores = memberScores.map(({ score }) => score);
    const result: RankedDestination = {
      destinationId: destination.id,
      slug: destination.slug,
      ...groupFit(scores, weights),
      max: Math.max(...scores),
      memberScores,
    };
    const rankScore = weightList ? groupFit(scores, weights, weightList).gfs : result.gfs;
    return { result, rankScore };
  });
  return sortByRankScore(entries);
}

function weightFor(memberWeights: Readonly<Record<string, number>>, memberId: string): number {
  const weight = memberWeights[memberId];
  if (weight === undefined) throw new RangeError(`No fairness weight for member ${memberId}.`);
  return weight;
}
