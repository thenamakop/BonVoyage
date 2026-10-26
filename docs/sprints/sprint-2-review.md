# Sprint 2 review (24 to 26 October 2026)

**Result: Passed, with the production halves of R5 and R7 carried into Sprint 3.** The demo dry run on preview (27 October, by Claude at Maulik's request) passed R5, R6 and R7's preview halves. Maulik's hand-over answers (26 October) settle R1, R3, R8, R9 and R13. Nothing checked has failed. One defect was found: `/admin/catalogue` shows the stage plan from before the re-plan. It is spill issue #81. See [To finish](#to-finish).

Sprint 2 was planned for Saturday 24 to Tuesday 27 October with prompts S2-1 to S2-9. S2-1 to S2-8 were merged by 26 October, 03:23 India time (see Velocity). This review was written on 26 October from the commands below. Times are India time unless marked UTC.

## Review items

| Item | Check | Evidence | Result | Follow-up |
| --- | --- | --- | --- | --- |
| R1 | Every Sprint 2 issue is closed by a merged PR, and every acceptance criterion is met | `gh issue list --milestone "Sprint 2 (24-27 Oct)" --state all`: #64 to #70 are `CLOSED`, closed by #72, #73, #76, #74, #78, #79 and #80. #37 (stage A) was closed by hand after #77. The S1 spills #60 to #62 are closed. Criteria with evidence are [below](#acceptance-criteria-per-issue); #64's last criterion (the Neon hand-over) is met by Maulik's migration status (R3). The requirement issues #14 to #17 and #26 are still open on the milestone: they close once the demo run passes, so the milestone stays open. | pass | — |
| R2 | A fresh clone installs, migrates (0000 and 0001), seeds and passes `pnpm verify`; CI is green on master | Fresh clone of `b274eee` into a temporary folder, Node 24.21.0, pnpm 10.33.2. The clone had no `.env` (only `.env.example`). The local Docker databases were used, with throwaway values set in that shell only: a new `bonvoyage_clone` database in the local container, a random `BETTER_AUTH_SECRET` and a random `SEED_DEMO_PASSWORD`. Results: `pnpm install --frozen-lockfile` took 11 s. `pnpm db:migrate` recorded **2** migrations (`0000_init.sql`, `0001_selected_destination_and_usage.sql`). `pnpm db:seed` made trip 4, trip_member 11, trip_transition 18 and preference 10, with the three demo trips at `ready_for_recommendation`. `pnpm verify` exited 0: format clean, **78 files, 653 tests passed**, build ok. The folder and the database were deleted afterwards. `gh run list --branch master`: the last three merges (#78, #79, #80) are `completed/success`. | pass | — |
| R3 | Production and preview answer `/api/health`; both are on migration 0001 with nothing pending | Production health: `curl -s https://bonvoyage-orpin.vercel.app/api/health` → `{"status":"ok","db":"ok"}`, HTTP 200 in 1.25 s; Maulik's browser also returned ok on 26 Oct. Preview `/api/health` was not run over HTTP: the deployment answers HTTP 302 "Protected by Vercel Authentication". Neon status, run by Maulik on 26 Oct: `pnpm db:migrate:remote --target preview --status` → Postgres 18.6, "Journal: 2 migration(s); recorded: 2; pending: 0"; `--target production --status` → Postgres 18.6, "Journal: 2 migration(s); recorded: 2; pending: 0". Both branches are on 0000 and 0001. | pass (preview `/api/health` not run; its database answered `--status`) | — |
| R4 | The golden example (scoring section 7) passes, and the scoring, group, costs and feasibility modules have 100% branch coverage | `pnpm vitest run --project unit packages/engine/src/scoring/golden.test.ts` → 1 file, **6 passed**. The coverage command from S2-3 and S2-4 over all four folders, with `--coverage.thresholds.100`: Statements 100% (213/213), **Branches 100% (93/93)**, Functions 100% (70/70), Lines 100% (185/185); "12 files fully covered". | pass | — |
| R5 | Privacy: the leak test covers the recommendation routes; on production, two accounts in one trip each see only their own For you line | `pnpm vitest run --project integration apps/api/src/security packages/integrations/test apps/api/src/recommendations` → **7 files, 78 passed**. The access matrix is 30 endpoints × 6 actors: anonymous 2×200 28×401; nonMember 9×200 2×201 2×403 17×404; member 15×200 2×201 1×204 11×403 1×404; excludedMember 13×200 2×201 13×403 1×404 1×409; organiser 19×200 2×201 3×204 2×403 3×409 1×422; admin 11×200 2×201 17×404. `no-leak.test.ts` stores a run first and checks `recommendations/latest` and `group-profile` (lines 92 and 291). Preview half, 27 Oct (Claude drove Asha in its built-in browser, Maulik drove Rohan in Brave): on Hills shortlist demo Rohan saw the same five places in the same order (Chakrata, Dhanaulti, Almora, Rishikesh, Mukteshwar) but his own For you line (Chakrata 3.5 out of 10 "Matches temples, trekking", against Asha's 2.9 "Matches adventure, trekking, camping"); he had no Choose button and no other member's name appeared on his shortlist. The production half needs two real accounts in one trip and is carried into Sprint 3. | test and preview halves pass; production carried to Sprint 3 | Sprint 3: run the R5 production half |
| R6 | The demo runs end to end on production or preview: shortlist, diagnostic with a one-tap fix and round 2, date clash, destination chosen | Dry run on preview, 27 October 04:15 to 04:25 India time, by Claude at Maulik's request (Claude drove Asha in its built-in browser, Maulik drove Rohan in Brave). All three scenarios passed. Hills shortlist demo: Get recommendations returned 33 places; cards show distance, group and per-person cost marked estimate, "Opinions differ", climate, shared interests and the For you line. Asha chose Chakrata via "Choose Chakrata? The group moves on to packages."; her dashboard read "Chakrata chosen. Packages arrive in the next release." with a Destination row; Rohan's dashboard showed the same 263 ms after "Back to the trip". Tight budget demo: "No destination fits", "Most places cost more than the group can spend.", closest misses Mathura (about Rs 6,600 over), Vrindavan (Rs 6,730), Bikaner (Rs 6,860); "Raise the group budget to Rs 14,000" with "This adds Bikaner, Mathura and Vrindavan."; "Saved. Now mark the trip ready again and get recommendations."; Mark ready again (confirmed); Round 2 listed Vrindavan (Rs 13,730), Mathura (Rs 13,600) and Bikaner (Rs 13,860). Date clash demo: "No destination fits", "The dates members gave do not overlap.", "Ask members to check their dates"; the dashboard then read "The last round found a date clash." with See why. Difference from `docs/demo/sprint-2-demo.md`: the tight budget fix now adds Bikaner as well as Mathura and Vrindavan (amount still Rs 14,000), because of the stage B2 fares merged on 27 October (#91, #92). The preview demo trips are now used (Hills has Chakrata chosen, Tight budget is at Round 2, Date clash is back to collecting preferences); a further run needs fresh demo trips (Sprint 3, `--fresh-demos`). | pass (preview) | — |
| R7 | R15 speed: `pnpm perf:recommend` locally, and the time from clicking Get recommendations to the shortlist on production; target under 10 s, design target under 2 s | `pnpm perf:recommend` with `pnpm dev` running, 26 Oct: runs of 112, 53, 70, 61 and 48 ms (32 feasible each); **min 48 ms, median 61 ms, max 112 ms**; 5 of 5 copies cancelled. The S2-8 run in #80 gave 55/77/149 ms. The S2-7 walk-through (local, browser) measured 159 ms. The in-process real-catalogue test reports 46 ms. The dev server was stopped. Preview click times during the dry run on 27 Oct (click to result on screen, browser performance clock): 310 ms (hills, 33 places), 213 ms (tight budget), 310 ms (Round 2), 214 ms (date clash). The production click time is carried into Sprint 3. | local and preview pass; production carried to Sprint 3 | Sprint 3: run the R7 production half |
| R8 | Integrations (R16): cache hits and the quota fallback are tested; `provider_usage` exists on production | `packages/integrations/test/routing.test.ts` passed in the R5 run, including "serves a repeat from cache with its original provenance, and calls no provider or quota", "ignores a row at exact expiry and upserts its replacement without duplicates", "allows two live calls, falls back on the third, and resets at the next India midnight" and "runs exactly one of two parallel reservations with limit one". `provider_usage` is created by migration 0001 (R2), and production has 2 of 2 migrations recorded, 0 pending (R3), so the table exists on production. | pass | — |
| R9 | Catalogue: stage A 50/50 and imported to preview and production; B1 progress against 137 rows | `pnpm catalogue:check --require a` → exit 0, 0 errors, 42 warnings (missing POIs). **Stage A 50/50**, B1 0/137, B2 0/116, C 0/21. Preview import, 26 Oct (`pnpm catalogue:import --target preview`): hub 6, destination 44, fare_fallback 204, poi 21 and cost_rule 5 updated, 0 inserted. Production: Maulik imported the catalogue on 26 Oct with `pnpm catalogue:import --target production`, typing the confirmation himself. Production's `/admin/catalogue`, as he quoted it: Hubs 6, Destinations 44, Points of interest 21, Fares 204, Cost rules 5; "Stage A: 50 of 50 verified, due 18 Oct 2026"; "Stage B: 0 of 253 verified, due 25 Oct 2026"; "Stage C: 0 of 21 verified, due 1 Nov 2026"; "Last updated 24 Oct 2026, 9:27 pm". Defect: `/admin/catalogue` still shows "Stage A … due 18 Oct", a combined "Stage B … due 25 Oct" and "Stage C". It reads `packages/db/src/catalogue/stages.ts` (`['a', 'b', 'c']`), while `pnpm catalogue:check` already uses A, B1, B2 and C with the decision 0004 dates. The quoted page shows exactly that. | pass (admin page labels and dates: spill) | #81 |
| R10 | The re-plan holds | `gh api …/milestones`: "Sprint 1 (12-18 Oct)" is closed (15 closed); "Sprint 2 (24-27 Oct)", "Sprint 3 (28 Oct-2 Nov)", "Sprint 4 (3-7 Nov)" and "Buffer (8-10 Nov)" match `replan-2026-10-23.md`. `gh issue view 37` → `#37 CLOSED (COMPLETED) closed 2026-10-25T19:22:17Z: Catalogue stage A: verify hubs and destination identity (due 26 Oct)`. #38 "Catalogue stage B: verify costs and fares (B1 due 1 Nov, B2 best effort)" and #39 "Catalogue stage C: verify places of interest (due 1 Nov)" are on Sprint 3. #54 "Account deletion" is on Sprint 3. | pass | — |
| R11 | `docs/traceability.md` lists the Sprint 2 tests on R4, R5, R6, R7, R15 and R16 | Each row names Sprint 2 test files. Paths named: R4 4, R5 3, R6 10, R7 5, R15 3, R16 4. A shell check found **0 missing** paths. | pass | — |
| R12 | No key, connection string or `.env` file anywhere in git history | `git log --all -- .env .env.neon '*.env'` → empty. A pattern scan of every added line in history (`postgres(ql)://user:password@`, `AIza…`, `npg_…`, `AQ.…`) found 16 matches, all the public Docker Compose credential `bonvoyage:bonvoyage` on `localhost:5432`, `localhost:5433` or `127.0.0.1:1`. There are no Google, Neon or other keys. The Sprint 1 fake Neon fixtures in `packages/db/src/remote.test.ts` use one-character passwords. | pass | — |
| R13 | Hours per prompt, approximate from PR times, confirmed by Maulik | See [Velocity](#velocity): time between merges, not hours worked. Maulik confirmed it on 26 Oct with one correction: S2-6's 27 h 27 min gap was not a day off. In it, stage A was verified and merged (#77), and S2-6 (#78) was implemented, independently reviewed and fixed (`a3de7b2`). | recorded (time between merges), confirmed by Maulik | — |

## Acceptance criteria per issue

**#64 Migration 0001 (PR #72)**
- Nullable, indexed `trip.selected_destination_id` with ON DELETE RESTRICT: `packages/db/src/schema/trips.ts`; the delete refusal is tested in `packages/db/test/schema.test.ts`.
- `past_trip.place_name` nullable, with one of `destination_id` and `place_name` after the data UPDATE: "migration 0001 clears copied names before enforcing the one-of CHECK".
- `provider_usage` with a provider/day primary key and non-negative calls: "provider usage enforces its primary key, default and nonnegative calls"; the delete refusal asserts SQLSTATE `23001` on `trip_selected_destination_id_destination_id_fk`.
- Profile writes stop copying names, and TripDetail returns `selectedDestination`: `profile.test.ts` asserts a catalogue past trip stores `placeName` null; `TripDetail.selectedDestination` is filled after T9 (`group-flow.test.ts`).
- Schema tests cover the CHECKs, the primary key, the trip cascade and the delete refusal: "deleting a trip cascades to every dependent table" and the CHECK tests.
- Preview and production hand-over with full SQL and health checks: given in #72; met: Maulik ran `--status` on both branches on 26 Oct, 2 of 2 recorded, 0 pending (R3).

**#65 Member score, ranking, explanations, group profile (PR #73)**
- The nine golden member scores to within 1e-6 with weighted type Jaccard: "memberScore reproduces the 6.7 member scores (S2, R6)" (R4 run).
- Golden mean, min, sd and GFS, and the d1, d3, d2 order with deterministic ties: "recomputed aggregates match the spec", "GFS order is d1, d3, d2 while mean order is d1, d2, d3" and `rank.test.ts`.
- `explainMatch` uses stated wants; `groupSummary` hides values met for fewer than two members: `explain.test.ts`.
- `groupProfile` with inclusive dates, caps, blocking window conflicts and warning-only budget conflicts: `profile.test.ts` "intersects inclusive windows…", "marks a two-day common window as too short for two nights" and "returns no common window for disjoint ranges and only a warning for disjoint budgets".
- 100% branch coverage with no I/O: R4.
- Engine exports and traceability on R4, R6 and R7: `packages/engine/src/index.ts`; R11.

**#66 Hard constraints, costs, diagnostic (PR #76)**
- The car shares 1678 and 2014 and the group cost 18180: `costs.test.ts` lines 20, 21 and 62.
- F1, F2, F4 and F5 pass at exactly their limits; F3 is the group gate: "passes every constraint at exactly its limit", "fails F5 by one rupee over the cap" and "reports binding F3 with no alternatives or suggestions on a blocking window conflict".
- F4 uses circular month distance, December to January: "computes the smallest circular shift, capped at 6".
- Near misses and alternatives, F5-first ties, no alternatives for F3: "F5 wins a near-miss tie over F1" and the F3 test.
- Suggestions at minimal unlocking limits, rounded to 10 km or ₹500, identifying a member-funded cap: "suggests a members-side cap with newPerPersonMaxInr". The F2 suggestion read the wrong field until it was fixed in #78 (`diagnostic.ts`).
- 100% branch coverage: R4.

**#67 Integrations (PR #74)**
- Curated, then estimated, with an answer for every destination: "continues in strict provider order for partial answers and ignores unrequested IDs".
- Verified car rows are curated; draft or computed distances are estimated: "uses draft/verified car provenance and estimates missing car rows".
- Fresh cache entries avoid provider calls; expired entries are replaced: the two cache tests in R8.
- Atomic per-India-day quota, with a parallel limit-one test: R8.
- Quota or provider failure falls back without failing the request and with no live call: "logs a provider failure once … and falls back" and the quota test; all tests run with `LIVE_APIS=off`.
- 44 destinations without per-destination queries: "uses one SQL query for all 44 default curated/estimate results" and "batches all 44 external cache reads/writes and needs only one warm read".

**#68 Recommendation runs and destination choice (PR #78)**
- Four routes with shared contracts in the inventory, the access matrix and the leak test: R5 (30 endpoints).
- Validated weights, injected and stored on every run: `apps/api/config/scoring.json`, `config/scoring.test.ts`, and the "weights stored" assertion in `recommendations.test.ts`.
- Compute outside the lock, persist through `transitionTrip`, staleness rejection, no direct status writes: `recommendations.test.ts` staleness tests; the independent S2-6 review's probes.
- T4 for date conflicts, T6>T8 for fewer than three feasible, T6>T7 for shortlists: `recommendations.test.ts`; the seed tests (R2).
- Own explanation only; T9 stores a destination from the newest shortlist: `group-flow.test.ts` (`mine` equals the caller's own kinds of place; outsider 404) and the choose tests.
- Parameters editable until shortlisted; a real-catalogue test under 2000 ms: `trips.test.ts` (0004 j); the R15 test (46 ms here).

**#69 Screens (PR #79)**
- Private-safe group aggregates and warnings, with the organiser's Get recommendations: `RecommendationDashboard.test.tsx`.
- Five then all, costs labelled estimate, the caller's own For you line: `ShortlistPage.test.tsx`.
- Diagnostic with binding constraint, alternatives, incomplete entries and organiser-only suggestions: `ShortlistPage.test.tsx`, diagnostic view.
- Choosing needs confirmation; the dashboard follows through polling: `ShortlistPage.test.tsx`; the walk-through (Rohan saw the choice within 8 s).
- Headings, text ranks, 44 px targets, announced states: the walk-through's 360 px check; `role="status"` regions.
- Web tests and 360 px and desktop screenshots: 23 web files, 139 tests at merge; 7 images on #79.

**#70 Demo scenarios (PR #80)**
- An idempotent, service-based seed with three demo trips and no status writes: `demo-trips.ts`; R2.
- Seed tests prove the three outcomes, and a second seed adds nothing: `run-seed.test.ts`.
- End-to-end test with ordered transition ids: `group-flow.test.ts` asserts `T1, T2, I1, I1, I1, T3, T6>T7, T9`.
- `perf:recommend` min, median and max over five copies, then cancels them: R7.
- A five-minute demo script with safe reset steps: `docs/demo/sprint-2-demo.md`.
- Verification and traceability on R6 and R15: #80; R11. The preview seed is Maulik's step.

## What was built (merged in Sprint 2)

| PR | Title | Issue |
| --- | --- | --- |
| #71 | docs: Sprint 2 decisions, backlog, stage B split and re-plan | S2-1 (refs #37, #38, #64 to #70) |
| #72 | feat: persist selected destinations and provider usage safely | #64 |
| #73 | feat: member score, group-fit ranking, explanations and group profile | #65 |
| #74 | feat: route distances through fresh local providers and guarded external calls | #67 |
| #76 | feat: evaluate hard constraints and build the empty-shortlist diagnostic | #66 |
| #77 | chore: verify catalogue stage A (50 rows) | #37 |
| #78 | feat: recommendation runs, conflict report and destination choice | #68 |
| #79 | feat: group profile, shortlist and diagnostic screens | #69 |
| #80 | feat: demo scenarios, end-to-end flow and speed check | #70 |

## How the work was done (facts checked against the repo and GitHub)

- **S2-6 (#78)** was implemented by Claude in a cloud session (the PR body links a `claude.ai/code` session), not by a local agent. An independent session reviewed it. The review fixes are commit `a3de7b2` ("fix: round member-set budget figures in recommendation responses"), the second commit of #78.
- **S2-7 (#79)** was walked through by Claude driving Brave as Asha, with Maulik as Rohan in a second window. Get recommendations reached the shortlist in **159 ms**. The walk-through found seven issues, all fixed in `6fd63c6`.
- **S2-8 (#80)** uses a **₹7,000** tight budget, not the prompt's ₹9,000. ₹9,000 was only 10% below the cheapest 3-member estimate (₹10,010); ₹7,000 is 30% below. The other margins: hills 32 feasible (at least 8 needed), date clash 6 days (at least 5). `perf:recommend` gave 55/77/149 ms.
- **Catalogue:** stage A 50/50, verified by an AI report with an independent spot check. B1 (0/137), B2 (0/116) and C were deferred on 26 Oct until after S2-9. B1 and C are still due Sunday 1 November.

## Inventory for Sprint 3

- **Endpoints: 30** (Sprint 1 ended at 26). New in Sprint 2, with access rules:
  - `GET /api/trips/:id/recommendations/latest` (member, removed members included)
  - `GET /api/trips/:id/group-profile` (member)
  - `POST /api/trips/:id/recommendations` (organiser, active)
  - `POST /api/trips/:id/destination` (organiser, active)

  `PATCH /api/trips/:id` is now allowed in draft, collecting_preferences and ready_for_recommendation (0004 j).
- **Shared contracts:**
  - `packages/shared/src/api/recommendations.ts`: `GroupProfileResponse`, `RecommendationRun` (with `incomplete` on every run), `RecommendationItem`, `LatestRecommendationResponse`, `RequestRecommendationsResponse`, `ChooseDestinationInput`, `LatestRecommendationSummary`
  - `TripDetail.latestRecommendation` and `selectedDestination`
  - the trip actions `requestRecommendations`, `viewRecommendations` and `chooseDestination`
  - `packages/shared/src/provenance.ts`
- **Engine exports** (`packages/engine/src/index.ts`, added in Sprint 2):
  - scoring: `jaccard`, `memberTypeWeights`, `weightedJaccard`, `memberScore`, `groupFit`, `sortRankedDestinations`, `rankDestinations`, `explainMatch`, `groupSummary`
  - group: `groupProfile`
  - costs: `carSharePerPersonOneWay`, `cheapestOneWay`, `composeEstimate`, `estimatedGroupCost`
  - feasibility: `capSource`, `windowDays`, `evaluateCandidate`, `monthShift`, `windowMonths`, `buildDiagnostic`
  - types: `CostRules`, `CostedDestination`, `Evaluation`, `Diagnostic`, `Suggestion`, `Weights` and others
- **Integrations** (`@bonvoyage/integrations/routing`):
  - `createRouting`, `curatedProvider`, `estimateProvider`, `readDistanceCache`, `writeDistanceCache`, `withQuota`, `QuotaExceededError`
  - providers: curated (catalogue car rows), then estimate (haversine × 1.3); neither has a daily limit
  - quota is counted per provider per India day in `provider_usage`
  - Gemini gets a limit in Sprint 4
- **`createApp` deps:** `db`, `pool`, `logger`, `auth`, `clock?`, `adminEmails?`, `routing?`, `scoringWeights?` (defaults to the config), `recommendationHooks?` (test seam).
- **Config:** `apps/api/config/scoring.json` = `{ "alpha": 0.5, "beta": 0.3, "gamma": 0.2 }`, zod-validated at start-up.
- **Error codes added:** `RECOMMENDATION_STALE` (409), `DESTINATION_NOT_IN_SHORTLIST` (422).
- **Seed and scripts:**
  - `pnpm db:seed` adds "Hills shortlist demo", "Tight budget demo" and "Date clash demo" (`apps/api/src/seed/demo-trips.ts`)
  - `pnpm perf:recommend` (local only)
  - `CLAUDE.md` loads `AGENTS.md`

## Known gaps (not spill issues)

- **Each demo trip works once per database, and preview cannot be reset.** Sprint 3 note: a seed option that re-creates used demo trips.
- **Runs store a group profile snapshot,** although decision 0004 b says the profile is computed on read and never stored. This was named in #78; the snapshot is what makes a stored run auditable.
- **Feature PRs are over 400 lines** (#78 about 2,400 lines, #79 about 2,400, #80 about 690), each split into one commit per step.
- **Dependabot #75 is parked until the buffer.** Its `ci` fails at `pnpm lint` with 166 typescript-eslint errors in web test files.
- **POI coverage:** stage C has 21 rows covering only 3 of 44 destinations (Jaipur, Mussoorie, Rishikesh). The checker warns below 6 POIs per destination, so full cover is about 264 rows.
- **#39 cannot close before B2:** `pnpm catalogue:check --require c` also requires B2 (stage order a, b1, b2, c).
- **Every cost and distance is an estimate** until B1 is verified. The seed tests are the early warning if B1 flips a demo outcome.
- **What small groups can see.** In a 2-member group, the common window shows the other member's binding dates, and `gfs`, `mean`, `min` and `sd` with your own score reveal the other member's score. Both are accepted and recorded in `docs/security/privacy.md`.
- **Requirement issues #14 to #17 and #26** stay open on the Sprint 2 milestone until the demo run passes.

## Top three risks for Sprint 3

1. **Packages (R8) need B1 by Sunday 1 November.** Packages cost on stays, food and car rows; with B1 at 0/137, every package figure would be an estimate.
2. **Stage C and B2.** Itineraries (Sprint 4) need about 264 POI rows against 21 today, and train and bus fares stay estimates until B2.
3. **The Gemini free-tier quota in Sprint 4.** Itinerary generation must stay within the daily limit through `withQuota`, falling back to the catalogue.

## Velocity

Planned: Sprint 2 from Saturday 24 to Tuesday 27 October, S2-1 to S2-9, with time boxes adding up to 17.75 hours. Actual: S2-1 to S2-8 merged between 24 October 07:26 and 26 October 03:23 (India time); this review followed on 26 October. The last column is the time between merges (previous merge to this merge), not hours worked. Gaps include nights and other work, and S2-3 and S2-5 ran in parallel. Maulik confirmed the table on 26 October, with the S2-6 correction.

| Prompt | PR | Created | Merged | Time box | Time between merges |
| --- | --- | --- | --- | --- | --- |
| S2-1 kickoff | #71 | 24 Oct 07:21 | 24 Oct 07:26 | 1.5 h | 5 h 41 min (overnight) |
| S2-2 migration | #72 | 24 Oct 15:37 | 24 Oct 16:04 | 1 h | 8 h 38 min (includes a break) |
| S2-3 scoring | #73 | 24 Oct 16:49 | 24 Oct 17:13 | 2.5 h | 1 h 9 min |
| S2-5 integrations | #74 | 24 Oct 19:01 | 24 Oct 19:08 | 2 h | 1 h 55 min (in parallel with S2-3) |
| S2-4 feasibility | #76 | 24 Oct 20:04 | 24 Oct 20:08 | 2.5 h | 1 h 0 min |
| Catalogue stage A | #77 | 24 Oct 20:15 | 24 Oct 21:14 | (Maulik's daily batch) | 1 h 6 min |
| S2-6 recommendations | #78 | 26 Oct 00:06 | 26 Oct 00:41 | 3 h | 27 h 27 min (stage A verified and merged in #77; S2-6 implemented, independently reviewed and fixed in `a3de7b2`) |
| S2-7 screens | #79 | 26 Oct 01:44 | 26 Oct 02:06 | 3 h | 1 h 25 min |
| S2-8 demo | #80 | 26 Oct 02:55 | 26 Oct 03:23 | 1.5 h | 1 h 17 min |
| S2-9 review | this PR | 26 Oct | — | 0.75 h | — |

## To finish

The demo dry run is done (27 October, on preview; see R5, R6 and R7 above) and everything checked has passed. Carried into Sprint 3:

1. **R5 production half:** two real accounts in one trip each see only their own For you line.
2. **R7 production half:** the time from clicking Get recommendations to the shortlist on production; target under 10 s, design target under 2 s.
3. The preview demo trips are used; a fresh dry run needs `--fresh-demos` or equivalent (Sprint 3 note in [Known gaps](#known-gaps-not-spill-issues)).

Close #14 to #17 and #26, then the Sprint 2 milestone.
