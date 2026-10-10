# S0-9: Sprint 0 exit gate audit

Checks every exit-gate item with real evidence, writes `docs/sprints/sprint-0-review.md`, tags the design baseline, and turns every unticked box into a Sprint 1 issue ahead of any feature. It changes no code. Run it last, on Sunday evening, and send its final block back to get the Sprint 1 prompts.

**Branch:** `docs/s0-exit-gate` · **Time box:** 45 minutes · **Depends on:** S0-1 to S0-8 merged (or knowingly skipped)

```text
S0-9  SPRINT 0 EXIT GATE AUDIT
Branch: docs/s0-exit-gate   Time box: 45 minutes

CONTEXT
Read AGENTS.md, docs/RUNBOOK.md Phase 10 (Definition of Ready), docs/decisions, docs/spikes, docs/accounts.md and docs/traceability.md. Sprint 0 ran prompts S0-1 to S0-8. This task audits and records; it does not fix anything. A failed check is recorded with its evidence and becomes an issue; it is never quietly repaired in this branch, and it is never marked as passed without command output.

The gate, adapted from Phase 10 for one developer and the 10 November plan:
  G1  Baseline and decisions: docs/baseline and docs/design present; 0000, 0001, 0002, 0003 and ADR-001 to ADR-010 all "Status: Accepted".
  G2  Tag design-baseline-v1 exists on the commit that first added docs/baseline.
  G3  A fresh clone installs, migrates, seeds and passes pnpm verify.
  G4  CI is green on master, and master accepts changes only through pull requests that pass the ci check.
  G5  Preview and production both answer /api/health from Neon.
  G6  Neon preview and production have no pending migrations.
  G7  pnpm catalogue:check reports 0 errors; stage progress recorded; CAT-A, CAT-B and CAT-C issues exist.
  G8  The trip state machine passes every transition test with 100 per cent branch coverage of trip-state.ts.
  G9  The scoring spec and the golden fixture are committed, and the fixture self-check passes.
  G10 Spike notes S2 and S4 are merged; S1 and S3 are recorded as not run by decision (ADR-007, ADR-006).
  G11 No key or .env file anywhere in git history, and the Gemini key pasted in chat earlier has been rotated.
  G12 Wireframes are planned as Sprint 1 issue S1-8.
  G13 Sprint 1 issues are estimated, assigned and on the board.

GOAL
docs/sprints/sprint-0-review.md records each gate item with its evidence and result, the work merged in Sprint 0, the deviations, and the top risks for Sprint 1. Every failed item has an "S0 spill" issue in Sprint 1. The final message ends with a block Maulik pastes back to get the Sprint 1 prompts.

STEPS
1. Collect evidence, one item at a time, saving each command and the lines that prove the result:
   G1   git grep -n "^Status:" -- docs/decisions ; ls docs/baseline docs/design
   G2   git rev-parse -q --verify refs/tags/design-baseline-v1 . If it is missing, find the commit with git log --diff-filter=A --format="%H %s" -- docs/baseline | tail -1, then HAND OVER: show Maulik the sha and subject and ask him to confirm. Only after he replies "tag it", run git tag -a design-baseline-v1 <sha> -m "Design baseline v1" and git push origin design-baseline-v1.
   G3   git clone --branch master . ../bv-gate && cd ../bv-gate && cp .env.example .env. In that throwaway clone only, set BETTER_AUTH_SECRET to a freshly generated value (node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))") and SEED_DEMO_PASSWORD to a throwaway 16-character value. Then: pnpm install --frozen-lockfile; pnpm db:up; pnpm db:migrate; pnpm db:seed; pnpm verify. (Use db:migrate, not db:reset: the containers are shared with Maulik's checkout.) Delete ../bv-gate afterwards.
   G4   gh run list --branch master --limit 5 --json conclusion,displayTitle,createdAt ; gh api repos/{owner}/{repo}/rulesets and the ruleset detail (required check ci, pull request rule, no bypass).
   G5   curl -s https://<production domain>/api/health (the URL is in docs/accounts.md). For the preview, ask Maulik to open the latest preview while logged in and reply with what /api/health shows.
   G6   pnpm db:migrate:remote --target preview --status ; pnpm db:migrate:remote --target production --status
   G7   pnpm catalogue:check (copy the verification table) ; gh issue list --label catalogue --state all
   G8   pnpm vitest run --project unit --coverage.enabled --coverage.include=packages/engine/src/trip-state.ts --coverage.thresholds.100
   G9   ls docs/specs/scoring.md packages/engine/src/scoring ; pnpm vitest run --project unit packages/engine/src/scoring
   G10  ls docs/spikes
   G11  git log -p --all | grep -cE 'AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{20,}' (must print 0) ; git log --all --format=%h -- .env .env.neon (must print nothing). Ask Maulik to confirm the Gemini key rotation with "rotated"; never ask for the key.
   G12  gh issue list --search "Wireframes in:title" --state all
   G13  gh issue list --milestone "Sprint 1 (12-18 Oct)" --json number,title,assignees,labels ; and the project items with Estimate and Sprint set.
2. docs/sprints/sprint-0-review.md:
   - Title "Sprint 0 review (8 to 11 October 2026)" and a result line: Pass, Pass with spill (some items moved to Sprint 1), or Fail (any of G3, G4 or G8 failed).
   - A table: Item | Check | Evidence (the command and its key output line) | Result (pass, fail, moved, not run) | Follow-up issue.
   - What was built: one line per merged pull request (gh pr list --state merged --limit 30 --json number,title,mergedAt).
   - Deviations and decisions: links to 0002 and 0003, the deploy-proof result from S0-3, and the model and SDK findings from the S2 note.
   - Top three risks for Sprint 1, taken from the evidence (for example catalogue verification load, sessions on phones, Gemini rate limits), each with an owner and a mitigation.
   - Time: ask Maulik for the actual hours per prompt and record them next to the time boxes, as the velocity baseline for Sprint 1.
3. For every item that is fail or not run: create an issue titled "S0 spill: <item and short reason>" with labels type:chore, milestone "Sprint 1 (12-18 Oct)", assignee Maulik and the evidence in the body; add it to the BonVoyage project with Sprint S1 and Priority Must. A spill issue comes before any feature in Sprint 1.
4. Commit only the review file (and docs/traceability.md if a test or issue column changed) and open the pull request.
5. End your final message with this block, filled in:
     PASTE THIS BACK
     Gate: <Pass | Pass with spill | Fail>
     Items: G1 <result> ... G13 <result>
     Spill issues: <numbers and titles, or none>
     Production URL: <url>
     Versions: node, pnpm, typescript, vite, react, react-router, express, zod, drizzle-orm, better-auth, vitest, @google/genai
     Catalogue: stage A <v>/<n>, stage B <v>/<n>, stage C <v>/<n>
     Spike S2: pass rate <x> of <n>, median <s> s, p95 <s> s, injected price caught <yes | no>
     Deviations worth knowing: <one line each>
     Open questions: <one line each, or none>

VERIFICATION
  git diff --stat master...HEAD          only docs/sprints/sprint-0-review.md (and docs/traceability.md if changed)
  gh issue list --search "S0 spill in:title" --state open
  the review file opens on GitHub and its table has 13 rows
Report: the PASTE THIS BACK block.

IF BLOCKED
- A check cannot run (Docker stopped, no network, Neon suspended for longer than a minute): record "not run" with the reason, create the spill issue, and continue with the next item.
- A check fails because of a small bug: record it and open the spill issue. Do not fix code on this branch.
- Maulik does not answer a HAND OVER question within this session: record the item as "not run: waiting for Maulik" and continue.
```
