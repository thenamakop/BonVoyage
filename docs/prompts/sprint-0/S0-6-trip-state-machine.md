# S0-6: Trip state machine

Turns the state diagram into a pure, exhaustively tested `nextState()` in the engine and a locked, audited `transitionTrip()` in the API, then proves it end to end with the cancel endpoint. It also commits the scoring golden fixture that Sprint 2 builds against.

**Branch:** `feat/s0-trip-state` · **Time box:** 2.5 hours · **Depends on:** S0-5 merged

```text
S0-6  TRIP STATE MACHINE
Branch: feat/s0-trip-state   Time box: 2.5 hours

CONTEXT
Read AGENTS.md (design rule 6), docs/decisions/0001-state-machine-clarifications.md, docs/RUNBOOK.md Appendix B2, the state diagram docs/design/png (Design Lab page 4.4), and docs/specs/scoring.md section 6.7. Merged so far: the schema with trip, trip_member and trip_transition (S0-5), Better Auth with requireSession and getSessionUser (S0-5), and the domain enums in packages/shared (TRIP_STATUSES, PLANNING_STATUSES).

The table below is the contract. It merges Appendix B2 with decision 0001; if the diagram disagrees, this table wins, and you list the difference in your report.

  id     from                       event                    guard                                      to                         actions
  T1     initial                    createTrip                                                          draft                      assignOrganiser
  T2     draft                      inviteMembers                                                       collecting_preferences     sendInvitations
  T3     collecting_preferences     preferenceSubmitted      pendingCount = 0 and submittedCount >= 2   ready_for_recommendation   (none)
  T3b    collecting_preferences     closeSubmissions         submittedCount >= 2                        ready_for_recommendation   excludeNonSubmitters, notifyMembers
  T4     ready_for_recommendation   conflictDetected                                                    collecting_preferences     reportConflict
  T5     ready_for_recommendation   preferenceRevised                                                   ready_for_recommendation   (none; the self-transition re-runs the entry behaviour)
  T6>T7  ready_for_recommendation   recommendationRequested  feasibleCount >= 3                         shortlisted                filterByHardConstraints, rankByGroupFit
  T6>T8  ready_for_recommendation   recommendationRequested  feasibleCount < 3                          collecting_preferences     filterByHardConstraints, showEmptyShortlistDiagnostic
  T9     shortlisted                destinationSelected                                                 packages_proposed          (none)
  T10    packages_proposed          packageRejected          alternativesLeft = 0                       shortlisted                (none)
  T11    packages_proposed          packageAccepted                                                     package_selected           (none)
  T12    package_selected           generateItinerary                                                   itinerary_proposed         (none)
  T13    itinerary_proposed         itineraryRejected                                                   package_selected           (none)
  T14    itinerary_proposed         itineraryAccepted                                                   finalised                  (none)
  T15    any PLANNING status        cancelTrip                                                          cancelled                  (none)
  T16    finalised                  cancelTrip               today < startDate                          cancelled                  (none)
  T17    finalised                  tripStarted                                                         in_progress                (none)
  T18    in_progress                tripEnded                                                           completed                  requestRatings

  Internal transitions (status unchanged, no entry behaviour):
  I1     collecting_preferences     preferenceSubmitted      T3's guard is false                        updateProgress
  I2     collecting_preferences     preferenceRevised                                                   updateProgress
  I3     packages_proposed          packageModified                                                     recomputeCost
  I4     packages_proposed          packageRejected          alternativesLeft > 0                       hidePackage
  I5     itinerary_proposed         itineraryModified                                                   revalidate

  Terminal: completed and cancelled reject every event (T19 and T20).
  Locked: preferenceRevised in shortlisted, packages_proposed, package_selected, itinerary_proposed, finalised or in_progress is rejected as PREFERENCES_LOCKED (0001 b, a known gap).
  Entry behaviours run after the transition's own actions on every external transition into a state, including T5, and never on internal transitions:
    draft: validateTripParameters; collecting_preferences: openSubmissionWindow; ready_for_recommendation: computeGroupProfile; shortlisted: saveRankedShortlist; packages_proposed: generateAndCostPackages; package_selected: lockPackage; itinerary_proposed: assembleDayWisePlan; finalised: notifyMembers; completed: archiveToTripHistory; cancelled: notifyMembers, releaseHolds.
    in_progress has the do-activity sendDailyReminders. Reminders (C4) are deferred, so store it as data on the state and never return it as an action.
  tripStarted and tripEnded are the time events at(startDate) and at(endDate); a daily job will send them later. They have no guards here.

GOAL
packages/engine/src/trip-state.ts implements the table as data plus one pure function, with 100 per cent branch coverage. apps/api/src/trips/transition-trip.ts is the only code path that changes trip.status: it locks the row, asks nextState, persists the new status and an audit row, runs the action handlers, and maps every rejection to a 409 envelope. POST /api/trips/:id/cancel exercises the whole path.

STEPS
1. packages/engine/src/trip-state.ts (pure; no clock, no I/O):
   - TRIP_EVENTS: the 18 events in the table. ActionName: a union of every action and entry behaviour named above.
   - GuardContext: { pendingCount: number; submittedCount: number; feasibleCount: number | null; alternativesLeft: number | null; today: string (YYYY-MM-DD, India date); startDate: string | null }. If a guard needs a value that is null, throw an Error: that is a bug in the caller, not a user error.
   - TRANSITIONS and INTERNAL_TRANSITIONS: readonly arrays of rows { id, from, event, guard?, guardText, to, actions }, one row per line of the table, in the same order, with the ids exactly as written ("T6>T7", "T3b", "I4"). T15's from is PLANNING_STATUSES. guardText holds the guard as written in the table, for messages and the docs.
   - ENTRY_ACTIONS: Record<TripStatus, readonly ActionName[]> and DO_ACTIVITIES: Partial<Record<TripStatus, string>>.
   - nextState(from: TripStatus | "initial", event, ctx) returns one of:
       { ok: true, kind: "external", transitionId, from, to, actions }   actions = the row's actions, then ENTRY_ACTIONS[to]
       { ok: true, kind: "internal", transitionId, from, to: from, actions }
       { ok: false, reason: "ILLEGAL_EVENT" | "GUARD_FAILED" | "PREFERENCES_LOCKED" | "TERMINAL_STATE", message }
     Order of evaluation: terminal state first; then the locked rule; then the rows for (from, event) in table order, external before internal, first passing guard wins; rows exist but none passes gives GUARD_FAILED naming the guardText; no rows gives ILLEGAL_EVENT. Messages are plain sentences, for example "Submissions can close only when at least 2 members have submitted."
   - legalEvents(status): the events with at least one row from that status (the web uses it to show or hide buttons).
   - Export everything from the engine index.

2. Engine tests (packages/engine/src/trip-state.test.ts), named by transition id:
   - one test per row (18 external, 5 internal) asserting to, kind and the exact action list, including entry behaviours;
   - T19 and T20: every event from completed and from cancelled gives TERMINAL_STATE;
   - an exhaustive matrix over 12 sources (initial plus 11 statuses) x 18 events = 216 pairs, checked against a legal-pairs list written out by hand in the test (do not derive it from TRANSITIONS, or the test proves nothing). Use a permissive context (pendingCount 0, submittedCount 3, feasibleCount 5, alternativesLeft 0, today 2026-11-01, startDate 2026-11-20) for legal pairs;
   - guard edges: pendingCount 0 with submittedCount 1 gives I1, not T3 (0001 a); closeSubmissions with submittedCount 1 gives GUARD_FAILED; feasibleCount 3 gives T6>T7, 2 and 0 give T6>T8; alternativesLeft 0 gives T10 and 1 gives I4; T16 passes when today is the day before startDate and fails when today equals it;
   - T5 includes computeGroupProfile; no internal result ever includes an entry behaviour; T6>T7 actions are exactly [filterByHardConstraints, rankByGroupFit, saveRankedShortlist];
   - preferenceRevised gives PREFERENCES_LOCKED in each of the six locked states; a null feasibleCount for recommendationRequested throws.
   Then prove coverage: pnpm vitest run --project unit --coverage.enabled --coverage.include=packages/engine/src/trip-state.ts --coverage.thresholds.100

3. apps/api/src/trips/transition-trip.ts:
   transitionTrip(deps: { db, logger, clock: () => Date }, input: { tripId, event, actorUserId, feasibleCount?, alternativesLeft? })
   - One transaction. Select the trip with FOR UPDATE (drizzle .for("update")); missing gives AppError 404 NOT_FOUND "Trip not found."
   - Build the context inside the transaction: pendingCount = active members with submitted_at null; submittedCount = active members with submitted_at set; today = clock() formatted as YYYY-MM-DD in Asia/Kolkata (Intl.DateTimeFormat "en-CA" with timeZone "Asia/Kolkata"); startDate = trip.start_date; feasibleCount and alternativesLeft from the input or null.
   - Call nextState. A rejection throws AppError 409 with code ILLEGAL_TRANSITION (for ILLEGAL_EVENT), GUARD_FAILED, PREFERENCES_LOCKED or TRIP_CLOSED (for TERMINAL_STATE), and the engine's message. Add those four codes to ERROR_CODES.
   - External: update trip.status and updated_at. Every result, external or internal, inserts one trip_transition row (transition_id, event, from_status, to_status, actor_user_id).
   - Run the actions through ACTION_HANDLERS, a map with one entry for EVERY ActionName (use satisfies so a missing action fails the type-check). Implement excludeNonSubmitters now: set status excluded on active members whose submitted_at is null (0001 f). Every other handler is a named no-op that logs at debug "action <name> deferred to <sprint>": S1 for assignOrganiser, sendInvitations, updateProgress, notifyMembers, openSubmissionWindow and validateTripParameters; S2 for computeGroupProfile, reportConflict, filterByHardConstraints, rankByGroupFit, saveRankedShortlist and showEmptyShortlistDiagnostic; S3 for generateAndCostPackages, recomputeCost, hidePackage and lockPackage; S4 for assembleDayWisePlan, revalidate, archiveToTripHistory, requestRatings and releaseHolds.
   - Handlers run inside the transaction, so they must be fast and database-only. Slow work (language-model calls) happens in the calling service, outside the lock. Write that rule as a comment at the top of the file.
   - Return { transitionId, kind, from, to, actions }.
   - T1 is not handled here: creating a trip is an insert in Sprint 1's createTrip service, which records T1 the way the seed does.

4. POST /api/trips/:id/cancel in the users-groups module (RUNBOOK B3: T15 and T16), router, then service, then repository:
   - requireSession; :id must be a uuid (400 VALIDATION_ERROR with fields.id); the caller must be a member of the trip, otherwise 404 NOT_FOUND (do not reveal that the trip exists); a member who is not the organiser gets 403 FORBIDDEN "Only the organiser can cancel this trip."; then transitionTrip with cancelTrip; respond 200 { id, status }.

5. API tests (integration):
   - transition-trip.test.ts: T2 moves a draft trip and writes one trip_transition row; I1 leaves the status unchanged and still writes a row; T3b excludes the non-submitter; acceptance of a package (packageAccepted) on a trip in collecting_preferences gives 409 ILLEGAL_TRANSITION (the RUNBOOK A3 check); two concurrent inviteMembers calls on one draft trip give exactly one success, one 409 ILLEGAL_TRANSITION and exactly one T2 row (this proves the row lock).
   - trips cancel route tests: the organiser cancels a draft trip (200, cancelled, a T15 row); cancelling again gives 409 TRIP_CLOSED; a plain member gets 403; a signed-in non-member gets 404; a bad id gives 400; a finalised trip whose start date is tomorrow (by the injected clock) cancels through T16; one starting today gives 409 GUARD_FAILED.
   - Test setup may write trip.status directly to arrange a state. Application code never does (AGENTS.md rule 6).

6. Seed: after creating the demo trip, runSeed calls transitionTrip with inviteMembers (actor Asha) when the trip is still draft, so the demo trip sits in collecting_preferences with T1 and T2 recorded. Update run-seed.test.ts to expect that.

7. Scoring golden fixture (pure engine data; scoring itself is Sprint 2, R6):
   - packages/engine/src/scoring/golden.fixture.ts: the members, destinations, weights and expected values from docs/specs/scoring.md section 6.7, typed, with a comment pointing to the spec.
   - packages/engine/src/scoring/golden.test.ts: a self-check that recomputes mean, min, population sd and GFS from the fixture's member scores and matches the expected values within 1e-6, and that the GFS order is d1, d3, d2 while the mean order is d1, d2, d3. Add it.todo("memberScore reproduces the 6.7 member scores (S2, R6)") and it.todo("rankDestinations orders d1, d3, d2 (S2, R6)").

8. Docs: AGENTS.md design rule 6 becomes "Trip status changes only through transitionTrip() in apps/api/src/trips/transition-trip.ts, which uses nextState() in packages/engine/src/trip-state.ts: 18 external rows (T1 to T18 with T3b, T6 split into T6>T7 and T6>T8), 5 internal transitions (I1 to I5) and two terminal states (T19, T20); see docs/decisions/0001. Rejected events return 409; never update trip.status directly." AGENTS.md section 4 gains "src/trips/: the trip lifecycle shared by every module (transitionTrip)" under apps/api. docs/traceability.md: test files for R2, R11 and (fixture only) R6.

VERIFICATION
Paste the real output of:
  pnpm vitest run --project unit packages/engine/src/trip-state.test.ts
  pnpm vitest run --project unit --coverage.enabled --coverage.include=packages/engine/src/trip-state.ts --coverage.thresholds.100
  pnpm verify
  pnpm db:reset && pnpm db:seed           the demo trip ends in collecting_preferences
Then with pnpm dev running, sign in as asha@demo.bonvoyage.test through curl against http://localhost:5173/api/auth/sign-in/email (save the cookie jar), read the demo trip id from pnpm db:studio or psql, and call POST /api/trips/<id>/cancel twice: 200 then 409 TRIP_CLOSED. Run pnpm db:seed afterwards to restore the demo data (the cancelled trip stays; that is fine locally, or run pnpm db:reset first).
Report: the transition count by kind, the coverage numbers, any difference between the diagram and this table, deviations.

IF BLOCKED
- The diagram and this table disagree: follow the table and list the difference. Do not change docs/design.
- 100 per cent branch coverage is out of reach because of a defensive branch: remove the dead branch rather than excluding it from coverage, or explain why it must stay.
- drizzle's .for("update") is unavailable in the installed version: use a raw SELECT ... FOR UPDATE through the transaction and say so.
- The concurrency test is flaky: it must not be. Use two separate pool connections and await both promises with Promise.allSettled; if it still flakes, stop and report.
- Need a new table, column or event: stop and ask. A state-machine change needs a new decision record first.
```
