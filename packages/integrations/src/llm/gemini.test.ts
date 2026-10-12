import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { IntegrationError } from '../errors';
import { createLlmClient } from './factory';
import { FixtureLlmClient } from './fixture';
import { GeminiLlmClient } from './gemini';
import type { GeminiSdkLike } from './gemini';

const Answer = z.object({ answer: z.string() });

function fakeSdk(
  respond: () => Promise<{ text?: string; usageMetadata?: Record<string, number> }>,
  captured?: { request?: unknown },
): GeminiSdkLike {
  return {
    models: {
      generateContent(request) {
        if (captured) captured.request = request;
        return respond();
      },
    },
  };
}

describe('GeminiLlmClient', () => {
  it('parses valid JSON and maps usage', async () => {
    const client = new GeminiLlmClient({
      apiKey: 'unused',
      model: 'test-model',
      sdk: fakeSdk(() =>
        Promise.resolve({
          text: '{"answer":"yes"}',
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 },
        }),
      ),
    });
    const result = await client.generateStructured({
      system: 'sys',
      prompt: 'p',
      schema: Answer,
      schemaName: 'answer',
    });
    expect(result.data).toEqual({ answer: 'yes' });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, thinkingTokens: 2 });
    expect(result.model).toBe('test-model');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('throws a non-retryable error on invalid JSON', async () => {
    const client = new GeminiLlmClient({
      apiKey: 'unused',
      model: 'm',
      sdk: fakeSdk(() => Promise.resolve({ text: 'not json' })),
    });
    const error = await client
      .generateStructured({ system: 's', prompt: 'p', schema: Answer, schemaName: 'a' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IntegrationError);
    expect((error as IntegrationError).retryable).toBe(false);
    expect((error as IntegrationError).rawText).toBe('not json');
  });

  it('throws a non-retryable error on schema mismatch', async () => {
    const client = new GeminiLlmClient({
      apiKey: 'unused',
      model: 'm',
      sdk: fakeSdk(() => Promise.resolve({ text: '{"wrong":1}' })),
    });
    const error = await client
      .generateStructured({ system: 's', prompt: 'p', schema: Answer, schemaName: 'a' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IntegrationError);
    expect((error as IntegrationError).retryable).toBe(false);
  });

  it('throws a retryable error on 429', async () => {
    const client = new GeminiLlmClient({
      apiKey: 'unused',
      model: 'm',
      sdk: fakeSdk(() => Promise.reject(Object.assign(new Error('rate limited'), { status: 429 }))),
    });
    const error = await client
      .generateStructured({ system: 's', prompt: 'p', schema: Answer, schemaName: 'a' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IntegrationError);
    expect((error as IntegrationError).retryable).toBe(true);
  });

  it('sends no sampling parameters and thinking level low', async () => {
    const captured: { request?: { config?: Record<string, unknown> } } = {};
    const client = new GeminiLlmClient({
      apiKey: 'unused',
      model: 'm',
      sdk: fakeSdk(() => Promise.resolve({ text: '{"answer":"yes"}' }), captured),
    });
    await client.generateStructured({ system: 's', prompt: 'p', schema: Answer, schemaName: 'a' });
    const config = captured.request?.config ?? {};
    expect(config).not.toHaveProperty('temperature');
    expect(config).not.toHaveProperty('topP');
    expect(config).not.toHaveProperty('topK');
    expect(config['thinkingConfig']).toEqual({ thinkingLevel: 'low' });
    expect(config['responseMimeType']).toBe('application/json');
    expect(config['responseJsonSchema']).toBeTypeOf('object');
  });
});

describe('createLlmClient', () => {
  it('returns a fixture client when live APIs are off', () => {
    const client = createLlmClient({ liveApis: 'off' });
    expect(client).toBeInstanceOf(FixtureLlmClient);
  });

  it('throws when live without a key', () => {
    expect(() => createLlmClient({ liveApis: 'on' })).toThrow(IntegrationError);
  });

  it('returns the Gemini client when live with a key', () => {
    const client = createLlmClient({ liveApis: 'on', apiKey: 'k', model: 'm' });
    expect(client).toBeInstanceOf(GeminiLlmClient);
  });
});

describe('FixtureLlmClient', () => {
  it('returns the recorded output for the schema name', async () => {
    const client = new FixtureLlmClient({ a: { answer: 'recorded' } });
    const result = await client.generateStructured({
      system: 's',
      prompt: 'p',
      schema: Answer,
      schemaName: 'a',
    });
    expect(result.data).toEqual({ answer: 'recorded' });
  });
});
