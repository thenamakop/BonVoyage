# S3-9: Dry run and Sprint 3 review

Sunday 1 November: prepare preview, run the Monday script end to end in two browsers, run the production checks carried from Sprint 2 (#94), and write the Sprint 3 review. The dry run is driven by Claude in Cowork (as on 27 October) with Maulik signing the windows in; the review is written by Claude Code from the results.

**Branch:** `docs/s3-9-review` · **Time box:** 1.5 hours (30 minutes of setup and dry run, 1 hour for the review) · **Depends on:** everything above merged and imported · **Issue:** S3-9, #94

## Part 1: Maulik's setup (about 10 minutes)

1. `git checkout master; git pull`
2. Migration 0002 is on both databases: `pnpm db:migrate:remote --target preview --status` and `--target production --status` show nothing pending.
3. Catalogue: `pnpm catalogue:import --target preview --prune`, then `--target production --prune` (type `import production`).
4. Demo data: `pnpm db:seed --target preview --fresh-demos`.
5. Optional, for model-written wording on preview: `LIVE_APIS=on`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash-lite` in Vercel (Preview), then redeploy. Skip it and the plan uses the catalogue templates.
6. Two windows on the preview URL: the Claude app's built-in browser signed in as `asha@demo.bonvoyage.test`, and Brave signed in as `meera@demo.bonvoyage.test`. Then tell Claude in Cowork "ready" with the preview URL.
7. For #94 (production halves of R5 and R7): two real accounts in one production trip with preferences submitted. If you only have one, say so and #94 moves to Sprint 4.

## Part 2: the dry run (Claude in Cowork)

Claude runs `docs/demo/sprint-3-demo.md` step by step, records every on-screen line against the script, times recommend, choose, package and plan (browser clock), compares the two members' views for privacy, then gives you the review prompt below filled in with the real results.

## Part 3: the review (Claude Code)

```text
S3-9  SPRINT 3 REVIEW
Branch: docs/s3-9-review   Time box: 1 hour   Issues: S3-9, #94

CONTEXT
Read AGENTS.md, docs/prompts/sprint-3/README.md, docs/decisions/0005, docs/sprints/replan-2026-10-27.md,
docs/sprints/sprint-2-review.md (the layout to follow), docs/traceability.md, docs/demo/sprint-3-demo.md,
and the dry-run results Maulik pastes below this prompt.

GOAL
docs/sprints/sprint-3-review.md records whether G2 holds (the MVP, R1 to R11, accepted) and whether
the full-journey demo works, with every claim backed by a command output or the dry-run results.

STEPS
1. Run and keep the real output of: pnpm verify ; pnpm vitest run --project integration
   apps/api/src/e2e apps/api/src/seed apps/api/src/security ; pnpm catalogue:check ; pnpm
   perf:recommend with pnpm dev running (then stop it) ; gh api for the Sprint 3 milestone's open
   and closed issues.
2. docs/sprints/sprint-3-review.md in the sprint-2-review layout: a result line; a table of checks
   (R2, R8, R10 deletion, R12, R13, R14, R15 recommend and plan times, the privacy checks on
   preview and, if done, production for #94, the demo script end to end, catalogue status); what
   was cut under 0005 k, if anything; velocity (prompt, PR, merge times); spill issues for anything
   that failed; "To finish" for Sprint 4 (hardening).
3. Traceability: every Sprint 3 row has its issues and tests.
4. PR "docs: Sprint 3 review", body "Closes #<S3-9>" (and "closes #94" only if both production
   halves passed). Do not merge.

VERIFICATION
Paste the outputs listed in step 1, trimmed to their summaries.

IF BLOCKED
A dry-run result is missing or unclear: stop and ask; never mark a check passed without evidence.
```
