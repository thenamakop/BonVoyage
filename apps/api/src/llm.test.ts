import { createDb } from '@bonvoyage/db';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { createLlmFromEnv } from './llm';

// #121: both entry points build the model client here. A missing key or model
// on a deployment logs which variable is missing and gives the templates; it
// never throws at cold start. No test reaches a real model (LIVE_APIS stays
// off in tests; "on" here only builds the client).

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
afterAll(async () => {
  await pool.end();
});

function capture() {
  const lines: Record<string, unknown>[] = [];
  const logger = pino(
    { level: 'info' },
    { write: (line: string) => void lines.push(JSON.parse(line) as Record<string, unknown>) },
  );
  return { lines, logger };
}
const deps = (logger: ReturnType<typeof capture>['logger']) => ({
  db,
  clock: () => new Date('2026-11-03T06:30:00Z'),
  logger,
});

describe('createLlmFromEnv', () => {
  it('LIVE_APIS off: no client, so the templates word the day plan', () => {
    const { lines, logger } = capture();
    const llm = createLlmFromEnv(
      { LIVE_APIS: 'off', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', GEMINI_DAILY_LIMIT: 5 },
      deps(logger),
    );
    expect(llm).toBeUndefined();
    expect(lines).toEqual([]);
  });

  it('LIVE_APIS on with a key and a model: a guarded client for that model', () => {
    const { lines, logger } = capture();
    const llm = createLlmFromEnv(
      {
        LIVE_APIS: 'on',
        GEMINI_API_KEY: 'test-key-not-real',
        GEMINI_MODEL: 'test-model',
        GEMINI_DAILY_LIMIT: 5,
      },
      deps(logger),
    );
    expect(llm).toBeDefined();
    expect(llm?.modelId).toBe('test-model');
    expect(lines).toEqual([]);
  });

  it('LIVE_APIS on without a key: no client and one warning naming the variable, never a value', () => {
    const { lines, logger } = capture();
    const llm = createLlmFromEnv(
      { LIVE_APIS: 'on', GEMINI_MODEL: 'test-model', GEMINI_DAILY_LIMIT: 5 },
      deps(logger),
    );
    expect(llm).toBeUndefined();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 40, missing: 'GEMINI_API_KEY' });
    expect(JSON.stringify(lines[0])).not.toContain('test-model');
  });

  it('LIVE_APIS on without a model: no client and one warning naming GEMINI_MODEL', () => {
    const { lines, logger } = capture();
    const llm = createLlmFromEnv(
      { LIVE_APIS: 'on', GEMINI_API_KEY: 'test-key-not-real', GEMINI_DAILY_LIMIT: 5 },
      deps(logger),
    );
    expect(llm).toBeUndefined();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 40, missing: 'GEMINI_MODEL' });
    expect(JSON.stringify(lines[0])).not.toContain('test-key-not-real');
  });
});
