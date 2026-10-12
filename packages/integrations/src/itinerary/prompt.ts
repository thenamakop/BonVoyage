import type { FactSheet } from '@bonvoyage/shared';
import { IntegrationError } from '../errors';

const PERSONAL_DATA = [
  { name: 'email address', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  // Requires a space so ISO dates like 2026-11-06 are not flagged.
  { name: 'phone number', pattern: /\+?\d[\d\s-]{4,}\s[\d\s-]{3,}\d/ },
  { name: 'API-key-like string', pattern: /(?:AIza|AQ\.)[A-Za-z0-9_-]{8,}/ },
] as const;

/** Design rule: prompts carry destination facts only (AGENTS.md section 11). */
export function assertNoPersonalData(text: string): void {
  for (const { name, pattern } of PERSONAL_DATA) {
    if (pattern.test(text)) {
      throw new IntegrationError(
        'prompt',
        `Prompt contains a ${name}; personal data is never sent to the model.`,
        false,
      );
    }
  }
}

const SYSTEM = [
  'You write a day-wise trip itinerary as JSON.',
  'Use only the places and numbers in the fact sheet: never invent a place, price, distance, duration or time.',
  'Refer to places by their id in poiId. Keep activities inside opening hours and off closed days.',
  'Put the onward journey on day 1 and the return journey on the last day, each as a travel item with its legId.',
  'Keep each day within limits.maxDayHours from first start to last end, ignoring stay items.',
  'Write British English in short notes. Output JSON matching the schema exactly.',
].join(' ');

export function buildItineraryPrompt(facts: FactSheet): { system: string; prompt: string } {
  const prompt = `Fact sheet:\n${JSON.stringify(facts, null, 2)}`;
  assertNoPersonalData(prompt);
  return { system: SYSTEM, prompt };
}
