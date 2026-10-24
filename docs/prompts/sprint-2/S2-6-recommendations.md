# S2-6: Recommendation runs and destination choice (T4, T6, T9)

Wires the engine and the integrations module into the API. The organiser asks for recommendations; the server computes everything outside the lock, stores one auditable run, and moves the trip to a shortlist, back for a rethink with a diagnostic, or back with a date-conflict report. Members read the result with their own explanation only, and the organiser picks a destination.

**Branch:** `feat/s2-6-recommendations` · **Time box:** 3 hours · **Depends on:** S2-2, S2-4 and S2-5 merged · **Issue:** S2-6

```text
S2-6  RECOMMENDATION RUNS, CONFLICT REPORT AND DESTINATION CHOICE (T4, T6, T9)
Branch: feat/s2-6-recommendations   Time box: 3 hours   Issue: S2-6 (gh issue list --milestone "Sprint 2 (24-27 Oct)")

CONTEXT
Read AGENTS.md, docs/prompts/sprint-2/README.md (all ten rules), docs/decisions/0001 and 0004,
docs/specs/scoring.md (Accepted), the engine exports from S2-3 and S2-4, packages/integrations
(S2-5), apps/api/src/trips (transition-trip.ts with beforeDecide, access.ts, actions.ts, router.ts),
the recommendation_run and recommendation_item tables, and the S1-6 security tests
(endpoint-inventory.ts, the access matrix, the leak test).
State-machine rows used: T4 (ready_for_recommendation, conflictDetected, to collecting_preferences),
T6>T7 (recommendationRequested, feasibleCount >= 3, to shortlisted), T6>T8 (feasibleCount < 3, to
collecting_preferences), T9 (shortlisted, destinationSelected, to packages_proposed).

GOAL
The organiser asks for recommendations; the API builds the group profile, candidates, distances,
F1 to F5, scores and the diagnostic outside the lock, then stores one run with its items and fires
T4, T6>T7 or T6>T8 atomically. Members read the latest run with their own explanation and group
aggregates only. The organiser chooses a destination from the shortlist (T9). Parameters are
editable until shortlisted. Every new route is in the inventory, the access matrix and the leak test.

STEPS
1. apps/api/config/scoring.json { "alpha": 0.5, "beta": 0.3, "gamma": 0.2 }, zod-validated at
   start-up (numbers >= 0, fail fast with a clear message), bundled by esbuild, passed through createApp
   deps as scoringWeights (tests inject their own).
2. Shared (packages/shared/src/api/recommendations.ts):
   - GroupProfileResponse: { ready: false, memberCount } when fewer than 2 have submitted, otherwise
     { ready: true, memberCount, commonWindow, windowFits, budgetBand, perPersonCapInr, groupCapInr,
     typeVotes, activityVotes, climateVotes (values with count >= 2 only, plus otherInterestCount),
     conflicts }. No names.
   - RecommendationItem { rank, destination { slug, name, state }, gfs, mean, min, sd,
     estimatedCostInr, perPersonInr, cheapestMode, distanceKm, distanceProvenance, group
     { memberCount, climateMetCount, sharedTypes, sharedActivities, lowestScore10, highestScore10 },
     mine: { score10, metTypes, missedTypes, metActivities, missedActivities, climateMet } | null }.
   - RecommendationRun { id, round, kind ("shortlist" | "diagnostic"), createdAt, weights,
     feasibleCount, bindingConstraint, weakMatch (best mean < 0.25), diagnostic: { feasible,
     nearMisses, alternatives, suggestions, incomplete } | null, groupProfile }.
   - LatestRecommendationResponse { run: RecommendationRun | null, items: RecommendationItem[] };
     RequestRecommendationsResponse = that plus transition { transitionId, to }.
   - ChooseDestinationInput { destinationSlug }.
   - Error codes RECOMMENDATION_STALE (409) and DESTINATION_NOT_IN_SHORTLIST (422).
   - TripDetail gains latestRecommendation: { round, kind, feasibleCount, createdAt } | null.
3. apps/api/src/recommendations/ (service and repository; routes in apps/api/src/trips/router.ts):
   a) POST /api/trips/:id/recommendations (organiser, active, body {}):
      - members = active members with a submitted preference; likedPastTypes from their past trips
        rated 4 or 5 that have a destination;
      - profile = groupProfile(...); staleness stamp = the latest of the members' preference
        updated_at and trip.updated_at;
      - blocking conflict: diagnostic run (kind diagnostic, bindingConstraint F3, no items) and
        conflictDetected (T4);
      - otherwise: candidates = active destinations with complete costs (the rest go to
        diagnostic.incomplete); distances from routing.getDistances(origin hub, candidates) in ONE
        call; fares and cost rules in ONE query each; evaluateCandidate for every candidate;
        rankDestinations over the feasible ones; buildDiagnostic; recommendationRequested with
        feasibleCount (T6>T7 or T6>T8). Kind is shortlist when feasibleCount >= 3, else diagnostic
        (which still stores the 1 or 2 feasible items);
      - persistence inside transitionTrip's beforeDecide: re-read the staleness stamp (changed:
        throw 409 RECOMMENDATION_STALE "Preferences changed while recommending. Try again."), then
        insert the run (round = the trip's previous max + 1; weights from config) and its items
        (rank, gfs, mean, min, sd, estimated_cost_inr, distance_km, distance_provenance, reasons =
        { members: [{ tripMemberId, score, ...explainMatch }], summary: groupSummary });
      - one info log line: tripId, round, kind, feasibleCount, candidates, durationMs; no member data;
      - respond 200 RequestRecommendationsResponse, filtered for the caller as in b).
   b) GET /api/trips/:id/recommendations/latest (any member, excluded included): the newest run and
      its items; mine = the caller's own reasons entry (null for anyone not in the run); group
      fields from the summary; perPersonInr = estimatedCostInr / run member count, rounded up.
      Never another member's reasons.
   c) GET /api/trips/:id/group-profile (any member): computed from the current submitted
      preferences.
   d) POST /api/trips/:id/destination (organiser, active) with ChooseDestinationInput: the slug must
      be an item of the newest run of kind shortlist, else 422 DESTINATION_NOT_IN_SHORTLIST;
      destinationSelected (T9) with beforeDecide setting trip.selected_destination_id; returns
      TripDetail (selectedDestination filled).
   e) PATCH /api/trips/:id allowed in draft, collecting_preferences and ready_for_recommendation
      (0004 j); TRIP_NOT_EDITABLE message: "Trip details can be changed until the shortlist is made."
   f) tripActions: requestRecommendations (organiser, ready_for_recommendation), chooseDestination
      (organiser, shortlisted), viewRecommendations (any member once a run exists); editDetails
      follows e).
   g) EVENT_SUMMARIES: "Asha asked for recommendations", "The group's dates do not overlap enough"
      (conflictDetected), "Asha chose the destination" (destinationSelected).
4. Security tests: the four new routes in endpoint-inventory.ts; access matrix (POST recommendations
   and POST destination: organiser 2xx or the state's 409, member and excluded 403, non-member 404,
   anonymous 401; the two GETs: every member 200, non-member 404, anonymous 401); leak test: two
   members with unique activities, then A's latest response holds none of the values only B wants,
   and every group list holds counts of 2 or more only.
5. Integration tests (apps/api/src/recommendations), with a small fixture catalogue unless stated:
   - 3 members: T6>T7, kind shortlist, items in gfs order, round 1, weights stored;
   - fewer than 3 feasible: T6>T8, kind diagnostic, alternatives and suggestions present, trip back
     in collecting_preferences;
   - disjoint dates: T4, kind diagnostic, bindingConstraint F3, no items;
   - staleness: a preference revised after compute and before persist gives 409
     RECOMMENDATION_STALE and no run (inject a hook between the phases);
   - second round: after T6>T8 the organiser widens the radius (PATCH allowed), closes submissions
     (T3b), recommends again: round 2;
   - choose: a shortlisted slug gives T9 and packages_proposed with selectedDestination; another slug
     gives 422; a member gets 403; choosing again gives 409;
   - an incomplete destination shows in diagnostic.incomplete;
   - speed (R15): import the real catalogue from packages/db/catalogue into the test database, run one
     recommendation for a 3-member trip from gurugram, assert under 2000 ms, log the time.
6. Traceability on R4 to R7 and R15. PR "feat: recommendation runs, conflict report and destination
   choice", body starts "Closes #<S2-6>", with one trimmed shortlist response and one diagnostic
   response.

VERIFICATION
Paste the real output of: pnpm vitest run --project integration apps/api/src/recommendations
apps/api/src/security apps/api/src/trips ; pnpm verify ; pnpm vercel-build && pnpm smoke:function ;
the speed-test time. Then pnpm db:reset && pnpm db:seed and pnpm dev: meera submits on the demo trip
(T3), asha requests recommendations, paste the trimmed JSON (rank, slug, gfs, cost, provenance).
Stop every dev server you start.

IF BLOCKED
transitionTrip cannot carry the inserts in beforeDecide: tell me; never write trip.status yourself.
The real catalogue run is slower than 2 s: profile it and report (look for per-destination queries);
never cache results across trips. A 0004 rule does not fit the data: stop and ask.
```
