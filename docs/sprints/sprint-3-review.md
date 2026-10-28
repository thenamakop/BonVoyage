# Sprint 3 review (27 to 28 October 2026)

**Result: G2 holds on preview and production.** The MVP requirements R1 to R11 are built and tested, `pnpm verify` passes, and CI is green on every Sprint 3 merge.

- **Preview:** on 28 October the Monday demo script ran end to end: sign-up, preferences, shortlist, packages, day plan, finalised trip, the transport comparison and account deletion. The dry run found three defects (D1 to D3); all three are fixed and merged (#112, #113, #114).
- **Production:** the checks carried from Sprint 2 (#94) passed the same day. Two real accounts in one trip each saw only their own For you line, and the shortlist appeared in 250 ms.

Nothing checked has failed. One privacy observation from production becomes a Sprint 4 decision (#116). G2's acceptance itself is Maulik's call at the Monday demo. See [To finish](#to-finish).

Sprint 3 was planned for Tuesday 27 October to Monday 2 November, with prompts S3-1 to S3-9 ([re-plan](replan-2026-10-27.md)). S3-1 to S3-8 merged between 27 October 11:22 and 28 October 15:04. The dry-run fixes merged by 28 October 19:42. This review was written on 28 October from the dry-run results and the commands below. Times are India time unless marked UTC.

Evidence comes from three sources:

- **Dry run:** Maulik's dry-run results of 28 October. Preview deployment `bonvoyage-f38tn50vh`, `LIVE_APIS` off. Claude drove Asha in the Claude app's built-in browser, Meera ran in Brave, and Maulik ran steps 0 and 6 in a private window.
- **Production check (#94):** 28 October, `https://bonvoyage-orpin.vercel.app`, `LIVE_APIS` off, run by Claude in Cowork. Maulik Gupta was the organiser in the built-in browser and Parth Bansal the member in Brave. Trip "Production Check": Gurugram, 2 nights, ₹30,000, 300 km; both members submitted.
- **Commands:** the outputs listed under [Commands run for this review](#commands-run-for-this-review).

## Review items

| Area | Check | Evidence | Result | Follow-up |
| --- | --- | --- | --- | --- |
| Build | `pnpm verify` passes on master; CI is green | `pnpm verify` on `c179e87`: format clean, lint clean, typecheck done, **91 files, 831 tests passed**, build ok (web and api bundle). `gh run list --branch master --workflow ci`: all 12 Sprint 3 merges (#103 to #114) are `completed/success`. | pass | — |
| R2 | Create a trip, invite members, manage the roster | `apps/api/src/e2e/full-journey.test.ts` signs three users up over HTTP, creates the trip, invites and joins (transitions T1, T2, I1, I1). It passed in the integration run (8 files, 77 tests). Dry run step 0 (Maulik): a new account created "Diwali weekend", and the dashboard read "Step 1 of 7: Draft" and "Create the invite link to open the trip." | pass | — |
| R8 | At least three costed packages with group and per-person totals; members give opinions; the organiser chooses or changes one | Dry run step 3: Chakrata's Saver ₹29,566 (₹9,856 each), Balanced ₹31,566 and Comfort ₹39,966, as scripted. Meera's Works for me gave "1 of 3 say it works" and "You said it works."; Asha saw "1 of 3 say it works" with no name. Change took 282 ms; choosing Saver took 390 ms and the card showed "Chosen". Step 5: Bikaner's four packages match the script table, three of them flagged over budget, and Change offered Train, Bus and Car. **D1:** after changing Balanced from Train to Bus, the card showed ₹22,570 but still "₹5,195 over" (the train figure). Fixed in #112: the amount is now the stored total minus the cap. The new test fails on the old code (`expected +0 to be 18000`). A local run after #112 shows "₹8,570 over the group budget". | pass (D1 fixed in #112; not rechecked on preview) | Recheck step 5.7 on preview |
| R10 | Account deletion (#54) and preference privacy | Dry run step 6 (Maulik): deletion was refused with "Cancel or finish these trips first:" and a link to Diwali weekend. The trip was cancelled ("Cancel this trip? Nobody will be able to plan it after this."). After deletion the page read "✓ Your account has been deleted." and the header showed only Sign in. Signing in again gave "Email or password is incorrect." **D3:** the refusal was shown twice. Fixed in #114, with a test asserting exactly one alert. The stale session after deletion was found and fixed before the dry run (#111). Privacy: see the privacy row. | pass (D3 fixed in #114; not rechecked on preview) | — |
| R12 | A day plan built only from catalogue facts, with unverified items marked in words | Dry run step 4: "Planning the days. This can take up to 30 seconds."; the plan appeared in 552 ms with "Saver package · version 1" and "Planned from the BonVoyage catalogue". Tiger Falls read "Not verified: This place's details are not verified yet."; every other item read Verified. Tests: the itinerary, engine and seed tests in `docs/traceability.md` R12 all passed in `pnpm verify`. **Not exercised:** model wording (`LIVE_APIS=on`); every plan in the dry run came from the catalogue planner. | pass (catalogue planner); model wording not exercised | Sprint 4: run once with `LIVE_APIS=on` |
| R13 | Accept, adjust or reject the day plan | Dry run step 4: Remove Lakhamandal gave "17:50–18:50 · Free time". Swap on Tiger Falls offered only Lakhamandal Temple; after the swap, Day 2 12:30–14:30 read Lakhamandal Temple, Verified. Meera's view was read-only: "Waiting for Asha (demo) to accept the plan." Accept took 226 ms and the dashboard read "Step 7 of 7: Finalised" and "Trip finalised: Chakrata, 28 Nov 2026 – 30 Nov 2026, Saver package, ₹29,566 for the group, about ₹9,856 each (estimate)." The Trips page listed it under "Past and finalised trips". Reject (T13) was not part of the dry run; `apps/api/src/itinerary/itinerary.test.ts` covers T13 and version 2. The full-journey test asserts I5, I5 and T14 over HTTP. | pass (reject by test only) | — |
| R14 | Every figure labelled by provenance | Dry run step 3: the cost lines show Curated badges, and the entry-fee line shows Estimate. Step 4: day-plan items read Verified or "Not verified" in words. `packages.test.ts` (provenance per line) and `ItineraryPage.test.tsx` (badges) passed in `pnpm verify`. | pass | — |
| R15 | Recommend under 10 s (design target 2 s); destination choice with packages under 1 s; day plan under 2 s with templates | Preview, browser clock (dry run): recommend 278 ms; choose Chakrata 258 ms; Change 282 ms; choose Saver 390 ms; plan 552 ms; accept 226 ms; Tight budget round 1 214 ms and round 2 260 ms; choose Bikaner 400 ms. Local `pnpm perf:recommend` with `pnpm dev` running: 138, 73, 56, 54 and 52 ms (33 feasible each), **min 52 ms, median 56 ms, max 138 ms**, 5 of 5 copies cancelled. In-process tests: destination choice 42 ms, day plan 55 ms, shortlist 43 ms (`pnpm verify`); full journey recommend 57 ms, choose 50 ms, plan 58 ms (integration run). Production (#94): Get recommendations to the shortlist on screen in **250 ms** (limit 10 s). There were 15 feasible places; the first three were Lansdowne, Mussoorie and Dehradun, with the note "These are the closest options; none match the types the group asked for well." | pass (local, preview and production) | — |
| Privacy | Members see only their own reasons and opinion; counts carry no names; the day plan holds no member data | Preview (dry run): Asha's For you line on Chakrata was 2.9 (adventure, trekking, camping) and Meera's was 4.3 (‘hill station’, trekking). Meera had no Choose button and read "Waiting for Asha (demo) to choose a destination." Package opinions were counts with no member names on either packages page; Meera saw no organiser buttons and a read-only day plan. Tests: the access matrix covers **42 endpoints × 6 actors**; the leak test covers package opinions ("package responses hold opinion counts and only the caller’s own vote") and the day plan ("itinerary responses hold no member data"). Production (#94), 2 members: each member's For you lines cite only their own picks (the organiser's mountain, trekking, rafting and camping; the member's beach and boating). The member's shortlist page, and his GET responses for the trip, the group profile and the latest recommendation, contain none of the organiser's picks and no email; the only name is in "Waiting for Maulik Gupta to choose a destination." The member has no organiser actions and no Choose buttons. With 2 members the "Opinions differ" range is hidden. **Observation, not a failure:** with 2 members, the group profile's common window (4 to 10 Nov) and budget band (₹20,000 to ₹25,000) let each member infer the other's binding start date and minimum budget (rounded to ₹500). | pass (tests, preview and production) | #116 (two-member bounds) |
| Demo | `docs/demo/sprint-3-demo.md` end to end on preview | Every step ran on preview, and the screens matched the script line for line, except D1 (R8), D2 (below) and D3 (R10). **D2:** Change on Chakrata's Comfort made it identical to Balanced; the ₹135 gap between Bikaner's shortlist (₹13,860) and its Saver package (₹13,995) was unexplained; the Swap list said "Entry ₹0 per person (estimate)". Fixed in #113: Change moved to step 5.7, the gap is explained (the shortlist estimate has no entry-fee line, confirmed against `composeEstimate`), and the Swap list says "Free entry". | pass (D1 to D3 fixed) | Rerun steps 3, 4.6 and 5.7 on preview after a reset |
| Catalogue | Stage status | `pnpm catalogue:check` → exit 0, **0 errors, 3 warnings** (no beach destination; neemrana 3 POIs, ranthambore 5). Stage A 50/50 (due 26 Oct), **B1 136/137** (due 1 Nov), B2 85/116 (best effort, 5 Nov), **C 202/276** (due 1 Nov). The same as the re-plan of 27 October: no rows were verified during the sprint. Every destination has places of interest (min 3, median 6). | in progress, not yet due | #38, #39 (due 1 Nov) |

## What was cut under decision 0005 k

Nothing was cut:

- Itinerary Adjust (I5) shipped in #109 and was shown in the dry run (Remove and Swap).
- Package Change (I3) shipped in #106 and #108 and was shown in steps 3 and 5.
- Model wording is built (`createLlmClient`, the itinerary wording step) but was not exercised: preview ran with `LIVE_APIS` off.

## Dry-run defects

| Id | Defect | Fix | Test |
| --- | --- | --- | --- |
| D1 | The over-budget amount was stale after Change: Bikaner Balanced moved to Bus showed ₹22,570 and "₹5,195 over" (the train figure). | #112 | `packages.test.ts` "after a change (I3) overByInr follows the stored total, proposed and accepted" |
| D2 | Script: Change on Chakrata duplicated Balanced; the ₹135 entry-fee gap was unexplained; the Swap list said "Entry ₹0". | #113 | `ItineraryPage.test.tsx` "the Swap list words fees as the day plan does" |
| D3 | The deletion refusal was shown twice; Recent activity said "in 2 minutes" when the browser clock was behind. | #114 | `ProfilePage.test.tsx` (exactly one alert), `format.test.ts` (now + 2 min and now + 10 min read "just now") |
| — | Before the dry run: account deletion left a stale client session; sign-out had the same bug in the header. | #111 | `clear-session.test.tsx`, `LandingPage.test.tsx`, `ProfilePage.test.tsx` |

All four are merged. **Spill issues: none.** Nothing that failed is still open.

## What was built (merged in Sprint 3)

| PR | Title | Issue |
| --- | --- | --- |
| #103 | docs: Sprint 3 kickoff: decision 0005, re-plan and backlog | S3-1 |
| #104 | feat: package and day-plan engine | #95 (S3-2) |
| #105 | feat: account deletion and admin stage labels | #98 (S3-5), #54, #81 |
| #106 | feat: packages API and migration 0002 | #96 (S3-3) |
| #107 | feat: day-plan API | #99 (S3-6) |
| #108 | feat: packages screen | #97 (S3-4) |
| #109 | feat: day-plan screen, adjust and trip history | #100 (S3-7) |
| #110 | feat: fresh demos, full-journey test, prune and the Monday demo script | #101 (S3-8) |
| #111 | fix: sign out in the client after account deletion | refs #98 |
| #112 | fix: recompute over-budget amount after a package change | D1 |
| #113 | docs: demo script dry-run corrections | D2 |
| #114 | fix: one deletion alert and no future relative times | D3 |

## How the work was done (facts checked against GitHub)

- **Wrong issue numbers in two PR bodies.**
  - #105 (S3-5) said "Closes #96", so it closed S3-3's issue as well as #54 and #81.
  - #106 (S3-3) said "Closes #97", so it closed S3-4's issue.
  - On 28 October at 04:00 (22:30 UTC on 27 October) Maulik reopened #97 and closed #98 by hand. #108 then closed #97.
  - Every S3 build issue is now closed, but GitHub shows #105 as the closer of #96.
- **The dry run** used a preview deployment built after #111 (the deletion notice was there) and before #112. The fixes for D1 to D3 (#112 to #114) are covered by tests. They are on production through master's deployment, and #112's figures were also read off a local run. They were not re-run on preview. Monday's demo runs on a preview reset after this review merges.
- **Feature PRs are over the 400-line guide:** #104 about 1,650 lines, #106 about 5,000, #107 about 1,750, #109 about 1,250 and #110 about 1,100.

## Commands run for this review

All were run on 28 October on `c179e87` (master after #114), with Node 24.21.0.

- `pnpm verify` → exit 0:
  - "All matched files use Prettier code style!"
  - lint clean; typecheck done for six packages
  - **Test Files 91 passed (91), Tests 831 passed (831)**, 122.5 s
  - web build ✓, api bundle `dist/server.mjs` 6.0 MB
- `pnpm vitest run --project integration apps/api/src/e2e apps/api/src/seed apps/api/src/security` → **Test Files 8 passed (8), Tests 77 passed (77)**, 54.0 s. The access matrix and the timings printed:

  ```text
  Access matrix: 42 endpoints x 6 actors
    anonymous       42 cases: 2x200 35x401 5x415
    nonMember       42 cases: 9x200 2x201 1x400 2x403 23x404 5x415
    member          42 cases: 16x200 2x201 1x204 1x400 14x403 1x404 2x409 5x415
    excludedMember  42 cases: 14x200 2x201 1x400 17x403 1x404 2x409 5x415
    organiser       42 cases: 20x200 2x201 3x204 1x400 2x403 1x404 7x409 5x415 1x422
    admin           42 cases: 11x200 2x201 1x400 23x404 5x415
  full journey: recommend took 57 ms
  full journey: choose a destination took 50 ms
  full journey: plan the days took 58 ms
  ```

- `pnpm catalogue:check` → exit 0, "0 error(s), 3 warning(s), 1 info"; stages as in the Catalogue row.
- `pnpm perf:recommend` with `pnpm dev` running (health `{"status":"ok","db":"ok"}`) → "min 52 ms, median 56 ms, max 138 ms (target under 10,000 ms; test budget 2,000 ms)", "Cancelled 5 of 5 timing copies." The dev server was then stopped.
- `gh api` for the "Sprint 3 (27 Oct-2 Nov)" milestone: **9 open, 9 closed**.
  - Closed: #54, #81 and #95 to #101.
  - Open: requirement issues #18 (R8), #20 (R10), #22 (R12), #23 (R13) and #24 (R14); catalogue #38 and #39; #94 (closed by this PR); and #102 (S3-9, closed by this PR).

## Known gaps (not spill issues)

- **#112 to #114 have not been re-run on preview.** The dry-run deployment predates them; they reach production through master's deployment.
- **Model wording has never run against Gemini on preview.** It is optional for the demo; the templates are the fallback.
- **Reject (T13) is tested but was not part of the dry run.**
- **B1 (136/137) and C (202/276) are due Sunday 1 November.** Where they are not verified, packages and day plans keep saying Estimate or Not verified.
- **The web bundle is 596 kB** (Vite warns above 500 kB). This is not a correctness issue.

## Velocity

Planned: Sprint 3 from Tuesday 27 October to Monday 2 November, S3-1 to S3-9, with time boxes of about 21 hours ([README](../prompts/sprint-3/README.md)). Actual: S3-1 to S3-8 merged within 28 hours, and the dry-run fixes merged the same evening, four days ahead of plan.

The last column is the time from the previous merge to this one, not hours worked. The previous merge before #103 is #93 (Sprint 2 review, 27 Oct 04:20). Gaps include nights and other work. These figures come from PR times and have not yet been confirmed by Maulik.

| Prompt | PR | Created | Merged | Time box | Time between merges |
| --- | --- | --- | --- | --- | --- |
| S3-1 kickoff | #103 | 27 Oct 11:15 | 27 Oct 11:22 | 45 min | 7 h 2 min (overnight) |
| S3-2 engine | #104 | 27 Oct 11:35 | 27 Oct 11:47 | 3 h | 25 min |
| S3-5 account deletion | #105 | 27 Oct 12:01 | 27 Oct 12:15 | 2 h | 28 min |
| S3-3 packages API | #106 | 27 Oct 12:38 | 27 Oct 13:01 | 3 h | 46 min |
| S3-6 day-plan API | #107 | 27 Oct 13:34 | 28 Oct 03:17 | 3 h | 14 h 16 min |
| S3-4 packages screen | #108 | 28 Oct 03:28 | 28 Oct 04:10 | 3 h | 53 min |
| S3-7 day-plan screen | #109 | 28 Oct 05:09 | 28 Oct 05:43 | 3 h | 1 h 33 min |
| S3-8 demo | #110 | 28 Oct 06:22 | 28 Oct 15:04 | 2 h | 9 h 21 min |
| Deletion sign-out fix | #111 | 28 Oct 15:25 | 28 Oct 18:15 | 45 min | 3 h 11 min |
| D1 over-budget fix | #112 | 28 Oct 18:54 | 28 Oct 19:05 | 45 min | 49 min |
| D2 script corrections | #113 | 28 Oct 19:14 | 28 Oct 19:18 | 40 min | 14 min |
| D3 display fixes | #114 | 28 Oct 19:37 | 28 Oct 19:42 | 30 min | 24 min |
| S3-9 review | this PR | 28 Oct | — | 1 h | — |

## To finish

Before the Monday demo:

1. **Reset preview after this review merges** (`pnpm db:seed --target preview --fresh-demos`, Maulik). Monday's demo runs on that reset. Before then, rerun steps 3, 4.6 and 5.7, plus step 6's refusal, on a deployment that includes #114. This confirms D1 to D3 on preview.
2. **Accept G2:** Maulik reviews this page. Then close the requirement issues #18, #20, #22, #23 and #24, as was done for Sprint 2.

Sprint 4 (hardening, 3 to 7 November):

1. **Two-member groups (#116):** decide whether to hide the window and budget bounds below 3 members, or document the limit in `docs/security/privacy.md`. That file already keeps the common window for every group size (decided 26 October) and says what it shows in a 2-member group. The budget band's 2-member inference is not documented, so the budget band is the open part.
2. **Model wording:** one day plan on preview with `LIVE_APIS=on`, checking that the wording passes `validateItinerary` and stays within the quota.
3. **Catalogue:** B1 and C by 1 November (#38, #39); B2 and fee pass 2 best effort by 5 November.
4. Fixes from the Monday demo.

Then close the Sprint 3 milestone once #38 and #39 are closed or moved.
