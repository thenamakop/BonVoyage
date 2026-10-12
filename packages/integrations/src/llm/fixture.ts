import type { z } from 'zod';
import { IntegrationError } from '../errors';
import type { LlmClient, LlmResult } from './types';

/** Returns recorded outputs keyed by schemaName; used whenever LIVE_APIS is off. */
export class FixtureLlmClient implements LlmClient {
  private readonly fixtures: Record<string, unknown>;

  constructor(fixtures: Record<string, unknown>) {
    this.fixtures = fixtures;
  }

  generateStructured<T>(request: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    schemaName: string;
  }): Promise<LlmResult<T>> {
    const recorded = this.fixtures[request.schemaName];
    if (recorded === undefined) {
      return Promise.reject(
        new IntegrationError(
          'fixture',
          `No fixture recorded for schema "${request.schemaName}".`,
          false,
        ),
      );
    }
    const parsed = request.schema.parse(recorded);
    return Promise.resolve({
      data: parsed,
      usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 },
      latencyMs: 0,
      model: 'fixture',
    });
  }
}
