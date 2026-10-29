# S5-2: R17 fairness across recommendation rounds (#27)

The synopsis promises: "A fairness adjustment is also applied across successive recommendation rounds within the same trip, raising the weight given to any member whose score has been lowest in previous rounds." Today a trip has at most one shortlist: nothing leads back from `shortlisted` (plan finding a). Under decision E1, this prompt adds "Ask again" (T21), then member weights that start equal and shift towards members whom earlier shortlists' top choices served least.

Three PRs, in order. Each starts from fresh master after the one before has merged.

| Part | Branch | Time box | What | Migration |
| --- | --- | --- | --- | --- |
| 2a | `feat/27-fairness-engine` | 2 h | Pure engine: deficits, weights, weighted GFS, scoring.md section 8 | none |
| 2b-1 | `feat/27-ask-again` | 2 h | T21 `shortlistReopened`: state machine, endpoint, organiser button | none |
| 2b-2 | `feat/27-fairness-weights` | 2 h | lambda config, weights from earlier shortlists, the R7 sentence, privacy tests | 0004 |

**Depends on:** #136 merged (plan, decisions E1 and E2) · **Issue:** #27 (2a and 2b-1 say "Refs #27"; 2b-2 says "Closes #27") · **Never cut**

## Design (decisions E1 and E2, 29 October 2026)

```text
Earlier rounds: the trip's earlier runs with kind = shortlist, oldest first. Diagnostics never count.
Top choice o_r: the destination chosen from run r (T9) if there was one, else its rank 1.
deficit_i = (1/R) x sum_r max(0, mean_j s_j(o_r) - s_i(o_r))
            (0 with no earlier shortlist, or if member i was not scored in run r;
             s comes from recommendation_item.reasons.members[].score)
w_i       = 1 + lambda x deficit_i, then w_i <- w_i / mean_k w_k   (mean weight 1)
mean_w    = (1/n) x sum_i w_i x s_i(d)
sd_w      = sqrt((1/n) x sum_i w_i x (s_i(d) - mean_w)^2)
GFS_fair  = alpha x mean_w + beta x min_i s_i(d) - gamma x sd_w     (min unweighted)
Rank by GFS_fair, then mean, then slug. lambda = 1 (scoring.json, 0 to 5).
Items keep gfs, mean, min and sd UNWEIGHTED; only rank follows GFS_fair.
Weights are recomputed per run and never stored, returned or logged.
```

Worked example (golden data; round 1 chose d1; round 2 has the same three destinations), already recomputed independently to 6 decimals:

| | Weights (m1, m2, m3) | d1 | d2 | d3 | Order |
| --- | --- | --- | --- | --- | --- |
| Round 1 | 1, 1, 1 | 0.129780 | 0.066957 | 0.082828 | d1, d3, d2 |
| Round 2, lambda 0.5 | 0.942080, 1.115841, 0.942080 | 0.117974 | 0.082610 | 0.074925 | d1, d2, d3 |
| Round 2, lambda 1 | 0.890501, 1.218997, 0.890501 | 0.107752 | 0.097066 | 0.068044 | d1, d2, d3 |
| Round 2, lambda 2 | 0.802616, 1.394768, 0.802616 | 0.090935 | 0.122755 | 0.056665 | d2, d1, d3 |

## S5-2a: engine

```text
S5-2a  R17 ENGINE: DEFICITS, WEIGHTS AND WEIGHTED GROUP FIT
Branch: feat/27-fairness-engine (from fresh master)   Time box: 2 hours   Issue: Refs #27
Follow the Sprint 5 conventions (docs/prompts/sprint-5/README.md: Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/sprints/sprint-5-plan.md (design 1 and decisions E1, E2), this file's Design section,
docs/specs/scoring.md (sections 3, 4 and 7), packages/engine/src/scoring/* (group-fit.ts:3-9,
rank.ts:20-45, golden.fixture.ts, golden.test.ts) and packages/engine/src/index.ts.

STEPS
1. scoring/fairness.ts: memberDeficits(earlierRounds, memberIds) where each round is
   { topChoiceScores: Record<memberId, number> }, and fairnessWeights(deficits, lambda). Export
   both from index.ts.
2. groupFit and rankDestinations take optional weights. Without weights the code path and results
   are exactly today's; golden.test.ts is not edited and passes.
3. fairness.test.ts with full branch coverage: no earlier round; lambda 0; one member; every
   deficit 0; a member missing from a round; 2 members; 2 earlier rounds averaged.
4. A new golden test asserting the worked example above to 1e-6 (weights and GFS at lambda 0.5,
   1 and 2, and the three orders).
5. scoring.md: section 8 "Fairness across rounds (R17)" with the formula, the worked example table
   and "Verified: recomputed independently on 2026-10-29". Status line: "R17 added 29 October 2026".
6. PR "feat: fairness weights in the scoring engine (R17, part 1)", body "Refs #27".

VERIFICATION
Paste: pnpm vitest run --project unit packages/engine/src/scoring --coverage (fairness.ts lines
and branches); the new golden values; pnpm format:check; pnpm lint; pnpm typecheck; pnpm test
summary; the CI result.

IF BLOCKED
The worked example does not reproduce to 1e-6: stop and paste both sets of numbers.
```

## S5-2b-1: "Ask again" (T21)

