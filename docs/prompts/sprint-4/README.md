# Sprint 4 build prompts

Sprint 4 runs from Tuesday 3 November to Saturday 7 November 2026. It adds no new requirements: it hardens what Sprint 3 shipped, closes the requirement issues with evidence, and carries the [Sprint 3 review](../../sprints/sprint-3-review.md)'s "To finish" list. Feature freeze is Sunday 8 November; the Buffer follows.

**Goal:** the deployed app behaves as the documents say it does. Every finding in the [Sprint 4 plan](../../sprints/sprint-4-plan.md) is fixed or recorded with a decision, model wording runs on deployments behind a quota guard and a cache, the catalogue rows that touch the demo are settled, and every open requirement issue closes with cited evidence.

## Decisions (Maulik, 28 October 2026)

These are the rules for this sprint. A prompt that would go beyond them stops and asks.

| # | Decision |
| --- | --- |
| D1 | #116: below 3 contributing members, no member-visible response carries the budget band's numbers (or anything from which a member's own bound can be derived); the card says only whether budgets overlap. The common date window stays for every group size (26 October decision unchanged). |
| D2 | #20 closes when the #116 fix merges. |
| D3 | #23 follows decision 0005 h: the organiser accepts, modifies (remove or replace) or rejects; members read; no reorder. #23's text is amended to say so. |
| D4 | Build model wording on deployments (S4-6, S4-7): the client is created in `vercel-entry.ts`, the call goes through `withQuota` and a cache. Approved: one env var `GEMINI_DAILY_LIMIT` and one table for the cache (migration 0003). Cut after S4-10 and S4-11 if the week slips. |
| D5 | #38's done check is `pnpm catalogue:check --require b1`. The 31 draft B2 fares move to their own issue, demo-touching rows first. |
| D6 | R17 (fairness across rounds) and R18 (voting) stay out of Sprint 4. |

## Run order

Prompts are numbered in the order they were written; run them in the order of this table. Issue numbers come from `docs/sprints/sprint-4-plan.md` (filled in by S4-1) or `gh issue list --milestone "Sprint 4 (3-7 Nov): hardening" --state all`, never from `docs/traceability.md`.

