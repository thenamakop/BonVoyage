import type { z } from 'zod';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
}

export interface LlmResult<T> {
  data: T;
  usage: LlmUsage;
  latencyMs: number;
  model: string;
}

export interface LlmClient {
  generateStructured<T>(request: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    schemaName: string;
  }): Promise<LlmResult<T>>;
}
