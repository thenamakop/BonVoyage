# Known limitations

Open gaps the team accepts for the 10 November 2026 submission, each with its source. Updated 8 November 2026 (#163).

## What the evaluation harness does not show

- Date clashes (F3) are not sampled: every generated group shares a common November–February window long enough for the trip.
- Scores are synthetic preference matches, not reported satisfaction.
- R17's adjustment changes the cumulative spread for only 7.12% of groups at λ = 1 (20 of 281 groups lower, 1 higher, the rest within 1e-9): the fairness mechanism works but rarely changes an outcome in this evaluation.

Source: `docs/evaluation/results-2026-11-03.md` and `docs/evaluation/README.md`.

## Catalogue rows still draft

`pnpm catalogue:check` on 3 November 2026: stage A 50/50, B1 137/137, B2 102/104 and C 214/276 verified, so 64 rows remain draft (2 fares, 62 places) and show in the app as "Not verified". Four Rajasthan places carry a best-estimate fee per the estimate rule in `docs/sprints/catalogue-s4-c-batch2-2026-11-03.md`; they stay draft until an operator's own page or two agreeing pages can be found.

## In-app reminders only, and no user study

Reminders are in-app only (M4): there is no email or push. There is also no user study: the synopsis's subjective axis (perceived satisfaction and fairness from participating student groups) stays out of the 10 November scope. Source: `docs/RUNBOOK.md` Appendix B out-of-scope line, decision E3.

## Live model wording: a cold first call can still fall back to templates (#165)

S4-7 (#122) ran on preview on 3 November 2026 with `LIVE_APIS=on`. The first call to the model took about 20.1 s, over the app's then 20 s wording timeout, so a fresh plan fell back to the catalogue templates; the repeat came from the cache, model-worded, in 121 ms. Two phrases the validator accepted overstate (a visit note naming the next item's place, and "historic" added to a reason); neither is a number, time, price or new place.

#165 raised the wording timeout to `WORDING_TIMEOUT_MS` = 25 s (the plan's own 30 s budget; the function allows 60 s), set `thinkingLevel: 'minimal'`, banned duration claims and unsupported adjectives in the prompt, and made the validator reject a note naming another item's place. Measured on 8 November 2026, all three configs returned in about 2 s and validated (`pnpm spike:wording --live`; the table is in `packages/integrations/README.md`). What remains: an unusually slow cold call beyond 25 s still falls back to the templates by design, and the prompt ban on unsupported adjectives is a mitigation, not a proof — the validator's hard guarantees stay on numbers, times, places and now other items' place names. Source: `docs/sprints/s4-7-preview-check-2026-11-03.md`; issue #165.