```text
S5-2b-1  T21 shortlistReopened ("ASK AGAIN")
Branch: feat/27-ask-again (from fresh master, after S5-2a merged)   Time box: 2 hours
Issue: Refs #27. Follow the Sprint 5 conventions (Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/sprints/sprint-5-plan.md (finding a, design 1, E1), docs/decisions/0001 (the table),
packages/engine/src/trip-state.ts and trip-state.test.ts, apps/api/src/trips (service.ts
EDITABLE_STATUSES at :59, transition-trip.ts, router.ts), apps/api/src/packages/service.ts
(:408-409, T10 clears selected_destination_id), apps/api/src/recommendations/service.ts
(chooseDestination :675-707, round numbering via repository.ts:151-157),
apps/api/src/test/endpoint-inventory.ts, apps/api/src/security/access-matrix.test.ts,
apps/web/src/pages/Trips/shortlist (DestinationCard.tsx canChoose) and TripPage.

GOAL
On a shortlisted trip the organiser can "Ask again": the trip returns to ready_for_recommendation,
members may revise preferences (T5), the organiser may edit parameters (decision 0004 j), and the
next request makes a new run (round + 1). Nothing from the earlier run leaks into the next T9.

STEPS
1. trip-state.ts: T21 { from: shortlisted, event: shortlistReopened, guard: none, to:
   ready_for_recommendation, actions: [] }. The exhaustive test covers it; every other state
   rejects the event with the existing error shape.
2. decision 0001: add the T21 row with the date and "decision E1, 29 October 2026"; RUNBOOK
   Appendix B's transition list if it enumerates them.
3. API: POST /api/trips/:id/reopen-shortlist (organiser only; 409 outside shortlisted). In one
   transaction: fire T21 and record activity "Asha asked for new recommendations". Confirm that no
   package, package decision or itinerary row from an earlier T9/T10 cycle is read by the next
   T9; if any is, delete or ignore it here and test it.
4. endpoint-inventory.ts and access-matrix.test.ts (6 actors). Paste the counts (43 before).
5. Web: an organiser-only "Ask again" button on the shortlist page (44 px, text), with a confirm:
   "Ask again? Members can change their answers, and you can ask for new recommendations." Members
   see the trip at "Ready for recommendations" as today.
6. Tests: integration (shortlist, T21, revise, request again gives round + 1 and a new shortlist
   run; T9 then works on the new run only; a member cannot reopen: 403); web test for the button
   and confirm; run-seed and e2e unchanged (V6).
7. PR "feat: ask again from the shortlist (T21)", body "Refs #27".

VERIFICATION
Paste: the trip-state test summary; endpoint and matrix counts; pnpm vitest run --project
integration apps/api/src/trips apps/api/src/recommendations apps/api/src/packages
apps/api/src/security apps/api/src/seed apps/api/src/e2e; pnpm vitest run --project web;
pnpm format:check; pnpm lint; pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
Reopening would need a new trip status, or would have to delete a member's submitted preferences:
stop. Both break V4 or decision 0004.
```

## S5-2b-2: weights in the app

```text
S5-2b-2  R17 IN THE APP: LAMBDA, WEIGHTS FROM EARLIER SHORTLISTS, THE R7 SENTENCE
Branch: feat/27-fairness-weights (from fresh master, after S5-2b-1 merged)   Time box: 2 hours
Issue: Closes #27. Follow the Sprint 5 conventions (Q1 to Q10 with V1 to V8).

CONTEXT
Read this file's Design section, docs/sprints/sprint-5-plan.md (findings a and b, design 1
"API" and "Privacy"), apps/api/config/scoring.json and apps/api/src/config/scoring.ts,
packages/db/src/schema/recommendations.ts, apps/api/src/recommendations/service.ts (planRun :426,
items :538-565, reasons typing :140-150, toItemView :318), the explanation code
(packages/engine/src/scoring/explain.ts and the web "why" panel), apps/api/src/security/
no-leak.test.ts, docs/security/privacy.md (:39, :43) and run-seed.test.ts.

STEPS
1. scoring.json gains "lambda": 1; scoring.ts validates 0 to 5 at start-up.
2. Migration 0004 via pnpm db:generate: recommendation_run.lambda double precision NOT NULL
   DEFAULT 0. New runs always write the configured value.
3. planRun: load the trip's earlier shortlist runs, take each one's top choice (selected destination
   if T9 happened on it, else rank 1) and its reasons.members[].score, compute weights with the
   engine, rank with them. Store nothing about weights.
4. R7: when the weights are not all 1, every member's own "why" panel adds: "This round gives more
   weight to members whose wishes were met less in earlier rounds." No names, no numbers.
5. Tests:
   - recommendations.test.ts: a 3-member trip where m2 scores lowest on round 1's top choice;
     T21, request again: the round-2 order matches the engine with weights and differs from
     lambda 0 where the data allows; the run stores lambda; returned gfs, mean and sd equal the
     unweighted formula from the stored scores.
   - no-leak.test.ts: after two shortlists, no body for any actor has a lambda, weight or deficit
     key, and no per-member score beyond the caller's own.
   - run-seed.test.ts: add the Tight budget trip's first shortlist order (plan finding f), so any
     future change to a first shortlist fails a test (M3).
6. privacy.md: one line under recommendations saying the order of a second round may favour
   members less served before, without showing who; in 2-member groups this reveals nothing beyond
   what round 1's figures already do (:43).
7. Traceability row R17: sprint S5, #27, the tests. PR "feat: fairness across recommendation
   rounds (R17)", body "Closes #27" and "After merge (Maulik): pnpm db:migrate:remote --target
   preview --status, then without --status; then the same for production".

VERIFICATION
Paste: the migration file name; pnpm vitest run --project integration
apps/api/src/recommendations apps/api/src/security apps/api/src/seed apps/api/src/e2e;
pnpm format:check; pnpm lint; pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
Any first-shortlist order or golden value changes: stop (M3). Do not adjust the formula to hide it.
```
