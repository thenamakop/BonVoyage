import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { FactSheet, ItineraryOutput } from '@bonvoyage/shared';
import { loadRootEnv } from '@bonvoyage/shared/node';
import { validateItinerary } from '../../../engine/src/itinerary/validate';
import { IntegrationError } from '../../src/errors';
import { GeminiLlmClient } from '../../src/llm/gemini';
import { buildItineraryPrompt } from '../../src/itinerary/prompt';

const { values: args } = parseArgs({
  options: {
    live: { type: 'boolean', default: false },
    gap: { type: 'string', default: '7' },
    runs: { type: 'string', default: '20' },
    model: { type: 'string' },
    tag: { type: 'string', default: '' },
  },
});

if (!args.live) {
  console.error('Refusing to call the live API without --live.');
  process.exit(1);
}

loadRootEnv(import.meta.dirname);
const apiKey = process.env.GEMINI_API_KEY;
const model = args.model ?? process.env.GEMINI_MODEL;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set.');
  process.exit(1);
}
if (!model) {
  console.error('GEMINI_MODEL is not set.');
  process.exit(1);
}

const here = import.meta.dirname;
const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });

const facts = FactSheet.parse(JSON.parse(readFileSync(resolve(here, 'fact-sheet.json'), 'utf8')));
const { system, prompt } = buildItineraryPrompt(facts);
const client = new GeminiLlmClient({ apiKey, model });
const gapMs = Number(args.gap) * 1000;
const runCount = Number(args.runs);

const sleep = (ms: number) => new Promise((resolve_) => setTimeout(resolve_, ms));

interface RunRecord {
  run: number;
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number; thinkingTokens?: number };
  validation: ReturnType<typeof validateItinerary> | null;
  rateLimited: boolean;
  error?: string;
  output: unknown;
}

function retryDelayMs(error: unknown): number {
  // The SDK's 429 body carries retryDelay as "42s" in error details when available.
  const cause = error instanceof IntegrationError ? error.cause : undefined;
  const text = JSON.stringify(cause ?? error);
  const seconds = /"retryDelay"\s*:\s*"(\d+)s"/.exec(text)?.[1];
  return seconds === undefined ? 60_000 : Number(seconds) * 1000 + 1000;
}

async function callOnce(): Promise<{
  data?: unknown;
  latencyMs: number;
  usage: RunRecord['usage'];
  rateLimited: boolean;
  error?: string;
}> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await client.generateStructured({
        system,
        prompt,
        schema: ItineraryOutput,
        schemaName: 'itinerary',
      });
      return {
        data: result.data,
        latencyMs: result.latencyMs,
        usage: result.usage,
        rateLimited: attempt > 0,
      };
    } catch (error) {
      const retryable = error instanceof IntegrationError && error.retryable;
      if (retryable && attempt === 0) {
        const wait = retryDelayMs(error);
        console.log(`  429: waiting ${Math.round(wait / 1000)}s before one retry`);
        await sleep(wait);
        continue;
      }
      return {
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
        rateLimited: retryable,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return {
    latencyMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    rateLimited: false,
    error: 'unreachable',
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)]!;
}

const runs: RunRecord[] = [];
for (let run = 1; run <= runCount; run++) {
  const result = await callOnce();
  let validation: RunRecord['validation'] = null;
  if (result.data !== undefined) {
    validation = validateItinerary(ItineraryOutput.parse(result.data), facts);
  }
  const record: RunRecord = {
    run,
    model,
    latencyMs: result.latencyMs,
    usage: result.usage,
    validation,
    rateLimited: result.rateLimited,
    error: result.error,
    output: result.data,
  };
  runs.push(record);
  writeFileSync(
    resolve(
      outDir,
      `run${args.tag === '' ? '' : `-${args.tag}`}-${String(run).padStart(2, '0')}.json`,
    ),
    JSON.stringify(record, null, 2),
  );
  console.log(
    `run ${String(run).padStart(2, '0')}: ${result.error ? `ERROR ${result.error.slice(0, 80)}` : `ok=${validation?.ok} verified=${validation?.verifiedRatio.toFixed(2)} ${result.latencyMs}ms`}`,
  );
  if (run < runCount) await sleep(gapMs);
}

// Injection: put a made-up price into the first valid run and re-validate.
let injectedCaught = false;
const firstOk = runs.find((record) => record.validation?.ok === true);
if (firstOk) {
  const mutated = structuredClone(firstOk.output) as {
    days: { items: { kind: string; note: string }[] }[];
  };
  const activity = mutated.days
    .flatMap((day) => day.items)
    .find((item) => item.kind === 'activity');
  if (activity) {
    activity.note = `${activity.note} Entry ₹9,999.`;
    const revalidated = validateItinerary(ItineraryOutput.parse(mutated), facts);
    injectedCaught = revalidated.items.some(
      (item) => !item.verified && item.reasons.join().includes('9,999'),
    );
    writeFileSync(
      resolve(outDir, `injected${args.tag === '' ? '' : `-${args.tag}`}.json`),
      JSON.stringify({ run: firstOk.run, validation: revalidated, output: mutated }, null, 2),
    );
  }
}

const latencies = runs
  .map((record) => record.latencyMs)
  .filter((ms) => ms > 0)
  .sort((a, b) => a - b);
const errorCodes = new Map<string, number>();
const unverifiedReasons = new Map<string, number>();
for (const record of runs) {
  for (const error of record.validation?.errors ?? []) {
    errorCodes.set(error.code, (errorCodes.get(error.code) ?? 0) + 1);
  }
  for (const item of record.validation?.items ?? []) {
    for (const reason of item.verified ? [] : item.reasons) {
      unverifiedReasons.set(reason, (unverifiedReasons.get(reason) ?? 0) + 1);
    }
  }
}
const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

const summary = {
  model,
  runs: runs.length,
  ok: runs.filter((record) => record.validation?.ok).length,
  fullyVerified: runs.filter((record) => record.validation?.verifiedRatio === 1).length,
  errors: Object.fromEntries(errorCodes),
  unverifiedReasons: Object.fromEntries(unverifiedReasons),
  medianLatencyMs: percentile(latencies, 50),
  p95LatencyMs: percentile(latencies, 95),
  meanInputTokens: Math.round(mean(runs.map((record) => record.usage.inputTokens))),
  meanOutputTokens: Math.round(mean(runs.map((record) => record.usage.outputTokens))),
  meanThinkingTokens: Math.round(mean(runs.map((record) => record.usage.thinkingTokens ?? 0))),
  rateLimited: runs.filter((record) => record.rateLimited).length,
  failedCalls: runs.filter((record) => record.error !== undefined).length,
  injectedPriceCaught: injectedCaught,
};
writeFileSync(
  resolve(outDir, `summary${args.tag === '' ? '' : `-${args.tag}`}.json`),
  JSON.stringify(summary, null, 2),
);
console.log('\nsummary:', JSON.stringify(summary, null, 2));
