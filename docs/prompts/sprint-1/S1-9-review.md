# S1-9: Sprint 1 review

Checks every Sprint 1 issue against its acceptance criteria with real evidence, walks the whole Sprint 1 journey on production, records the result in `docs/sprints/sprint-1-review.md`, and moves anything unfinished into Sprint 2 ahead of new features. It changes no code. Run it on Sunday evening, after your last catalogue batch, and send its final block back to get the Sprint 2 prompts.

**Branch:** `docs/s1-review` · **Time box:** 45 minutes (plus about 20 minutes of your own for the walkthrough) · **Depends on:** S1-1 to S1-8 merged (or knowingly skipped) and stage A finished

```text
S1-9  SPRINT 1 REVIEW
Branch: docs/s1-review   Time box: 45 minutes

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md, docs/sprints/sprint-0-review.md (the format to follow), docs/traceability.md and docs/security/privacy.md. Sprint 1 ran S1-1 to S1-8 (issues #29 to #36) and catalogue stage A (#37). This task audits and records; it does not fix anything. A failed check is recorded with its evidence and becomes a spill issue; it is never repaired on this branch and never marked passed without output.

The review items:
  R1  Issues #29 to #37 are closed by merged pull requests, and every acceptance criterion in each issue body is met (check each one; quote the evidence).
  R2  A fresh clone installs, migrates, seeds and passes pnpm verify; CI is green on master.
  R3  Production answers /api/health with {"status":"ok","db":"ok"}; Neon preview and production have no pending migrations (Sprint 1 added none).
  R4  The Sprint 1 journey works on production (Maulik's walkthrough, step 2).
  R5  SRS 3.3: a change by one member shows on another member's dashboard within 10 seconds on production.
  R6  The access matrix, leak and log tests pass; every registered route is in the inventory.
  R7  Spike S4: the phone session result is recorded in docs/spikes.
  R8  pnpm catalogue:check --require a passes, and production holds the verified stage A rows.
  R9  Accessibility spot check: keyboard-only journey works; Lighthouse accessibility is at least 90 on /sign-in, /trips/:id and /trips/:id/preferences.
  R10 docs/traceability.md lists Sprint 1's test files on R1, R2, R3, R9, R10 and R11, and the wireframes.
  R11 No key, connection string or .env file anywhere in git history.
  R12 Actual hours per prompt are recorded against the time boxes.

GOAL
docs/sprints/sprint-1-review.md records each item with evidence and result, what was built, deviations, the API and UI inventory Sprint 2 builds on, the velocity, and the top risks for Sprint 2. Every failed item has an "S1 spill" issue in Sprint 2. The final message ends with a block Maulik pastes back to get the Sprint 2 prompts.

STEPS
1. Collect evidence, one item at a time, saving each command and the lines that prove the result:
   R1   gh issue view <n> --json state,closedByPullRequestsReferences,body for 29 to 37; for each acceptance criterion, name the test or the observation that proves it.
   R2   git clone --branch master . ../bv-review && cd ../bv-review && cp .env.example .env; in that throwaway clone only, set BETTER_AUTH_SECRET to a freshly generated value and SEED_DEMO_PASSWORD to a throwaway 16-character value; pnpm install --frozen-lockfile; pnpm db:up; pnpm db:migrate; pnpm db:seed; pnpm verify. Delete ../bv-review afterwards. gh run list --branch master --limit 5 --json conclusion,displayTitle.
   R3   curl -s https://bonvoyage-orpin.vercel.app/api/health ; pnpm db:migrate:remote --target preview --status ; pnpm db:migrate:remote --target production --status
   R4, R5, R7, R9   HAND OVER (step 2).
   R6   pnpm vitest run --project integration apps/api/src/security
   R8   pnpm catalogue:check --require a ; ask Maulik for the stage A line from /admin/catalogue on production (or the output of pnpm catalogue:import --target production).
   R10  git diff of docs/traceability.md since the Sprint 0 review commit.
   R11  git log -p --all | grep -cE 'AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{20,}|postgres(ql)?://[^ ]*@[^ ]*neon' (must print 0) ; git log --all --format=%h -- .env .env.neon (must print nothing)
   R12  ask Maulik for the actual hours per prompt (S1-1 to S1-8 and the catalogue time).

2. HAND OVER to Maulik, one message with this checklist (about 20 minutes; he replies with the results, never with passwords):
   a) On production in a desktop browser, sign up account A (for example your email with +bv1 before the @). Create a trip from Gurugram, 2 nights, ₹45,000, 400 km. Create the invite link.
   b) On your phone, open the link, sign up account B, join, submit preferences. Note whether the desktop dashboard updated without a reload and roughly how many seconds it took.
   c) In a private window, sign up account C through the link, join, and do not submit. As A, close submissions: C is removed; status Ready for recommendation.
   d) As B, revise the budget: the saved message says the group profile will be recalculated.
   e) Keyboard only on desktop (Tab, Shift+Tab, Enter, Space, Escape): sign out, sign in, open the trip, open preferences. Note anything you could not reach or could not see focus on.
   f) Chrome DevTools, Lighthouse, Accessibility only, mobile: run it on /sign-in, the trip dashboard and the preference form; note the three scores.
   g) Confirm the S4 phone note is merged (S1-1 hand-over).
   h) Afterwards, as A, cancel the test trip.

3. docs/sprints/sprint-1-review.md:
   - Title "Sprint 1 review (13 to 18 October 2026)" and a result line: Pass, Pass with spill, or Fail (Fail if R2, R4 or R6 failed).
   - A table: Item | Check | Evidence | Result (pass, fail, moved, not run) | Follow-up issue.
   - Acceptance criteria per issue, each with its evidence.
   - What was built: one line per merged pull request since the Sprint 0 review (gh pr list --state merged --search "merged:>=2026-10-12" --json number,title).
   - Inventory for Sprint 2: every endpoint (from endpoint-inventory.ts) with its access rule; the shared contract files in packages/shared/src/api; the UI components in apps/web/src/components/ui; the error codes added in Sprint 1.
   - Deviations from the prompts, and decisions taken during the sprint.
   - Velocity: a table of prompt, time box, actual hours; the total against the plan.
   - Top three risks for Sprint 2 (for example scoring correctness against the golden fixture, catalogue stage B workload, the shortlist empty-state diagnostic), each with an owner and a mitigation.

4. For every item that is fail or not run: an issue "S1 spill: <item and short reason>" with labels type:chore, milestone "Sprint 2 (19-25 Oct)", assignee Maulik, the evidence in the body, added to the BonVoyage project with Sprint S2 and Priority Must. If every Sprint 1 issue is closed, close the "Sprint 1 (12-18 Oct)" milestone (gh api -X PATCH repos/{owner}/{repo}/milestones/<number> -f state=closed).

5. Commit only the review file (and docs/traceability.md if it needed a fix you were told to make) and open the pull request "docs: Sprint 1 review".

6. End your final message with this block, filled in:
     PASTE THIS BACK
     Gate: <Pass | Pass with spill | Fail>
     Items: R1 <result> ... R12 <result>
     Spill issues: <numbers and titles, or none>
     Merged in Sprint 1: <PR numbers and titles>
     Endpoints: <count>, and any whose path or behaviour differs from the Sprint 1 prompts
     Error codes added: <list>
     UI components: <list>
     SRS 3.3 times: <seconds, local and production>
     Spike S4: <phone, browser, result>
     Lighthouse accessibility: <three scores>
     Catalogue: stage A <v>/<n>, stage B <v>/<n>, stage C <v>/<n>
     Velocity: <planned hours> planned, <actual hours> actual
     Deviations worth knowing: <one line each>
     Open questions: <one line each, or none>

VERIFICATION
  git diff --stat master...HEAD          only docs/sprints/sprint-1-review.md (and docs/traceability.md if changed)
  gh issue list --search "S1 spill in:title" --state open
  the review file opens on GitHub and its table has 12 rows
Report: the PASTE THIS BACK block.

IF BLOCKED
- A check cannot run: record "not run" with the reason, create the spill issue, continue.
- A check fails because of a small bug: record it and open the spill issue. Do not fix code on this branch.
- Maulik has not answered the HAND OVER within this session: record R4, R5, R7 and R9 as "not run: waiting for Maulik", finish the rest, and say so at the top of the block.
```
