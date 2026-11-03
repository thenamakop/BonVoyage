import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PreferenceInput } from '@bonvoyage/shared';
import { readCatalogue } from './catalogue';
import { generateScenario, mulberry32 } from './generator';
import { aggregate, distribution, quantile } from './metrics';
import { csvReport, markdownReport } from './report';
import {
  independentConstraints,
  budgetNoSuggestionReason,
  leastServedRepeats,
  runEvaluation,
  type EvaluationRun,
  type ScenarioResult,
} from './runner';
import { scenarioFacts } from './catalogue';

const today = '2026-11-03';
const seed = 20261029;
const data = readCatalogue(today);

describe('offline evaluation generator', () => {
  it('reproduces each (seed,index) independently of the run length', () => {
    const a = mulberry32(seed);
    const b = mulberry32(seed);
    expect(Array.from({ length: 100 }, () => a())).toEqual(Array.from({ length: 100 }, () => b()));
    expect(generateScenario(data.catalogue, seed, 18)).toEqual(
      generateScenario(data.catalogue, seed, 18),
    );
    expect(generateScenario(data.catalogue, seed, 18)).not.toEqual(
      generateScenario(data.catalogue, seed + 1, 18),
    );
    expect(generateScenario(data.catalogue, seed, 18)).not.toEqual(
      generateScenario(data.catalogue, seed, 19),
    );
  });
  it('generates valid API preferences within the agreed sampling ranges', () => {
    const groups = Array.from({ length: 500 }, (_, i) => generateScenario(data.catalogue, seed, i));
    const types = new Set(data.catalogue.destinations.flatMap((d) => d.types));
    const activities = new Set(data.catalogue.destinations.flatMap((d) => d.activities));
    for (const group of groups) {
      expect(group.members.length).toBeGreaterThanOrEqual(2);
      expect(group.members.length).toBeLessThanOrEqual(8);
      expect(['delhi', 'gurugram']).toContain(group.origin);
      expect(group.durationNights).toBeGreaterThanOrEqual(1);
      expect(group.durationNights).toBeLessThanOrEqual(3);
      expect(group.radiusKm).toBeGreaterThanOrEqual(150);
      expect(group.radiusKm).toBeLessThanOrEqual(400);
      for (const preference of group.preferences) {
        expect(PreferenceInput.safeParse(preference).success).toBe(true);
        expect(preference.destinationTypes.length).toBeGreaterThanOrEqual(1);
        expect(preference.destinationTypes.length).toBeLessThanOrEqual(3);
        expect(preference.activities.length).toBeGreaterThanOrEqual(1);
        expect(preference.activities.length).toBeLessThanOrEqual(4);
        expect(preference.destinationTypes.every((t) => types.has(t))).toBe(true);
        expect(preference.activities.every((a) => activities.has(a))).toBe(true);
        expect(preference.dateStart >= '2026-11-01' && preference.dateEnd <= '2027-02-28').toBe(
          true,
        );
      }
    }
    expect(groups.filter((s) => s.tight).length).toBeGreaterThan(125);
    expect(groups.filter((s) => s.tight).length).toBeLessThan(210);
  });
});

function handmade(): EvaluationRun {
  const results: ScenarioResult[] = [0, 1, 2].map((index) => {
    const top = {
      destinationId: `d${index}`,
      slug: `d${index}`,
      gfs: 0,
      mean: [0.2, 0.4, 0.6][index] ?? 0,
      min: index === 1 ? 0 : 0.1,
      sd: 0.2,
      max: 0.8,
      memberScores: [{ memberId: 'm1', score: index === 1 ? 0 : 0.1 }],
    };
    return {
      scenario: generateScenario(data.catalogue, seed, index),
      feasibleCount: index === 0 ? 0 : 3,
      binding: index === 0 ? 'F5' : null,
      budgetNoSuggestionReason: null,
      checks: {
        constraints: { passed: index, total: index },
        packages: { passed: 1, total: 1 },
        affordability: { passed: 1, total: 1 },
        plans: { passed: 1, total: 1 },
        budgetRerun: { passed: index === 0 ? 1 : 0, total: index === 0 ? 1 : 0 },
      },
      choices:
        index === 0
          ? {}
          : {
              gfs: top,
              average: { ...top, destinationId: index === 1 ? 'different' : top.destinationId },
              'least-misery': top,
            },
      fairness:
        index === 0
          ? []
          : [
              { lambda: 0, spread: index, repeatLeast: index === 2, repeatUniqueLeast: false },
              { lambda: 1, spread: index / 2, repeatLeast: false, repeatUniqueLeast: false },
            ],
      defects: [],
    };
  });
  return { seed, results, weights: { alpha: 0.5, beta: 0.3, gamma: 0.2 }, lambda: 1 };
}

