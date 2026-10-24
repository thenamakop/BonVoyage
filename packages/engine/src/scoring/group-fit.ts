import type { GroupFit, Weights } from './types';

export function groupFit(scores: readonly number[], weights: Weights): GroupFit {
  if (scores.length === 0) throw new RangeError('Group fit requires at least one score.');
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const min = Math.min(...scores);
  const sd = Math.sqrt(scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length);
  return { mean, min, sd, gfs: weights.alpha * mean + weights.beta * min - weights.gamma * sd };
}