| When | Prompt | Who | Time box | Needs merged first | Tests against |
| --- | --- | --- | --- | --- | --- |
| Done 28 Oct | [S4-1 Plan, decisions and issues](S4-1-plan.md) | Claude Code | 1 h | Sprint 3 closed | nothing |
| Any time | [S4-2 Run queries on a transaction one after another](S4-2-stage-counts.md) | Claude Code | 45 min | S4-1 | db-test |
| Any time | [S4-3 Hide the budget band below three members (#116)](S4-3-two-member-budget.md) | Claude Code | 1.5 h | S4-1 | db-test |
| Tue 3 Nov | [S4-4 Fixes from the Monday demo](S4-4-demo-fixes.md) | Claude Code | S to M per defect | the demo | depends |
| Tue 3 Nov | [S4-5 Package cards: travel time and tap target (#18)](S4-5-package-cards.md) | Claude Code | 1.5 h | the demo, S4-1 | db-test |
| Wed 4 Nov | [S4-8 Catalogue: settle the remaining draft rows (#38, #39)](S4-8-catalogue.md) | Claude in Cowork, then Claude Code | M to L | S4-1 | nothing (CSV and checker) |
| Thu 5 Nov | [S4-6 Model wording on deployments: quota and cache](S4-6-model-on-deployments.md) | Claude Code | 4 h | S4-2 | db-test |
| Fri 6 Nov | [S4-7 Preview check with live model wording](S4-7-live-preview-check.md) | Maulik, then Claude in Cowork | 1 h | S4-6 merged and migrated | preview |
| Fri 6 Nov | [S4-9 Close the requirement issues with evidence](S4-9-close-issues.md) | Claude Code | 1 h | S4-3, S4-5, S4-7 (or its cut) | nothing |
| Sat 7 Nov | [S4-10 Packages note without rebuilding packages](S4-10-packages-note.md) | Claude Code | 45 min | S4-5 | db-test |
| Sat 7 Nov | [S4-11 Split the web bundle](S4-11-bundle-split.md) | Claude Code | 45 min | S4-5 | no database |
| Sat 7 Nov | [S4-12 Sprint 4 review](S4-12-review.md) | Claude Code (with Claude in Cowork's results) | 1 h | everything above | preview and production |

S4-2 and S4-3 change nothing the Sprint 3 demo script shows, so they may merge before Monday 2 November. **S4-5 changes the package cards the script reads: hold it until after the demo.**

## Routine

The same as Sprints 1 to 3, one session at a time:

1. `git checkout master; git pull`, then create the branch named in the prompt. Run `git branch --show-current` before every commit.
2. Open a fresh agent session and paste: `Read docs/prompts/sprint-4/README.md, then run the prompt in docs/prompts/sprint-4/<file> exactly.` Paste any targeted notes I give you after that line.
3. Paste the agent's report back to Claude in the BonVoyage project for review. Merge only after the review, with:

   ```powershell
   gh pr checks <n> --watch --required; if ($?) { gh pr merge <n> --squash --delete-branch }
   ```

**Your steps between prompts (Maulik only):**

- After S4-6 merges: `pnpm db:migrate:remote --target preview`, then `--target production` (migration 0003, the model cache table).
- Before S4-7: set the Vercel **Preview** environment variables listed in S4-7 and redeploy. Never paste a key into chat, a commit, a screenshot or a prompt.
- After S4-8's pull request merges: `pnpm catalogue:import --target preview`, then `--target production` (type `import production`).
- Before any demo or review on preview: `pnpm db:seed --target preview --fresh-demos`.

## Cut order if a day slips

From the plan: cut S4-11 first, then S4-10, then S4-6 and S4-7 together (deployments keep the catalogue templates; #22 records that the model path is tested but not deployed), then B2 rows that do not touch the demo trips. **Never cut** S4-4 (demo fixes), S4-2 (pg), S4-5 (#18 travel time) or S4-3 (#116).

## Sprint 4 conventions

Every Sprint 4 prompt says "follow the Sprint 4 conventions". The Sprint 1 to 3 conventions (`docs/prompts/sprint-1/README.md` S1 to S10, `docs/prompts/sprint-2/README.md`, `docs/prompts/sprint-3/README.md` P1 to P12) still apply.

```text
SPRINT 4 CONVENTIONS (apply to every Sprint 4 prompt, on top of Sprints 1 to 3)

State of the repo (end of Sprint 3, closed 28 Oct 2026)
- Endpoints: 42 in apps/api/src/test/endpoint-inventory.ts; access matrix 42 x 6 actors.
- Tests: 831 in 91 files (pnpm verify). Full journey: apps/api/src/e2e/full-journey.test.ts.
- Migrations 0000 to 0002 on master and on both Neon branches.
- Trip lifecycle: draft to finalised through T1 to T14, I1 to I5 (decision 0001); packages and
  day plans follow decision 0005; the day plan is built by planDays, worded by templates or the
  model (LIVE_APIS=on, local only so far), checked by validateItinerary.
- Catalogue: A 50/50, B1 136/137, B2 85/116, C 202/276 verified; 0 errors.
- Demo: docs/demo/sprint-3-demo.md; four demo trips; apps/api/src/seed/run-seed.test.ts guards
  every line the script quotes (Chakrata first, Tiger Falls "Not verified", Bikaner packages).
- Known: vercel-entry.ts never creates the model client (S4-6); the model call has no quota guard
  or cache (S4-6); GET /packages rebuilds packages for its note (S4-10); web bundle 596 kB (S4-11).

Sprint 4 rules
Q1  Hardening only. Nothing beyond docs/sprints/sprint-4-plan.md and decisions D1 to D6. A change
    to what users see, the state machine, scoring, auth or privacy that the prompt does not spell
    out: stop and ask.
Q2  Every defect fix starts with a test that fails on master and passes after the fix; say in the
    report that you saw it fail.
Q3  Issue numbers come from gh issue list or sprint-4-plan.md, never from traceability.md. PR
    bodies use "Closes #n" only for the issue the prompt names.
Q4  Before pushing, run the CI sequence locally: pnpm format:check; pnpm lint; pnpm typecheck;
    pnpm test. After pushing, watch CI to the end and report the run's result.
Q5  The demo stays true. A PR that changes a line docs/demo/sprint-3-demo.md quotes updates the
    script (read the new line off the running app) and run-seed.test.ts in the same PR. After
    2 November the script is the reference for the final submission demo.
Q6  Neon and Vercel are Maulik's: never run db:migrate:remote, catalogue:import or db:seed with a
    remote target, never change Vercel settings. Write the commands Maulik must run into the PR
    body under "After merge".
Q7  Secrets: GEMINI_API_KEY and every other key live only in .env and Vercel. Never print, log,
    echo or commit them; never put them in fixtures, snapshots or reports. New variables go into
    .env.example by name only.
Q8  Git hygiene: git branch --show-current before every commit; stage by explicit path (never
    git add -A or git add .); the drawio file stays untracked; no Co-Authored-By trailers and no
    "Generated with" lines in commits or PR bodies.
Q9  Size: keep each PR under about 400 changed lines excluding tests and fixtures; if a prompt
    cannot fit, split it into commits and say so.
Q10 Report format: what changed (files), why, the real verification output (trimmed to
    summaries), anything that differs from the prompt, and open questions for Maulik.
```

## When Sprint 4 is done

S4-12 has Claude in Cowork re-run the demo script on a fresh preview reset (including model wording if S4-7 passed) and spot-check production, then Claude Code writes `docs/sprints/sprint-4-review.md` from those results and its own command output.
