import type { Weights } from '@bonvoyage/engine';
import { z } from 'zod';
import scoringConfig from '../../config/scoring.json' with { type: 'json' };

// Decision 0004 h: the group-fit weights live in apps/api/config/scoring.json,
// are validated once at start-up (a bad file stops the server with a clear
// message) and are stored on every recommendation run. No literal weights in
// application code; tests inject their own through createApp's deps.
// R17 (decision E1): lambda, the fairness strength across rounds, lives in the
// same file, 0 to 5, and is stored on every run too.

const ScoringConfig = z.strictObject({
  alpha: z.number().min(0),
  beta: z.number().min(0),
  gamma: z.number().min(0),
  lambda: z.number().min(0).max(5),
});

export interface ScoringConfig {
  weights: Weights;
  lambda: number;
}

export function parseScoringConfig(value: unknown): ScoringConfig {
  const parsed = ScoringConfig.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `apps/api/config/scoring.json is invalid: ${z.prettifyError(parsed.error)}. ` +
        'Expected { "alpha": number >= 0, "beta": number >= 0, "gamma": number >= 0, ' +
        '"lambda": number from 0 to 5 }.',
    );
  }
  const { alpha, beta, gamma, lambda } = parsed.data;
  return { weights: { alpha, beta, gamma }, lambda };
}

const CONFIG = parseScoringConfig(scoringConfig);

/** The configured weights, validated when this module first loads. */
export const SCORING_WEIGHTS: Weights = CONFIG.weights;
/** The configured fairness lambda (R17), validated with the weights. */
export const FAIRNESS_LAMBDA: number = CONFIG.lambda;
