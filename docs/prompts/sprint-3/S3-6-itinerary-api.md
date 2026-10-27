# S3-6: Day-plan API: plan, read, accept, reject (T12 to T14)

The server side of R12 and R13: the organiser asks for a day plan; the engine plans it from catalogue facts, the model (if switched on) only rewrites the words, the validator checks everything, and the plan is stored as a new version. The organiser accepts it (the trip is finalised) or rejects it and plans again.

**Branch:** `feat/s3-6-itinerary-api` · **Time box:** 3 hours · **Depends on:** S3-3 merged · **Issue:** S3-6 · **Can run beside S3-4** in a worktree (this one uses db-test; S3-4 does not)

```text
S3-6  DAY-PLAN API: PLAN, READ, ACCEPT, REJECT (T12 TO T14)
Branch: feat/s3-6-itinerary-api   Time box: 3 hours   Issue: S3-6 (Sprint 3 milestone)

CONTEXT
Read AGENTS.md (6.2 and 11 above all), docs/prompts/sprint-3/README.md (P1 to P12),
docs/decisions/0005 (e, f, h), docs/spikes/S2-grounded-itinerary.md, the S3-2 engine exports
(planDays, buildFactSheet, unusedPlacesFitting), packages/engine/src/itinerary/validate.ts,
packages/integrations/src/llm (createLlmClient, FixtureLlmClient, GeminiLlmClient) and
src/itinerary/prompt.ts (buildItineraryPrompt, assertNoPersonalData), packages/shared/src/itinerary.ts,
the S3-3 packages module (inputs loader, accepted package), apps/api/src/env.ts (LIVE_APIS,
GEMINI_API_KEY, GEMINI_MODEL), apps/api/src/trips and the security tests.
State-machine rows: T12 (package_selected, generateItinerary, to itinerary_proposed, entry
assembleDayWisePlan), T13 (itinerary_proposed, itineraryRejected, to package_selected), T14
(itinerary_proposed, itineraryAccepted, to finalised, entry archiveToTripHistory).

GOAL
POST plans and stores a validated itinerary version atomically with T12; GET returns the latest
version to every member; accept and reject fire T14 and T13. With LIVE_APIS=off the plan uses the
templates; with LIVE_APIS=on the model writes only words and any failure falls back to the templates.

STEPS
1. Integrations (packages/integrations/src/itinerary/wording.ts):
   - ItineraryWording zod schema: { summary (max 600), reasons (1 to 5, each max 200), notes: [{ day,
     index, note (max 200) }] }.
   - composeItineraryWording(llm, factSheet, skeleton, { timeoutMs: 20000 }) builds the prompt from
     the fact sheet and the skeleton (times and places fixed; "write words only, no new numbers,
     times or places"), calls assertNoPersonalData on it, makes one call, parses with the schema, and
     returns { ok: true, wording, model } or { ok: false, reason }. Never throws to the caller.
   - FixtureLlmClient fixtures for: good wording; a note with an invented price; a malformed reply;
     a timeout (a fixture that never resolves within the timeout).
2. Shared (packages/shared/src/api/itinerary.ts): ItineraryItemView { id, day, position, start, end,
   kind, place: { key, name, category, entryFeeInr } | null, legId, note, verified,
   unverifiedReason }; ItineraryView { id, version, status, model, source: 'catalogue' | 'model',
   generatedAt, summary, reasons, legs (with "planned times" flag), days: [{ day, date, items }],
   packageLabel }; ItineraryResponse { itinerary: ItineraryView | null }. TripDetail gains
   latestItinerary: { version, status } | null.
3. apps/api/src/itinerary/ (service, repository; routes in apps/api/src/trips/router.ts):
   a) POST /api/trips/:id/itinerary (organiser, package_selected, body {}):
      - outside the lock (P7): load the accepted package, its legs (fare and car rows), the
        destination's active places, the group interests (activities chosen by 2 or more members);
        planDays, buildFactSheet, template notes; if LIVE_APIS=on, composeItineraryWording and
        merge each note by (day, index);
      - validateItinerary on the result; an item whose model note fails gets its template note back
        and is validated again; item verified = verdict and, for an activity, the place row verified;
        unverified_reason = the validator's reason or "This place's details are not verified yet.";
      - staleness: if the accepted package changed between compute and persist, 409
        ITINERARY_STALE "The package changed while planning. Try again.";
      - inside beforeDecide: insert itinerary (version = max + 1, status proposed, model =
        'catalogue-planner' or the model id used, summary, reasons) and its items; earlier versions
        that are proposed become superseded; then generateItinerary (T12);
      - one info log line: tripId, version, source, durationMs, itemCount, verifiedRatio; no member
        data, no prompt text;
      - 200 ItineraryResponse.
   b) GET /api/trips/:id/itinerary (any member, excluded included): the latest version, or null.
   c) POST /api/trips/:id/itinerary/accept (organiser, itinerary_proposed): itineraryAccepted (T14,
      finalised); itinerary accepted; returns TripDetail.
   d) POST /api/trips/:id/itinerary/reject (organiser, itinerary_proposed): itineraryRejected (T13,
      back to package_selected); itinerary rejected; returns TripDetail.
   e) tripActions planDays (organiser, package_selected), viewItinerary (any member once a version
      exists), acceptItinerary and rejectItinerary (organiser, itinerary_proposed).
      EVENT_SUMMARIES: "Asha planned the days (version 2)", "Asha accepted the day plan; the trip is
      finalised", "Asha asked for a new day plan".
   f) createApp deps gain llm (createLlmClient from env; tests inject a FixtureLlmClient).
4. Security: four routes in endpoint-inventory.ts and the access matrix; leak test: the itinerary
   response and the stored prompt contain no member name, email or budget (search the response and
   the fixture's recorded prompt).
5. Integration tests (apps/api/src/itinerary): templates path (LIVE_APIS off): T12, version 1, every
   item verified for an all-verified fixture destination, day count = nights + 1, onward and return
   legs present; model path with good wording: notes replaced, model id stored; injected price:
   only that item falls back and is still verified; malformed reply and timeout: whole plan on
   templates; a draft place gives verified false with the reason; reject then plan again gives
   version 2 and version 1 stays rejected; accept gives finalised; wrong states 409; member 403;
   staleness 409; speed: the real catalogue, templates path, under 2000 ms.
6. run-seed.test.ts stays green. Traceability R12 and R13. PR "feat: day-plan API", body starts
   "Closes #<S3-6>", with one trimmed ItineraryResponse (templates path).

VERIFICATION
Paste the real output of: pnpm vitest run --project integration apps/api/src/itinerary
apps/api/src/security apps/api/src/packages apps/api/src/seed ; pnpm vitest run --project unit
packages/integrations ; pnpm verify ; pnpm vercel-build && pnpm smoke:function ; the speed-test
time. Then pnpm db:reset && pnpm db:seed and pnpm dev with LIVE_APIS=off: Hills shortlist demo,
recommend, choose the first place, choose the Saver package, plan the days; paste the trimmed day
plan (day, start, end, kind, place, verified). Stop every dev server you start. Never print .env.

IF BLOCKED
The validator rejects a template plan from real data: report the code, day and place; do not loosen
the validator. The model client cannot honour a timeout: wrap it with Promise.race in
packages/integrations and say so. A 0005 rule does not fit the data: stop and ask.
```
