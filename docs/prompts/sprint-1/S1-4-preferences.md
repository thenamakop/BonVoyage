# S1-4: Preference form and profile (T3, I1, I2, T5)

The heart of Sprint 1: each member says what kind of place they want, what they want to do, the weather, their style, their budget and their dates. A submission drives the state machine (the last one moves the trip to ready for recommendation), and a small profile page records the home city and past trips that Sprint 2's scoring reads.

**Branch:** `feat/32-preferences` · **Time box:** 3 hours · **Depends on:** S1-3 merged · **Issue:** #32

```text
S1-4  PREFERENCE FORM AND PROFILE (T3, I1, I2, T5)
Branch: feat/32-preferences   Time box: 3 hours   Issue: #32

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions: follow them), docs/wireframes/05-preferences.svg, issue #32, docs/specs/scoring.md (what scoring reads from a preference and a past trip), docs/decisions/0001 (a: one submission alone never makes a trip ready; b: revisions lock once the shortlist exists), and SRS sections 3.1.3 and 3.3. S1-3 added beforeDecide to transitionTrip, the invitations and the roster.

The tables exist. preference (one per trip_member): destination_types, activities, climate (cold, mild, warm, any), travel_style (budget, comfort, premium), budget_min_inr, budget_max_inr, date_start, date_end. trip_member.submitted_at marks a submission. past_trip: user_id, destination_id or place_name, visited_on, rating 1 to 5. user_profile: home_hub_id. The vocabularies are in packages/shared/src/vocab.ts with labels.

The member's budget is per person for the whole trip (travel, stay, food and activities), unlike the trip's budget, which is the group total. Say so on the form.

GOAL
An active member fills in and later revises their preferences. The first submission records I1, or T3 when it is the last one needed; a revision records I2 while collecting or T5 when ready; once the shortlist exists, revisions are refused as locked. Each member sees and edits only their own answers. A profile page holds the home city and past trips.

STEPS
1. India date helper: move the "today in Asia/Kolkata as YYYY-MM-DD" code that transitionTrip uses into packages/shared/src/time.ts as indiaDate(date: Date): string, export it, and use it in transitionTrip, the API services and the web. Unit tests around midnight IST (18:29 and 18:31 UTC).

2. Shared contracts (packages/shared/src/api/preferences.ts and profile.ts, exported):
   - PreferenceInput: destinationTypes (DestinationType[], 1 to 10, unique), activities (Activity[], 1 to 14, unique), climate (ClimatePreference), travelStyle (TravelStyle), budgetMinInr (integer 0 to 10000000), budgetMaxInr (integer 1 to 10000000, refined to be >= budgetMinInr with the error on budgetMaxInr "Maximum must be at least the minimum."), dateStart and dateEnd (YYYY-MM-DD, refined dateEnd >= dateStart with the error on dateEnd). Messages are sentences, for example "Pick at least one kind of place."
   - Preference = PreferenceInput plus updatedAt. MyPreferenceResponse { preference: Preference | null, submittedAt: string | null }.
   - SavePreferenceResponse { preference, submittedAt, transition: { transitionId, kind, to } }.
   - ProfileResponse { homeHubSlug: string | null, pastTrips: PastTrip[] }, PastTrip { id, destination: { slug, name } | null, placeName: string | null, visitedOn: string | null, rating }. UpdateProfileInput { homeHubSlug: string | null }. AddPastTripInput { destinationSlug?, placeName? (1 to 80), visitedOn?, rating (1 to 5) } refined to need exactly one of destinationSlug and placeName. DestinationsResponse { destinations: { slug, name, state }[] }.

3. Preference endpoints (router, then service, then repository):
   - GET /api/trips/:id/preferences/me: loadTripForMember; returns only the caller's own preference as MyPreferenceResponse (null when none or when excluded).
   - PUT /api/trips/:id/preferences/me with PreferenceInput: loadTripForMember, requireActiveMember, then the server-only checks against the clock and the trip: dateStart >= indiaDate(clock()) (fields.dateStart "Choose a start date from today onwards."); the number of nights between dateStart and dateEnd >= trip.duration_nights (fields.dateEnd "Your dates must cover at least <n> nights for this trip."). Then transitionTrip with:
       event = preferenceRevised when the caller's submitted_at is set, else preferenceSubmitted;
       beforeDecide = upsert the preference row (by trip_member_id) and, on a first submission, set submitted_at to clock(). Because the hook runs before the guard context is built, the caller already counts as submitted, which is what makes the last submission fire T3.
     The engine then decides: I1 or T3 for a first submission in collecting_preferences; I2 for a revision there; T5 for a revision in ready_for_recommendation; PREFERENCES_LOCKED in the six locked states; ILLEGAL_TRANSITION in draft (preferences open only after the invite link exists) and in the terminal states (TRIP_CLOSED). Respond 200 SavePreferenceResponse.
   - Nothing else ever returns another member's preference values. The trip page shows only who has submitted (S1-6 tests this).

4. Profile endpoints:
   - GET /api/me/profile; PATCH /api/me/profile with UpdateProfileInput (upsert user_profile; an unknown slug gives 400 fields.homeHubSlug).
   - POST /api/me/past-trips with AddPastTripInput (unknown destinationSlug gives 400 fields.destinationSlug; visitedOn after today gives 400 fields.visitedOn); 201 PastTrip.
   - DELETE /api/me/past-trips/:id: only the caller's own rows (anything else is 404); 204.
   - GET /api/destinations: active destinations ordered by name, as DestinationsResponse.

5. API tests (integration), the rule 10 matrix plus the state-machine cases, each asserting the transition row written:
   - three active members, nobody submitted: the first submission gives I1 and the status stays; the third gives T3 and status ready_for_recommendation;
   - a trip whose only active member is the organiser: their submission gives I1, not T3 (0001 a);
   - a revision while collecting gives I2; a revision when ready gives T5 and the status stays ready_for_recommendation;
   - shortlisted (arrange with setTripStatus): 409 PREFERENCES_LOCKED and the stored preference is unchanged (the hook's write rolled back); draft: 409 ILLEGAL_TRANSITION and no preference row;
   - validation: fields.destinationTypes for an empty list, fields.budgetMaxInr for max < min, fields.dateStart for yesterday (injected clock), fields.dateEnd for a window shorter than the trip;
   - 401; 404 for a non-member; 403 for an excluded member;
   - member A's GET never returns member B's values;
   - profile: unknown hub 400; both destinationSlug and placeName 400; rating 6 400; deleting another user's past trip 404.

6. Web data hooks: src/features/preferences/api.ts (useMyPreference on ["trip", id, "preference"]; useSavePreference invalidates it and ["trip", id]) and src/features/profile/api.ts (useProfile on ["me", "profile"], useUpdateProfile invalidates ["me"] too, useAddPastTrip, useDeletePastTrip, useDestinations on ["destinations"]).

7. /trips/:id/preferences (wireframe 05), linked from the trip page as "Your preferences" ("Edit your preferences" once submitted):
   - ChipGroup for destination types and for activities (labels from vocab.ts); RadioGroup for climate (cold, mild, warm, any) and travel style (each with a one-line description); budget minimum and maximum in rupees with the helper "Per person, for the whole trip: travel, stay, food and activities." and a context line "The group budget is ₹48,000, about ₹16,000 each for 3 travellers." (group total divided by active members, rounded down to the nearest 500, marked "about"); date inputs (type="date", min = today in India) with the helper "The days you could travel. The trip needs <n> nights."
   - Prefill from useMyPreference. Check with PreferenceInput before sending and map server fields onto the same inputs; keep every value on any error.
   - Draft: an info Alert "Preferences open once the organiser creates the invite link." instead of the form. Excluded: an info Alert, no form. Locked statuses: a warning Alert "Preferences are locked because the shortlist has been made." and the saved answers shown in a disabled fieldset.
   - After saving: a success Alert whose wording follows transition.kind and to: "Saved." (I1 or I2), "Saved. Everyone has submitted, so the trip is ready for recommendations." (T3), "Saved. The group profile will be recalculated." (T5). Then a link back to the trip.

8. /me profile page (linked as "Your profile" in the user menu): name and email (read-only), home city (Select from useHubs with a Save button and a "Saved" status message), past trips (list with destination or place name, visited date when present, "Rated 4 out of 5" in words, and a Remove button), and an "Add a past trip" form: destination Select from useDestinations with a final option "Somewhere else" that reveals a place name TextField, optional visited date, and rating as a RadioGroup 1 to 5. S1-2's trip form already preselects the home city.

9. Web tests: no destination type shows "Pick at least one kind of place." and sends nothing; max below min shows the message on the maximum field; a T3 response shows the ready message; the draft state shows the info alert; a locked status disables the fieldset; the profile's "Somewhere else" option reveals the place name field.

10. docs/traceability.md: test files on R3 (and R10 for the own-preference-only test). Pull request "feat: preference form and profile (T3, I1, I2, T5)", body starting "Closes #32", with 360 px and desktop screenshots of the form (empty, with errors, saved), the locked state and /me.

VERIFICATION
Paste the real output of:
  pnpm vitest run --project unit
  pnpm vitest run --project integration apps/api/src/preferences apps/api/src/profile
  pnpm vitest run --project web
  pnpm verify
Then pnpm db:reset && pnpm db:seed and pnpm dev. The demo trip is collecting preferences with Asha and Rohan submitted and Meera pending:
  - as meera, open the demo trip, fill in the form and submit: "Everyone has submitted" and the trip status becomes Ready for recommendation;
  - as rohan, change his budget maximum: "The group profile will be recalculated";
  - as rohan, set a maximum below the minimum: the message appears under the maximum and nothing is saved;
  - as kabir on /me: set home city Delhi, add a past trip to Rishikesh rated 4, remove it.
Paste the trip_transition rows of the demo trip (T1, T2, T3, T5).
Report: endpoints, the transitions observed, deviations.

IF BLOCKED
- The guard context is built before beforeDecide runs in your transitionTrip: move the context building after the hook, as S1-3 specified, and say so.
- A submission in draft should be allowed: no. The state machine opens preferences at T2; the organiser creates the link first.
- Scoring needs a field the form does not collect: stop and tell me. Do not add columns.
- The date input looks different across browsers: keep the native input; do not add a date-picker library.
```
