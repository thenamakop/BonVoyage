import { SHORTLIST_SIZE } from '@bonvoyage/engine';
import { METHODS, type Check, type EvaluationRun, type Method } from './runner';

export function quantile(values: readonly number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const low = sorted[Math.floor(position)];
  const high = sorted[Math.ceil(position)];
  if (low === undefined || high === undefined) throw new RangeError('Invalid quantile.');
  return low + (high - low) * (position % 1);
}

export function distribution(values: number[]) {
  return { median: quantile(values, 0.5), q1: quantile(values, 0.25), q3: quantile(values, 0.75) };
}

export function aggregate(run: EvaluationRun) {
  const checks = Object.fromEntries(
    (['constraints', 'packages', 'affordability', 'plans', 'budgetRerun'] as const).map((key) => [
      key,
      run.results.reduce<Check>(
        (sum, r) => ({
          passed: sum.passed + r.checks[key].passed,
          total: sum.total + r.checks[key].total,
        }),
        { passed: 0, total: 0 },
      ),
    ]),
  ) as Record<keyof EvaluationRun['results'][number]['checks'], Check>;
  const fits = METHODS.map((method: Method) => {
    const choices = run.results.flatMap((r) => (r.choices[method] ? [r.choices[method]] : []));
    return {
      method,
      count: choices.length,
      mean: distribution(choices.map((c) => c.mean)),
      min: distribution(choices.map((c) => c.min)),
      sd: distribution(choices.map((c) => c.sd)),
      zeros: choices.filter((c) => c.memberScores.some((m) => m.score === 0)).length,
      differs: run.results.filter(
        (r) =>
          r.choices[method] && r.choices[method]?.destinationId !== r.choices.gfs?.destinationId,
      ).length,
    };
  });
  const lambdas = [...new Set(run.results.flatMap((r) => r.fairness.map((f) => f.lambda)))].sort(
    (a, b) => a - b,
  );
  const fairness = lambdas.map((lambda) => {
    const rows = run.results.flatMap((r) => r.fairness.filter((f) => f.lambda === lambda));
    return {
      lambda,
      count: rows.length,
      spread: distribution(rows.map((r) => r.spread)),
      repeats: rows.filter((r) => r.repeatLeast).length,
      strictRepeats: rows.filter((r) => r.repeatUniqueLeast).length,
    };
  });
  const pairedFairness = lambdas
    .filter((lambda) => lambda !== 0)
    .map((lambda) => {
      const changes = run.results.flatMap((r) => {
        const baseline = r.fairness.find((f) => f.lambda === 0);
        const comparison = r.fairness.find((f) => f.lambda === lambda);
        return baseline && comparison ? [comparison.spread - baseline.spread] : [];
      });
      return {
        lambda,
        count: changes.length,
        lower: changes.filter((change) => change < -1e-9).length,
        equal: changes.filter((change) => Math.abs(change) <= 1e-9).length,
        higher: changes.filter((change) => change > 1e-9).length,
        medianChange: quantile(changes, 0.5),
      };
    });
  const recoveryReasons = (['too-few-budget-misses', 'other-cap', 'other'] as const).map(
    (reason) => ({
      reason,
      count: run.results.filter((r) => r.budgetNoSuggestionReason === reason).length,
    }),
  );
  const counts = new Map<number, number>();
  const bindings = new Map<string, number>();
  for (const r of run.results) {
    counts.set(r.feasibleCount, (counts.get(r.feasibleCount) ?? 0) + 1);
    if (r.feasibleCount < SHORTLIST_SIZE)
      bindings.set(r.binding ?? 'none', (bindings.get(r.binding ?? 'none') ?? 0) + 1);
  }
  return {
    checks,
    fits,
    fairness,
    pairedFairness,
    recoveryReasons,
    counts: [...counts].sort(([a], [b]) => a - b),
    bindings: [...bindings].sort(([a], [b]) => a.localeCompare(b)),
    diagnostics: run.results.filter((r) => r.feasibleCount < SHORTLIST_SIZE).length,
  };
}
