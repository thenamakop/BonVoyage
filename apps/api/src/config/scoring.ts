import type { Weights } from '@bonvoyage/engine';
import { z } from 'zod';
import scoringConfig from '../../config/scoring.json' with { type: 'json' };

// Decision 0004 h: the group-fit weights live in apps/api/config/scoring.json,
// are validated once at start-up (a bad file stops the server with a clear
// message) and are stored on every recommendation run. No literal weights in
// application code; tests inject their own through createApp's deps.

const ScoringWeights = z.strictObject({
  alpha: z.number().min(0),
  beta: z.number().min(0),
  gamma: z.number().min(0),
});

export function parseScoringWeights(value: unknown): Weights {
  const parsed = ScoringWeights.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `apps/api/config/scoring.json is invalid: ${z.prettifyError(parsed.error)}. ` +
        'Expected { "alpha": number >= 0, "beta": number >= 0, "gamma": number >= 0 }.',
    );
  }
  return parsed.data;
}

/** The configured weights, validated when this module first loads. */
export const SCORING_WEIGHTS: Weights = parseScoringWeights(scoringConfig);
