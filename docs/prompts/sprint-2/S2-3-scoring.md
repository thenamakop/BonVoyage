# S2-3: Member score, group-fit ranking, explanations and group profile

The heart of the product as pure functions: how much each member likes a destination, how well it suits the group as a whole, why, and what the group looks like together. The golden example written in Sprint 0 finally gets checked against real code.

**Branch:** `feat/s2-3-scoring` · **Time box:** 2.5 hours · **Depends on:** S2-1 merged · **Issue:** S2-3

```text
S2-3  MEMBER SCORE, GROUP-FIT RANKING, EXPLANATIONS AND GROUP PROFILE
Branch: feat/s2-3-scoring   Time box: 2.5 hours   Issue: S2-3 (gh issue list --milestone "Sprint 2 (24-27 Oct)")

CONTEXT
Read AGENTS.md (design rules 1 and 3), docs/prompts/sprint-2/README.md (rules S1, S2, S4, S10),
docs/specs/scoring.md (Accepted: 6.1, 6.3, 6.4, 6.5, 6.7) and docs/decisions/0004 (a, b, c, h, i, m).
Look at packages/engine/src/scoring/golden.fixture.ts and golden.test.ts (two it.todo tests become real
here), packages/engine/src/trip-state.ts (the style to follow: data plus small pure functions) and
packages/shared/src/vocab.ts.
The engine is pure: no I/O, no clock, no env, no Date.now. Weights are parameters, never literals
outside tests.

GOAL
packages/engine exports memberScore, groupFit, rankDestinations, explainMatch, groupSummary and
groupProfile, all pure, with 100 per cent branch coverage, reproducing scoring.md 6.7 to within 1e-6
including the ranking d1, d3, d2.

STEPS
1. src/scoring/types.ts:
   MemberInput { memberId; types: DestinationType[]; activities: Activity[]; climate: ClimatePreference;
     likedPastTypes: DestinationType[]; budgetMinInr; budgetMaxInr; dateStart; dateEnd (YYYY-MM-DD) }
   DestinationInput { id; slug; types; activities; climate: Climate; bestMonths: number[]; minNights }
     (S2-4 extends it with costs; keep it open for extension)
   Weights { alpha; beta; gamma }
2. src/scoring/similarity.ts: jaccard(a, b), 0 when both are empty; weightedJaccard(memberWeights:
   Map<string, number>, destination: Set<string>) = sum over the union of min(wm, wd) / sum of
   max(wm, wd), destination weights 1. memberTypeWeights(member): 1 for stated types, 0.5 for
   likedPastTypes not already stated. Hand-checked case for the tests: stated {mountain}, liked past
   {heritage}, destination {mountain, heritage, city} gives 0.5 (plain Jaccard of {mountain} would be
   1/3).
3. src/scoring/member-score.ts: memberScore(member, destination) = 0.5 x weightedJaccard(types) +
   0.3 x jaccard(activities) + 0.2 x climate (1 when the member says any or matches, else 0).
4. src/scoring/group-fit.ts: groupFit(scores, weights) returns { mean, min, sd (population),
   gfs = alpha x mean + beta x min - gamma x sd }. Throws on an empty array (caller bug).
5. src/scoring/rank.ts: rankDestinations(members, destinations, weights) returns RankedDestination[]
   { destinationId, slug, gfs, mean, min, max, sd, memberScores: { memberId, score }[] } sorted by gfs
   desc, mean desc, slug asc; compare floats with a 1e-12 tolerance before moving to the next key.
6. src/scoring/explain.ts:
   explainMatch(member, destination) returns { metTypes, missedTypes, metActivities, missedActivities,
   climateMet }: met = the member wants it and the destination has it, missed = wants it but the
   destination lacks it. Only stated types count as wanted (past-trip types do not).
   groupSummary(explanations, memberCount) returns { memberCount, climateMetCount, sharedTypes,
   sharedActivities } where the shared lists hold { value, count } for values met for at least 2
   members, sorted by count desc then value (0004 i).
7. src/group/profile.ts: groupProfile(members, trip { durationNights, budgetTotalInr }) returns
   { memberCount, commonWindow: { start, end, days } | null, windowFits, budgetBand: { minInr, maxInr,
   overlaps }, perPersonCapInr, groupCapInr, typeVotes, activityVotes, climateVotes (each { value,
   count }[] sorted by count desc then value), conflicts: { code: "NO_COMMON_WINDOW" |
   "WINDOW_TOO_SHORT" | "BUDGET_BANDS_DISJOINT", blocking }[] }.
   Dates: parse YYYY-MM-DD to UTC-midnight values, no time zones; days counts both ends;
   WINDOW_TOO_SHORT when days < durationNights + 1; both window conflicts are blocking, the budget one
   is not. groupCapInr = min(budgetTotalInr, memberCount x perPersonCapInr). Throws on zero members.
   The profile returns all counts; hiding single-member values is the API's and web's job.
8. Export everything from the engine index.
9. Tests (unit):
   - golden.test.ts: replace both it.todo. memberScore reproduces the nine member scores of 6.7;
     rankDestinations returns d1, d3, d2 with the 6.7 GFS, mean, min and sd (1e-6).
   - similarity: both empty, identical, disjoint, the weighted case in step 2.
   - ranking ties: equal gfs falls to mean, equal mean falls to slug.
   - explainMatch and groupSummary: met and missed lists; a value met for one member only is not
     listed; climate any counts as met.
   - groupProfile: overlapping windows; a 2-day window for 2 nights (WINDOW_TOO_SHORT, blocking);
     disjoint windows (NO_COMMON_WINDOW, null window); disjoint budget bands (warning only); the group
     cap taking the trip budget in one case and n x lowest maximum in another.
   - Coverage: pnpm vitest run --project unit --coverage.enabled
     --coverage.include=packages/engine/src/scoring/** --coverage.include=packages/engine/src/group/**
     --coverage.thresholds.100
10. docs/traceability.md: tests on R4, R6 and R7. PR "feat: member score, group-fit ranking,
    explanations and group profile", body starts "Closes #<S2-3>".

VERIFICATION
Paste the real output of: pnpm vitest run --project unit packages/engine ; the coverage command ;
pnpm verify.
Report: the nine member scores and three GFS values as computed, and any deviation.

IF BLOCKED
A golden value differs beyond 1e-6: the code is wrong, not the spec; show the numbers and stop if you
cannot find why. Coverage is short because of a defensive branch: remove the branch rather than
excluding it. Never add I/O, Date.now or env access to the engine.
```
