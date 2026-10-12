# S1-2: Create, list and edit trips (T1)

The first real feature: an organiser creates a trip from a starting city, a number of nights, a group budget and a search radius, sees it in a list, opens it and edits it while it is still a draft. It also creates the access helper and test helpers that every later Sprint 1 prompt reuses, so take the extra care here.

**Branch:** `feat/30-create-trip` · **Time box:** 3 hours · **Depends on:** S1-1 merged · **Issue:** #30

```text
S1-2  CREATE, LIST, VIEW AND EDIT TRIPS (T1)
Branch: feat/30-create-trip   Time box: 3 hours   Issue: #30

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions: follow them), docs/wireframes 02-trips.svg and 03-trip-new.svg, issue #30 (gh issue view 30), docs/decisions/0001 and 0003, and SRS Table 5 (trip parameters). Look at how POST /api/trips/:id/cancel is built (router, service, repository, its tests) and at transitionTrip: this task follows the same layering. S1-1 gave the web app its UI kit in src/components/ui, useMe, RequireAuth and a placeholder /trips page.

The trip table exists: title (1 to 120), organiser_id, origin_hub_id, duration_nights (1 to 14), budget_total_inr (> 0), radius_km (> 0), status (default draft), start_date and end_date (null until a package is chosen). budget_total_inr is the whole group's budget for the whole trip. A trip is created with status draft and a T1 transition row; T1 is the one transition that happens outside transitionTrip (conventions rule 5).

GOAL
A signed-in user creates a trip at /trips/new and lands on /trips/:id; /trips lists every trip they belong to; the organiser can edit a draft trip; nobody else can see a trip they do not belong to. The API has the trip contracts, the access helper and the test helpers the rest of Sprint 1 builds on.

STEPS
1. Shared contracts in packages/shared/src/api/trips.ts (export from the index):
   - HubSummary { slug, name, state }; HubsResponse { hubs: HubSummary[] }.
   - CreateTripInput: title (trimmed, 1 to 120), originHubSlug (non-empty), durationNights (integer 1 to 14), budgetTotalInr (integer 1000 to 10000000), radiusKm (integer 50 to 1500). Messages are sentences, for example "Choose between 1 and 14 nights."
   - UpdateTripInput: CreateTripInput.partial() refined to need at least one field.
   - TripMember { userId, name, role, status, submitted: boolean, joinedAt }. Never include email: members see each other's names only.
   - TripDetail { id, title, status, originHub: HubSummary, durationNights, budgetTotalInr, radiusKm, startDate: string | null, endDate: string | null, organiser: { userId, name }, members: TripMember[], myRole, myStatus, legalEvents: TripEvent[], createdAt, updatedAt }. legalEvents comes from legalEvents(status) in the engine; the web uses it to decide which buttons exist.
   - TripSummary { id, title, status, originHub: HubSummary, durationNights, budgetTotalInr, memberCount (active members), myRole, updatedAt }; TripsResponse { trips: TripSummary[] }.
   - TRIP_STATUS_LABELS: for each of the 11 statuses, { label, explanation }, for example collecting_preferences gives { label: "Collecting preferences", explanation: "Members are filling in what they want from the trip." }. Unit test: every status has both, in British English.
   - Add TRIP_NOT_EDITABLE to ERROR_CODES.

2. apps/api/src/trips/access.ts:
   - parseTripId(value): a uuid or AppError 400 VALIDATION_ERROR with fields.id.
   - loadTripForMember(db, tripId, userId): returns { trip, membership } where membership is the caller's trip_member row (active or excluded); a missing trip or a non-member throws 404 NOT_FOUND "Trip not found." (the same message for both).
   - requireOrganiser(membership): 403 FORBIDDEN "Only the organiser can do this." unless role is organiser.
   - requireActiveMember(membership): 403 FORBIDDEN "You were removed from this trip, so you can only view it." when status is excluded.
   - Refactor the cancel route to use these (its tests must still pass unchanged).
   - Unit or integration tests for each function.

3. Test helpers in apps/api/src/test/ (create or extend what exists): createTestUser(name) returns a supertest agent with a signed-in session (Host localhost:5173 and Origin http://localhost:5173, as the auth tests do) plus the user id; ensureHub(db, slug) inserts a hub if missing; createTripAs(agent, overrides) posts a valid trip and returns the TripDetail; setTripStatus(db, tripId, status) for arranging states in tests only (AGENTS.md rule 6 allows test setup to write status). Later prompts reuse these, so give them clear names and JSDoc.

4. Endpoints (router, then service, then repository; every response parsed with its shared schema in tests):
   - GET /api/hubs: all hubs ordered by name, as HubsResponse. Session required.
   - POST /api/trips with CreateTripInput, 201 TripDetail. Service createTrip(deps, userId, input), in one transaction: resolve the hub by slug (unknown gives 400 VALIDATION_ERROR with fields.originHubSlug "Choose a starting city from the list."); call nextState("initial", "createTrip", ctx) and use its "to" as the status (it must be external; anything else is a bug, so throw); insert the trip; insert the organiser's trip_member row (role organiser, status active); insert the trip_transition row (T1, createTrip, from null, to draft, actor the user).
   - GET /api/me/trips: the caller's trips (active or excluded membership) as TripsResponse, newest updated first.
   - GET /api/trips/:id: loadTripForMember, then TripDetail.
   - PATCH /api/trips/:id with UpdateTripInput: loadTripForMember, requireActiveMember, requireOrganiser; the trip must be draft, otherwise 409 TRIP_NOT_EDITABLE "Trip details can be changed only before anyone is invited."; update the given fields and updated_at; return TripDetail. Read the status inside a transaction with the row locked (FOR UPDATE) so an edit cannot race an invitation.

5. API tests (integration), the conventions rule 10 matrix:
   - POST: 201 with status draft, one organiser member and exactly one T1 row; 400 with fields.title for an empty title, fields.durationNights for 15, fields.budgetTotalInr for 999, fields.originHubSlug for an unknown hub; 401 without a session.
   - GET /api/me/trips: lists only the caller's trips; another user's trip never appears.
   - GET /api/trips/:id: 200 for a member; 404 for a signed-in non-member; 400 for "not-a-uuid"; 401.
   - PATCH: 200 for the organiser on a draft; 403 for a member; 404 for a non-member; 409 TRIP_NOT_EDITABLE once the trip is collecting_preferences; 400 for an empty body.
   - GET /api/hubs: 200 with the hubs in the test database; 401.

6. Web data hooks in src/features/trips/api.ts: useHubs (["hubs"], staleTime 1 hour), useMyTrips (["trips"]), useTrip(id) (["trip", id]), useCreateTrip (on success set ["trip", id] and invalidate ["trips"]), useUpdateTrip (invalidate ["trip", id] and ["trips"]).

7. Web pages (all inside RequireAuth):
   - /trips (replace the placeholder; wireframe 02): PageHeader "Your trips" with a "New trip" ButtonLink; a Card per trip linking to /trips/:id with title, origin, nights, a Badge with the status label, member count and an "Organiser" tag when myRole is organiser; skeleton while loading; EmptyState "No trips yet" with the create button; error Alert with Retry.
   - /trips/new (wireframe 03): a TripForm component (src/pages/Trips/TripForm.tsx, reused by edit) with title, origin hub (Select from useHubs, preselecting the user's homeHubSlug when set), nights, group budget in rupees (helper "Total for the whole group, for the whole trip" and a live line such as "₹48,000 for the group" from formatInr), search radius in km (helper "How far from your starting city you are willing to travel by road"). Use inputMode="numeric" for numbers and treat an empty box as missing, not 0. Check with CreateTripInput before sending; map server fields onto the same inputs; keep every typed value on any error. Success navigates to /trips/:id.
   - /trips/:id: a simple trip page for now (S1-5 turns it into the dashboard): PageHeader with the title and a status Badge, the status explanation, the parameters (budget shown as the group total), the member list with roles, and an "Edit details" ButtonLink only when myRole is organiser and the status is draft. A 404 shows EmptyState "Trip not found" with a link to /trips.
   - /trips/:id/edit: TripForm prefilled; if the caller is not the organiser or the trip is not draft, show an info Alert explaining why plus a link back instead of the form; a 409 TRIP_NOT_EDITABLE on save shows the server message.

8. Web tests: TripForm shows "Choose between 1 and 14 nights." for 15 and sends nothing; a valid create navigates to /trips/<id>; a server 400 with fields.radiusKm shows under the radius input while the other values stay; TripsPage shows the empty state and a list.

9. docs/traceability.md: the new test files on R2 and R9. Pull request "feat: create, list and edit trips (T1)", body starting "Closes #30", with 360 px and desktop screenshots of /trips (empty and with trips), /trips/new with an error, and /trips/:id.

VERIFICATION
Paste the real output of:
  pnpm test:unit
  pnpm vitest run --project integration apps/api/src/trips
  pnpm vitest run --project web
  pnpm verify
Then with pnpm dev, signed in as kabir@demo.bonvoyage.test (he has no trips): /trips shows the empty state; create "Test weekend" from Delhi, 2 nights, ₹30,000, 300 km; you land on its page with status "Draft"; edit the budget to ₹36,000; /trips lists it. In psql or pnpm db:studio: one trip_transition row T1 for it. Sign in as rohan in another browser profile and open the same /trips/<id> URL: "Trip not found". Paste the T1 row.
Report: endpoints added, helper names, deviations.

IF BLOCKED
- nextState("initial", "createTrip") needs a GuardContext: pass zeros and nulls (T1 has no guard).
- The cancel route tests break after the access refactor: fix the refactor, not the tests.
- You want to store the per-person budget or the members' emails: do not. Per person is computed for display; emails stay private.
- Anything needs a migration: stop and ask.
```
