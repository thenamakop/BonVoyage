# S4-1: Sprint 4 plan, decisions and issues

Gathers the evidence for Sprint 4, writes `docs/sprints/sprint-4-plan.md`, then records Maulik's decisions D1 to D6, creates the Sprint 4 issues and commits these prompt files. Part 1 ran on 28 October 2026 (PR #117); Part 2 is the amendment that follows Maulik's decisions.

**Branch:** `docs/s4-1-plan` · **Time box:** 1 hour, plus 30 minutes for Part 2 · **Depends on:** Sprint 3 closed (#115) · **Issue:** none (plan PR, "Refs #116")

## Part 1: gather and plan (done, PR #117)

```text
S4-1  SPRINT 4 KICKOFF: HARDENING PLAN (3 to 7 November)
Branch: docs/s4-1-plan (from fresh master; git branch --show-current before the commit)
Time box: 1 hour. Docs only, no code. Explicit paths only; the drawio stays untracked.

CONTEXT
Read AGENTS.md, docs/sprints/sprint-3-review.md (To finish), docs/sprints/replan-2026-10-27.md,
docs/decisions/0005 (k: what was cut), docs/traceability.md, docs/security/privacy.md (line 42 on
the common window), docs/baseline/BonVoyage_MoSCoW_Prioritization.md and the RUNBOOK's Sprint 4
section if it has one.

GOAL
docs/sprints/sprint-4-plan.md: an evidence-based list of hardening work for 3 to 7 November,
ranked, with each item's issue, size and acceptance check. Maulik approves it before any build
prompt is written.

STEPS
1. Gather, pasting the raw output into the PR body: open issues (gh issue list); pnpm
   catalogue:check with the draft rows by stage; the pg deprecation warning traced to file and
   line; TODO, FIXME and "Sprint 4" in apps and packages.
2. Assess: #116; the pg warning; LIVE_APIS on deployments; the catalogue draft rows that touch the
   demo; GET /packages rebuilding packages; the open requirement issues; R17 and R18; 360 px and
   tap targets on the Sprint 3 screens.
3. sprint-4-plan.md: the table (item, issue, why, size, acceptance check, depends on), a five-day
   order, the cut order, and the decisions Maulik must make.
4. PR "docs: Sprint 4 hardening plan". Do not create or change issues yet.

VERIFICATION
Paste the gathered outputs (trimmed), the plan's table, and the decisions list.

IF BLOCKED
A source disagrees with another: name both and stop at that item.
```

## Part 2: record the decisions, create the issues, commit the prompts

Paste into the same session (or a fresh one on the same branch).

```text
S4-1 AMENDMENT  RECORD DECISIONS D1 TO D6, CREATE THE ISSUES, COMMIT THE SPRINT 4 PROMPTS (PR #117)
Branch: docs/s4-1-plan (git branch --show-current before the commit). Explicit paths only.
Follow the Sprint 4 conventions in docs/prompts/sprint-4/README.md (Q1 to Q10).

CONTEXT
Maulik decided on 28 October 2026 (the table in docs/prompts/sprint-4/README.md is the record):
D1 #116: below 3 contributing members, the group profile and every member-visible response show
   only whether budgets overlap, never the band's numbers; the date window stays for every size
   (26 October decision unchanged).
D2 #20 closes when #116's fix merges.
D3 #23 follows decision 0005 h: the organiser accepts, modifies or rejects; members read; no
   reorder.
D4 Build items 6 and 7 (model wording on deployments with quota guard and cache). Approved: env
   var GEMINI_DAILY_LIMIT and a cache table in migration 0003. Cut after items 10 and 11.
D5 #38's check becomes --require b1; the 31 draft B2 fares move to a new issue, demo-touching rows
   (Gurugram to Mathura and Vrindavan trains) first.
D6 R17 and R18 stay out of Sprint 4.
The folder docs/prompts/sprint-4/ (README.md and S4-1 to S4-12) is already in the working tree,
untracked; it was written by Claude in the BonVoyage project.

STEPS
1. docs/sprints/sprint-4-plan.md: change the status line to "approved 28 October 2026"; add a
   "Decisions" section recording D1 to D6 with the date; update the depends-on column; map each
   plan item to its prompt file (item 1 S4-4, 2 S4-2, 3 and 4 S4-5, 5 S4-3, 6 S4-6, 7 S4-7,
   8 S4-8, 9 S4-9, 10 S4-10, 11 S4-11, 12 S4-12).
2. Create issues on the "Sprint 4 (3-7 Nov): hardening" milestone with gh issue create, one each
   for: item 2 (pg stage counts), item 4 (toggle tap target; item 3 stays on #18), item 6 (model
   wording on deployments), item 7 (preview check with LIVE_APIS=on), item 10 (packages note),
   item 11 (bundle split), item 12 (Sprint 4 review), and "Catalogue B2: the 31 draft fares"
   (D5). Each body: the plan's why, acceptance check and prompt file. Put the numbers in the
   plan's table.
3. Edit #23's body to match 0005 h (organiser decides, members read, no reorder) with a line
   "Amended 28 October 2026 per decision D3 and decision 0005 h." Edit #38's acceptance check to
   "--require b1" with "per decision D5" and a link to the new B2 issue.
4. Read every file in docs/prompts/sprint-4/ once; fix only broken relative links or a wrong
   path you can prove from the repo (list each fix). Add a line for Sprint 4 to
   docs/prompts/README.md if it lists sprints.
5. Commit the plan, the prompt folder and any README line by explicit path; push. PR body keeps
   "Refs #116".

VERIFICATION
Paste: the gh issue create output (numbers and titles); git show --stat HEAD; the CI result.

IF BLOCKED
A prompt file contradicts the plan or the code in a way you cannot fix by a link or path: list it
in the report and leave the file unchanged.
```

After CI is green: `gh pr checks 117 --watch --required; if ($?) { gh pr merge 117 --squash --delete-branch }`
