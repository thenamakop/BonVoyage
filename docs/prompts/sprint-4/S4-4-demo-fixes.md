# S4-4: Fixes from the Monday demo

A template for every defect seen in the 2 November demo (or in the questions after it). One defect per branch and per pull request, so each can be reviewed and reverted on its own. Claude in the BonVoyage project fills in the DEFECT block from Maulik's notes and screenshots; the agent runs the rest unchanged.

**Branch:** `fix/<n>-<slug>` · **Time box:** 45 minutes (S) to 2 hours (M) per defect · **Depends on:** the demo · **Issue:** one new issue per defect (create it first)

## Before the first fix (Maulik, 5 minutes)

Write down for each defect: what you clicked, what the screen said, what it should have said, which window (organiser, member, new account), and the preview URL. A screenshot is worth more than a description. Paste them to Claude; it returns one filled-in prompt per defect, ranked.

## The prompt (one copy per defect)

```text
S4-4  DEMO FIX: <one-line title>
Branch: fix/<n>-<slug> (from fresh master)   Time box: <45 min | 2 h>   Issue: #<n>
Follow the Sprint 4 conventions (Q1 to Q10).

DEFECT (filled in by Claude from Maulik's notes)
Seen:      <exact on-screen text, window, step of docs/demo/sprint-3-demo.md, preview URL>
Expected:  <what the script or the SRS says should happen, with the source>
Evidence:  <screenshot path or pasted text>
Suspected: <file and line if known, else "unknown">

CONTEXT
Read AGENTS.md, docs/demo/sprint-3-demo.md (the step above), the files named under Suspected, and
the tests next to them. If the defect touches privacy, the state machine, scoring or auth, read the
matching decision record first and stop if the fix would change a rule (Q1).

GOAL
The demo step behaves as Expected, proved by a test that fails on master and passes after the fix.

STEPS
1. Create the issue if it does not exist: gh issue create --title "<title>" --milestone
   "Sprint 4 (3-7 Nov): hardening" --body "<Seen / Expected / Evidence>". Use its number.
2. Reproduce locally: pnpm db:reset; pnpm db:seed; pnpm dev; follow the script to the step. Paste
   what you see. If it does not reproduce locally, try the preview URL read-only (no sign-in by
   you) and say so; if it still does not reproduce, stop and report.
3. Write the failing test first, at the lowest level that shows the defect (engine unit, API
   integration, or web component). Run it on master and paste the failure (Q2).
4. Fix the cause, not the symptom. If the fix changes any line the demo script quotes, update the
   script and run-seed.test.ts in the same PR (Q5).
5. Run the CI sequence (Q4). PR "fix: <title>", body "Closes #<n>" plus Seen / Expected / Fix.

VERIFICATION
Paste: the reproduction; the failing then passing test output; pnpm format:check; pnpm lint;
pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
The expected behaviour is not written anywhere (script, SRS, decisions): stop and ask; do not
choose one.
```

## Already fixed before the demo

These came from the 28 October dry run and are on `master`: stale over-budget amount after Change (#112), demo script corrections and "Free entry" in Swap (#113), duplicate deletion alert and future relative times (#114), stale client session after deletion (#111). Do not reopen them unless the demo shows them again.
