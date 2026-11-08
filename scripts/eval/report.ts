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
    'budget_no_suggestion_reason',
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
        r.budgetNoSuggestionReason ?? '',
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
  dirty?: boolean;
}
export function markdownReport(run: EvaluationRun, meta: Metadata): string {
  const m = aggregate(run);
  const n = run.results.length;
  const defects = run.results.flatMap((r) =>
    r.defects.map((d) => `- Seed ${run.seed}, index ${r.scenario.index}: ${d}`),
  );
  return `# Offline evaluation: ${meta.date}

Issue #140; synopsis objective 8 (quantitative component only).

- Commit: \`${meta.commit}\` (source checkout${meta.dirty ? ' with uncommitted harness changes' : ''}; generated evidence is committed afterwards).
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

### Paired cumulative-spread changes against lambda 0

${table(
  [
    'Lambda vs 0',
    'Paired groups',
    'Lower spread',
    'Equal spread (within 1e-9)',
    'Higher spread',
    'Median per-group change',
  ],
  m.pairedFairness.map((r) => [
    r.lambda,
    r.count,
    percent(r.lower, r.count),
    percent(r.equal, r.count),
    percent(r.higher, r.count),
    number(r.medianChange),
  ]),
)}

**How to read this.** Each change is that same group's spread at the stated lambda minus its spread at lambda 0. Lower is a change below -1e-9, equal is within ±1e-9, and higher is above 1e-9. The median is taken over paired changes, not obtained by subtracting the two aggregate medians. Groups missing either run are excluded from that pair.

### Strict least-served measure

${table(
  ['Lambda', 'Groups', 'Same member uniquely least served in ≥2 rounds'],
  m.fairness.map((r) => [r.lambda, r.count, percent(r.strictRepeats, r.count)]),
)}

**How to read this.** A strict occurrence requires exactly one lowest-scoring member, with no other member within 1e-12 of that minimum; the same member must have such an occurrence in at least two rounds. Ties are common because many scores are 0, so the existing tie-inclusive figure is high even at lambda 0. The strict measure excludes those tied occurrences, not those groups, and is not a measure of perceived fairness.

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
      'F5 diagnostics whose suggestion reaches a shortlist on re-run',
      percent(m.checks.budgetRerun.passed, m.checks.budgetRerun.total),
    ],
    ['of which raisesBoth: the cap must move on both sides (#163)', m.f5RaisesBoth],
    [
      'F5 diagnostics without an actionable suggestion',
      m.bindings.filter(([b]) => b === 'F5').reduce((sum, [, count]) => sum + count, 0) -
        m.checks.budgetRerun.total,
    ],
  ],
)}

**How to read this.** Recovery is measured only when the engine supplies an F5 suggestion. A trip-side raise changes the trip budget only; a member-side raise changes only member maxima below the suggested maximum, leaving the trip cap unchanged. A raisesBoth suggestion (#163) is re-run with both sides raised: the trip budget to the suggested cap and every member's maximum to at least its per-person share rounded up to ₹500. All candidates are evaluated again, rather than trusting the suggestion's unlock list. No suggestion can be tested only when too few near misses prevent one; a suggestion that would cross the other cap is now offered as raisesBoth instead of dropped.

### Why F5 diagnostics have no actionable suggestion

${table(
  ['Reason', 'Scenarios', 'Share without a suggestion'],
  m.recoveryReasons.map((r) => [
    {
      'too-few-budget-misses': 'Fewer budget-only misses than needed',
      'other-cap': 'Required amount would cross the other cap',
      other: 'Other',
    }[r.reason],
    r.count,
    percent(
      r.count,
      m.recoveryReasons.reduce((sum, row) => sum + row.count, 0),
    ),
  ]),
)}

**How to read this.** Reasons are derived from the engine's full diagnostic near-miss list, failure actual amounts and feasible count, together with the existing cap context; the engine emits no explicit dropped-reason field. Too few budget-only misses takes precedence. Otherwise the needed miss's cost rounded up to ₹500 is compared with the unchanged side of the cap: n × the lowest member maximum for a trip-budget raise, or the trip budget for a member-maximum raise. "Other" catches a dropped suggestion not explained by those conditions. ${(m.recoveryReasons.find((r) => r.reason === 'other-cap')?.count ?? 0) > m.recoveryReasons.reduce((sum, r) => sum + r.count, 0) / 2 ? 'The majority of these diagnostics have no suggestion because the required amount would cross the other cap.' : 'Crossing the other cap is not the majority reason in this run.'}

## Defects

${defects.length ? defects.join('\n') : 'None found by these checks.'}

## Scope and reproducibility

The CSV contains one row per scenario and ranking method, including empty choices on diagnostics; scenario-level checks and fairness arrays repeat on those three rows and must not be summed three times. Seed and zero-based index reproduce a scenario independently of run length. CSVs exclude timestamps and elapsed times and are byte-identical for the same seed, count, catalogue and scoring configuration. Catalogue CSVs include draft rows; this run does not verify them, live availability, prices, model wording, perceived satisfaction or a user study. See README.md for the full method and re-run instructions.
`;
}