describe('evaluation metrics and reports', () => {
  it('computes metric A–D summaries on three hand-made scenarios', () => {
    const metrics = aggregate(handmade());
    expect(metrics.checks).toEqual({
      constraints: { passed: 3, total: 3 },
      packages: { passed: 3, total: 3 },
      affordability: { passed: 3, total: 3 },
      plans: { passed: 3, total: 3 },
      budgetRerun: { passed: 1, total: 1 },
    });
    expect(metrics.fits[0]).toMatchObject({
      count: 2,
      mean: { median: 0.5 },
      min: { median: 0.05, q1: 0.025 },
      zeros: 1,
      differs: 0,
    });
    expect(metrics.fits[0]?.mean.q1).toBeCloseTo(0.45, 12);
    expect(metrics.fits[0]?.mean.q3).toBeCloseTo(0.55, 12);
    expect(metrics.fits[0]?.min.q3).toBeCloseTo(0.075, 12);
    expect(metrics.fits[1]?.differs).toBe(1);
    expect(metrics.fairness).toEqual([
      {
        lambda: 0,
        count: 2,
        spread: { median: 1.5, q1: 1.25, q3: 1.75 },
        repeats: 1,
        strictRepeats: 0,
      },
      {
        lambda: 1,
        count: 2,
        spread: { median: 0.75, q1: 0.625, q3: 0.875 },
        repeats: 0,
        strictRepeats: 0,
      },
    ]);
    expect(metrics.counts).toEqual([
      [0, 1],
      [3, 2],
    ]);
    expect(metrics.bindings).toEqual([['F5', 1]]);
    expect(metrics.diagnostics).toBe(1);
  });
  it('handles empty denominators and interpolated quartiles explicitly', () => {
    expect(distribution([])).toEqual({ median: null, q1: null, q3: null });
    expect(quantile([4, 1, 3, 2], 0.25)).toBe(1.75);
    expect(quantile([7], 0.5)).toBe(7);
    const empty: EvaluationRun = { ...handmade(), results: [] };
    expect(
      markdownReport(empty, { date: today, commit: 'abc', command: 'pnpm eval', milliseconds: 1 }),
    ).toContain('N/A (0/0)');
  });
  it('detects independent constraint violations rather than trusting engine verdicts', () => {
    const scenario = generateScenario(data.catalogue, seed, 0);
    const candidate = scenarioFacts(data, scenario)[0];
    if (!candidate) throw new Error('Missing catalogue candidate.');
    expect(independentConstraints({ ...candidate.facts, distanceKm: 9999 }, scenario)).toBe(false);
    expect(independentConstraints(candidate.facts, { ...scenario, budgetTotalInr: 1 })).toBe(false);
  });
  it('writes byte-identical CSVs and preserves defect reproduction coordinates', () => {
    expect(csvReport(runEvaluation(20, seed, today))).toBe(
      csvReport(runEvaluation(20, seed, today)),
    );
    const run = handmade();
    const first = run.results[0];
    if (!first) throw new Error('Missing fixture.');
    first.defects.push('plans: fixture failure');
    const markdown = markdownReport(run, {
      date: today,
      commit: 'abc123',
      command: 'pnpm eval --scenarios 3',
      milliseconds: 5,
    });
    expect(markdown).toContain('Seed 20261029, index 0: plans: fixture failure');
    expect(markdown).toContain('abc123');
    expect(csvReport(run).trim().split('\n')).toHaveLength(10);
  });
});

