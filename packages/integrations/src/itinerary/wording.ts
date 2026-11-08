import type { TripPlan } from '@bonvoyage/engine';
import type { FactSheet } from '@bonvoyage/shared';
import { z } from 'zod';
import { ModelOutputError } from '../errors';
import type { LlmClient } from '../llm/types';
import { QuotaExceededError } from '../quota/quota';
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

/**
 * #121: why the templates were used, as a fixed code. A raw error message can
 * echo provider text, so it never goes into the result or a log.
 */
export type WordingFailure = 'quota' | 'timeout' | 'invalid' | 'error';

export type WordingResult =
  | { ok: true; wording: ItineraryWording; model: string; fromCache: boolean }
  | { ok: false; reason: WordingFailure };

class WordingTimeout extends Error {}

function failureOf(error: unknown): WordingFailure {
  if (error instanceof QuotaExceededError) return 'quota';
  if (error instanceof WordingTimeout) return 'timeout';
  if (error instanceof ModelOutputError || error instanceof z.ZodError) return 'invalid';
  return 'error';
}

/**
 * #165: planning plus wording plus saving must finish inside the 30-second
 * plan limit (SRS 3.3, P10); the wording call gets 25 of them so the rest of
 * the pipeline keeps about 5 seconds of headroom.
 */
export const WORDING_TIMEOUT_MS = 25000;

/**
 * #165: two overstatements reached users on preview (a note claiming "Spend
 * the day" and naming the next item's place, and an invented "historic").
 * The prompt now bans duration claims and adjectives the fact sheet does not
 * support, and the validator independently rejects a note naming another
 * item's place.
 */
const WORDING_RULES =
  ' Wording rules: write a notes entry only for items whose kind is "activity".' +
  ' Never claim a duration: no "spend the day", "all day", "half a day" or hour counts.' +
  ' Use only adjectives grounded in the fact sheet (category, entry fee, opening times);' +
  ' never add qualities such as "historic", "famous" or "scenic".' +
  " A note may name only its own item's place, never another item's.";

/**
 * One model call with a timeout; never throws to the caller. The prompt pins
 * the skeleton (times and places are fixed) and asks for words only.
 */
export async function composeItineraryWording(
  llm: LlmClient,
  factSheet: FactSheet,
  skeleton: TripPlan,
  { timeoutMs = WORDING_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<WordingResult> {
  try {
    const { system, prompt } = buildItineraryPrompt(factSheet);
    const skeletonPrompt = `${prompt}${WORDING_RULES}\n\nPlanned skeleton (times and places are fixed; write words only, no new numbers, times or places):\n${JSON.stringify(skeleton.days)}`;
    assertNoPersonalData(skeletonPrompt);

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new WordingTimeout(`wording timed out after ${timeoutMs} ms`)),
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

    return {
      ok: true,
      wording: result.data,
      model: result.model,
      fromCache: result.fromCache ?? false,
    };
  } catch (error) {
    return { ok: false, reason: failureOf(error) };
  }
}
