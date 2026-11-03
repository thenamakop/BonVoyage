import { aggregate, type distribution } from './metrics';
import { METHODS, type EvaluationRun } from './runner';

const number = (n: number | null) => (n === null ? 'N/A' : n.toFixed(4));
const percent = (n: number, total: number) =>
  total ? `${((100 * n) / total).toFixed(2)}% (${n}/${total})` : 'N/A (0/0)';
const summary = (d: ReturnType<typeof distribution>) =>
  `${number(d.median)} [${number(d.q1)}, ${number(d.q3)}]`;
const table = (headers: string[], rows: (string | number)[][]) =>
  [headers, headers.map(() => '---'), ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');

export function csvReport(run: EvaluationRun): string {
  const headers = [
    'seed',
    'index',
    'method',
    'origin',
    'members',
    'nights',
    'radius_km',
    'budget_inr',
    'tight',
    'start',
    'end',
    'feasible_count',
    'binding',
    'top_choice',
    'mean',
    'min',
    'sd',
    'zero_member',
    'different_from_gfs',
    'constraints_passed',
    'constraints_total',
    'packages_passed',
    'packages_total',
    'affordability_passed',
    'affordability_total',
    'plans_passed',
    'plans_total',
    'budget_rerun_passed',
    'budget_rerun_total',
    'fairness',
    'defects',
  ];
  const rows = run.results.flatMap((r) =>
    METHODS.map((method) => {
      const choice = r.choices[method];
      const first = r.scenario.members[0];
      return [
        r.scenario.seed,
        r.scenario.index,
        method,
        r.scenario.origin,
        r.scenario.members.length,
        r.scenario.durationNights,
        r.scenario.radiusKm,
        r.scenario.budgetTotalInr,
        r.scenario.tight,
        first?.dateStart ?? '',
        first?.dateEnd ?? '',
        r.feasibleCount,
        r.binding ?? '',
        choice?.slug ?? '',
        choice?.mean ?? '',
        choice?.min ?? '',
        choice?.sd ?? '',
        choice ? choice.memberScores.some((m) => m.score === 0) : '',
        choice ? choice.destinationId !== r.choices.gfs?.destinationId : '',
        r.checks.constraints.passed,
        r.checks.constraints.total,
        r.checks.packages.passed,
        r.checks.packages.total,
        r.checks.affordability.passed,
        r.checks.affordability.total,
        r.checks.plans.passed,
        r.checks.plans.total,
        r.checks.budgetRerun.passed,
        r.checks.budgetRerun.total,
        JSON.stringify(r.fairness),
        r.defects.join('; '),
      ];
    }),
  );
  return (
    [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
      .join('\n') + '\n'
  );
}

export interface Metadata {
  date: string;
  commit: string;
  command: string;
  milliseconds: number;
}
export function markdownReport(run: EvaluationRun, meta: Metadata): string {
  const m = aggregate(run);
  const n = run.results.length;
  const defects = run.results.flatMap((r) =>
    r.defects.map((d) => `- Seed ${run.seed}, index ${r.scenario.index}: ${d}`),
  );
  return `# Offline evaluation: ${meta.date}

Issue #140; synopsis objective 8 (quantitative component only).

- Commit: \`${meta.commit}\` (source checkout; generated evidence is committed afterwards).
- Run date (UTC): ${meta.date}
- Exact command: \`${meta.command}\`
- Seed: ${run.seed}; scenarios: ${n}; elapsed: ${(meta.milliseconds / 1000).toFixed(3)} seconds.
- GFS weights: alpha=${run.weights.alpha}, beta=${run.weights.beta}, gamma=${run.weights.gamma}; configured lambda=${run.lambda}.
- Tight-budget draws: ${percent(run.results.filter((r) => r.scenario.tight).length, n)}. This is a generator stratum, not a claim that every such draw fails F5.

## A. Hard-constraint and pipeline checks

${table(
  ['Check', 'Pass share'],
  [
    [
      'Shortlisted destinations, independent F1–F5 arithmetic',
      percent(m.checks.constraints.passed, m.checks.constraints.total),
    ],
    [
      'Package arithmetic and budget declarations',
      percent(m.checks.packages.passed, m.checks.packages.total),
    ],
    [
      'Packages declared affordable that are within the group cap',
      percent(m.checks.affordability.passed, m.checks.affordability.total),
    ],
    [
      'Catalogue plans passing validateItinerary',
      percent(m.checks.plans.passed, m.checks.plans.total),
    ],
  ],
)}

**How to read this.** Only scenarios with at least three feasible destinations enter the shortlist pipeline. Every shortlisted destination is independently checked against scoring.md section 2 (including F4's any-touched-month rule, not the stronger demo-window rule). Every package of the GFS top choice is checked: summed lines, per-person rounding, over-budget flag and excess must agree with the cap; explicitly over-budget alternatives are allowed, not misreported as affordable. Every generated package is planned and validated; no model is called. These checks test implementation consistency, not whether catalogue estimates are real-world quotes.

## B. Top-choice group fit

${table(
  [
    'Method',
    'Groups',
    'Mean median [Q1, Q3]',
    'Minimum median [Q1, Q3]',
    'SD median [Q1, Q3]',
    'Any member scores zero',
    'Top differs from GFS',
  ],
  m.fits.map((r) => [
    r.method,
    r.count,
    summary(r.mean),
    summary(r.min),
    summary(r.sd),
    percent(r.zeros, r.count),
    percent(r.differs, r.count),
  ]),
)}

**How to read this.** All methods rank the same feasible set; diagnostics are excluded equally. Scores are synthetic preference matches on a 0–1 scale, not reported satisfaction. GFS uses the checked-in configuration; average-only uses (1,0,0), least-misery uses (0,1,0), with the engine's mean-then-slug tie breaks. Quartiles use linear interpolation at (n−1)p; brackets are the interquartile interval, not a confidence interval. Differences do not establish that one method is universally better.

## C. Fairness across three rounds

${table(
  [
    'Lambda',
    'Groups',
    'Cumulative spread median [Q1, Q3]',
    'Same member least served in ≥2 rounds',
  ],
  m.fairness.map((r) => [r.lambda, r.count, summary(r.spread), percent(r.repeats, r.count)]),
)}

**How to read this.** The cohort has at least three members and at least three initially feasible destinations. Each round chooses the top, removes it, and ranks the remaining feasible set, until three distinct choices have been taken (later pools may contain fewer than three). Preferences and constraints stay fixed. Weights use earlier top-choice scores via the production fairness functions. Spread is max minus min of the three-round cumulative scores. All tied least-served members count, with a 1e-12 tolerance. Smaller spread is more equal under this simulation, not evidence of perceived fairness or a guarantee that each group improves.

## D. Feasibility and budget recovery

${table(
  ['Feasible destinations', 'Scenarios', 'Share of all scenarios'],
  m.counts.map(([count, groups]) => [count, groups, percent(groups, n)]),
)}

**How to read this.** This is the distribution over the sampled groups, not an estimate for the travelling population. All generated groups have a common November–February window long enough for the trip, so this design does not exercise F3 conflicts.

${table(
  ['Diagnostic binding constraint', 'Scenarios', 'Share of all scenarios', 'Share of diagnostics'],
  m.bindings.map(([binding, groups]) => [
    binding,
    groups,
    percent(groups, n),
    percent(groups, m.diagnostics),
  ]),
)}

**How to read this.** ${percent(m.diagnostics, n)} ended in a diagnostic (fewer than three feasible destinations). The binding constraint follows the engine's near-miss count and tie break; it is not necessarily the only constraint that failed. "none" means no single-constraint near miss selected a binding constraint.

${table(
  ['Budget diagnostic recovery', 'Result'],
  [
    [
      'F5 diagnostics with a one-tap suggestion that reach a shortlist on re-run',
      percent(m.checks.budgetRerun.passed, m.checks.budgetRerun.total),
    ],
    [
      'F5 diagnostics without an actionable suggestion',
      m.bindings.filter(([b]) => b === 'F5').reduce((sum, [, count]) => sum + count, 0) -
        m.checks.budgetRerun.total,
    ],
  ],
)}

**How to read this.** Recovery is measured only when the engine supplies an F5 suggestion. A trip-side raise changes the trip budget only; a member-side raise changes only member maxima below the suggested maximum, leaving the trip cap unchanged. All candidates are evaluated again, rather than trusting the suggestion's unlock list. No suggestion can be tested when the other cap or too few near misses prevents one.

## Defects

${defects.length ? defects.join('\n') : 'None found by these checks.'}

## Scope and reproducibility

The CSV contains one row per scenario and ranking method, including empty choices on diagnostics; scenario-level checks and fairness arrays repeat on those three rows and must not be summed three times. Seed and zero-based index reproduce a scenario independently of run length. CSVs exclude timestamps and elapsed times and are byte-identical for the same seed, count, catalogue and scoring configuration. Catalogue CSVs include draft rows; this run does not verify them, live availability, prices, model wording, perceived satisfaction or a user study. See README.md for the full method and re-run instructions.
`;
}
