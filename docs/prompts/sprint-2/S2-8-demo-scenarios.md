# S2-8: Demo scenarios, end-to-end flow and speed check

Makes Sprint 2 demonstrable on demand: three seeded trips that reliably produce a shortlist, a diagnostic and a date clash, one test that walks the whole flow from sign-up to chosen destination, a timing script for the R15 target, and a five-minute demo script for the team.

**Branch:** `feat/s2-8-demo-scenarios` · **Time box:** 1.5 hours · **Depends on:** S2-7 merged · **Issue:** S2-8

```text
S2-8  DEMO SCENARIOS, END-TO-END FLOW AND SHORTLIST SPEED CHECK
Branch: feat/s2-8-demo-scenarios   Time box: 1.5 hours   Issue: S2-8 (gh issue list --milestone "Sprint 2 (24-27 Oct)")

CONTEXT
Read docs/prompts/sprint-2/README.md, apps/api/src/seed (it follows the state machine since S1-6:
services only, dates relative to today), the recommendation service (S2-6) and the shortlist screens
(S2-7). The course demo needs repeatable data. The seed must keep using the real services; no
direct status writes.

GOAL
pnpm db:seed adds three demo trips that give a shortlist, a diagnostic and a date clash when the
organiser asks for recommendations; an end-to-end API test walks the whole flow; a timing script
measures R15; docs/demo/sprint-2-demo.md is a five-minute script anyone can follow.

STEPS
1. Seed (idempotent by title; organiser asha; members joined through the invitation service;
   preferences through the preference service; all left in ready_for_recommendation):
   a) "Hills shortlist demo": 3 members, overlapping dates, compatible budgets, 2 nights, ₹48,000,
      radius 450 km from gurugram: gives at least 3 feasible destinations with the current catalogue.
   b) "Tight budget demo": the same members, ₹9,000 group budget: gives fewer than 3 feasible and an
      F5 suggestion with capSource trip.
   c) "Date clash demo": two members whose dates do not overlap: gives T4 with F3.
   The original "Long weekend in the hills" stays as it is (Meera pending).
   run-seed.test.ts proves each outcome by requesting recommendations in the test, and that a second
   seed run adds nothing.
2. apps/api/src/e2e/group-flow.test.ts: sign up four users; create a trip; invite; three join; all
   submit (T3); request recommendations (shortlist); a member reads latest and gets only their own
   mine; the organiser chooses (T9, packages_proposed). Assert the trip_transition ids in order.
3. scripts/perf/recommend-timing.ts (tsx, root script "perf:recommend", local only):
   creates 5 fresh copies of the hills demo trip with the seed's helpers (in-process, local database
   only), signs in as asha against the running local API, requests recommendations on each copy,
   prints min, median and max ms, then cancels the copies.
4. docs/demo/sprint-2-demo.md: five minutes with exact clicks for the three demo trips, what to say
   at each step (the group profile, private explanations, ranking by group fit rather than the
   average, the diagnostic and its one-tap fix, the date clash), and how to reset (local:
   pnpm db:reset && pnpm db:seed; preview: pnpm db:seed --target preview; never production).
5. Traceability on R6 and R15. PR "feat: demo scenarios, end-to-end flow and speed check", body
   starts "Closes #<S2-8>".
6. HAND OVER to Maulik: pnpm db:seed --target preview, then open the preview and run the demo once.

VERIFICATION
Paste the real output of: pnpm db:reset && pnpm db:seed (row counts, the new trips and their
statuses) ; pnpm vitest run --project integration apps/api/src/seed apps/api/src/e2e ;
pnpm perf:recommend (with pnpm dev running) ; pnpm verify. Stop every dev server you start.

IF BLOCKED
The draft catalogue cannot give 3 feasible destinations for a sensible trip: report which constraints
fail; never edit catalogue data or review statuses. A seed step seems to need a direct status write:
it does not; use the services.
```