describe('follow-up fairness and recovery measures', () => {
  it('pairs changes by group and applies the 1e-9 equality tolerance', () => {
    const run = handmade();
    for (const [i, r] of run.results.entries()) {
      r.fairness = [
        { lambda: 0, spread: 0, repeatLeast: false, repeatUniqueLeast: false },
        {
          lambda: 1,
          spread: [-0.1, 5e-10, 0.2][i] ?? 0,
          repeatLeast: false,
          repeatUniqueLeast: false,
        },
      ];
    }
    expect(aggregate(run).pairedFairness).toEqual([
      { lambda: 1, count: 3, lower: 1, equal: 1, higher: 1, medianChange: 5e-10 },
    ]);
    run.results[0]?.fairness.pop();
    expect(aggregate(run).pairedFairness[0]?.count).toBe(2);
  });
  it('includes both exact equality-tolerance boundaries', () => {
    const run = handmade();
    run.results.forEach((r, i) => {
      r.fairness = [
        { lambda: 0, spread: 0, repeatLeast: false, repeatUniqueLeast: false },
        {
          lambda: 1,
          spread: [-1e-9, 1e-9, 0][i] ?? 0,
          repeatLeast: false,
          repeatUniqueLeast: false,
        },
      ];
    });
    expect(aggregate(run).pairedFairness[0]).toMatchObject({ lower: 0, equal: 3, higher: 0 });
  });
  it('distinguishes repeated tied minima from the same repeated unique minimum', () => {
    expect(
      leastServedRepeats([
        { a: 0, b: 0, c: 1 },
        { a: 0, b: 0, c: 1 },
      ]),
    ).toEqual({ repeatLeast: true, repeatUniqueLeast: false });
    expect(
      leastServedRepeats([
        { a: 0, b: 1, c: 1 },
        { a: 0, b: 0.5, c: 1 },
      ]),
    ).toEqual({ repeatLeast: true, repeatUniqueLeast: true });
    expect(
      leastServedRepeats([
        { a: 0, b: 1 },
        { a: 1, b: 0 },
      ]),
    ).toEqual({ repeatLeast: false, repeatUniqueLeast: false });
    expect(
      leastServedRepeats([
        { a: 0, b: 1e-12 },
        { a: 0, b: 5e-13 },
      ]),
    ).toEqual({ repeatLeast: true, repeatUniqueLeast: false });
    expect(
      leastServedRepeats([
        { a: 0, b: 2e-12 },
        { a: 0, b: 2e-12 },
      ]),
    ).toEqual({ repeatLeast: true, repeatUniqueLeast: true });
    expect(leastServedRepeats([])).toEqual({ repeatLeast: false, repeatUniqueLeast: false });
  });
  it('derives dropped-budget reasons from diagnostic misses and both cap sources', () => {
    const ctx = {
      n: 3,
      durationNights: 2,
      radiusKm: 400,
      groupCapInr: 10000,
      capSource: 'trip' as const,
      perPersonCapInr: 5000,
      tripBudgetInr: 10000,
      commonWindow: { start: '2026-11-01', end: '2026-11-03' },
    };
    const miss = (actual: number) => ({
      destinationId: String(actual),
      slug: String(actual),
      feasible: false,
      estimatedGroupCostInr: actual,
      cheapest: { inr: 500, mode: 'bus' as const },
      failures: [
        {
          id: 'F5' as const,
          actual,
          limit: 10000,
          relaxation: actual - 10000,
          relative: 1,
          unit: 'inr' as const,
        },
      ],
    });
    const diagnostic = {
      feasibleCount: 0,
      feasible: [],
      nearMisses: [miss(11000), miss(12000)],
      alternatives: [],
      bindingConstraint: 'F5' as const,
      suggestions: [],
      incomplete: [],
    };
    expect(budgetNoSuggestionReason(diagnostic, ctx)).toBe('too-few-budget-misses');
    const enough = { ...diagnostic, nearMisses: [...diagnostic.nearMisses, miss(15001)] };
    expect(budgetNoSuggestionReason(enough, ctx)).toBe('other-cap');
    expect(
      budgetNoSuggestionReason(
        { ...enough, nearMisses: [miss(11000), miss(12000), miss(15000)] },
        ctx,
      ),
    ).toBe('other');
    expect(
      budgetNoSuggestionReason(enough, { ...ctx, capSource: 'members', tripBudgetInr: 15000 }),
    ).toBe('other-cap');
    expect(
      budgetNoSuggestionReason(enough, { ...ctx, capSource: 'members', tripBudgetInr: 15500 }),
    ).toBe('other');
    expect(budgetNoSuggestionReason({ ...enough, feasibleCount: 2 }, ctx)).toBe('other');
    expect(
      budgetNoSuggestionReason(
        {
          ...diagnostic,
          suggestions: [
            { constraint: 'F5', newGroupCapInr: 15000, capSource: 'trip', unlocks: [] },
          ],
        },
        ctx,
      ),
    ).toBeNull();
    expect(budgetNoSuggestionReason({ ...diagnostic, bindingConstraint: 'F1' }, ctx)).toBeNull();
  });
  it('aggregates all three no-suggestion reasons without counting actionable diagnostics', () => {
    const run = handmade();
    run.results.forEach((r, i) => {
      r.budgetNoSuggestionReason =
        (['too-few-budget-misses', 'other-cap', 'other'] as const)[i] ?? null;
    });
    expect(aggregate(run).recoveryReasons).toEqual([
      { reason: 'too-few-budget-misses', count: 1 },
      { reason: 'other-cap', count: 1 },
      { reason: 'other', count: 1 },
    ]);
  });
});

it('pnpm eval --scenarios 20 runs offline in under 20 seconds with metric A at 100%', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bonvoyage-eval-'));
  const started = performance.now();
  try {
    const output = execSync(`pnpm eval --scenarios 20 --output-dir "${directory}"`, {
      encoding: 'utf8',
      timeout: 19000,
      env: {
        ...process.env,
        BONVOYAGE_SKIP_DOTENV: '1',
        DATABASE_URL: 'invalid-do-not-connect',
        LIVE_APIS: 'off',
      },
    });
    expect(output).toContain('Evaluation: 20 scenarios');
    const checks = output
      .split('\n')
      .filter((s) => /^(constraints|packages|affordability|plans):/.test(s));
    expect(checks).toHaveLength(4);
    for (const line of checks) expect(line).toContain('(100.00%)');
    const file = readdirSync(directory).find((f) => f.endsWith('.md'));
    if (!file) throw new Error('Missing smoke report.');
    const report = readFileSync(join(directory, file), 'utf8');
    expect(report).toContain('None found by these checks.');
    expect(performance.now() - started).toBeLessThan(20000);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20000);
