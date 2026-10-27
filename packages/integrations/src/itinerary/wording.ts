import type { TripPlan } from '@bonvoyage/engine';
import type { FactSheet } from '@bonvoyage/shared';
import { z } from 'zod';
import { IntegrationError } from '../errors';
import type { LlmClient } from '../llm/types';
import { assertNoPersonalData, buildItineraryPrompt } from './prompt';

// 0005 e/f: with LIVE_APIS=on the model rewrites the WORDS only. Times,
// places and amounts stay on the planned skeleton; every note is re-checked
// against the fact sheet by validateItinerary after merging.

export const ItineraryWording = z.object({
  summary: z.string().min(1).max(600),
  reasons: z.array(z.string().min(1).max(200)).min(1).max(5),
  notes: z.array(
    z.object({
      day: z.number().int().min(1),
      index: z.number().int().min(0),
      note: z.string().min(1).max(200),
    }),
  ),
});
export type ItineraryWording = z.infer<typeof ItineraryWording>;

export type WordingResult =
  { ok: true; wording: ItineraryWording; model: string } | { ok: false; reason: string };

/**
 * One model call with a timeout; never throws to the caller. The prompt pins
 * the skeleton (times and places are fixed) and asks for words only.
 */
export async function composeItineraryWording(
  llm: LlmClient,
  factSheet: FactSheet,
  skeleton: TripPlan,
  { timeoutMs = 20000 }: { timeoutMs?: number } = {},
): Promise<WordingResult> {
  try {
    const { system, prompt } = buildItineraryPrompt(factSheet);
    const skeletonPrompt = `${prompt}\n\nPlanned skeleton (times and places are fixed; write words only, no new numbers, times or places):\n${JSON.stringify(skeleton.days)}`;
    assertNoPersonalData(skeletonPrompt);

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`wording timed out after ${timeoutMs} ms`)),
        timeoutMs,
      );
    });
    const result = await Promise.race([
      llm.generateStructured({
        system,
        prompt: skeletonPrompt,
        schema: ItineraryWording,
        schemaName: 'ItineraryWording',
      }),
      timeout,
    ]).finally(() => clearTimeout(timer));

    return { ok: true, wording: result.data, model: result.model };
  } catch (error) {
    const reason = error instanceof IntegrationError ? error.message : String(error);
    return { ok: false, reason };
  }
}
