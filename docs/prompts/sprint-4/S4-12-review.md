# S4-12: Sprint 4 review

Saturday 7 November: Claude in Cowork re-runs the demo script on a fresh preview reset and spot-checks production; Claude Code writes the Sprint 4 review from those results and its own command output. Feature freeze follows on Sunday 8 November.

**Branch:** `docs/s4-12-review` · **Time box:** 1.5 hours (30 minutes setup and run, 1 hour review) · **Depends on:** everything above merged or cut, catalogue imported · **Issue:** #125

## Part 1: Maulik's setup (about 10 minutes)

1. `git checkout master; git pull`.
2. Both Neon branches up to date: `pnpm db:migrate:remote --target preview --status` and `--target production --status` show nothing pending (0003 if S4-6 shipped).
3. Catalogue: `pnpm catalogue:import --target preview`, then `--target production` (type `import production`), if any S4-8 batch merged since the last import.
4. `pnpm db:seed --target preview --fresh-demos`.
5. Built-in browser: preview, signed in as Asha. Brave: preview, signed in as Meera. Tell Claude in Cowork "ready" with the URL. For the production spot check, the two real accounts as on 28 October, if available.

## Part 2: the run (Claude in Cowork)

Claude runs `docs/demo/sprint-3-demo.md` end to end as on 28 October, times recommend, choose, package, plan and accept, compares both members' views, checks the Sprint 4 changes on screen (travel time on cards, the 44 px toggle, two-member budget hiding on a 2-member trip, model wording if S4-7 turned it on), then gives Maulik the filled-in results block for Part 3.

## Part 3: the review (Claude Code)

```text
S4-12  SPRINT 4 REVIEW
Branch: docs/s4-12-review (from fresh master)   Time box: 1 hour   Issue: #125
Follow the Sprint 4 conventions (Q1 to Q10).

CONTEXT
Read AGENTS.md, docs/prompts/sprint-4/README.md, docs/sprints/sprint-4-plan.md, docs/sprints/
sprint-3-review.md (the layout to follow), docs/traceability.md, docs/demo/sprint-3-demo.md and
the results block Maulik pastes below this prompt.

GOAL
docs/sprints/sprint-4-review.md records, item by item, whether each plan item shipped, was cut or
spilled, with every claim backed by command output or the results block; the requirement issues'
state; and what the Buffer must finish before submission.

STEPS
1. Run and keep the real output of: pnpm verify ; pnpm vitest run --project integration
   apps/api/src/e2e apps/api/src/seed apps/api/src/security ; pnpm catalogue:check (and
   --require b1) ; pnpm perf:recommend with pnpm dev running (then stop it) ; pnpm --filter
   @bonvoyage/web build (chunk sizes) ; gh issue list for the Sprint 4 milestone (open and closed)
   and for the requirement issues #18 to #25.
2. sprint-4-review.md in the sprint-3-review layout: a result line; a table of the plan's items
   1 to 12 (shipped in #PR, cut, or spilled to issue #n) with evidence; decisions D1 to D6 and
   how each was carried out; the defects found in the demo and their fixes; catalogue counts
   before and after; speed table (preview, production, local); velocity (prompt, PR and merge
   times); "Buffer: to finish before submission".
3. Traceability: every row current, each Sprint 4 PR cited where it changed a requirement's
   evidence.
4. PR "docs: Sprint 4 review", body "Closes #125". Do not merge.

VERIFICATION
Paste the outputs from step 1, trimmed to their summaries.

IF BLOCKED
A result is missing from the block or your output: stop and ask; never mark an item shipped
without evidence.
```
