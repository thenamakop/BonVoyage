/**
 * R17 (scoring.md section 8, decision E1): one earlier shortlisted run, reduced to
 * each member's score on that run's top choice (the destination chosen from it,
 * else its rank 1), keyed by member id.
 */
export interface FairnessRound {
  topChoiceScores: Readonly<Record<string, number>>;
}

/**
 * deficit_i = (1/R) x sum_r max(0, mean_j s_j(o_r) - s_i(o_r)). A member not scored
 * in a round (joined later) adds 0 for it; with no earlier round every deficit is 0.
 */
export function memberDeficits(
  earlierRounds: readonly FairnessRound[],
  memberIds: readonly string[],
): Record<string, number> {
  const roundMeans = earlierRounds.map(({ topChoiceScores }) => {
    const scores = Object.values(topChoiceScores);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  });
  return Object.fromEntries(
    memberIds.map((memberId) => {
      const total = earlierRounds.reduce((sum, { topChoiceScores }, r) => {
        const own = topChoiceScores[memberId];
        // Safe: roundMeans was mapped from earlierRounds, so index r exists. A round
        // that scored this member has at least one score, so its mean is a number.
        return own === undefined ? sum : sum + Math.max(0, roundMeans[r]! - own);
      }, 0);
      return [memberId, earlierRounds.length === 0 ? 0 : total / earlierRounds.length];
    }),
  );
}

/** w_i = 1 + lambda x deficit_i, normalised so the mean weight is 1 (E1). */
export function fairnessWeights(
  deficits: Readonly<Record<string, number>>,
  lambda: number,
): Record<string, number> {
  if (!Number.isFinite(lambda) || lambda < 0) {
    throw new RangeError('lambda must be a finite number of at least 0.');
  }
  const raw = Object.entries(deficits).map(
    ([memberId, deficit]) => [memberId, 1 + lambda * deficit] as const,
  );
  if (raw.length === 0) return {};
  const meanRaw = raw.reduce((sum, [, weight]) => sum + weight, 0) / raw.length;
  return Object.fromEntries(raw.map(([memberId, weight]) => [memberId, weight / meanRaw]));
}
