# S5-4: R18 voting on the shortlist (#28)

R18: "The system shall allow members to vote on the shortlisted destinations before a package is selected." Decision 0005 h keeps the organiser as the decision maker, so the vote informs the choice and never makes it. This prompt adds one vote per member per run, shows counts to everyone and each member's own vote to them, and models voting as an internal event with no state change.

**Branch:** `feat/28-voting-api`, then `feat/28-voting-web` · **Time box:** 2 x 2.5 hours · **Depends on:** S5-2b-1 merged (same screen and service) · **Issue:** #28 · **Migration:** one (the vote table) · **Cut:** first

```text
S5-4  R18 VOTING ON THE SHORTLIST
Branches: feat/28-voting-api, then feat/28-voting-web (from fresh master, after S5-2b-1 merged)
Time box: 2 x 2.5 hours
Issue: #28. Follow the Sprint 5 conventions (Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/sprints/sprint-5-plan.md (finding 1d, the voting design, decision E4: it overrides
anything below), docs/decisions/0001 (the transition table) and 0005 (h: the organiser decides),
packages/engine/src/trip-state.ts and its test (I1 to I5), packages/db/src/schema/
recommendations.ts and trips.ts, apps/api/src/recommendations (service, repository, test),
the destinationSelected path (T9) in apps/api/src/trips, apps/api/src/security (no-leak,
access-matrix), apps/api/src/test/endpoint-inventory.ts, apps/web/src/pages/Trips/shortlist,
docs/security/privacy.md, and S5-3's notifications module if it has merged.

GOAL
While a trip is shortlisted, each active member can cast and change one vote for a shortlisted
destination; everyone sees the count per destination and their own vote; the organiser sees the
same counts when choosing, and the choice is never gated or made by the vote.

DESIGN (the recommended E4; the plan's version wins if it differs)
- Table vote: id, run_id (recommendation_run, cascade), trip_member_id (trip member, cascade),
  destination_id, created_at, updated_at; unique (run_id, trip_member_id); a composite foreign key
  (run_id, destination_id) to recommendation_item (unique on those columns), so the database
  refuses a destination outside the run. Votes are deleted when a member is removed or excluded,
  as preferences are (privacy.md:48). Migration 0005 via pnpm db:generate.
- Event I6 voteCast: from shortlisted to shortlisted, guard "member is active", no actions. Add it
  to trip-state.ts, trip-state.test.ts and decision 0001's table with the date.
- Votes belong to the shortlisted run. A new run starts with no votes. On T10 (back to
  shortlisted) the same run's votes remain. After T9 voting closes (409 "Voting has closed").
- Visibility: counts per destination and the number of members who have voted ("3 of 5 voted");
  your own vote marked "Your vote". Never who voted for what, for anyone, including the organiser.
- Two-member trips (decision E4): show counts only once both members have voted; until then
  show "1 of 2 voted" without per-destination counts. privacy.md says plainly that once both have
  voted, each member can work out the other's vote (a vote is a choice made for the group, like
  the package opinions' counts, not a private preference).
- Endpoints: PUT /api/trips/:id/vote { destinationSlug } (create or change);
  DELETE /api/trips/:id/vote (withdraw); the shortlist GET response gains
  votes: { counts?: Record<slug, number>, voted: number, eligible: number, mine?: slug }.
- Web: on each shortlist card a "Vote for this" button (44 px, text label, aria-pressed for your
  vote), the count as text ("2 votes"), and the "N of M voted" line above the list. The organiser's
  choose button stays where it is, with the counts beside it.
- If S5-3 has merged: shortlist_ready's notification text adds "Vote for your favourite".

STEPS
0. Two PRs: part 1 the API (steps 1 to 5 and the migration; "Refs #28"), part 2 the web (steps 6
   to 8; "Closes #28").
1. Engine: I6 in trip-state.ts with tests (accepted only in shortlisted; rejected in every other
   state with the existing error shape).
2. DB, repository and service, inside transactions; T9 and a new run end voting as above.
3. endpoint-inventory.ts and access-matrix.test.ts (excluded members and non-members: 403 or 404
   as the existing rules say; organiser may vote as a member). Paste the counts.
4. no-leak.test.ts: no response, for any actor, pairs a member id, name or email with a
   destination in a vote context; two-member counts hidden until both voted.
5. Tests: cast, change, withdraw; a destination not in the run (400); voting after T9 (409); a
   new run resets; T10 keeps votes; the organiser can choose a destination with 0 votes.
6. Web tests for the card button, aria-pressed, counts text and the two-member wait state.
7. Demo: the shortlist screen changes. Update docs/demo/sprint-3-demo.md step 2 (add an optional
   "Meera votes for Chakrata" line only if the plan says so) and run-seed.test.ts if a quoted line
   moved (Q5, V6).
8. Traceability row R18: sprint S5, #28, tests. PR "feat: members vote on the shortlist (R18)",
   body "Closes #28", with the migration commands under "After merge (Maulik)".

VERIFICATION
Paste: the migration file name and number; endpoint and access-matrix counts; pnpm vitest run
--project unit packages/engine/src/trip-state.test.ts; pnpm vitest run --project integration
apps/api/src/recommendations apps/api/src/trips apps/api/src/security apps/api/src/seed
apps/api/src/e2e; pnpm vitest run --project web; a 360 px check of the shortlist; pnpm
format:check; pnpm lint; pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
Voting would need a new trip status, or the organiser's choice would have to read votes to work:
stop. Both break V4 or decision 0005 h.
```
