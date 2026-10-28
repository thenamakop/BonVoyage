# Sprint 5 plan: Could-haves (29 October to 7 November 2026)

**Status: draft for Maulik's decisions.** Nothing below is built. No Sprint 5 issue, milestone or re-plan exists yet. After approval:

- decisions E1 to E7 are recorded here and in the [prompts README](../prompts/sprint-5/README.md);
- the milestone "Sprint 5 (29 Oct-7 Nov): Could-haves" and its issues are created, linking #27 and #28 rather than duplicating them;
- the [re-plan text](#re-plan-text-applied-only-after-approval) is applied.

Sprint 5 builds four items under Maulik's decisions M1 to M4 (29 October, [prompts README](../prompts/sprint-5/README.md)):

- R17, fairness across rounds (#27);
- in-app reminders (C4, never email);
- R18, voting on the shortlist (#28);
- an offline evaluation harness, `pnpm eval`.

Sprint 4's open items 1, 7, 8, 9 and 12 run beside them. Every finding cites a file and line on `master` at `af71a5d` (after #135). The prompts S5-2 to S5-5 say "the plan's version wins if it differs"; each difference is marked **Differs from the prompt** below.

## Conflicts to settle first

1. **R17 as worded cannot fire: a trip has exactly one shortlisted run** (finding a). S5-2 counts "earlier shortlisted runs", and its test asks for "a revision (T5) and a second request" after a shortlist. Neither can happen under decision 0001's table. Counting diagnostics as rounds would change a trip's first shortlist, which M3 forbids. There are two ways round it, set out in [design 1](#1-r17-fairness-across-rounds-27); E1 picks one.
2. **Voting as I6 adds a row** to the table that decision 0001 and RUNBOOK Appendix B fix at I1 to I5. V4 allows a new event if 0001's table is updated in the same PR. AGENTS.md section 12 still asks for approval, which E4 gives.
3. **Scope documents still say these items are out:**
   - ADR-010 line 19: "R17, R18, reminders and email, and the user study are not delivered by 10 November";
   - RUNBOOK line 434;
   - the 27 October re-plan ("remain deferred").

   M1 supersedes them. The re-plan text below updates the RUNBOOK, traceability and the README. ADR-010 is a record of its own date and stays as it is; the new re-plan cites M1.
4. **Reminders by email.** SRS line 283 says reminder messages go by email. Decision 0000's C4 row says "in-app first, email second", and M4 says in-app only. Decisions win over the SRS. SRS line 184's third kind of reminder ("approaching travel dates") needs a scheduler and is not planned.
5. **HTTP 429 is not in AGENTS.md section 7's status list** (400, 401, 403, 404, 409, 422, 503). The S5-3 prompt specifies 429 for the Remind limit. Proposal: allow 429 `TOO_MANY_REQUESTS` with a `Retry-After` header, recorded in this plan's decisions. The other option is 422.

## Findings

### a. Recommendation rounds and the state machine

- **Requesting recommendations.** `recommendationRequested` is legal only from `ready_for_recommendation`: T6>T7 to `shortlisted` (`packages/engine/src/trip-state.ts:132`) and T6>T8 back to `collecting_preferences` (`:141`). T4 (`:116`) also starts from `ready_for_recommendation` only.
- **No way back after a shortlist.** From `shortlisted` the only ways out are T9 (`:150`) and T15 (`:198`). T10 (`:158`) returns `packages_proposed` to `shortlisted` with the same run, and clears `selected_destination_id` (`apps/api/src/packages/service.ts:408-409`). So every trip has at most one `shortlist` run.
- **Earlier runs are diagnostics.**
  - The round number is `max(round) + 1` over all runs (`apps/api/src/recommendations/repository.ts:151-157`, used at `service.ts:640`).
  - The kind is decided at `service.ts:568` (`feasibleCount >= SHORTLIST_SIZE`).
- **Diagnostic runs keep items.** `planRun` (`service.ts:426`) ranks every feasible destination and builds items whatever the kind (`service.ts:538-565`), and `insertItems` runs for every run (`service.ts:649`).
  - A diagnostic with 1 or 2 feasible places stores 1 or 2 items.
  - An F3 run, and a run with nothing feasible, store none. The demo's Tight budget round 1 is one of these ("No destination fits", `docs/demo/sprint-3-demo.md:113`).
- **Parameters lock at `shortlisted`.** `EDITABLE_STATUSES` (`apps/api/src/trips/service.ts:59`, decision 0004 j) are `draft`, `collecting_preferences` and `ready_for_recommendation`.

### b. Per-member scores are already stored

- Each item's `reasons` jsonb (`packages/db/src/schema/recommendations.ts:57`) holds `members[]` with `tripMemberId` and `score`. It is typed at `apps/api/src/recommendations/service.ts:140-150` and filled at `543-550`. A later round can compute any deficit from these rows, so E2 needs no new column for per-member scores.
- Runs store `alpha`, `beta` and `gamma` (`recommendations.ts:27-29`); λ needs one new column.
- `groupFit` (`packages/engine/src/scoring/group-fit.ts:3-9`) computes an unweighted mean and population sd. `rankDestinations` (`scoring/rank.ts:20-45`) has no history. `scoring.md` section 7's golden values are asserted to 1e-6 in `scoring/golden.test.ts`.
- **What members get back.** `toItemView` (`service.ts:318`) returns only the caller's own `mine`. Every item also carries `gfs`, `mean`, `min` and `sd`, which the screen does not show (`docs/security/privacy.md:39`). In 2-member groups these already reveal the other member's score; that is accepted at `privacy.md:43`.

### c. Notifications exist as a table only

- **The table.** `notification` (`packages/db/src/schema/notifications.ts`) has:
  - `user_id` and `trip_id` foreign keys with `ON DELETE CASCADE`;
  - `type`, `payload` jsonb, `created_at` and `read_at`;
  - indexes on `(user_id, read_at)` and `trip_id`.

  Account deletion already lists it (`apps/api/src/profile/repository.ts:116-117`).
- **Nothing writes or reads it.** `apps/api/src/modules/notifications/router.ts` is an empty `Router`, mounted at `modules/index.ts:9,48`.
- **Notify actions are no-ops.** `notifyMembers` is one (`apps/api/src/trips/transition-trip.ts:77`; `deferred()` at `64-69`). The table already attaches it to:
  - T3b (`trip-state.ts:113`);
  - entry to `finalised` and `cancelled` (`trip-state.ts:278-290`), which T14, T15 and T16 reach.

  T6>T7, T11 and T12 have no notify action. `sendInvitations` on T2 (`:95`) is a no-op too.
- **T2 reaches nobody.** T2 fires when the organiser creates the invite link. At that moment the organiser is the only member. Invitations are links, not addressed to anyone, and joining is not a transition. **Differs from the prompt:** S5-3's `trip_opened` "to each invited member who has an account" has no recipients.
- `DO_ACTIVITIES.in_progress = 'sendDailyReminders'` (`trip-state.ts:293-295`) needs a scheduler and stays deferred.
- `privacy.md:79` says the access matrix covers "31 endpoints"; the inventory has 43 (V3). S5-6 corrects the line.

### d. Choosing a destination today

- `chooseDestination` (`service.ts:675-707`) checks, in order:
  - `requireActiveMember` (683);
  - `requireOrganiser` (684);
  - `assertEventLegal('destinationSelected')` (685);
  - the latest run is a `shortlist` (689);
  - the destination is in it (`DESTINATION_NOT_IN_SHORTLIST`, 695);

  then fires T9 (707).
- Choose is organiser-only in the web (`apps/web/src/pages/Trips/shortlist/DestinationCard.tsx:24-55`, `canChoose` at 92). "For you" comes from `mine` (19, 91).
- `recommendation_item` is unique on `(run_id, destination_id)` (`recommendations.ts:60-61`). A vote can therefore reference an item with a composite foreign key, the "check" S5-4 asks for.
- **Precedent for counts in small groups.** Package opinions show "1 of 3 say it works", with no names, at every group size (`docs/demo/sprint-3-demo.md:87-88`). D1 (#116) hides only budget figures below 3 members.

### e. What can be computed offline (for the harness)

- **Pure functions in `packages/engine`:**
  - `groupProfile` (`group/profile.ts:24`);
  - `evaluateCandidate` (`feasibility/evaluate.ts:40`) and `buildDiagnostic` (`feasibility/diagnostic.ts:77`);
  - `rankDestinations` and `groupFit`, and `estimateRoadKm` (`geo.ts`);
  - the cost functions (`costs/costs.ts:75-90`);
  - `generatePackages`, `planDays`, `validateItinerary` and `buildFactSheet` (`index.ts:1-82`).
- **The catalogue loader.** `loadCatalogue(dir, { today })` (`packages/db/src/catalogue/load.ts:185`) reads the CSVs with no database. But `packages/db` exports only `.`, `./schema` and `./remote-target` (`packages/db/package.json:6-11`). The harness needs a `./catalogue` subpath export, or it must parse the CSVs a second time.
- **The glue lives in the API.**
  - `toMemberInput`, `toDestinationInput` and `toCosted` (`service.ts:154-191`) turn rows into engine inputs.
  - The `FeasibilityContext` is built with RoutingProvider distances and database fares (`service.ts:426-520`).
  - A harness that copies this measures a copy, not the app. Proposal: S5-5 first moves the pure mapping into `packages/engine`, then the API and the harness call the same function.
  - Offline distances follow ADR-007's order: the curated `distance_km` on the car fare row (`packages/db/src/catalogue/schemas.ts:209`), else `estimateRoadKm`.

### f. Demo impact (`docs/demo/sprint-3-demo.md`)

M2 merges each PR when CI is green, without holding for the demo. The Sunday 1 November re-run checks whatever has merged.

| Feature | Demo lines touched | Effect |
| --- | --- | --- |
| R17 (fairness weights) | none | Round 1 is unchanged (M3). The Hills trip has one shortlist. Tight budget's round 2 is its first shortlist. |
| R17 "Ask again" (if E1 is B) | 2.4 to 2.5 | One more organiser button on the shortlist |
| Reminders | the header on every screen; 2.4 and 3.3 | A bell with an unread count. Meera has unread items after T6>T7 and T11. |
| Voting | 2.3 to 2.5 | A vote button and counts on each card, and "N of M voted" |
| Evaluation harness | none | Offline only |

`run-seed.test.ts` asserts the Hills order only. S5-2 adds the Tight budget round 2 order, so an R17 change to a first shortlist fails a test.

## Proposed designs

### 1. R17 fairness across rounds (#27)

**What a round is (conflict 1).**

- **Option B (recommended): add "Ask again"**, a new event and transition **T21 `shortlistReopened`**: `shortlisted → ready_for_recommendation`. Organiser only, no guard; it notifies members.
  - In `ready_for_recommendation`, members may revise (T5), and the organiser may edit parameters (0004 j) or request again. T6>T7 then makes the second shortlist, and R17 applies.
  - It needs no new status (V4). Decision 0001's table, `nextState()` and its exhaustive test change in the same PR.
  - Side benefit: it narrows the SRS 3.2.2 gap that 0001 accepts, since preferences can be revised again.
  - The first shortlist is never weighted (M3).
  - Votes stay with their run (S5-4).
  - Checks for S5-2b:
    - packages from an earlier T9 and T10 must not survive into the next T9;
    - `selected_destination_id` is already null in `shortlisted`.
- **Option A: engine and harness only.** Build the weights, store λ, and wire the API to earlier shortlist runs, but add no transition. The app path then never fires, and R17 is measured only by the harness. There is no state machine change, but #27's "successive recommendation rounds" is met offline only.

**The deficit (E1).** For each earlier shortlisted run r, member i and the run's **top choice** o_r (the destination chosen from that run if one was, else rank 1):

```text
deficit_i = (1/R) × sum_r max(0, mean_j s_j(o_r) − s_i(o_r))    (0 with no earlier run, or if i was not scored in r)
w_i       = 1 + λ × deficit_i, then w_i ← w_i / mean_k w_k       (mean weight 1)
mean_w    = (1/n) × sum_i w_i × s_i(d)
sd_w      = sqrt((1/n) × sum_i w_i × (s_i(d) − mean_w)²)
GFS_fair  = alpha × mean_w + beta × min_i s_i(d) − gamma × sd_w  (min stays unweighted)
```

**Differs from the prompt:** S5-2 averages s_i over each run's top 3 (u_i). On the golden data, which has 3 destinations, the two give:

| Deficit measure | Deficits (m1, m2, m3) | Round 2 order at λ = 0, 1, 2, 5 |
| --- | --- | --- |
| Top choice (proposed) | 0, 0.368889, 0 | λ 0: d1, d3, d2 · λ 1: **d1, d2, d3** · λ 2: **d2, d1, d3** |
| Top-3 mean (prompt) | 0, 0.009444, 0.041667 | d1, d3, d2 at every λ up to 5 |

The top-3 mean barely moves: each member's best place is already in the shortlist, so nobody looks under-served. Yet the group will travel to one place, and m2 scores 0 on it. The top choice is what the synopsis means by "whose score has been lowest" (line 124). It is also what the harness simulates ("the group takes the top choice").

**Worked example** for `scoring.md` section 8. Golden data, round 1 chose d1 (scores 0.453333, 0, 0.653333; mean 0.368889). Round 2 has the same three destinations, λ = 1:

| | Weights (m1, m2, m3) | d1 GFS | d2 GFS | d3 GFS | Order |
| --- | --- | --- | --- | --- | --- |
| Round 1 (λ any) | 1, 1, 1 | 0.129780 | 0.066957 | 0.082828 | d1, d3, d2 |
| Round 2, λ = 0.5 | 0.942080, 1.115841, 0.942080 | 0.117974 | 0.082610 | 0.074925 | d1, d2, d3 |
| **Round 2, λ = 1** | 0.890501, 1.218997, 0.890501 | 0.107752 | 0.097066 | 0.068044 | d1, d2, d3 |
| Round 2, λ = 2 | 0.802616, 1.394768, 0.802616 | 0.090935 | 0.122755 | 0.056665 | d2, d1, d3 |

At λ = 1, m2's only good place, d2, rises above d3 without displacing the group's clear favourite. S5-5 reports metric C at λ 0, 0.5, 1 and 2, so the default can be confirmed from evidence; only `scoring.json` would change.

**Engine (S5-2a, pure):**

- `memberDeficits(earlierRounds, memberIds)` and `fairnessWeights(deficits, lambda)` in `scoring/fairness.ts`.
- Optional weights in `groupFit` and `rankDestinations`. Without weights, the path and results are today's, so `golden.test.ts` is unchanged.
- Full branch coverage: no earlier round, λ 0, a single member, every deficit 0, a member missing from a round, 2 members.

**API (S5-2b):**

- `lambda` goes in `scoring.json`, default 1, range 0 to 5, validated in `apps/api/src/config/scoring.ts`.
- Migration 0004: `recommendation_run.lambda double precision NOT NULL DEFAULT 0`. Old rows read 0, and new rows always write the configured value.
- `planRun` reads the earlier shortlist runs' `reasons.members[].score` for each top choice (E2). Weights are recomputed each time and never stored.
- With option B, the T21 event, its endpoint `POST /api/trips/:id/reopen-shortlist` and an organiser button.
- R7: when the weights are not all 1, each member's own "why" panel adds the prompt's sentence: "This round gives more weight to members whose wishes were met less in earlier rounds."

**Privacy (V2):**

- Weights, deficits and λ-derived values are never returned or logged.
- Items keep `gfs`, `mean`, `min` and `sd` **unweighted**, so the response shape and `privacy.md`'s statements stay true. Only `rank` follows GFS_fair. Returning weighted figures would let a member in a small group solve for another member's weight.
- The order alone can hint that someone was less served. In a 2-member group, round 1's figures already reveal the other member's score (`privacy.md:43`), so nothing new leaks. `privacy.md` gets one line saying so.
- `no-leak.test.ts`:
  - no body contains a `lambda`, `weight` or `deficit` key;
  - each returned `gfs` equals the unweighted formula from the stored scores, even where the rank differs.

### 2. In-app reminders (C4, M4)

**Writing:**

- A `notifications` module (router, service, repository). The writes happen inside the transition's transaction, so a rolled-back transition writes nothing.
- The `notifyMembers` handler covers T3b, T14, T15 and T16 through the table as it stands.
- An API-side map from transition id to type covers T6>T7, T11, T12 and T21. This leaves `nextState()` unchanged for them. The other way, adding `notifyMembers` to those rows, also changes 0001's table.
- The payload holds the trip id, trip name and the type's own fields only, as the prompt says. Never preferences, budgets, dates, scores or votes.

**Events (E3).** These are the prompt's list, except for T2:

| Type | When | Who |
| --- | --- | --- |
| `member_joined` (replaces `trip_opened`, finding c) | a member joins by link (invitations service) | the organiser |
| `preferences_reminder` | the organiser's Remind | the member reminded |
| `submissions_closed` | T3b | every active member; excluded members get "You were not included because preferences closed before you submitted" |
| `shortlist_ready` | T6>T7 | active members except the actor ("Vote for your favourite" once S5-4 merges) |
| `shortlist_reopened` | T21 (option B) | active members except the actor |
| `package_chosen`, `plan_ready`, `trip_finalised`, `trip_cancelled` | T11, T12, T14, T15 (and T16) | active members except the actor |

**Remind** (prompt's design, kept):

- `POST /api/trips/:id/members/:userId/remind`: organiser only.
- 409 unless the member is active and has not submitted.
- 429 with `You can remind <first name> again after <time>` within a rolling 24 hours, checked from the `notification` table.
- **Added:** take a transaction-scoped advisory lock on (trip, member) first, so that two quick clicks cannot both pass.
- Whether a member has submitted is already group-visible (`privacy.md:28`).

**Reading** (prompt's endpoints):

- `GET /api/notifications` returns your own, newest first, at most 30, plus `unreadCount`.
- `POST /api/notifications/:id/read` gives 404 for someone else's id. `POST /api/notifications/read-all` marks everything read.
- Four new endpoints in all, each added to the inventory and access matrix for 6 actors.

**Web:**

- A bell in the AppShell header with the count as text (not a dot alone), 44 px, keyboard operable.
- A panel lists notifications with links to their trips, plus "Mark all as read".
- Refetch on focus and every 60 s while visible (`refetchInterval: 60_000`, `refetchIntervalInBackground: false`).
- "Remind" on each pending member row, disabled with its reason after use.

**Deletion:** the cascades are already in place (finding c).

### 3. R18 voting on the shortlist (#28)

**Data:**

- The `vote` table (migration 0005; 0004 if E1's migration has not merged first): `id`, `run_id` (cascade), `trip_member_id` (cascade), `destination_id`, `created_at` and `updated_at`.
- Unique `(run_id, trip_member_id)`.
- **Added:** a composite foreign key `(run_id, destination_id)` to `recommendation_item`, so the database itself refuses a destination outside the run.
- Account deletion reaches votes through `trip_member`. **Added:** votes are deleted when a member is removed or excluded, as preferences are (`privacy.md:48`).

**Rules** (prompt's design, kept):

- I6 `voteCast` in `shortlisted`, guard "member is active", no actions. It goes in 0001's table with the date.
- Votes belong to the run. A new run (T21) starts empty. T10 keeps them. After T9, the API returns 409 "Voting has closed".
- The organiser votes as a member and still chooses freely.
- `PUT /api/trips/:id/vote { destinationSlug }` casts or changes a vote; `DELETE /api/trips/:id/vote` withdraws it.
- The shortlist response gains `votes: { counts?, voted, eligible, mine? }`.

**Two-member trips (E4).** **Differs from the prompt.** S5-4 recommends showing counts "only once both members have voted". That stops the first voter's choice from showing to the member who has not voted yet. It does not stop each member deducing the other's vote afterwards, because 2 counts minus your own vote is the other vote. The real options:

- **Option 1 (recommended): use the prompt's wait-until-both rule, and document in `privacy.md` that each member learns the other's vote once both have voted.** This is the package-opinions precedent (finding d). A vote is a choice made for the group to see, not a private preference (R10).
- **Option 2: below 3 eligible members, never show per-destination counts**, only "1 of 2 voted" or "Both voted". The organiser then decides without knowing the votes, which defeats R18 for pairs.

**Web:**

- "Vote for this" on each card: 44 px, with `aria-pressed` on your own vote.
- The count as text ("2 votes"), and "N of M voted" above the list.
- Choose stays where it is.

### 4. Evaluation harness (`pnpm eval`)

**Where:** `scripts/eval/` (the prompt's place), run by `"eval": "tsx scripts/eval/run.ts"`.

- It uses engine exports, plus the catalogue loader through a new `@bonvoyage/db/catalogue` subpath (finding e). No database, network or model, and no new dependency.
- **Added:** S5-5's first PR moves the row-to-engine mapping (finding e) into `packages/engine`, with the API's recommendation tests unchanged. Only then does the harness reuse it.

**Scenarios** (the prompt's design):

- Seeded mulberry32. 500 groups by default; each scenario is reproducible from (seed, index).
- Group size 2 to 8; origin `gurugram` or `delhi`; 1 to 3 nights; radius 150 to 400 km.
- A common window between November and February.
- Members draw from the catalogue's own vocabularies, with budgets drawn so about a third of groups are tight.

**Metrics** (the prompt's A to D):

- **A. Hard constraints.** Shortlists are re-checked against F1 to F5 by an independent check written from `scoring.md` section 2. Also: packages within the cap where the engine says so, and plans passing `validateItinerary`. Expected 100%; any miss is listed with its (seed, index) and becomes an issue, not a fix in that PR.
- **B. Group fit** for GFS, average-only (1, 0, 0) and least-misery (0, 1, 0): the top choice's mean, minimum and sd (median and interquartile range), the share of groups where someone scores 0, and how often the top choices differ.
- **C. Fairness over 3 rounds** for groups of 3 or more: each round takes the top choice, removes it and asks again, at λ 0 against the configured λ. Reported: the spread of cumulative scores, and the share of groups where one member is least served in 2 or more rounds. **Added:** also at λ 0.5 and 2 (E1).
- **D. Feasibility:** the `feasibleCount` distribution and the share of diagnostics by binding constraint.

**Output:**

- `docs/evaluation/results-<date>.md` and a CSV, with the commit hash, seed, scenario count, date and command.
- `docs/evaluation/README.md`, covering what the harness does and does not measure.
- The smoke test (`--scenarios 20`, under 20 s, metric A at 100%) runs in the unit project, so CI runs it.

## Decisions for Maulik

| # | Question | Options | Recommended |
| --- | --- | --- | --- |
| E1 | R17: what a round is, the deficit, λ | Rounds: **B** add T21 "Ask again"; A engine and harness only. Deficit: **top choice**; top-3 mean (prompt). λ: 0.5, **1**, 2 | **B, top choice, λ = 1.** Returned `gfs`, `mean` and `sd` stay unweighted. |
| E2 | Where per-member scores live | **Reuse `reasons.members[].score`**; a jsonb column or table of u_i (prompt) | **Reuse reasons.** Migration 0004 adds only `recommendation_run.lambda`; weights are recomputed, never stored. |
| E3 | Notifying events and the Remind limit | The prompt's list; **the prompt's list with `member_joined` for T2, plus T21** | **The table in design 2; a rolling 24 h per member per trip; 429 with `Retry-After`** (conflict 5) |
| E4 | Voting in 2-member trips; the I6 row | **Wait until both, then show counts, and document it**; never show counts below 3 | **Option 1, and approve I6 in 0001's table** |
| E5 | Evaluation size, metrics, baselines | 200, **500**, 1,000 scenarios; smoke 20 | **500, seed 20261029, metrics A to D, average-only and least-misery baselines, λ sweep 0, 0.5, 1, 2** |
| E6 | Order and cut order | as below | **The README's order; cut voting first, then reminders; never cut R17 or the harness** |
| E7 | One review or two | One combined; **two** | **Two**, written on 7 November: `sprint-4-review.md` (#125) keeps the Must evidence apart from `sprint-5-review.md` (Could-haves) |

## Plan

| # | Item | Issue | Prompt | Why | Size | Acceptance check | Depends on |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S5-2a | R17 engine: `fairness.ts`, optional weights in `groupFit` and `rankDestinations`, `scoring.md` section 8 | #27 | [S5-2](../prompts/sprint-5/S5-2-fairness.md) | R17 | M | Golden test unchanged to 1e-6; the worked example to 1e-6; 100% branch coverage on `scoring/` | E1 |
| S5-2b | R17 API: T21 (if B) with 0001's table and the button; λ config; migration 0004; weights from earlier shortlists; the R7 sentence | #27 | S5-2 | R17 | M to L, two PRs (T21, then weights) | Integration: shortlist, T21, request again ranks by GFS_fair (compared with λ 0); returned `gfs` unweighted; the leak test finds no weight; `run-seed.test.ts` first shortlists unchanged (M3) | S5-2a, E1, E2 |
| S5-3 | Notifications and Remind: module, writes in transitions, 4 endpoints, bell, panel, Remind button, `privacy.md` | new | [S5-3](../prompts/sprint-5/S5-3-reminders.md) | C4 (0000), M4 | M to L, two PRs (API, web) | One test per type with its recipients; 409 and 429; another user's id gives 404; deletion cascade; the inventory and matrix counts pasted; web tests for the count and the panel; 360 px | E3 |
| S5-4 | Voting: I6, migration 0005, PUT and DELETE vote, counts, card button, demo step 2 (Q5) | #28 | [S5-4](../prompts/sprint-5/S5-4-voting.md) | R18 | M to L, two PRs (API, web) | Cast, change and withdraw; a destination outside the run gives 400; after T9, 409; a new run starts empty; T10 keeps votes; no voter identity in any response; the 2-member wait state | S5-2 merged, E4 |
| S5-5 | Evaluation harness: move the mapping into the engine, then `scripts/eval/`, smoke in the unit project, full run committed | new | [S5-5](../prompts/sprint-5/S5-5-evaluation.md) | Synopsis objective 8, expected result 7 | M to L, two PRs | The same seed gives byte-identical CSVs; smoke under 20 s with A at 100%; API recommendation tests unchanged after the move | S5-2a, E5 |
| S5-6 | Evidence: close #27, #28 and the new issues with evidence; traceability R16 to R18; `privacy.md` counts (finding c) | new | [S5-6](../prompts/sprint-5/S5-6-evidence.md) | Definition of done | S | Each row cites tests and issues | S5-2 to S5-5 merged or cut |
| S5-7 | Sprint 5 review | new | [S5-7](../prompts/sprint-5/S5-7-review.md) | Gate before the Buffer | S | `docs/sprints/sprint-5-review.md` with outputs and Cowork's results | All above |

Each migration PR lists "After merge (Maulik)": `pnpm db:migrate:remote --target preview --status`, then without `--status`, then the same for `production`.

### Order, Thursday 29 October to Saturday 7 November

This follows the README's run order. Per M2, every PR merges when CI is green and updates the demo script in the same PR (Q5).

| Day | Agent: Sprint 5 | Agent: Sprint 4 | Maulik |
| --- | --- | --- | --- |
| Thu 29 Oct | S5-1 (this plan); after approval, the issues and re-plan | 9 (close #18 to #24 with evidence; "S4-9 now") | Decide E1 to E7 |
| Fri 30 Oct | S5-2a, then S5-2b's T21 PR | — | 8 (catalogue batches) |
| Sat 31 Oct | S5-2b weights PR (migration 0004); S5-3 API (a second session, per the README's "Two at once") | — | Migrate 0004 to preview, then production |
| **Sun 1 Nov** | S5-3 web | — | `db:seed --target preview --fresh-demos`; **Claude in Cowork re-runs the demo on preview** |
| Mon 2 Nov | — | — | **The demo** (reseed preview first) |
| Tue 3 Nov | S5-4 API (migration 0005) | 1 (demo fixes, first) | Migrate 0005 |
| Wed 4 Nov | S5-4 web | 7 (#122, after the demo); 8 (rebase `data/126-no-service-trains-hold`) | Vercel Preview key for #122 |
| Thu 5 Nov | S5-5 (mapping move, then harness) | 8 | 8 (#126) |
| Fri 6 Nov | S5-5 full run; S5-6 | — | — |
| Sat 7 Nov | S5-7 | 12 (Sprint 4 review, #125) | Read both reviews |

### Cut first if time runs short

1. S5-4 web, then S5-4 API (voting). #28 stays open with a comment, and its traceability row says "cut 7 Nov". I6 is not added.
2. The Remind button and endpoint. Event notifications stay.
3. S5-3 entirely (reminders).
4. With option B, T21 stays: R17 needs it.

Never cut: S5-2 (R17), S5-5 (the harness), S5-6, S5-7, and Sprint 4's items 1, 9 and 12.

## Re-plan text, applied only after approval

**`docs/sprints/replan-2026-10-29.md` (new):**

> **Title:** Re-plan: 29 October 2026
>
> Sprint 4's items 2, 3, 4, 5, 6, 10 and 11 shipped early (#128 to #135). On 29 October Maulik moved the four deferred Could-have items into Sprint 5 (M1), Thursday 29 October to Saturday 7 November, beside Sprint 4's items 1, 7, 8, 9 and 12. The four items are R17 fairness across rounds (#27), in-app reminders (C4, in-app only: M4), R18 voting on the shortlist (#28) and the offline evaluation harness. This supersedes the "remain deferred" line of the 27 October re-plan and ADR-010's scope consequence. Feature freeze (8 November) and submission (10 November) are unchanged. PRs merge when CI is green, demo script included (M2). Claude in Cowork re-runs the demo on preview on Sunday 1 November. Cut order: voting, then reminders; R17 and the harness are never cut. Email, travel-date reminders and the user study stay out.

**`docs/RUNBOOK.md` sprint map, a new row after line 431:**

> `| S5 | 29 Oct to 7 Nov | Could-haves beside S4: fairness across rounds, in-app reminders, voting on the shortlist, offline evaluation harness | R17, R18 |`

**`docs/RUNBOOK.md` line 434, its first sentence becomes:**

> Out of scope for 10 November: email, travel-date reminders and the user study. R17, R18 and in-app reminders (C4) moved into Sprint 5 by the [29 October re-plan](sprints/replan-2026-10-29.md).

**`docs/traceability.md` lines 23 and 24:** status `deferred` becomes `Sprint 5`. The issue column keeps #27 and #28 and adds the new issues. S5-6 fills in the tests.

**`README.md`:**

- Add an S5 row to the roadmap (lines 267-274): `| S5 | 29&nbsp;Oct&nbsp;to 7&nbsp;Nov | Could-haves: fairness across rounds, in-app reminders, voting, evaluation harness | R17, R18 | Planned |`.
- Point line 276 at the 29 October re-plan.
- On line 278, "deferred past submission" becomes "planned for Sprint 5".

## Open questions

- **#125 (Sprint 4 review) was closed by mistake.** PR #127's body quoted the S4-12 prompt's "Closes #125", so GitHub closed the issue when #127 merged (28 October, 15:42 UTC). No `sprint-4-review.md` exists. Proposal: reopen #125 after approval.
- **The tracking issue.** The S5-1 prompt says an issue is "created by this prompt", but also that issues are created only after approval. It is created with the others, so this PR closes nothing yet.
- **The prompts are untracked.** `docs/prompts/sprint-5/` exists locally but not on `master`, so this plan's links to it resolve only once the prompts are committed. This PR does not add them; that is Maulik's call, as in S4-1 part 2.
