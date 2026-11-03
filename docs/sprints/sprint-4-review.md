# Sprint 4 review (28 October to 3 November 2026)

**Result: Sprint 4's hardening is in place, and model wording has now run on a deployment.** Nine of the twelve plan items are shipped or done, each with a test or a preview check. The demo fixes (item 1) wait for the demo, which moved. The catalogue (item 8) has B1 complete, but B2 and C are still partly draft. This review is item 12.

- **Preview, 3 November:** the demo script's steps 1 to 5 matched line for line. Every Sprint 4 change checked on screen still holds (travel time on cards, the 44 px toggle, two-member budget hiding). With `LIVE_APIS=on`, one day plan was model-worded and passed validation, and two live failures fell back to the catalogue plan with every fact intact (S4-7, #122).
- **Production:** not run end to end. It has no demo accounts, and its deployment URL is behind Vercel's login. The deployment at `7e28920` is READY, with migrations 6 of 6 (`pnpm db:migrate:remote --target production --status`, 3 November). Its day plans use the templates: production has no `GEMINI_DAILY_LIMIT`, so the quota guard allows no model call (`env.ts` defaults the limit to 0), whatever `LIVE_APIS` says there.
- **Not yet done:** the Monday demo moved from 2 November to later this week or next, so item 1 (S4-4) has nothing to fix yet and goes to the Buffer. `catalogue:check` still shows 2 B2 fares and 62 places as draft (#126, #39); they show in the app as "Not verified".

Sprint 4 was planned for Tuesday 3 to Saturday 7 November ([plan](sprint-4-plan.md)). Most of it shipped on 28 and 29 October, ahead of the plan ([re-plan of 29 October](replan-2026-10-29.md)), beside Sprint 5. This review was written on 3 November, earlier than the planned 7 November, from the two run files and the commands below. Times are India time unless marked UTC.

Evidence comes from three sources:

- **Review run:** [review-run-2026-11-03.md](review-run-2026-11-03.md). Claude in Cowork, 3 November, about 17:05 to 18:05 UTC, on preview at master `7e28920` (#164). Migrations 6 of 6, catalogue imported with `--prune`, demo trips reset. Asha was in the Claude app's built-in browser and Meera in Chrome.
- **S4-7 check:** [s4-7-preview-check-2026-11-03.md](s4-7-preview-check-2026-11-03.md). The same session, with `LIVE_APIS=on` on Preview only, plus the full demo rehearsal.
- **Commands:** the outputs under [Commands run for this review](#commands-run-for-this-review), on `7e28920`.

## Plan items

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Fixes from the Monday demo (S4-4) | **not started: moved to the Buffer** | The demo moved from 2 November to later this week or next, so no defect has been found to fix. The 3 November rehearsal found none in steps 1 to 5. |
| 2 | Catalogue import's stage counts one after another inside the transaction (#118) | shipped in #128 | The `pnpm verify` log contains no "already executing" line (0 matches). `admin.test.ts` passed in the same run. |
| 3 | One-way travel time on each package card (#119, for #18) | shipped in #130 | Review run, "Pair check": "About 6 h 45 min each way (planned)" on all three cards; the demo trips read as the script quotes. `PackagesPage.test.tsx` passed in `pnpm verify`. |
| 4 | "What it costs" toggle at least 44 px (#120) | shipped in #130 | Review run: measured heights 44, 44 and 44 px. |
| 5 | Two-member bounds, D1 (#116) | shipped in #129 | Review run, a 2-member trip whose cap the members set: "Budgets overlap" and "Budget figures appear once 3 or more people have answered.". The `group-profile` API returned `budgetBand {minInr:null, maxInr:null, overlaps:true}`, with `perPersonCapInr` and `groupCapInr` null. There is no "Opinions differ" range, and Comfort (₹32,996) reads "Over the group budget" with no amount (`overByInr: null`). |
| 6 | Model wording on deployments: client in `vercel-entry.ts`, quota guard, cache, README step (#121) | shipped in #133 | S4-7 step 3: a deployed plan read "Written with gemini-3.5-flash-lite from catalogue facts". `llm.test.ts`, `itinerary.test.ts` (limit 0 gives the catalogue plan; a re-plan is a cache hit) and `guarded-llm.test.ts` passed in `pnpm verify`. |
| 7 | Preview check with `LIVE_APIS=on` (#122) | **done 3 November** (no PR; the run file is committed here) | S4-7 file: version 4 model-worded from cache in 121 ms, `"verifiedRatio":1`, and the facts match the template plan. Two failures (a model error on gemini-3.8-flash, which returned 503 "high demand" in Maulik's local spike, then a 20.1 s first call on gemini-3.5-flash-lite over the 20 s timeout) gave catalogue plans with facts intact. The logs held no prompt text or member data. The quota-at-limit path was not run live; it is covered by `guarded-llm.test.ts`. #122 is closed by this review; traceability R12 and `known-limitations.md` now cite this check. |
| 8 | Verify the remaining catalogue rows (#38 B1, #126 B2, #39 C) | **B1 done in #144** (closes #38); **B2 and C partly done; #126 and #39 stay open** | B1 137/137 after #144 (Sariska costs). #146 (C batch 1): C +10. #158 (no-service trains, B2 batch 2, C batch 2): B2 102/104 and C +2. Still draft: the 2 Jim Corbett train fares (timetable verified, fare estimated) and 62 places. `catalogue:check --require b1` exits 0. Tiger Falls stays draft on purpose (the demo's "Not verified" item). |
| 9 | Close the requirement issues with evidence (S4-9) | **done 29 October** (issue comments, no PR) | #18, #21, #23 and #24 each have an evidence comment and closed on 29 October at 14:27. #20 closed with #129 (D2), followed by an evidence comment. #22 stayed open for #122 and is closed by this review. |
| 10 | Compute the `GET /packages` note without rebuilding every package (#123) | shipped in #134 | `packages.test.ts` (the note unchanged) passed in `pnpm verify`. |
| 11 | Split the web bundle (#124) | shipped in #135 | `pnpm --filter @bonvoyage/web build`: 24 assets, no chunk-size warning. The largest chunks are `index` at 302.28 kB and `react-dom` at 218.38 kB; the single bundle was 596 kB before. |
| 12 | Sprint 4 review (#125) | this PR | This file. |

**Issues closed early by mistake.** #127's body quoted the Sprint 4 prompts, so its merge on 28 October at 21:12 closed #118 to #121, #123, #124 and #125. Each fix (#128 to #135) merged afterwards. Every one of them closes its own issue in its body, and the evidence above is from those PRs. #125 was reopened on 29 October.

## Decisions D1 to D6

| Decision | How it was carried out |
| --- | --- |
| **D1**, two-member groups (#116) | #129: below 3 contributing members the group profile, recommendation runs and the diagnostic carry no budget figure, only whether budgets overlap. Packages against a member-set cap carry no amount. The date window is unchanged. Checked on preview on 3 November (item 5). |
| **D2**, #20 | #129's body closes #20 together with #116. An evidence comment followed on 29 October. |
| **D3**, #23 | #23's text follows decision 0005 h. It closed on 29 October with an evidence comment (S4-9). |
| **D4**, model wording on deployments | Built in #133 (#121) and checked on preview on 3 November (#122). Not cut. Maulik decided on 3 November that production stays on templates for submission; production has no `GEMINI_DAILY_LIMIT`, so the guard allows no model call there. Preview is back to `LIVE_APIS` off for the demo, with `GEMINI_MODEL=gemini-3.5-flash-lite` kept. |
| **D5**, catalogue criteria | #38's check became `--require b1`; #144 met it and closed #38. The 31 B2 fares went to #126; the Gurugram trains to Mathura and Vrindavan, first in line, were deleted in #158 because no train runs on either pair. 2 rows remain. |
| **D6**, R17 and R18 out of Sprint 4 | **Superseded on 29 October by M1** ([re-plan](replan-2026-10-29.md)): R17, R18 and in-app reminders moved into Sprint 5 and shipped there ([Sprint 5 review](sprint-5-review.md)). They stayed out of Sprint 4's items. |

## Defects found during the sprint

| Issue | Defect | Fix |
| --- | --- | --- |
| #132 | The one-tap budget fix could raise the budget to an amount that still gave fewer than 3 destinations | #157, 3 November (a test in the same PR) |
| #154 | Demo trip dates could fall outside a place's season. Master CI failed just after midnight on 3 November, after #153: `run-seed.test.ts` expected Chakrata first and got Dhanaulti, because the reset date had moved | #155, 3 November |
| #165 | S4-7: the first live model call (20.1 s) exceeds the app's 20 s wording timeout. The plan falls back to templates and the cached repeat is model-worded. Two phrases overstate ("Spend the day trekking to Moila Top meadow and Tiger Falls."; "historic" Deoban forest), with no number, time, price or new place. | after submission |

No defect was found in the demo script on preview.

## Catalogue

| Stage | 28 October (start) | 3 November (now) | Change |
| --- | --- | --- | --- |
| A (hubs, destination identity) | 50/50 | 50/50 | none |
| B1 (cost rules, destination costs, car rows) | 136/137 | **137/137** | +1, Sariska costs (#144) |
| B2 (bus and train fares, best effort) | 85/116 | **102/104** | +17 verified; 12 rows deleted (10 trains with no service, 2 Gurugram buses with none), #158 |
| C (places of interest) | 202/276 | **214/276** | +10 (#146), +2 (#158) |

- **Start figures:** from `pnpm catalogue:check` on 28 October, recorded in the [Sprint 4 plan](sprint-4-plan.md) (finding 5, `64bd978`) and the [Sprint 3 review](sprint-3-review.md). `git log` shows no change under `packages/db/catalogue` between #92 (27 October) and #144, so they still held when Sprint 4 began.
- **Now:** `pnpm catalogue:check` on `7e28920`: 0 errors, 3 warnings (no beach destination; neemrana 3 places, ranthambore 5) and 1 info.
- **Batch reports:** [B1 Sariska](catalogue-s4-b1-sariska-2026-10-28.md), [B2 no-service trains](catalogue-s4-b2-no-service-2026-10-28.md), [B2 batch 2](catalogue-s4-b2-batch2-2026-10-29.md), [C batch 1](catalogue-s4-c-batch1-2026-10-29.md), [C batch 2](catalogue-s4-c-batch2-2026-11-03.md).

## Speed (R15)

| Where | Action | Time | Source |
| --- | --- | --- | --- |
| Preview | Shortlist, 3 members (Long weekend) | 633 ms | Review run, browser clock |
| Preview | Shortlist, 2 members | 749 ms | Review run |
| Preview | Round 2 shortlist | 817 ms | Review run |
| Preview | Diagnostic (Tight budget) | 209 ms | Review run |
| Preview | Choose a destination (packages built) | 212 to 539 ms | Review run |
| Preview | Plan the days, templates | 609 ms | Review run |
| Preview | Plan the days, model live | 20.5 s (timeout fallback); 0.4 s from cache | S4-7 file |
| Preview | Load check: 300 reads at 20 in flight; 400 at 40 | p95 229 ms and 334 ms; max 393 ms and 1,816 ms; all under 3 s | Review run, "Load check" |
| Local | `pnpm perf:recommend`, 5 runs, 33 feasible each | **min 80 ms, median 133 ms, max 226 ms** | This review |
| Local, in-process | Full journey: recommend, choose, plan | 113 ms, 69 ms, 94 ms | Integration run, this review |
| Production | n/a | **not measured** | Production has no demo accounts and its deployment URL is behind Vercel's login, so no run was made (review run, "Production"). The last production measurement is 250 ms to the shortlist on 28 October (#94, [Sprint 3 review](sprint-3-review.md)). |

Every screen measured on preview is under 3 s, and every shortlist is under 10 s. The one exception is the live model plan, which falls under the 30 s itinerary target. #25 (R15) also asks for 95% of requests under 3 s under load: a read-only load check on preview gave 100% under 3 s, with p95 229 ms at 20 requests in flight and 334 ms at 40 (review run, "Load check"). Its other criterion, a model-worded plan for eight members, does not apply while production uses the templates (D4); the live model's first-call time is #165. #25 is closed with this evidence.

## Velocity

Planned: Sprint 4 from Tuesday 3 to Saturday 7 November, items 1 to 12. Actual: items 2 to 6, 10 and 11 merged on the evening of 28 October and the early hours of 29 October, within 5 h 14 min of the plan's prompts (#127). Item 9 was done on 29 October, item 8's batches went on until 3 November, and item 7 ran on 3 November.

The last column is the time from the previous merge to master, Sprint 5's merges included. It is not hours worked; gaps include nights and other work.

| Prompt | PR | Created | Merged | Time box | Time between merges |
| --- | --- | --- | --- | --- | --- |
| S4-1 plan | #117 | 28 Oct 20:46 | 28 Oct 21:04 | 1 h + 30 min | 48 min |
| Prompts and the approved plan | #127 | 28 Oct 21:08 | 28 Oct 21:12 | none | 8 min |
| S4-2 stage counts | #128 | 28 Oct 21:28 | 28 Oct 21:39 | 45 min | 26 min |
| S4-3 two-member budget | #129 | 28 Oct 22:07 | 28 Oct 22:21 | 1.5 h | 42 min |
| S4-5 package cards (items 3 and 4) | #130 | 28 Oct 22:45 | 28 Oct 22:55 | 1.5 h | 34 min |
| Prune removes fares (refs #126) | #131 | 28 Oct 23:24 | 28 Oct 23:42 | none | 47 min |
| S4-6 model on deployments | #133 | 29 Oct 00:03 | 29 Oct 00:11 | 4 h | 30 min |
| S4-10 packages note | #134 | 29 Oct 01:54 | 29 Oct 02:00 | 45 min | 1 h 48 min |
| S4-11 bundle split | #135 | 29 Oct 02:15 | 29 Oct 02:26 | 45 min | 26 min |
| S4-9 close issues | no PR | n/a | issues closed 29 Oct 14:27 | 1 h | n/a |
| S4-8 B1 (Sariska) | #144 | 29 Oct 15:30 | 29 Oct 15:57 | M to L (Maulik) | 1 h 17 min |
| S4-8 C batch 1 | #146 | 30 Oct 02:11 | 30 Oct 04:36 | | 7 h 41 min |
| S4-8 no-service trains, B2 batch 2, C batch 2 | #158 | 3 Nov 16:39 | 3 Nov 16:56 | | 38 min |
| S4-7 preview check | no PR | n/a | run 3 Nov, about 22:35 to 23:15 | 1 h | n/a |
| S4-12 review | this PR | 3 Nov | pending | 1.5 h | pending |

Every master CI run since 28 October passed except one: the run after #153 (3 November, 00:03), which was #154 (above).

## Commands run for this review

All were run on 3 November on `7e28920` (master after #164), with Node 24.21.0.

- **`pnpm verify`:**
  - format, lint and typecheck all passed.
  - Tests: **Test Files 2 failed | 109 passed (111), Tests 2 failed | 1161 passed (1163)**, 214.9 s.
  - Both failures were `ENOBUFS`: Windows ran out of loopback sockets. One was `notifications.test.ts` "a member who has submitted cannot be reminded (409)" (`listen ENOBUFS`); the other was `trips.test.ts` "404 for a non-member" (`connect ENOBUFS`).
  - After a two-minute wait (sockets in TIME_WAIT fell from 1,140 to 150), the two files re-ran with **Test Files 2 passed (2), Tests 51 passed (51)**.
  - `verify` stops at the tests, so `pnpm build` was then run on its own and passed (web and the api bundle).
  - The log has no "already executing" line. It has 24 `MaxListenersExceededWarning` lines from test servers.
  - CI on `7e28920`: 111 files, 1163 tests passed.
- **`pnpm vitest run --project integration apps/api/src/e2e apps/api/src/seed apps/api/src/security`:** **Test Files 9 passed (9), Tests 109 passed (109)**, 110.7 s.

  ```text
  Access matrix: 49 endpoints x 6 actors
    anonymous       49 cases: 2x200 42x401 5x415
    nonMember       49 cases: 10x200 2x201 1x204 1x400 2x403 28x404 5x415
    member          49 cases: 17x200 2x201 2x204 1x400 16x403 2x404 4x409 5x415
    excludedMember  49 cases: 15x200 2x201 1x204 1x400 21x403 2x404 2x409 5x415
    organiser       49 cases: 21x200 2x201 5x204 1x400 2x403 1x404 11x409 5x415 1x422
    admin           49 cases: 12x200 2x201 1x204 1x400 28x404 5x415
  full journey: recommend took 113 ms
  full journey: choose a destination took 69 ms
  full journey: plan the days took 94 ms
  ```

- **`pnpm catalogue:check`:** exit 0, "0 error(s), 3 warning(s), 1 info", stages as in [Catalogue](#catalogue). **`pnpm catalogue:check --require b1`:** exit 0, the same summary.
- **`pnpm eval --scenarios 100 --output-dir <temp>`:** seed 20261029, metric A at 100.00% on all four checks (694/694, 303/303, 221/221, 303/303), with budget re-runs 11/11. The temp folder was deleted. See the [Sprint 5 review](sprint-5-review.md).
- **`pnpm perf:recommend`** with `pnpm dev` running (health `{"status":"ok","db":"ok"}`):
  - "R15 recommendation timing over 5 runs: min 80 ms, median 133 ms, max 226 ms (target under 10,000 ms; test budget 2,000 ms)";
  - "Cancelled 5 of 5 timing copies."

  The dev server this review started was then stopped; nothing else was listening on 4000 or 5173.
- **`pnpm --filter @bonvoyage/web build`:** exit 0, 24 assets, no chunk-size warning, `index` 302.28 kB (gzip 93.56 kB), `react-dom` 218.38 kB (gzip 68.12 kB).
- **`gh` for the "Sprint 4 (3-7 Nov): hardening" milestone:** **3 open, 8 closed.** Closed: #116, #118 to #121, #123, #124 and #132. Open: #122 and #125 (both closed by this review) and #126.
- **`gh issue view` for #18 to #25:**
  - #18, #19, #20, #21, #23 and #24 are closed.
  - #22 (R12) was open for #122; it is closed by this review.
  - #25 (R15) was open; it is closed with the evidence under [Speed](#speed-r15).

## Buffer: to finish before submission

The same list is in the [Sprint 5 review](sprint-5-review.md#buffer-to-finish-before-submission).

1. **The demo.** Maulik resets preview first (`pnpm db:seed --target preview --fresh-demos`) and does steps 0 and 6 (create and delete an account) by hand.
2. **S4-4:** a fix for any defect the demo finds, each with a failing-then-passing test, updating the script and `run-seed.test.ts` in the same PR.
3. **The project report.**
4. **Feature freeze on 8 November; submission (G3) on 10 November.**

After submission:

- #159, a catalogue import while a package is being drafted;
- #163, the one-tap budget fix when both caps bind;
- #165, the first live model call exceeding the 20 s wording timeout, and the two overstated phrases;
- one test server per file, for the Windows `ENOBUFS` failures in long local runs;
- deriving the test import date from the catalogue.

Still open and Maulik's call:

- #126 (2 B2 fares) and #39 (62 places);
- closing the Sprint 3 and Sprint 4 milestones.
