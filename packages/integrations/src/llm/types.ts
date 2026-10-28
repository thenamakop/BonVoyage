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
  /** #121: true when the guarded client answered from llm_cache (no model call, no quota). */
  fromCache?: boolean;
}

export interface LlmRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
}

export interface LlmClient {
  /** The model a request goes to; part of the guarded client's cache key (#121). */
  readonly modelId?: string;
  generateStructured<T>(request: LlmRequest<T>): Promise<LlmResult<T>>;
}
