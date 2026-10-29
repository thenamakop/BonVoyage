# S5-7: Sprint 5 review

Saturday 7 November. Claude in Cowork re-runs the demo script on a fresh preview reset, with the Sprint 5 additions: a second shortlist round, a vote, a reminder and the bell. Claude Code then writes the review from those results and its own command output. If decision E7 combined the reviews, run S4-12 with this prompt's extra checks instead, and write one file, `sprint-4-and-5-review.md`.

**Branch:** `docs/s5-7-review` · **Time box:** 1.5 hours · **Depends on:** S5-6 merged; Sprint 4's items done or cut · **Issue:** the Sprint 5 review issue

## Part 1: Maulik's setup (about 10 minutes)

1. `git checkout master; git pull`.
2. Both Neon branches show nothing pending: `pnpm db:migrate:remote --target preview --status` and `--target production --status`.
3. `pnpm db:seed --target preview --fresh-demos`.
4. Built-in browser on preview, signed in as Asha; Brave on preview, signed in as Meera. Tell Claude in Cowork "ready" with the URL.

## Part 2: the run (Claude in Cowork)

Claude runs `docs/demo/sprint-3-demo.md` end to end. It also checks:
- **Reminders:** Asha reminds a pending member, and a second reminder is refused with the time.
- **Bell:** the other browser's bell count rises.
- **Voting:** both members vote, the counts appear only once both have voted (2-member rule), and Asha can still choose a destination with fewer votes.
- **Fairness:** on a revised second round, the sentence "This round gives more weight to…" appears, and no weight or number is visible in the page text or the network responses.
- **Earlier changes:** Sprint 4's are still in place (travel time, the 44 px toggle, two-member budget hiding).

It then gives Maulik the results block for Part 3.

## Part 3: the review (Claude Code)

```text
S5-7  SPRINT 5 REVIEW
Branch: docs/s5-7-review (from fresh master)   Time box: 1 hour   Issue: the Sprint 5 review issue
Follow the Sprint 5 conventions (Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/prompts/sprint-5/README.md, docs/sprints/sprint-5-plan.md, docs/sprints/
sprint-3-review.md (the layout to follow), docs/traceability.md, docs/evaluation/results-*.md and
the results block Maulik pastes below this prompt.

STEPS
1. Run and keep the real output of: pnpm verify ; pnpm vitest run --project integration
   apps/api/src/e2e apps/api/src/seed apps/api/src/security ; pnpm eval --scenarios 100 (compare
   with the committed results: same seed, same metric A) ; pnpm --filter @bonvoyage/web build ;
   gh issue list for the Sprint 5 milestone (open and closed).
2. docs/sprints/sprint-5-review.md: a result line; a table of items S5-1 to S5-7 (shipped in #PR,
   cut, or spilled to #n) with evidence; decisions M1 to M4 and E1 to E7 and how each was carried
   out; the evaluation headline numbers (metric A, B's minimum-score comparison, C's
   repeated-least-served share with and without R17), quoted from the results file; defects found
   in the run and their fixes; endpoint, test and migration counts before and after the sprint;
   velocity; "Buffer: to finish before submission".
3. PR "docs: Sprint 5 review", body "Closes #<review issue>". Do not merge.

VERIFICATION
Paste the outputs from step 1, trimmed to their summaries.

IF BLOCKED
A result is missing from the block or your output: stop and ask. Never mark an item shipped
without evidence.
```
