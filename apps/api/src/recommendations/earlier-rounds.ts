import { fairnessWeights, memberDeficits, type FairnessRound } from '@bonvoyage/engine';

// R17 (decision E1, S5-2b-2): the trip's earlier shortlists, reduced to each
// one's top choice. Pure, so planRun and the read path compute the same
// weights from the same rows; weights are never stored (E2).

export interface RunMark {
  id: string;
  round: number;
  kind: 'shortlist' | 'diagnostic';
  createdAt: Date;
}

/** A stored item of an earlier shortlist, with each scored member's score. */
export interface TopChoiceCandidate {
  runId: string;
  destinationId: string;
  rank: number;
  scores: readonly { tripMemberId: string; score: number }[];
}

/** A package row: T9 stores them and they are never deleted, only hidden. */
export interface PackageMark {
  destinationId: string;
  createdAt: Date;
}

/**
 * One FairnessRound per shortlist run before `beforeRound`, oldest first. Its top
 * choice is the destination chosen from it (T9), else its rank 1. T10 clears the
 * trip's selected destination, so the choice is read from the packages that T9
 * stored while the run was the latest one: created at or after the run and
 * before the next run. The latest such T9 wins. Diagnostics never count.
 */
export function earlierRounds(
  runs: readonly RunMark[],
  candidates: readonly TopChoiceCandidate[],
  packages: readonly PackageMark[],
  beforeRound: number,
): FairnessRound[] {
  const ordered = [...runs].sort((a, b) => a.round - b.round);
  const rounds: FairnessRound[] = [];
  ordered.forEach((run, index) => {
    if (run.kind !== 'shortlist' || run.round >= beforeRound) return;
    const from = run.createdAt.getTime();
    const until = ordered[index + 1]?.createdAt.getTime() ?? Infinity;
    const items = candidates.filter((c) => c.runId === run.id);
    const chosen = packages
      .filter((p) => p.createdAt.getTime() >= from && p.createdAt.getTime() < until)
      .filter((p) => items.some((c) => c.destinationId === p.destinationId))
      .reduce<PackageMark | undefined>(
        (latest, p) => (!latest || p.createdAt > latest.createdAt ? p : latest),
        undefined,
      );
    const top = chosen
      ? items.find((c) => c.destinationId === chosen.destinationId)
      : items.find((c) => c.rank === 1);
    if (!top) return;
    rounds.push({
      topChoiceScores: Object.fromEntries(top.scores.map((s) => [s.tripMemberId, s.score])),
    });
  });
  return rounds;
}

/**
 * The weights for this round's scored members, or undefined when every weight is
 * 1 (no earlier shortlist, lambda 0, or no deficit): ranking then takes today's
 * unweighted path exactly, so a first shortlist never moves (M3). Members
 * excluded since an earlier round are not in memberIds and get no weight.
 */
export function roundWeights(
  rounds: readonly FairnessRound[],
  memberIds: readonly string[],
  lambda: number,
): Record<string, number> | undefined {
  if (rounds.length === 0 || lambda === 0) return undefined;
  const weights = fairnessWeights(memberDeficits(rounds, memberIds), lambda);
  // Normalising equal weights can land a rounding error away from 1.
  return Object.values(weights).every((w) => Math.abs(w - 1) < 1e-12) ? undefined : weights;
}
