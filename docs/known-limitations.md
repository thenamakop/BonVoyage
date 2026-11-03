# Known limitations

Open gaps the team accepts for the 10 November 2026 submission, each with its source. Updated 3 November 2026 (S5-6, #141).

## One-tap budget fix unavailable when both caps bind (#163)

When the group cap is `min(trip budget, n × lowest member maximum)`, raising only the side the engine suggests cannot always reach a shortlist. In the offline evaluation, 116 of the 119 F5 diagnostics without a one-tap suggestion were dropped for this reason. The other 3 had too few budget-only misses. The synthetic member maxima sit close to the trip target, so the rate is likely overstated. Source: `docs/evaluation/results-2026-11-03.md`, "Why F5 diagnostics have no actionable suggestion"; issue #163.

## Catalogue import while a package is being drafted (#159)

A catalogue import can change facts under a package being drafted. Imports are run by hand, so the risk is low; revisit after submission. Source: issue #159, raised by Sourcery on #158.

## What the evaluation harness does not show

- Date clashes (F3) are not sampled: every generated group shares a common November–February window long enough for the trip.
- Scores are synthetic preference matches, not reported satisfaction.
- R17's adjustment changes the cumulative spread for only 7.12% of groups at λ = 1 (20 of 281 groups lower, 1 higher, the rest within 1e-9): the fairness mechanism works but rarely changes an outcome in this evaluation.

Source: `docs/evaluation/results-2026-11-03.md` and `docs/evaluation/README.md`.

## Catalogue rows still draft

`pnpm catalogue:check` on 3 November 2026: stage A 50/50, B1 137/137, B2 102/104 and C 214/276 verified, so 64 rows remain draft (2 fares, 62 places) and show in the app as "Not verified". Four Rajasthan places carry a best-estimate fee per the estimate rule in `docs/sprints/catalogue-s4-c-batch2-2026-11-03.md`; they stay draft until an operator's own page or two agreeing pages can be found.

## In-app reminders only, and no user study

Reminders are in-app only (M4): there is no email or push. There is also no user study: the synopsis's subjective axis (perceived satisfaction and fairness from participating student groups) stays out of the 10 November scope. Source: `docs/RUNBOOK.md` Appendix B out-of-scope line, decision E3.

## Live model wording not yet checked on a deployment

S4-7's `LIVE_APIS=on` preview check (model wording on a deployment, #122) has not run; itinerary wording is verified only with the fixture client. Source: issue #122.
