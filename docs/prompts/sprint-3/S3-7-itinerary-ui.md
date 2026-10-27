# S3-7: Day-plan screen, adjust (I5) and trip history

The screen that finishes the journey: the organiser plans the days, everyone reads the plan with what is verified and what is not, and the organiser accepts it (the trip is finalised), rejects it and plans again, or removes or swaps a place. The Trips page separates planning trips from past and finalised ones.

**Branch:** `feat/s3-7-itinerary-ui` · **Time box:** 3 hours · **Depends on:** S3-4 and S3-6 merged · **Issue:** S3-7 · **Cut first if Friday slips:** step 2 (Adjust, I5), per 0005 k

```text
S3-7  DAY-PLAN SCREEN, ADJUST (I5) AND TRIP HISTORY
Branch: feat/s3-7-itinerary-ui   Time box: 3 hours   Issue: S3-7 (Sprint 3 milestone)

CONTEXT
Read AGENTS.md, docs/prompts/sprint-3/README.md (P1 to P12), docs/decisions/0005 (e, f, h, i, k),
packages/shared/src/api/itinerary.ts (S3-6), apps/api/src/itinerary (S3-6), the S3-2 engine export
unusedPlacesFitting, the packages screen (S3-4) and the shortlist screens for patterns, the
dashboard and wording.ts, apps/web/src/pages/Trips/TripsPage.tsx, src/components/ui and
docs/wireframes.
State-machine row: I5 (itinerary_proposed, itineraryModified, action revalidate).

GOAL
/trips/:id/itinerary shows the day plan to every member with verified and unverified items, where
the words came from, and the organiser's Accept, Reject and Plan again; the organiser can remove or
swap an activity (I5); the dashboard runs from step 6 to step 7 and shows the finalised trip; the
Trips page shows "Planning" and "Past and finalised trips".

STEPS
1. Web (apps/web/src/features/itinerary/api.ts and apps/web/src/pages/Trips/itinerary/):
   - At package_selected the dashboard shows the organiser "Plan the days"; it calls POST and shows
     "Planning the days. This can take up to 30 seconds." with a spinner; on success it opens the
     itinerary page. Members see "Asha will plan the days next."
   - Itinerary page: "<Destination>: <dates>", "<Label> package · version <n>", a source line ("Planned
     from the BonVoyage catalogue" or "Written with <model> from catalogue facts"), "Travel times
     are planned, not a timetable.", the summary and reasons, then one section per day ("Day 1 ·
     Fri 27 Nov") with items: time range, kind as text ("Travel", "Check-in", "Visit", "Lunch",
     "Free time"), the place's name and category, "Entry ₹X per person" when it has a fee, the note,
     and a text badge "Verified" or "Not verified: <reason>". Every amount says "estimate".
   - Organiser at itinerary_proposed: "Accept this plan" (confirm "Accept this plan? The trip is
     finalised.") and "Reject and plan again" (confirm "Reject this plan? You can plan the days
     again."; after T13 the dashboard offers "Plan the days" again, which makes version n + 1).
   - Members see the plan read-only with "Waiting for Asha to accept the plan."
2. Adjust (I5), cut first if time runs short:
   - API: PATCH /api/trips/:id/itinerary/items/:itemId (organiser, itinerary_proposed) with
     { action: 'remove' } or { action: 'replace', placeKey }: replace only with a place returned by
     unusedPlacesFitting for that slot, else 422 PLACE_DOES_NOT_FIT; remove turns the item into
     free time; then revalidate the whole itinerary, recompute verified flags and fire
     itineraryModified (I5) with the update inside beforeDecide; returns ItineraryResponse.
     GET /api/trips/:id/itinerary/items/:itemId/alternatives (organiser) lists the fitting places.
     Both routes in endpoint-inventory.ts and the access matrix; integration tests for remove,
     replace, a place that does not fit (422), member 403 and wrong state 409.
   - Web: per activity, for the organiser, "Remove" and "Swap" (a list of alternatives with
     name, category and fee; choosing one saves).
3. Finalised: the dashboard at finalised reads "Trip finalised: <Destination>, <dates>, <Label>
   package, ₹X for the group (estimate)." with "See the day plan". Step 7 of 7.
4. Trips page: two sections, "Planning" (draft to itinerary_proposed) and "Past and finalised trips"
   (finalised, in_progress, completed, cancelled), each with its empty state (0005 i).
5. Tests: itinerary page rendering (days, badges, source line, verified and unverified items),
   organiser vs member actions, accept and reject confirm flows, the planning spinner, Adjust
   remove and swap flows, dashboard wording for steps 6 and 7, the Trips page sections; 360 px.
6. Screenshots at 360 px and desktop. Traceability R12 and R13. PR "feat: day-plan screen, adjust and
   trip history", body starts "Closes #<S3-7>".

VERIFICATION
Paste the real output of: pnpm vitest run --project web apps/web/src/pages/Trips
apps/web/src/features/itinerary ; pnpm vitest run --project integration apps/api/src/itinerary
apps/api/src/security ; pnpm verify. Then pnpm db:reset && pnpm db:seed and pnpm dev: run Hills
shortlist demo from recommendations to finalised in the browser and attach screenshots of the
packages page, the day plan and the finalised dashboard. Stop every dev server you start.

IF BLOCKED
The API lacks a field the screen needs: stop and say which; do not plan or validate in the browser.
Adjust does not fit in the time box: ship steps 1, 3, 4 and 5 without it, say so in the PR, and
leave I5 for Sprint 4 (0005 k).
```
