import { GoogleGenAI } from '@google/genai';
import type { z } from 'zod';
import { z as zod } from 'zod';
import { IntegrationError, ModelOutputError } from '../errors';
import type { LlmClient, LlmResult, LlmUsage } from './types';

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}

export interface GeminiSdkLike {
  models: {
    generateContent(request: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        responseMimeType?: string;
        responseJsonSchema?: unknown;
        thinkingConfig?: { thinkingLevel?: string };
      };
    }): Promise<{ text?: string; usageMetadata?: GeminiUsageMetadata }>;
  };
}

const PROVIDER = 'gemini';

function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

export class GeminiLlmClient implements LlmClient {
  private readonly model: string;
  private readonly sdk: GeminiSdkLike;

  get modelId(): string {
    return this.model;
  }

  constructor(options: { apiKey: string; model: string; sdk?: GeminiSdkLike }) {
    this.model = options.model;
    // Structural typing: the real SDK accepts a superset of our request shape.
    this.sdk =
      options.sdk ?? (new GoogleGenAI({ apiKey: options.apiKey }) as unknown as GeminiSdkLike);
  }

  async generateStructured<T>(request: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    schemaName: string;
  }): Promise<LlmResult<T>> {
    const jsonSchema = zod.toJSONSchema(request.schema) as Record<string, unknown>;
    delete jsonSchema['$schema'];

    const start = performance.now();
    let response: { text?: string; usageMetadata?: GeminiUsageMetadata };
    try {
      response = await this.sdk.models.generateContent({
        model: this.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      });
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      const status = statusOf(error);
      const retryable = status === 429 || (status !== undefined && status >= 500);
      const wrapped = new IntegrationError(
        PROVIDER,
        `generateContent failed${status === undefined ? '' : ` (HTTP ${status})`}: ${error instanceof Error ? error.message : String(error)}`,
        retryable,
      );
      wrapped.cause = error;
      throw wrapped;
    }
    const latencyMs = Math.round(performance.now() - start);

    const text = response.text;
    if (text === undefined || text === '') {
      throw new ModelOutputError(PROVIDER, 'Model returned no text.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ModelOutputError(PROVIDER, 'Model output was not valid JSON.', text);
    }
    const result = request.schema.safeParse(parsed);
    if (!result.success) {
      throw new ModelOutputError(
        PROVIDER,
        `Model output failed schema ${request.schemaName}: ${result.error.issues[0]?.message ?? 'invalid'}`,
        text,
      );
    }

    const usage: LlmUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      thinkingTokens: response.usageMetadata?.thoughtsTokenCount ?? 0,
    };
    return { data: result.data, usage, latencyMs, model: this.model };
  }
}
