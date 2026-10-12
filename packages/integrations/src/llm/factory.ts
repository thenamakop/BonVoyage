import { IntegrationError } from '../errors';
import { FixtureLlmClient } from './fixture';
import { GeminiLlmClient } from './gemini';
import type { LlmClient } from './types';

export function createLlmClient(options: {
  liveApis: string | undefined;
  apiKey?: string;
  model?: string;
  fixtures?: Record<string, unknown>;
}): LlmClient {
  if (options.liveApis === 'on') {
    if (!options.apiKey) {
      throw new IntegrationError('gemini', 'LIVE_APIS=on but GEMINI_API_KEY is not set.', false);
    }
    if (!options.model) {
      throw new IntegrationError('gemini', 'LIVE_APIS=on but GEMINI_MODEL is not set.', false);
    }
    return new GeminiLlmClient({ apiKey: options.apiKey, model: options.model });
  }
  return new FixtureLlmClient(options.fixtures ?? {});
}
