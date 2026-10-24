# S2-9: Sprint 2 review

Checks every Sprint 2 issue against its acceptance criteria with real evidence, runs the demo on production, records the result in `docs/sprints/sprint-2-review.md`, and moves anything unfinished into Sprint 3. It changes no code. Run it on Tuesday 27 after that day's catalogue batch, then send its final block back for the Sprint 3 prompts.

**Branch:** `docs/s2-review` · **Time box:** 45 minutes (plus about 20 minutes of yours) · **Depends on:** S2-1 to S2-8 merged (or knowingly skipped)

```text
S2-9  SPRINT 2 REVIEW
Branch: docs/s2-review   Time box: 45 minutes

CONTEXT
Read AGENTS.md, docs/prompts/sprint-2/README.md, docs/sprints/sprint-1-review.md (format to follow),
docs/decisions/0004, docs/specs/scoring.md, docs/traceability.md and docs/demo/sprint-2-demo.md.
Sprint 2 ran S2-1 to S2-8. Audit and record only: never fix code on this branch, never mark anything
passed without command output.

The review items:
  R1  Every Sprint 2 issue is closed by a merged PR and each acceptance criterion is met (evidence per
      criterion).
  R2  A fresh clone installs, migrates (0000 and 0001), seeds and passes pnpm verify; CI green on master.
  R3  Production and preview answer /api/health; both are on migration 0001 with nothing pending.
  R4  The golden example (6.7) passes, and the engine's scoring, group, costs and feasibility modules
      have 100 per cent branch coverage.
  R5  Privacy: the leak test covers the recommendation routes; on production, two accounts in one
      trip each see only their own For you line (Maulik).
  R6  The demo runs on production or preview end to end: shortlist, diagnostic with a one-tap fix and
      round 2, date clash, destination chosen (Maulik, following docs/demo/sprint-2-demo.md).
  R7  R15 speed: pnpm perf:recommend locally, and the time from clicking Get recommendations to the
      shortlist on production (Maulik); target under 10 s, design target under 2 s.
  R8  Integrations (R16): cache hits and the quota fallback are tested; provider_usage exists on
      production.
  R9  Catalogue: stage A 50/50 (due Mon 26 Oct) and imported to preview and production; B1 progress
      against 137 rows (due Sun 1 Nov).
  R10 The re-plan holds: #37 closed, the Sprint 1 milestone closed, the renamed milestones and CAT
      issues match docs/sprints/replan-2026-10-23.md, and #54 is on the Sprint 3 milestone.
  R11 docs/traceability.md lists the Sprint 2 tests on R4, R5, R6, R7, R15 and R16.
  R12 No key, connection string or .env file anywhere in git history.
  R13 Hours per prompt, approximate from PR times, confirmed by Maulik.

STEPS
1. Collect evidence for R1 to R13 as the Sprint 1 review did (the same commands where they apply,
   plus: pnpm db:migrate:remote --target preview --status and --target production --status; the
   engine coverage commands from S2-3 and S2-4; pnpm catalogue:check --require a and the B1 line).
2. HAND OVER to Maulik, one message, about 20 minutes: run docs/demo/sprint-2-demo.md on preview or
   production with two accounts (one on the phone); time Get recommendations three times; check each
   account's For you line shows only its own preferences; confirm production's /admin/catalogue shows
   stage A at 50/50.
   If he has not replied when you finish, mark those items "pending Maulik" and open the PR as a draft.
3. docs/sprints/sprint-2-review.md: title "Sprint 2 review (24 to 27 October 2026)" (or the real
   dates), result line (Pass, Pass with spill, Fail if R2, R4 or R6 failed), the R table with
   evidence, acceptance criteria per issue, what was built (merged PRs), an "Inventory for Sprint 3"
   (new endpoints with access rules, shared contracts, engine exports, integrations API, createApp
   deps, config files, error codes), "Known gaps" and the top three risks for Sprint 3 (packages
   need B1 data by 1 Nov, stage C and B2 fares, the Gemini quota in Sprint 4).
4. Spill issues "S2 spill: <item>" on the "Sprint 3 (28 Oct-2 Nov)" milestone for real failures only.
   Close the Sprint 2 milestone if every issue in it is closed.
5. Commit only the review file (and traceability if a link is wrong). PR "docs: Sprint 2 review".
6. End with this block, filled in:
     PASTE THIS BACK
     Gate: <Pass | Pass with spill | Fail | Provisional>
     Items: R1 <result> ... R13 <result>
     Spill issues: <numbers and titles, or none>
     Merged in Sprint 2: <PR numbers and titles>
     Endpoints: <count>, and any that differ from the Sprint 2 prompts
     Engine exports: <list>
     Integrations: <exports, providers, quota limits>
     Error codes added: <list>
     Config: <files and values>
     Recommendation speed: <local min/median/max ms; production seconds>
     Demo: <which scenarios worked where>
     Catalogue: stage A <v>/50, B1 <v>/137, B2 <v>/116, C <v>/21
     Velocity: <planned> planned, <actual> actual
     Deviations worth knowing: <one line each>
     Known gaps: <one line each>
     Open questions: <one line each, or none>
     Pending: <items waiting for Maulik>

VERIFICATION
git diff --stat master...HEAD shows only the review file (and traceability if fixed); the review table
has 13 rows; gh issue list --search "S2 spill in:title" --state open. Stop any dev server you start.

IF BLOCKED
A check cannot run: record "not run" with the reason and continue. A check fails because of a small
bug: record it and open a spill issue; never fix code here. Never edit .env or print env values.
```
