# S2-4: Hard constraints, cost estimate and diagnostic

The filter that runs before any scoring: is each destination within the radius, possible in the nights available, in season and affordable? When fewer than three survive, it works out the smallest change that would bring more in, which is what makes the empty-shortlist screen useful rather than a dead end.

**Branch:** `feat/s2-4-feasibility` · **Time box:** 2.5 hours · **Depends on:** S2-3 merged · **Issue:** S2-4

```text
S2-4  HARD CONSTRAINTS F1 TO F5, COST ESTIMATE AND EMPTY-SHORTLIST DIAGNOSTIC
Branch: feat/s2-4-feasibility   Time box: 2.5 hours   Issue: S2-4 (gh issue list --milestone "Sprint 2 (24-27 Oct)")

CONTEXT
Read docs/prompts/sprint-2/README.md (rules S1, S2, S8), docs/specs/scoring.md 6.2 and 6.6
(Accepted), docs/decisions/0004 (c, d, e, f), and S2-3's engine code (types, groupProfile).
estimateRoadKm already exists in the engine. The engine stays pure: the API gathers distances, fares
and cost rules and passes them in.

GOAL
packages/engine evaluates every candidate against F1, F2, F4 and F5 (F3 is the group gate from
groupProfile), estimates the group cost with the 0004 d formula, and builds the 6.6 diagnostic:
failures with relaxations, near misses, alternatives, binding constraint and suggestions.
100 per cent branch coverage.

STEPS
1. src/costs/:
   CostRules { fuelPriceInrPerLitre, carKmPerLitre, tollInrPerKm, personsPerCar, carRentalInrPerDay }.
   carSharePerPersonOneWay({ km, n, nights, rules }) = ceil(n / personsPerCar) x (km x (fuel / kmpl +
   toll) + rental x (nights + 1) / 2) / n.
   cheapestOneWay({ busInr, trainInr, carShareInr }) returns { inr, mode } (lowest; ties train, bus,
   car; bus and train may be null).
   estimatedGroupCost({ n, nights, oneWayPerPersonInr, stayBudgetInr, foodPerDayInr, localPerDayInr })
   = n x 2 x oneWay + ceil(n / 2) x nights x stayBudget + n x (nights + 1) x (food + local).
   Round up to whole rupees only at the end of each exported function (rule S8).
   Hand-checked cases for the tests:
     car share, n 3, km 250, fuel 95, kmpl 15, toll 1.8, rental 2000, nights 2, 4 seats: 1678;
     the same with n 5: 2014;
     group cost, n 3, nights 2, one-way 480, stay 1800, food 600, local 300: 18180.
2. src/feasibility/types.ts: FeasibilityContext { n, durationNights, radiusKm, groupCapInr,
   capSource: "trip" | "members", perPersonCapInr, commonWindow: { start, end } }; CandidateFacts
   { destination (DestinationInput plus stayBudgetInr, foodPerDayInr, localPerDayInr), distanceKm,
   distanceProvenance, fares: { busInr, trainInr }, costRules }.
3. src/feasibility/evaluate.ts: evaluateCandidate(facts, ctx) returns { destinationId, slug, feasible,
   estimatedGroupCostInr, cheapest: { inr, mode }, failures: Failure[] } where Failure { id, limit,
   actual, relaxation, relative, unit }:
     F1 distanceKm <= radiusKm; relaxation km over; relative = relaxation / radius.
     F2 durationNights >= minNights; relaxation nights short; relative = relaxation / durationNights.
     F4 some month touched by the common window (start to end inclusive, across year ends) is in
        bestMonths; relaxation = smallest circular month distance (1 to 6) from a window month to a
        best month; relative = relaxation / 12.
     F5 estimatedGroupCostInr <= groupCapInr; relaxation rupees over; relative = relaxation / cap.
4. src/feasibility/diagnostic.ts: buildDiagnostic({ evaluations, ctx, profile, incomplete }) returns
   { feasibleCount, feasible: slugs, nearMisses (exactly one failure), alternatives (up to 3 near
   misses by relative asc, then slug), bindingConstraint, suggestions, incomplete }:
     bindingConstraint = "F3" when the profile has a blocking conflict (then no alternatives or
     suggestions); otherwise the constraint with the most near misses, ties F5, F1, F2, F4; null when
     feasibleCount >= 3.
     suggestions: for each constraint among the near misses, the smallest new limit that unlocks at
     least one destination, and every slug it unlocks: F1 { newRadiusKm } rounded up to 10 km;
     F2 { newNights }; F4 { shiftMonths } (text only on screen); F5 { newGroupCapInr } rounded up to
     500 rupees, plus capSource, and when capSource is "members" also newPerPersonMaxInr =
     newGroupCapInr / n rounded up to 500 (members must raise their maximum; the organiser cannot).
5. Export from the engine index.
6. Tests (unit, 100 per cent branch for costs/** and feasibility/**): the three hand-checked numbers;
   cheapest picks train on a tie and handles missing bus or train; each constraint passing at exactly
   the limit and failing by one unit; F4 across December to January and the 6-month maximum; a
   diagnostic with 3 feasible (binding null), one with 1 feasible and a near-miss tie between F1 and
   F5 (F5 wins), one with an F3 conflict (binding F3, nothing else); suggestion rounding and the
   members cap source.
7. docs/traceability.md: tests on R5. PR "feat: hard constraints, cost estimate and diagnostic",
   body starts "Closes #<S2-4>".

VERIFICATION
Paste the real output of: pnpm vitest run --project unit packages/engine ; pnpm vitest run --project
unit --coverage.enabled --coverage.include=packages/engine/src/costs/**
--coverage.include=packages/engine/src/feasibility/** --coverage.thresholds.100 ; pnpm verify.

IF BLOCKED
The 0004 d formula gives a result that looks wrong for a case: implement it as written and tell me
the case. A constraint needs data the facts do not carry: stop and ask; never reach into the database
from the engine.
```
