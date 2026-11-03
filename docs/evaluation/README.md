# Offline evaluation harness

`pnpm eval` measures the quantitative part of synopsis objective 8, under Sprint 5 decision E5 and issue #140. It reads the checked-in catalogue and scoring configuration, not a database, `.env`, network provider or language model.

## Run

Use Node 24 and the workspace's pinned pnpm version:

```sh
pnpm eval
pnpm eval --scenarios 20 --seed 20261029
```

Defaults are 500 scenarios and seed 20261029. The runner writes `docs/evaluation/results-<UTC-date>.md` and `.csv`. An optional `--output-dir <directory>` keeps smoke or exploratory results elsewhere. Runs on the same date and directory replace that date's files, so choose another directory to preserve a previous run. The process exits nonzero after writing the evidence if it finds a defect in metric A or the budget-recovery check.

To run the unit tests without loading the repository's `.env`, set the test-runner opt-out before launching Vitest. It must be in the shell, not inside `.env`:

```powershell
$env:BONVOYAGE_SKIP_DOTENV = '1'
pnpm vitest run --project unit scripts/eval
```

This opt-out affects Vitest's existing environment loader only. The harness never loads environment files, regardless of this setting. Integration/full-suite verification still needs the local throwaway test database; `pnpm eval` and its unit smoke test do not.

## Sampling and reproducibility

- A local mulberry32 generator derives each scenario independently from `(seed, zero-based index)`. Increasing the scenario count does not change earlier scenarios.
- Group size is uniform over 2–8, origin over Delhi/Gurugram, nights over 1–3, and radius over integer kilometres 150–400.
- The common start is uniform from 1 November 2026 through 25 February 2027; every member has that same window, ending after the requested nights. These dates are fixed, not relative to the run date, so this evaluation does not exercise F3 failures.
- Distinct types (1–3), activities (1–4), and climates are drawn from the catalogue's vocabularies. Travel style uses the API's allowed values. Every preference is parsed with the API's `PreferenceInput` schema. Past-trip history is empty; travel style is generated but does not alter production scoring.
- Each group has a one-third chance of the tight-budget stratum: target per-person amount uniform ₹1,500–₹3,500, otherwise ₹6,000–₹14,000. Member maxima are uniform from that target to twice it; minima are uniform from zero to half each maximum. Trip budget is the target times group size, multiplied by either one or two with equal probability. This exercises both trip- and member-set caps. A tight draw does not necessarily produce a budget diagnostic.
- All complete catalogue destinations participate, including draft facts. Distances use `offlineRoadKm`: the car fare row through `curatedRoadKm`, otherwise haversine × 1.3. Draft distances remain estimated. No duration, fare or attraction is invented to fill missing catalogue rows.
- Recommendation row mapping and package-input mapping are shared with the API through public engine exports. Only the catalogue's snake-case-to-camel-case field adaptation is local to the harness. The runner reads `apps/api/config/scoring.json`; the baselines use `(1,0,0)` and `(0,1,0)`.
- The CSV is byte-identical for the same seed, count, catalogue and scoring configuration. Runtime and run date belong in Markdown, not CSV. Its rows contain the seed and index, method, scenario limits, top choice and scores, checks, fairness arrays and defects. Per-scenario fields repeat for all three methods: do not sum them three times.

## Measures

### A. Hard constraints and downstream consistency

For every destination on a returned shortlist, a separate arithmetic check implements F1–F5 from scoring.md section 2. It does not call `evaluateCandidate`, `composeEstimate`, `groupProfile` or the season/window helpers. F4 means at least one month touched is in season, as in production, rather than requiring every night to be in season (the stronger seeded-demo rule).

For the GFS top choice, all generated packages are checked for summed lines, per-person rounding, over-budget flags and excess. Separately, packages the engine declares affordable must be within the group cap. Over-budget alternatives are allowed and are not counted as affordable. Every package is passed through `planDays`, a catalogue fact sheet and `validateItinerary`. Draft facts are not promoted to verified facts by a successful structural validation.

### B. Group fit

Only scenarios with at least three feasible destinations enter all three ranking methods. The report gives median and quartiles of mean, minimum and population standard deviation on each method's top choice; the zero-member-score share; and the top-choice disagreement rate against GFS. Tie breaks are production's mean then slug ordering. Quartiles use linear interpolation at `(n−1)p`.

### C. Fairness

Groups of at least three members with at least three initially feasible destinations take three distinct top choices, removing each before the next ranking. The remaining pool can fall below three; the simulation ranks it anyway to complete three distinct selections, rather than claiming these are three full app shortlists. Constraints and preferences do not change. The public production deficit/weight functions use earlier top-choice scores. The sweep is λ=0, 0.5, 1, 2, plus the configured λ if different. The report gives cumulative score spread and the proportion with a member least served in at least two rounds. Every tied minimum counts (tolerance 1e-12). Alongside it, the strict measure counts a repeated unique minimum only when no other member is within 1e-12; ties are common because many scores are 0, making the tie-inclusive rate high even at λ=0. Paired comparisons against λ=0 classify each group's spread change as lower, equal within 1e-9, or higher, and take the median of those individual changes rather than subtracting aggregate medians. All lambdas use the same cohort.

### D. Feasibility and recovery

The report lists the full feasible-count distribution, diagnostic shares by binding constraint and one-tap budget recovery. Only F5 diagnostics with an actionable suggestion enter recovery's denominator; those without one are reported separately. A recovery changes the specified side of the cap and evaluates all candidates again. A zero denominator is N/A, never a claimed 100%. For F5 diagnostics without a suggestion, reasons are derived from the engine's full budget-only near-miss list and failure amounts, feasible count, and existing cap context: too few misses to complete a shortlist; the needed cost rounded up to ₹500 crosses the unchanged other cap; or other. Too few misses takes precedence. The engine itself is unchanged and emits no explicit dropped-reason field.

## What this does not measure

This is a reproducible synthetic evaluation, not a user study. It does not measure perceived satisfaction, perceived fairness, booking success, live prices or availability, real travel times, Gemini wording, factual verification of draft catalogue rows, changing group membership/preferences across rounds, or all possible origins/seasons. It does not fulfil objective 8's student-group survey component; that remains outside the approved submission scope. No statistical-significance or population-level claim follows from these tables.

## Defects and evidence

A failing check is listed with `(seed,index)` and details in the Markdown/CSV. Open one issue per distinct engine defect with reproduction coordinates; do not fix the engine to improve the evaluation numbers in the harness PR. The committed result identifies the source commit, exact command, date, seed, size and elapsed time. Re-run after catalogue or scoring changes rather than combining results from different versions.
