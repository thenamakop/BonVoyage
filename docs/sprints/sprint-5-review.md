# Sprint 5 review (29 October to 3 November 2026)

**Result: all four Could-have items shipped, and nothing was cut.** R17 fairness across rounds, in-app reminders, R18 voting and the offline evaluation harness are built, tested and checked on preview. The evaluation's metric A (hard constraints and pipeline consistency) is 100% on every check. This review (S5-7) closes the sprint.

- **Preview, 3 November:** every Sprint 5 check passed on a new 2-member trip and the Hills demo trip:
  - a reminder and its 429 with the time;
  - the bell rising in the other browser;
  - the 2-member voting rule;
  - the organiser choosing a place with fewer votes;
  - the round 2 fairness sentence, with no weight or number visible.

  The demo script's steps 1 to 5, including the new voting beat, matched line for line.
- **Production:** not run end to end. It has no demo accounts, and its deployment URL is behind Vercel's login. The deployment at `7e28920` is READY (Vercel API), and production's migrations are 6 of 6 (`pnpm db:migrate:remote --target production --status`, 3 November), so 0004 and 0005 are there. Its day plans use the templates (no `GEMINI_DAILY_LIMIT` on production).
- **Open:** three gaps go to after submission: #159, #163 and #165. See the [Buffer](#buffer-to-finish-before-submission).

Sprint 5 was planned for Thursday 29 October to Saturday 7 November ([plan](sprint-5-plan.md), [re-plan](replan-2026-10-29.md)). Every item merged by 3 November at 22:35. This review was written on 3 November, earlier than the planned 7 November, in the same PR as the [Sprint 4 review](sprint-4-review.md) (E7: two reviews). Times are India time unless marked UTC.

Evidence comes from three sources:

