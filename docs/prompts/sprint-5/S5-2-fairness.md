# S5-2: R17 fairness across recommendation rounds (#27)

The synopsis promises: "A fairness adjustment is also applied across successive recommendation rounds within the same trip, raising the weight given to any member whose score has been lowest in previous rounds, so that the same person is not repeatedly asked to compromise." Today every run scores members equally. This prompt adds member weights that start equal and shift towards members who were least served in earlier shortlisted runs of the same trip.

**Branch:** `feat/<issue>-fairness-rounds` · **Time box:** 4 hours · **Depends on:** S5-1 approved (E1, E2) · **Issue:** #27 · **Migration:** one, if E2 stores per-member scores · **Never cut**

```text
S5-2  R17 FAIRNESS ACROSS RECOMMENDATION ROUNDS
Branch: feat/<issue>-fairness-rounds (from fresh master)   Time box: 4 hours   Issue: #27
Follow the Sprint 5 conventions (docs/prompts/sprint-5/README.md: Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/sprints/sprint-5-plan.md (findings 1a and 1b, the R17 design, decisions E1 and E2:
they override anything below), docs/specs/scoring.md (sections 3, 4, 5 and 7),
docs/decisions/0004, packages/engine/src/scoring/* (member-score.ts, group-fit.ts, rank.ts,
explain.ts, golden.fixture.ts and their tests), apps/api/config/scoring.json and its loader
(rg -n "scoring.json" apps/api/src), apps/api/src/recommendations/service.ts and repository.ts,
packages/db/src/schema/recommendations.ts (recommendation_run.round), apps/api/src/security/
no-leak.test.ts, and apps/web/src/pages/Trips/shortlist.

GOAL
From the second shortlisted run of a trip, the ranking gives more weight to members who were least
served in earlier shortlisted runs. The first run is unchanged to 1e-6. No member, including the
organiser, can see anyone's weight, deficit or per-member score.

DESIGN (the recommended E1 and E2; the plan's version wins if it differs)
- Earlier rounds: the trip's earlier recommendation runs with feasibleCount >= 3 (shortlists),
  oldest first. Diagnostics (feasibleCount < 3) do not count.
- Deficit: for each earlier shortlisted run r and each member i, let u_i(r) be the mean of s_i over
  that run's top 3 destinations, and ubar(r) the mean of u_i(r) over the members scored in r.
  deficit_i = mean over r of max(0, ubar(r) - u_i(r)). A member absent from earlier runs (joined
  later) has deficit 0.
- Weights: w_i = 1 + lambda x deficit_i, then normalised so the mean weight is 1. With no earlier
  shortlisted run, every w_i = 1.
- Weighted GFS: GFS(d) = alpha x wmean_i s_i(d) + beta x min_i s_i(d) - gamma x wsd_i s_i(d), where
  wmean and wsd are the weighted mean and the weighted population standard deviation. min stays
  unweighted. With all w_i = 1 this is exactly today's GFS.
- lambda: scoring.json gains "lambda" (default 1.0, range 0 to 5), validated at start-up and stored
  on every recommendation_run row (new column, not null, default 0 for old rows).
- Storage (E2): the per-member u_i for the run's top 3, needed by later rounds, is stored
  server-side only (a jsonb column on recommendation_run, or a small table: follow E2). It is
  never selected by any query that feeds a response.

STEPS
1. Engine (pure, full branch coverage):
   a. scoring/fairness.ts: memberDeficits(earlierRuns, memberIds) and fairnessWeights(deficits,
      lambda), with the edge cases: no earlier runs, a single member, all deficits 0, a member
      missing from a run, lambda 0.
   b. group-fit.ts and rank.ts accept optional weights. Without weights the code path and the
      results are byte-for-byte today's. golden.test.ts unchanged and passing.
   c. A worked example with 3 members over 2 rounds (round 1 from the golden fixture, round 2 with
      the weights it produces), asserted to 1e-6 in a new golden test, and written into
      scoring.md as section 8 "Fairness across rounds (R17)" with every number.
2. API: recommendations/service.ts loads the trip's earlier shortlisted runs, computes weights,
   ranks with them, stores lambda and the per-member values (E2), and stores weights nowhere a
   response can reach. Migration through pnpm db:generate (see the README's migration rule).
3. Explanation (R7): when weights are not all 1, every member's own "why" panel adds one sentence:
   "This round gives more weight to members whose wishes were met less in earlier rounds." No
   names, no numbers, no hint whether it is the reader. Group views add nothing more.
4. Privacy and tests:
   - no-leak.test.ts: after two shortlisted runs, no response for any actor contains a weight,
     deficit, u_i or lambda-derived per-member value (search serialised bodies for the stored
     numbers and the member ids next to numbers).
   - recommendations.test.ts: a 3-member trip where member m2 is least served in round 1; after a
     revision (T5) and a second request, m2's top destination ranks higher than without weights
     (compare against lambda 0), and the run stores lambda.
   - The first run of a fresh demo trip is unchanged: run-seed.test.ts and the e2e tests pass
     without edits. If any demo line changes, stop: that breaks M3.
5. Traceability row R17: sprint S5, issue #27, the new tests. scoring.md status line: "R17 added
   29 October 2026 (S5-2)".
6. PR "feat: fairness across recommendation rounds (R17)", body "Closes #27", with "After merge
   (Maulik)" listing the migration commands if one was added.

VERIFICATION
Paste: the new golden test values; pnpm vitest run --project unit packages/engine/src/scoring
with coverage for fairness.ts; pnpm vitest run --project integration
apps/api/src/recommendations apps/api/src/security apps/api/src/seed apps/api/src/e2e;
pnpm format:check; pnpm lint; pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
- The data from earlier runs is not enough to compute u_i (for example, earlier runs scored a
  different member set and the plan does not say how to treat it): stop and describe the case.
- Any demo line or golden value changes: stop. Do not adjust the formula to hide it; report it.
```
