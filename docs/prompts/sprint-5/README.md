# Sprint 5 build prompts

Sprint 5 runs from Thursday 29 October to Saturday 7 November 2026, alongside the rest of Sprint 4 ([Sprint 4 prompts](../sprint-4/README.md)). Sprint 4 items 2, 3, 4, 5, 6, 10 and 11 shipped early (#128 to #135), so on 29 October Maulik moved the four deferred Could-have items in. Feature freeze is Sunday 8 November; submission is Tuesday 10 November.

**Goal:** the app does what the synopsis promised beyond the MVP, and the report has measured results to cite:

- **R17 fairness across rounds (#27):** a member who was least served in earlier rounds counts for more in the next one.
- **In-app reminders:** a notification bell, plus an organiser "Remind" button for members who have not submitted. No email.
- **R18 voting (#28):** members vote on the shortlist; the organiser still decides.
- **Evaluation harness:** `pnpm eval` measures hard-constraint satisfaction, group fit against the average and least-misery baselines, and fairness across rounds with and without R17.

## Decisions

**Maulik, 29 October 2026:**

| # | Decision |
| --- | --- |
| M1 | Build all four items in Sprint 5. |
| M2 | Merge each PR when CI is green. Do not hold PRs for the Monday demo. A PR that changes a line `docs/demo/sprint-3-demo.md` quotes updates the script and `run-seed.test.ts` in the same PR (Q5). Claude in Cowork re-runs the whole script on preview on Sunday 1 November. |
| M3 | R17 never changes a trip's first shortlist. The golden values in `docs/specs/scoring.md` section 7 hold to 1e-6, so the demo's shortlists do not move. |
| M4 | Reminders are in-app only. No email or push, and no new outbound service. |

**E1 to E7 (from S5-1, filled in when Maulik approves the plan):**

| # | Topic | Decision |
| --- | --- | --- |
| E1 | Fairness formula and lambda default | _pending S5-1_ |
| E2 | Where per-member scores are stored | _pending S5-1_ |
| E3 | Which events notify; reminder limit | _pending S5-1_ |
| E4 | Vote counts in 2-member trips | _pending S5-1_ |
| E5 | Evaluation scenarios, metrics, baselines | _pending S5-1_ |
| E6 | Order and cut order | _pending S5-1_ |
| E7 | One combined Sprint 4 and 5 review, or two | _pending S5-1_ |

**Prompts S5-2 to S5-5 assume the recommended option for each E.** If Maulik chose otherwise, the agent follows the plan's Decisions section. Where the prompt and the plan disagree, the plan wins, and the agent says so in its report.

## Run order

Issue numbers come from `docs/sprints/sprint-5-plan.md` (S5-1 fills them in) or `gh issue list --milestone "Sprint 5 (29 Oct-7 Nov): Could-haves" --state all`, never from `docs/traceability.md`.

| When | Prompt | Who | Time box | Needs merged first | Tests against |
| --- | --- | --- | --- | --- | --- |
| Thu 29 Oct | [S5-1 Plan, decisions and issues](S5-1-plan.md) | Claude Code | 1.5 h | nothing | nothing |
| Fri 30 Oct | [S5-2 R17 fairness across rounds](S5-2-fairness.md) | Claude Code | 4 h | S5-1 approved | unit and db-test |
| Sat 31 Oct | [S5-3 In-app notifications and reminders](S5-3-reminders.md) | Claude Code | 4 h | S5-1 approved | db-test and web |
| Sun 1 Nov | Demo script re-run on preview | Claude in Cowork | 1 h | whatever merged | preview |
| Mon 2 Nov | The demo | Maulik | | | |
| Tue 3 to Wed 4 Nov | [S5-4 R18 voting on the shortlist](S5-4-voting.md) | Claude Code | 5 h | S5-2 merged (shares the shortlist screen) | db-test and web |
| Thu 5 Nov | [S5-5 Evaluation harness](S5-5-evaluation.md) | Claude Code | 4 h | S5-2 merged | unit |
| Fri 6 Nov | [S5-6 Evidence and traceability](S5-6-evidence.md) | Claude Code | 1 h | S5-2 to S5-5 merged or cut | nothing |
| Sat 7 Nov | [S5-7 Sprint 5 review](S5-7-review.md) (or combined with S4-12, per E7) | Claude Code, with Claude in Cowork's results | 1.5 h | everything above | preview and production |

Sprint 4's own items carry on next to these: S4-4 after the demo, S4-7 after the demo, S4-8 catalogue batches, S4-9 now, S4-12 last.

**Two at once:** S5-2 and S5-3 touch different modules (engine and recommendations, against notifications and the app shell). They may run in two sessions on two branches. S5-4 waits for S5-2, because both change the shortlist screen and `recommendations/service.ts`.

**Migrations:** S5-2 (if E2 stores per-member scores) and S5-4 (the vote table) each add one. Numbers go in merge order. If another migration merges first, rebase, delete your generated SQL and its journal entry, and run `pnpm db:generate` again. Never hand-edit `meta/_journal.json`. Maulik runs `pnpm db:migrate:remote` for each, preview first.

## Routine

The same as Sprint 4, one session per branch:

1. `git checkout master; git pull`, then create the branch named in the prompt. Run `git branch --show-current` before every commit.
2. Open a fresh agent session and paste: `Read docs/prompts/sprint-5/README.md, then run the prompt in docs/prompts/sprint-5/<file> exactly.` Paste any targeted notes from Claude after that line.
3. Paste the agent's report back to Claude in the BonVoyage project for review. Merge only after the review:

   ```powershell
   gh pr checks <n> --watch --required; if ($?) { gh pr merge <n> --squash --delete-branch }
   ```

**Your steps between prompts (Maulik only):**

- After any PR with a migration merges: `pnpm db:migrate:remote --target preview --status`, then without `--status`. Then the same for `--target production`.
- Before the Sunday re-run and before the demo: `pnpm db:seed --target preview --fresh-demos`.
- Before S5-5's full run: nothing. It needs no database, keys or network.

## Cut order if a day slips

From E6 (recommended): cut S5-4 voting first, then S5-3 reminders. **Never cut** S5-2 R17 or S5-5 the harness. Together they are the report's research result: the synopsis's fairness adjustment, measured. A cut item keeps its issue open with a comment saying why, and its traceability row says "cut 7 Nov".

## Sprint 5 conventions

Every Sprint 5 prompt follows the Sprint 4 conventions Q1 to Q10 (`docs/prompts/sprint-4/README.md`), with these changes:

```text
SPRINT 5 CONVENTIONS (on top of Q1 to Q10)

V1  Replaces Q1 for Sprint 5 only: Sprint 5 adds features, but only the four in
    docs/sprints/sprint-5-plan.md, built to decisions M1 to M4 and E1 to E7. Anything else that
    changes what users see, the state machine, scoring, auth or privacy: stop and ask.
V2  Privacy first (AGENTS.md section 12). Every new response is added to
    apps/api/src/security/no-leak.test.ts. Never return another member's preferences, budget,
    per-member score, fairness weight or vote. Counts follow the existing rule: show a preference
    value only when 2 or more members share it.
V3  Every new endpoint goes into apps/api/src/test/endpoint-inventory.ts (43 today) and the
    access matrix (access-matrix.test.ts) for all 6 actors. Paste the new counts.
V4  State machine: a new event goes into packages/engine/src/trip-state.ts, its test, and decision
    0001's table in the same PR. No new trip status in Sprint 5.
V5  Engine purity (P2): new engine code is pure, has full branch coverage, and takes its weights
    from apps/api/config/scoring.json, validated at start-up and stored on every run.
V6  Demo safety (M2, M3): run pnpm vitest run --project integration apps/api/src/seed
    apps/api/src/e2e before pushing, and say which demo lines, if any, changed.
V7  Accessibility: new controls meet the 44 px tap target (min-h-11), work by keyboard, and
    never use colour alone; check at 360 px.
V8  Report also lists: migrations added (with numbers), endpoints added, and the after-merge
    commands for Maulik.
```

## When Sprint 5 is done

S5-6 closes #27, #28 and the new issues with evidence and updates the traceability rows R16 to R18. S5-7 (or S4-12, if E7 combines them) records what shipped, what was cut and the harness's numbers. Then the Buffer starts on Sunday 8 November.