- **Review run:** [review-run-2026-11-03.md](review-run-2026-11-03.md). Claude in Cowork, 3 November, about 17:05 to 18:05 UTC, on preview at master `7e28920` (#164), migrations 6 of 6. Asha was in the Claude app's built-in browser and Meera in Chrome, both signed in by Maulik.
- **S4-7 check:** [s4-7-preview-check-2026-11-03.md](s4-7-preview-check-2026-11-03.md), for the demo rehearsal.
- **Commands:** listed under [Commands run for this review](sprint-4-review.md#commands-run-for-this-review) in the Sprint 4 review (the same run), and summarised [below](#commands-run-for-this-review).

## Plan items

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| S5-1 | Sprint 5 plan, issues and re-plan (#138) | shipped in #136 | [sprint-5-plan.md](sprint-5-plan.md) and [replan-2026-10-29.md](replan-2026-10-29.md); issues #139 to #142 created, #27 and #28 linked. #138 closed with #136's merge. |
| S5-2 | R17 fairness across rounds (#27) | shipped in #143 (engine), #145 (T21 "Ask again") and #147 (weights, migration 0004); closes #27 | Review run, Hills shortlist demo: round 1, then "Ask again" with its confirm, then round 2 read "Round 2" and "This round gives more weight to members whose wishes were met less in earlier rounds." (`run.favoursLessServed` true). The top five were unchanged. The page and the response carried no member weight, deficit or lambda. Tests in `pnpm verify`: `scoring/fairness.test.ts` and `fairness-golden.test.ts` (scoring.md section 8 to 1e-6), `scoring/golden.test.ts` (section 7 unchanged, M3), `trips/reopen-shortlist.test.ts`, `recommendations/earlier-rounds.test.ts`. |
| S5-3 | In-app notifications and organiser reminders (#139) | shipped in #148 (API) and #150 (web); closes #139 | Review run: "Reminder sent to Meera (demo)" and "You can remind Meera again after 4 Nov, 11:18 pm". A second `POST …/remind` gave 429 with `Retry-After: 86387` and the same sentence. Meera's bell went from none unread to "Notifications, 1 unread", then rose again with `shortlist_reopened` after "Ask again". `notifications/notifications.test.ts` (each of the nine types to the right people) passed after the `ENOBUFS` re-run. |
| S5-4 | R18 voting on the shortlist (#28) | shipped in #152 (API, I6, migration 0005) and #161 (web); closes #28 | Review run, 2 members: "0 of 2 voted" with no counts. After Asha voted, her card read "Your vote" (`aria-pressed="true"`). Meera's page read "1 of 2 voted" with no counts, and her `votes` was `{"voted":1,"eligible":2}`. After both voted: "Almora: 2 votes", "Lansdowne: No votes", "Chakrata: No votes". Asha then chose Lansdowne (0 votes): "Step 5 of 7: Packages proposed" in 212 ms. Demo rehearsal: "0 of 3 voted", "Your vote", "1 of 3 voted", and in Asha's window "1 vote" beside Choose. Tests: `recommendations/votes.test.ts`, `security/no-leak.test.ts`, `ShortlistPage.test.tsx` (voting), `demo-season.test.ts` (the vote beat). |
| S5-5 | Evaluation harness (#140) | shipped in #153 (the shared row-to-engine mapping and `@bonvoyage/db/catalogue`) and #162 (`scripts/eval/`, `pnpm eval`, first results); closes #140 | [results-2026-11-03.md](../evaluation/results-2026-11-03.md) (500 scenarios). This review's `pnpm eval --scenarios 100`: the same seed, and metric A at 100.00% on all four checks. The smoke test (`--scenarios 20`, under 20 s, A at 100%) is in `scripts/eval/eval.test.ts` and passed in `pnpm verify`. |
| S5-6 | Evidence and traceability (#141) | shipped in #164; closes #141 | Evidence comments on #27 and #28. Traceability rows R16 to R18. [known-limitations.md](../known-limitations.md). The `privacy.md` counts. |
| S5-7 | Sprint 5 review (#142) | this PR | This file. |

**Also merged in Sprint 5 (not plan items):**

- #149 and #151: cancelling a finalised trip (T16), API and dashboard;
- #155: demo trips stay in season after any reset (#154);
- #157: the one-tap budget fix unlocks a shortlist (#132);
- #75, #156 and #160: dependencies, with one `@types/node` (24) across the workspace.

## Decisions M1 to M4 and E1 to E7

| Decision | How it was carried out |
| --- | --- |
| **M1**, build all four items in Sprint 5 | All four shipped (S5-2 to S5-5). |
| **M2**, merge when CI is green; demo lines change with their PR | Every Sprint 5 PR has a green `ci` check (`gh pr view --json statusCheckRollup`). #153's check ran on 30 October; master's run after its merge (3 November, 00:03) failed on the season dates (#154), fixed by #155. #161 added the voting beat to `docs/demo/sprint-3-demo.md` and updated `run-seed.test.ts` and `demo-season.test.ts` in the same PR. #155 did the same for the demo dates. **Done late:** the planned Sunday 1 November re-run happened on the morning of 3 November instead, on the preview for the Dependabot PR (master at #152 plus the bumps). Steps 1 to 5 matched apart from two findings, both recorded in #154 and fixed in #155: the demo dates had left Chakrata's season, and step 5.7 was ₹15 higher on a Friday window (entry fees). The full run on the final master followed the same evening. The demo itself moved from 2 November. |
| **M3**, R17 never changes a trip's first shortlist | `scoring/golden.test.ts` (section 7 to 1e-6) and `run-seed.test.ts` (the Hills order) passed in `pnpm verify`. The demo's shortlists matched the script on preview. |
| **M4**, reminders in-app only | No email or push was built, and no new outbound service. The bell and panel are in-app (S5-3). [known-limitations.md](../known-limitations.md) records it. |
| **E1**, R17 rounds and formula | T21 `shortlistReopened` in #145, organiser only, in decision 0001's table. The deficit is on each earlier shortlist's top choice, with λ = 1 from configuration (#147). Returned `gfs`, `mean` and `sd` stay unweighted; the review run found only `run.weights` (the stored alpha, beta and gamma) in the round 2 response. |
| **E2**, per-member scores | Reused `reasons.members[].score`. Migration 0004 adds only `recommendation_run.lambda` (AGENTS.md section 10). |
| **E3**, notifications and the Remind limit | `member_joined` replaces T2 and `shortlist_reopened` covers T21, nine types in all. Remind allows once per member per rolling 24 hours. 429 `TOO_MANY_REQUESTS` with `Retry-After` was added to AGENTS.md section 7 and checked on preview. |
| **E4**, voting | Counts wait until both members of a 2-member trip have voted, and then show (checked on preview). `privacy.md` says each member of a pair can then work out the other's vote. I6 `voteCast` is in decision 0001's table (h). |
| **E5**, evaluation | 500 scenarios, seed 20261029, metrics A to D, the average-only and least-misery baselines, and λ 0, 0.5, 1 and 2, as in the results file. |
| **E6**, order and cut order | Order as planned: S5-2, then S5-3, then S5-4's API and S5-5's mapping move, then S5-4's web, the harness and S5-6. **Nothing was cut.** |
| **E7**, two reviews | `sprint-4-review.md` (#125) and this file (#142), both in this PR, written on 3 November rather than 7 November. |

## Evaluation headline numbers

Quoted from [results-2026-11-03.md](../evaluation/results-2026-11-03.md): 500 scenarios, seed 20261029, GFS weights 0.5, 0.3 and 0.2, λ = 1. Scores are synthetic preference matches on a 0 to 1 scale, not reported satisfaction.

**A. Hard constraints and pipeline (must be 100%).**

| Check | Result |
| --- | --- |
| Shortlisted destinations, independent F1–F5 arithmetic | 100.00% (3137/3137) |
| Package arithmetic and budget declarations | 100.00% (1312/1312) |
| Packages declared affordable that are within the group cap | 100.00% (924/924) |
| Catalogue plans passing `validateItinerary` | 100.00% (1312/1312) |

**B. Top-choice group fit, 329 groups.**

| Method | Minimum score, median [Q1, Q3] | Any member scores zero |
| --- | --- | --- |
| GFS | 0.0600 [0.0000, 0.1500] | 35.26% (116/329) |
| Average only | 0.0000 [0.0000, 0.1000] | 52.28% (172/329) |
| Least misery | 0.0600 [0.0000, 0.1667] | 31.31% (103/329) |

**C. Fairness across three rounds, 281 groups.**

| Measure | λ = 0 | λ = 1 |
| --- | --- | --- |
| Cumulative spread, paired change against λ = 0 | baseline | lower for 7.12% (20/281), equal for 92.53% (260/281), higher for 0.36% (1/281); median change 0.0000 |
| Same member uniquely least served in 2 or more rounds (strict) | 59.43% (167/281) | 59.07% (166/281) |

**D. Budget recovery.**

- F5 diagnostics with a one-tap suggestion that reach a shortlist on re-run: **100.00% (39/39)**.
- 119 F5 diagnostics have no actionable suggestion:
  - **116 (97.48%)**: the required amount would cross the other cap. The group cap is the lower of the trip budget and n × the lowest member maximum, so raising one side alone cannot reach a shortlist (#163).
  - 3: too few budget-only misses.
- The synthetic member maxima sit close to the trip target, so the rate is likely overstated ([known-limitations.md](../known-limitations.md)).

The results file records no defect. This review's re-run (`--scenarios 100`, the same seed) gave metric A at 100.00% (694/694, 303/303, 221/221 and 303/303), with budget re-runs 11/11 and 24 diagnostics out of 100.

## Review-run checks

| Check | Result |
| --- | --- |
| Reminder, and the second one refused with the time (429, `Retry-After`) | pass |
| The bell rises in the other browser (reminder, then `shortlist_reopened`) | pass |
| Voting in a 2-member trip: no counts until both have voted | pass |
| The organiser chooses a place with fewer votes | pass |
| The fairness sentence on round 2 | pass |
| No weight or number visible | pass |
| Sprint 4 checks still in place (travel time, 44 px toggle, two-member budget hiding, templates) | pass |
| Demo script, steps 1 to 5, with the voting beat | pass (steps 0 and 6 are Maulik's, by hand) |

**Defects found in the run:** none in the Sprint 5 checks. The S4-7 observations (first-call latency, two overstated phrases) are in the [Sprint 4 review](sprint-4-review.md#defects-found-during-the-sprint) as #165.

**Defects found during the sprint:**

- #154: master CI failed after #153 (3 November, 00:03), because demo dates fell out of season. Fixed in #155.
- #132: the one-tap fix could leave fewer than 3 destinations. Fixed in #157.
- The Dependabot group bump #75 broke lint: a second `@types/node` (26) gave the web tests a second Vitest copy. Fixed by #156, then #160.

## Counts before and after

| Count | Start of Sprint 5 (`af71a5d`, master before #136) | Now (`7e28920`, after #164) | Change |
| --- | --- | --- | --- |
| API endpoints in the inventory | 42 | 49 | +7: four notification endpoints, reopen-shortlist, and PUT and DELETE vote |
| Test files | 96 | 111 | +15 |
| Tests | 890 | 1163 | +273 |
| Migrations | 4 (0000 to 0003) | 6 (0004 lambda, 0005 vote) | +2 |

Sources:

- Endpoints: the `path:` entries in `apps/api/src/test/endpoint-inventory.ts` (`git show <sha>:<path>`). Now is also the access matrix's "49 endpoints x 6 actors".
- Test files: `*.test.ts(x)` in `git ls-tree`, matching CI's "Test Files" at both commits.
- Tests: CI on `af71a5d` ("Tests 890 passed (890)") and on `7e28920` ("Tests 1163 passed (1163)").
- Migrations: the SQL files in `packages/db/migrations`.

## Velocity

Planned: 29 October to 7 November, S5-1 to S5-7. The prompts' time boxes add up to about 24 hours of agent work (S5-1 1.5 h, S5-2 3 × 2 h, S5-3 and S5-4 2 × 2.5 h each, S5-5 2 × 2 h, S5-6 1 h, S5-7 1.5 h). Actual: S5-1 to S5-6 merged by 3 November at 22:35, four days early.

The last column is the time from the previous merge to master, Sprint 4's merges included. It is not hours worked.

| Prompt | PR | Created | Merged | Time box | Time between merges |
| --- | --- | --- | --- | --- | --- |
| S5-1 plan | #136 | 29 Oct 04:21 | 29 Oct 14:40 | 1.5 h | 12 h 14 min |
| S5-2a fairness engine | #143 | 29 Oct 15:02 | 29 Oct 20:31 | 2 h | 4 h 34 min |
| S5-2b-1 "Ask again" (T21) | #145 | 29 Oct 20:47 | 29 Oct 20:55 | 2 h | 24 min |
| S5-2b-2 weights (0004) | #147 | 30 Oct 05:00 | 30 Oct 05:06 | 2 h | 30 min |
| S5-3 API | #148 | 30 Oct 05:25 | 30 Oct 15:10 | 2.5 h | 10 h 4 min |
| T16 fix | #149 | 30 Oct 15:22 | 30 Oct 15:45 | none | 36 min |
| S5-3 web | #150 | 30 Oct 16:06 | 30 Oct 16:13 | 2.5 h | 28 min |
| T16 from the dashboard | #151 | 30 Oct 16:27 | 30 Oct 18:59 | none | 2 h 46 min |
| S5-4 API (0005) | #152 | 30 Oct 19:22 | 30 Oct 19:43 | 2.5 h | 44 min |
| S5-5 step 0 (mapping move) | #153 | 30 Oct 19:56 | 3 Nov 00:03 | 2 h | 76 h 20 min |
| Demo dates (#154) | #155 | 3 Nov 05:20 | 3 Nov 13:22 | none | 13 h 19 min |
| `@types/node` in apps/web | #156 | 3 Nov 14:07 | 3 Nov 14:11 | none | 49 min |
| One-tap rule (#132) | #157 | 3 Nov 14:32 | 3 Nov 14:50 | none | 39 min |
| Dependabot group bump | #75 | 24 Oct 19:16 | 3 Nov 16:18 | none | 1 h 28 min |
| One `@types/node` | #160 | 3 Nov 17:14 | 3 Nov 17:19 | none | 23 min |
| S5-4 web | #161 | 3 Nov 18:27 | 3 Nov 18:57 | 2.5 h | 1 h 38 min |
| S5-5 harness | #162 | 3 Nov 20:19 | 3 Nov 21:20 | 2 h | 2 h 23 min |
| S5-6 evidence | #164 | 3 Nov 22:00 | 3 Nov 22:35 | 1 h | 1 h 15 min |
| S5-7 review | this PR | 3 Nov | pending | 1.5 h | pending |

#153 stayed open from 30 October to 3 November (00:03). #158 (catalogue, Sprint 4) merged between #75 and #160.

## Commands run for this review

The full outputs are in the [Sprint 4 review](sprint-4-review.md#commands-run-for-this-review); both reviews come from one run on `7e28920` with Node 24.21.0.

- **`pnpm verify`:** format, lint and typecheck passed. Tests: 1161 of 1163 passed; the 2 failures were `ENOBUFS`, and both files passed on re-run (51 tests). The build passed when run on its own.
- **Integration (`e2e`, `seed`, `security`):** 9 files, 109 tests passed. Access matrix: 49 endpoints x 6 actors.
- **`pnpm eval --scenarios 100`:** metric A 100.00%; the temp output folder was deleted.
- **`pnpm --filter @bonvoyage/web build`:** no chunk-size warning.
- **`gh` for the "Sprint 5 (29 Oct-7 Nov): Could-haves" milestone:** **1 open, 6 closed.** Closed: #27, #28 and #138 to #141. Open: #142, closed by this PR.

## Buffer: to finish before submission

The same list is in the [Sprint 4 review](sprint-4-review.md#buffer-to-finish-before-submission).

1. **The demo.** Maulik resets preview first (`pnpm db:seed --target preview --fresh-demos`) and does steps 0 and 6 (create and delete an account) by hand.
2. **S4-4:** a fix for any defect the demo finds, each with a failing-then-passing test, updating the script and `run-seed.test.ts` in the same PR.
3. **The project report.**
4. **Feature freeze on 8 November; submission (G3) on 10 November.**

After submission:

- #159, a catalogue import while a package is being drafted;
- #163, the one-tap budget fix when both caps bind;
- #165, the first live model call exceeding the 20 s wording timeout, and the two overstated phrases.
