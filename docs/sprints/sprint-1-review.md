# Sprint 1 review (early, 13 October 2026)

**Result: provisional pass.** Every item that could be checked today passes: R1, R2, R3, R6, R10 and R11 pass, and R12 is recorded approximately, from PR times.
- **Pending Maulik:** R4, R5, R7 and R9 need his production walkthrough. They are pending, not failed, and this review stays a draft until they are filled in.
- **In progress:** R8, because catalogue stage A is due on Sunday 18 October.
- **Spill issues:** none.
- **Not closed yet:** issue #37 (catalogue stage A) and the Sprint 1 milestone stay open until Sunday.

This is an early review: S1-1 to S1-8 (#29 to #36) are merged; #37 is not judged yet.

## Review items

| Item | Check | Evidence | Result | Follow-up issue |
| --- | --- | --- | --- | --- |
| R1 | #29 to #36 closed by merged PRs, every acceptance criterion met | `gh issue view` for 29 to 36: all `CLOSED`, closed by #48, #49, #50, #52, #53, #55, #56 and #47. All 36 criteria have evidence below; two are met as their prompts scoped them (#31 T2, #36 desktop), and one waits on R7 (#29 phone session). | pass (one criterion pending Maulik) | — |
| R2 | Fresh clone installs, migrates, seeds, verifies; CI green on master | Throwaway clone of master at `6321df0` with fresh secrets: `pnpm install --frozen-lockfile` done in 6.9 s; `db:up` healthy; `db:migrate` ok; `db:seed` → trip 1, trip_member 3, trip_transition 4, preference 2; `pnpm verify` → 58 files, **466 passed + 2 todo**, build ok, exit 0. Clone deleted. `gh run list --branch master`: the last 3 runs are green. The #52 merge run failed on `cancel.test.ts` "a finalised trip starting tomorrow cancels through T16": a UTC "tomorrow" equals India's "today" after 18:30 UTC. It was fixed in #53 (`2bbe931`). | pass | — |
| R3 | Production health; no pending Neon migrations | `curl -s https://bonvoyage-orpin.vercel.app/api/health` → `{"status":"ok","db":"ok"}` HTTP 200 in 0.25 s. `pnpm db:migrate:remote --target preview --status` → recorded 1, pending 0; `--target production --status` → recorded 1, pending 0 (Postgres 18.6). | pass | — |
| R4 | Sprint 1 journey on production | Maulik's walkthrough (hand-over a to h) | pending Maulik | — |
| R5 | SRS 3.3: dashboard updates within 10 s on production | Locally, three runs measured 9.4 s each at the old 10 s interval (PR #53). The poll is now 8 s (`refetchInterval` 8000). Production needs two devices (hand-over b). | pending Maulik | — |
| R6 | Access matrix, leak and log tests pass; every route in the inventory | `pnpm vitest run --project integration apps/api/src/security` → 5 files, **44 passed**; the access matrix is 26 endpoints × 6 actors (156 cases): anonymous 2×200 24×401; nonMember 9×200 2×201 2×403 13×404; member 13×200 2×201 1×204 9×403 1×404; excludedMember 11×200 2×201 11×403 1×404 1×409; organiser 16×200 2×201 3×204 2×403 2×409 1×422; admin 11×200 2×201 13×404. `routes.test.ts` checks that the registered routes match the 26-route inventory exactly. | pass | — |
| R7 | Spike S4 phone session recorded in docs/spikes | `docs/spikes/S4-deploy-and-sessions.md` still says the phone check "moves to Sprint 1 issue 1". PR #48 handed it over ("Android, Chrome: sign up, reload, reopen after 10 min"), but no result is committed. | pending Maulik | — |
| R8 | `catalogue:check --require a` passes; production holds verified stage A | `pnpm catalogue:check --require a` → exit 1 (`hub "delhi" is still draft`, …), as expected while stage A runs. `pnpm catalogue:check` → **Stage A 0/50**, Stage B 0/253, Stage C 0/21; 0 errors, 42 warnings, 1 info. | in progress: 0/50, due Sun 18 Oct | — (not a fail; #37 stays open) |
| R9 | Keyboard-only journey; Lighthouse accessibility ≥ 90 on three pages | Maulik's checks (hand-over e and f) | pending Maulik | — |
| R10 | Traceability lists Sprint 1 test files on R1, R2, R3, R9, R10, R11 and the wireframes | `git diff --stat a9e3b90 HEAD -- docs/traceability.md` → 14 lines changed; each of R1, R2, R3, R9, R10 and R11 names its Sprint 1 test files (for example R10: the five `apps/api/src/security/*.test.ts` files); "Wireframes: docs/wireframes/README.md" present. All 44 test paths it names exist. | pass | — |
| R11 | No key, connection string or .env in history | `git log --all -- .env .env.neon` → empty. The pattern scan prints **2**: both are fixtures in `packages/db/src/remote.test.ts` (commit `ad586f0`) with user `u`, a 1-character password and host `ep-fake-123…neon.tech`. These are not credentials. No `AIza…` or `AQ.…` key anywhere. | pass (2 fake fixtures) | — |
| R12 | Actual hours per prompt against the time boxes | Approximate, from PR times (previous merge → this merge); see Velocity. Maulik can correct. | recorded (approximate) | — |

## Acceptance criteria per issue

**#29 Sign-up, sign-in and sign-out (PR #48)**
- Sign-up rejects a password under 12 characters: `SignUpPage.test.tsx` "rejects a short password without sending anything"; `SignUpInput` has `password.min(12)`.
- A registered user can sign in and sign out: `auth.test.ts` "signs up, then GET /api/me returns the user" and "after sign out GET /api/me is 401 with the UNAUTHENTICATED envelope"; `SignInPage.test.tsx`; `UserMenu.test.tsx` "opens, calls signOut and clears the cache".
- Protected API routes reject an unauthenticated request: the access matrix gives anonymous 401 on all 24 non-public routes.
- The session survives a reload on a preview in Chrome on Android: **pending Maulik** (R7, hand-over g).

**#30 Create a trip, T1 (PR #49)**
- An organiser can create a trip from a curated hub: `trips.test.ts` "201: creates a draft trip with one organiser member and one T1 row" and "400 fields.originHubSlug for an unknown hub".
- Duration, budget and radius reject zero or negative values against the field: `packages/shared/src/api/trips.test.ts` `CreateTripInput` rejects `durationNights: 0`, `budgetTotalInr: -1`, `radiusKm: 0`, each on its own field; `trips.test.ts` 400s carry `fields.durationNights` and `fields.budgetTotalInr`.
- T1 goes through the state machine: `createTrip` calls `nextState('initial', 'createTrip')` and writes the T1 row in the same transaction (the same 201 test).
- The organiser and parameters are persisted: `trips.test.ts` "200 for a member" reads them back.

**#31 Invitation link, join, roster (PR #50)**
- The organiser can create a link: `invitations.test.ts` "201 in draft: one T2 row, trip collecting; a second POST returns the same token".
- An invitee can join through an active link: "200 joins as an active member; accepting again is idempotent"; the S1-3 manual run.
- Joining records T2: **met as RUNBOOK B2 and S1-3 define it.** T2 (`inviteMembers`) fires when the organiser creates the first link; joining is not a state-machine event. The issue's wording differs.
- A duplicate join creates no second roster entry: the same idempotent test asserts one row.
- The dashboard shows the updated roster: `TripPage.test.tsx` roster tests; the S1-3 and S1-5 manual runs.

**#32 Preference form, T3 or I1 (PR #52)**
- Minimum above maximum is rejected against the field: `preferences.test.ts` "400 fields.budgetMaxInr for a maximum below the minimum"; `PreferencesPage.test.tsx` "max below min".
- A date window in the past or with start after end is rejected: "400 fields.dateStart for a start date before today in India"; `shared/src/api/preferences.test.ts` puts a reversed window on `dateEnd`.
- A profile is stored only for its submitting member: "member A never receives member B's values, here or on the trip page"; `no-leak.test.ts`.
- T3 when the last required member submits, otherwise I1: "three members: the first submission is I1, the third is T3"; "a lone organiser submitting gives I1, not T3 (0001 a)".

**#33 Dashboard, 8-second poll (PR #53)**
- Every member's submission status shows: `Roster` shows "Submitted" or "Waiting" in words; the S1-5 screenshots.
- It polls every 8 seconds: `TripDashboard.test.tsx` "polls every 8 s, announces a status change, and reloads activity only when it moves" (no refetch at 7.999 s, one at 8 s). The production time is **pending Maulik** (R5).
- A changed status appears without a reload: the same test, plus the announcer; three local two-browser runs at 9.4 s.
- Usable at 360 px: the S1-5 screenshots at 360 px; the scripted runs found no horizontal scroll.

**#34 Access rules (PR #55)**
- An owner reads their own profile: the access matrix (GET preferences/me 200 for members); `preferences.test.ts` own-answers test.
- Another member cannot read it: no endpoint returns another member's preference; `no-leak.test.ts` searches every GET for other users' budgets.
- The group reads only aggregates: in Sprint 1 the group sees names, roles, statuses and the submitted flag only (`no-leak.test.ts` asserts the member keys). The aggregate group profile itself (R4) arrives in Sprint 2.
- An unauthenticated request is rejected: the matrix gives anonymous 401.
- Integration tests cover allowed and forbidden access: 156 matrix cases.

**#35 Administrator catalogue re-import (PR #56)**
- Only an administrator can import: `admin.test.ts` "anonymous 401, a signed-in non-administrator 403, the administrator 200"; the matrix admin column.
- A non-administrator gets 403 "Only administrators can do this.": the same test.
- Rows are validated before persistence: "a bad destinations header is 422 CATALOGUE_INVALID with an issue on line 1"; "an out-of-range latitude is reported with its line number".
- Repeated imports cause no duplicates: "re-importing the same files changes nothing: 0 inserted, 0 updated"; `packages/db/test/catalogue-import.test.ts`.
- The response reports inserted and updated counts: `CatalogueImportResponse.counts`; the S1-7 manual run (edited copy → destinations 1 updated).

**#36 Wireframes (PR #47)**
- The dashboard and preference form are covered: `05-preferences.svg`, `06-dashboard.svg`, `06-dashboard-desktop.svg`.
- Shortlist, packages and itinerary are covered: `07-shortlist.svg`, `08-shortlist-empty.svg`, `09-packages*.svg`, `10-itinerary*.svg`.
- Every screen at 360 px and desktop: **met as S1-8 scoped it.** Every screen exists at 360 × 780, and desktop versions exist for the three data-heavy screens (dashboard, packages, itinerary). The preference form and shortlist have no desktop wireframe; the built preference page was screenshotted at desktop in PR #52.
- Costs show group and per-person estimates; meaning is not shown by colour alone: wireframes README design notes; 06 shows "₹48,000 · about ₹16,000 each".

## What was built

- #47 docs: wireframes for the BonVoyage screens (S1-8)
- #48 feat: app shell, UI kit and sign-in screens (S1-1)
- #49 feat: create, list and edit trips, T1 (S1-2)
- #50 feat: invitation link, join flow and roster, T2 (S1-3)
- #51 Update project description to include AI component (manual edit)
- #52 feat: preference form and profile, T3, I1, I2, T5 (S1-4)
- #53 feat: live trip dashboard and close submissions, T3b (S1-5)
- #55 feat: access matrix, leak tests and JSON-only writes (S1-6)
- #56 feat: administrator catalogue re-import (S1-7)

## Inventory for Sprint 2

**Endpoints** (`apps/api/src/test/endpoint-inventory.ts`, 26; `routes.test.ts` keeps it equal to the registered routes):

| Method and path | Access |
| --- | --- |
| GET /api/health | public |
| GET /api/invitations/:token | public |
| GET /api/me | session |
| GET /api/me/trips | session |
| GET, PATCH /api/me/profile | session |
| POST /api/me/past-trips | session |
| DELETE /api/me/past-trips/:id | owner |
| GET /api/hubs | session |
| GET /api/destinations | session |
| POST /api/trips | session |
| POST /api/invitations/:token/accept | session |
| GET /api/trips/:id | member (removed members too) |
| GET /api/trips/:id/activity | member |
| GET /api/trips/:id/preferences/me | member |
| PUT /api/trips/:id/preferences/me | activeMember |
| DELETE /api/trips/:id/members/me | activeMember |
| PATCH /api/trips/:id | organiser |
| POST /api/trips/:id/cancel | organiser |
| POST /api/trips/:id/close-submissions | organiser |
| POST /api/trips/:id/invitations | organiser |
| GET, DELETE /api/trips/:id/invitations/active | organiser |
| DELETE /api/trips/:id/members/:userId | organiser |
| GET /api/admin/catalogue/status | admin |
| POST /api/admin/catalogue/import | admin |

All POST, PUT and PATCH routes need `Content-Type: application/json`, otherwise 415. That check runs before the session check, and body-less writes send `{}`.

**Shared contracts** (`packages/shared/src`): `api/auth.ts`, `api/trips.ts` (TripDetail with progress, availableActions, lastActivityAt; ActivityResponse; EVENT_SUMMARIES), `api/invitations.ts`, `api/preferences.ts`, `api/profile.ts`, `api/admin.ts`, and `time.ts` (`indiaDate`, `nightsBetween`).

**UI components** (`apps/web/src/components/ui`): Alert, Badge, Button and ButtonLink, Card, ChipGroup, EmptyState, PageHeader, RadioGroup (options can carry a description), Select, Skeleton, Spinner, TextField (`hint` accepts a node).

**Error codes added in Sprint 1:** TRIP_NOT_EDITABLE, INVITATIONS_CLOSED, INVITATION_EXPIRED, TRIP_FULL, MEMBER_EXCLUDED, CANNOT_REMOVE_ORGANISER, ORGANISER_CANNOT_LEAVE, TRIP_LOCKED, UNSUPPORTED_MEDIA_TYPE, CATALOGUE_INVALID. The error envelope also gained an optional `details`.

**`createApp` deps:** `db`, `pool`, `logger` and `auth`, plus the optional `clock` (tests inject time) and `adminEmails` (from `ADMIN_EMAILS`, lowercased).

**Test helpers** (`apps/api/src/test/helpers.ts`): `createTestUser(app, name, email?)`, `ensureHub(db, slug)`, `createTripAs(agent, overrides)` and `setTripStatus(db, tripId, status)` (test setup only). The web tests share `apps/web/src/test/trip-fixture.ts`, which builds a full TripDetail.

**Layout:**
- **Feature folders:** `apps/api/src/<area>/` each have a router, service and repository: trips, invitations, preferences, profile and admin.
- **Trip-scoped routes:** all registered in `trips/router.ts`.
- **State changes:** `transitionTrip` is the only path that changes status. Its `beforeDecide` hook runs after the row lock and before the guard context is built.
- **Dashboard polling:** `useTrip(id, { live: true })` polls every 8 s, only on the dashboard and only while the tab is visible, and stops for cancelled or completed trips. The activity list reloads only when `lastActivityAt` moves.

## Deviations and decisions

- **T2 timing:** T2 fires when the organiser creates the first invitation link, not when someone joins; joining, leaving and removal are roster changes, not events (S1-3).
- **Double-clicked submission:** decided under the trip lock. A second click that finds the member already submitted is retried once as a revision, so the last member's double click gives T3 and then T5 (S1-4).
- **Wording:** counts say "members" throughout, for example "3 of 8 members" and "2 of 3 members have submitted".
- **Dashboard polling:** the poll changed from 10 s to 8 s after S1-5, so one interval plus the request stays within 10 s. ADR-003 was amended, and issue #33 and the RUNBOOK were updated.
- **Polling scope:** only the dashboard polls (`{ live: true }`); the preference and edit pages share the query without polling.
- **415 before 401:** JSON-only writes return 415 before the session check (S1-6).
- **Request logs:** they carry the id, method, path, status and user id only; bodies and headers are never serialised (S1-6).
- **Referrer policy:** `same-origin` on the SPA (meta tag and a Vercel headers route); the API keeps helmet's `no-referrer`.
- **Seed:** it follows the state machine (T1, T2, then an I1 per submission), with preference dates relative to today (S1-6 part A).
- **Catalogue counts:** `importParsedCatalogue` counts updated rows as rows whose values changed, and rewrites a row only then. `pnpm catalogue:import` keeps its old count, so its output is unchanged (S1-7).
- **Account deletion:** deferred to issue #54 (Sprint 2).
- **Fixed during the sprint:** sign-in and sign-up now honour `next` once a session appears (S1-3). The evening T16 test failure was fixed (S1-5). The 12 lint warnings are down to 0 (S1-6).

## Known gaps

- Joins, leaves and removals are not state-machine events, so they write no activity row.
- Removing the last pending member does not advance the trip; the organiser uses Close submissions.
- `past_trip.place_name` is NOT NULL, so a catalogue pick also stores the destination's name. Make it nullable at the next migration.
- The group-profile aggregate (R4) does not exist yet; the group sees only names and submitted flags.
- Lint warnings left: none (`pnpm lint` → 0 problems).

## To finish on Sunday (18 October)

- Catalogue stage A: `pnpm catalogue:check --require a` must pass (it is 0/50 today).
- Import the verified rows into preview and production (`pnpm catalogue:import --target …` or `/admin/catalogue` once `ADMIN_EMAILS` is set in Vercel).
- Re-check R8 and record the production stage A line; then close #37 and the Sprint 1 milestone.
- Fill in R4, R5, R7 and R9 from Maulik's walkthrough.

## Velocity

Approximate, from PR times: each figure runs from the previous PR's merge to this PR's merge on 12 October (UTC). It includes reading, waiting and Maulik's checks, and excludes catalogue work. Maulik can correct these.

| Prompt | PR | Time box | Approx. hours |
| --- | --- | --- | --- |
| S1-8 wireframes | #47 | 1.5 h | 1.3 h |
| S1-1 app shell and sign-in | #48 | 3 h | 0.5 h |
| S1-2 create trips | #49 | 3 h | 0.6 h |
| S1-3 invitations | #50 | 2.5 h | 0.6 h |
| S1-4 preferences | #52 | 3 h | 0.8 h |
| S1-5 dashboard | #53 | 2.5 h | 0.9 h |
| S1-6 access matrix | #55 | 2 h + 20 min | 2.4 h |
| S1-7 admin catalogue | #56 | 2 h | 1.2 h |
| **Total** | | **19.8 h** | **about 8.3 h** |

Catalogue stage A (#37, about 1 h a day) is not included.

## Top three risks for Sprint 2

1. **Scoring correctness against the golden fixture.**
   - Owner: Maulik.
   - Why it matters: `memberScore` and `rankDestinations` turn two `it.todo` tests into real ones; a wrong weight or a missed past-trip rule changes every shortlist.
   - Mitigation: build against `docs/specs/scoring.md` and the S0-6 golden fixture first, keep alpha, beta and gamma in configuration, and review the fixture numbers by hand before the UI uses them.
2. **Catalogue stage B workload.**
   - Owner: Maulik.
   - Why it matters: 253 rows of costs, fares and cost rules are due 25 October while filtering depends on them.
   - Mitigation: start Monday, verify in daily batches as for stage A, and import through `/admin/catalogue` after each verified batch.
3. **The empty-shortlist diagnostic (T6 > T8).**
   - Owner: Maulik.
   - Why it matters: with draft costs, many groups may get fewer than 3 feasible destinations.
   - Mitigation: return the `{ kind: 'diagnostic', bindingConstraint, alternatives }` shape from the first filtering commit and test it on the demo trip, so an empty result is explained rather than an error.
