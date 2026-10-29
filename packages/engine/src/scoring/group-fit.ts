import type { GroupFit, Weights } from './types';

/**
 * Without member weights this is section 4's GFS. With them (R17, section 8) the
 * mean and the population sd are weighted; min stays unweighted.
 */
export function groupFit(
  scores: readonly number[],
  weights: Weights,
  memberWeights?: readonly number[],
): GroupFit {
  if (scores.length === 0) throw new RangeError('Group fit requires at least one score.');
  if (memberWeights !== undefined) return weightedGroupFit(scores, weights, memberWeights);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const min = Math.min(...scores);
  const sd = Math.sqrt(scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length);
  return { mean, min, sd, gfs: weights.alpha * mean + weights.beta * min - weights.gamma * sd };
}

function weightedGroupFit(
  scores: readonly number[],
  weights: Weights,
  memberWeights: readonly number[],
): GroupFit {
  if (memberWeights.length !== scores.length) {
    throw new RangeError('Group fit requires one member weight per score.');
  }
  // Safe: the lengths match, so every index of scores has a weight.
  const weightAt = (index: number) => memberWeights[index]!;
  const n = scores.length;
  const mean = scores.reduce((sum, score, i) => sum + weightAt(i) * score, 0) / n;
  const min = Math.min(...scores);
  const sd = Math.sqrt(
    scores.reduce((sum, score, i) => sum + weightAt(i) * (score - mean) ** 2, 0) / n,
  );
  return { mean, min, sd, gfs: weights.alpha * mean + weights.beta * min - weights.gamma * sd };
}
