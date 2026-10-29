# S5-5: Evaluation harness

The synopsis's objective 8 and its expected results promise "quantitative results on hard-constraint satisfaction across the synthetic evaluation scenarios" and a comparison of the group-fit score against pure average and pure least-misery baselines. Nothing produces those numbers yet. This prompt adds `pnpm eval`, a deterministic offline harness over the real catalogue, and commits its first results for the report. The questionnaire on perceived satisfaction stays out (there is no user study).

**Branch:** `feat/<issue>-evaluation-harness` · **Time box:** 4 hours · **Depends on:** S5-2 merged (to measure R17) · **Issue:** the harness issue from S5-1 · **Migration:** none · **Never cut**

```text
S5-5  EVALUATION HARNESS (pnpm eval)
Branch: feat/<issue>-evaluation-harness (from fresh master, after S5-2 merged)   Time box: 4 hours
Issue: the "Evaluation harness" issue. Follow the Sprint 5 conventions (Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/sprints/sprint-5-plan.md (finding 1e, the harness design, decision E5: it overrides
anything below), docs/baseline/BonVoyage_Project_Synopsis.md (objective 8, the scoring section and
the expected results), docs/specs/scoring.md (all, including S5-2's section 8),
packages/engine/src (feasibility, scoring including fairness.ts, packages/generate.ts and cost.ts,
itinerary/plan.ts and validate.ts), packages/db/catalogue/* and the loader the engine tests use
for the real catalogue (rg -n "destinations.csv" packages apps scripts), scripts/perf/
recommend-timing.ts (a script in this repo's style), and the root package.json scripts.

GOAL
pnpm eval [--scenarios N] [--seed S] runs with no database, no network and no model, finishes the
default run in under 2 minutes on Maulik's laptop, and writes docs/evaluation/results-<date>.md
and results-<date>.csv that the report can quote directly.

DESIGN (the recommended E5; the plan's version wins if it differs)
- Scenarios: seeded PRNG (a small local implementation such as mulberry32; no new dependency).
  Default 500 groups. Size uniform 2 to 8; origin gurugram or delhi; nights 1 to 3; radius 150 to
  400 km; a common date window in November to February; each member's types, activities and
  climate drawn from the catalogue's own vocabularies (1 to 3 types, 1 to 4 activities), travel
  style, and a budget band drawn so roughly a third of groups are tight. Every scenario is
  reproducible from (seed, index).
- Pipeline per scenario: feasibility (F1 to F5) over the real catalogue; rank by GFS and by the
  two baselines; for the GFS top choice, generatePackages and planDays, then validateItinerary.
- Metrics:
  A. Hard constraints: share of shortlisted destinations that satisfy F1 to F5 when re-checked
     independently, share of generated packages within the group cap where the engine says so,
     share of plans passing validateItinerary. Expected 100 %; any miss is listed with its
     (seed, index) as a defect.
  B. Group fit, for GFS (0.5, 0.3, 0.2), average-only (1, 0, 0) and least-misery-only (0, 1, 0):
     the top choice's mean member score, minimum member score and standard deviation (median and
     interquartile range over scenarios), and the share of groups where some member scores 0 on
     the top choice. Also how often each baseline picks a different top destination from GFS.
  C. Fairness across rounds: for groups of 3 or more, simulate 3 rounds (after each round the
     group "takes" the top choice, then asks again with that destination removed), with lambda 0
     and with the configured lambda. Report the spread (max minus min) of members' cumulative
     scores and the share of groups where the same member is least served in 2 or more rounds.
  D. Feasibility: distribution of feasibleCount and the share of scenarios ending in a diagnostic,
     by binding constraint.
- Output: the markdown file states the commit hash, seed, scenario count, run date and the exact
  command; one table per metric group; a short "How to read this" paragraph per table with no
  claims beyond the numbers. The CSV has one row per scenario and ranking method.

STEPS
1. scripts/eval/ (generator, runner, metrics, report writer) using only engine exports and the
   catalogue files. Root script "eval": "tsx scripts/eval/run.ts".
2. Unit tests: the generator is deterministic (same seed, same scenarios), every generated member
   passes the preference schema the API uses, metrics functions on a hand-made 3-scenario set.
3. A CI smoke test: pnpm eval --scenarios 20 runs inside the unit project in under 20 seconds and
   asserts metric A is 100 %.
4. Run the full default once; commit docs/evaluation/results-2026-11-0X.md and the CSV. If metric
   A finds any miss, do not fix the engine in this PR: open an issue per defect with the (seed,
   index) and list them in the report.
5. docs/evaluation/README.md: what the harness measures, what it does not (perceived satisfaction,
   live prices, model wording), and how to re-run it.
6. PR "feat: evaluation harness and first results", body "Closes #<issue>".

VERIFICATION
Paste: the full run's console summary (time taken, scenario count) and every table from the
results file; pnpm vitest run --project unit scripts/eval; pnpm format:check; pnpm lint;
pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
An engine export the pipeline needs is not public, or needs the database: stop, name it, and
propose the smallest export change (a separate commit with its own test).
```
