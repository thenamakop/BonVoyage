# S3-1: Kickoff: decision 0005, re-plan and backlog

Commits these prompts and decision 0005, records the 27 October re-plan (a full-journey demo on Monday 2 November), moves the day-plan work from Sprint 4 into Sprint 3 and creates the Sprint 3 issues. Docs and backlog only; no app code.

**Branch:** `docs/s3-kickoff` · **Time box:** 45 minutes · **Depends on:** Sprint 2 closed (done, #93) · **Issue:** none (it creates them) · **Before pasting:** `docs/prompts/sprint-3/` (README and nine prompts) and `docs/decisions/0005-packages-and-itinerary.md` are in the working tree, untracked

```text
S3-1  SPRINT 3 KICKOFF: DECISION 0005, RE-PLAN AND BACKLOG
Branch: docs/s3-kickoff   Time box: 45 minutes

CONTEXT
Read AGENTS.md, docs/prompts/sprint-3/README.md (Sprint 3 conventions), docs/decisions/0005 (new,
untracked), docs/decisions/0004, docs/sprints/replan-2026-10-23.md, docs/sprints/sprint-2-review.md,
docs/traceability.md, the sprint map in docs/RUNBOOK.md ("After pre-dev: the sprint map"), the README
roadmap, and scripts/backlog (create-backlog.ts, issues.csv).
On 27 October Maulik's demo deadline moved: a working end-to-end journey is shown on Monday
2 November. Sprint 3 now runs Tue 27 Oct to Mon 2 Nov and also delivers the core of R12 and R13
(planned for Sprint 4). Decision 0005 fixes the rules. Feature freeze (8 Nov) and submission
(10 Nov) are unchanged unless Maulik says otherwise.
GitHub: use the REST API through gh api (repos/thenamakop/BonVoyage/...). Epics: #18 (R8),
#22 (R12), #23 (R13), #24 (R14), #20 and #54 (R10, account deletion), #81 (admin stage labels),
#94 (production halves of R5 and R7).

GOAL
docs/prompts/sprint-3/ and decision 0005 are committed unchanged; the re-plan is recorded in a new
file and in the README roadmap, the RUNBOOK sprint map and the traceability matrix; the Sprint 3
milestone covers 27 Oct to 2 Nov and holds issues S3-2 to S3-9 plus #22, #23, #54, #81 and #94.

STEPS
1. Commit docs/prompts/sprint-3/ and docs/decisions/0005-packages-and-itinerary.md first ("docs: add
   Sprint 3 build prompts and decision 0005"). Whitespace-only prettier changes are fine; word
   changes are not.
2. docs/sprints/replan-2026-10-27.md, in the layout of replan-2026-10-23.md:
   - why: the demo deadline moved to Monday 2 November (a full-journey demo);
   - calendar: Sprint 3 Tue 27 Oct to Mon 2 Nov (G2 plus the core of R12 and R13; the demo on Mon 2);
     Sprint 4 Tue 3 to Sat 7 Nov becomes hardening (demo fixes, #94 if still open, catalogue fee
     pass 2, anything cut under 0005 k); Buffer Sun 8 to Tue 10 Nov unchanged (feature freeze 8 Nov,
     submission 10 Nov);
   - the cut order from 0005 k, which replaces the RUNBOOK's "cut R13's modify step first, then R12";
   - catalogue status today: A 50/50, B1 136/137, B2 85/116, C 202/276, all imported.
3. Update the README roadmap and the RUNBOOK sprint map rows for S3 and S4 to match (S3: R8, R10,
   R12, R13, R14; S4: hardening), linking the new re-plan. In docs/traceability.md set the Sprint
   column of R12 and R13 to S3. Do not edit docs/baseline or docs/design.
4. Milestones (gh api): rename the Sprint 3 milestone to "Sprint 3 (27 Oct-2 Nov)" with due date
   2026-11-02; move #22 and #23 to it; rename the Sprint 4 milestone to "Sprint 4 (3-7 Nov):
   hardening" (keep its due date). Make sure #54, #81 and #94 are on Sprint 3.
5. Create issues S3-2 to S3-9 on the Sprint 3 milestone, titles exactly as the README run order
   ("S3-2 Package and day-plan engine (pure)" and so on), each body: "Prompt:
   docs/prompts/sprint-3/<file>", the prompt's GOAL paragraph, and "Part of #<epic>" (S3-2: #18 and
   #22; S3-3: #18 and #24; S3-4: #18 and #24; S3-5: #54 and #81; S3-6: #22 and #23; S3-7: #23;
   S3-8: #22; S3-9: #94). Use the labels the Sprint 2 issues use. Use scripts/backlog if it fits;
   otherwise gh api. Print the numbers.
6. PR "docs: Sprint 3 kickoff: decision 0005, re-plan and backlog", body: the issue numbers created,
   the milestone changes, and "Decision 0005 is accepted when Maulik merges this PR." No
   Co-Authored-By trailer and no "Generated with Claude Code" line.

VERIFICATION
Paste the real output of: gh api "repos/thenamakop/BonVoyage/issues?milestone=<sprint 3
number>&state=open&per_page=50" --jq '.[] | "#\(.number) \(.title)"' ; pnpm format:check (or the
repo's prettier check) and pnpm lint ; git log --oneline -3.

IF BLOCKED
A milestone or epic is missing or named differently: list what exists and use the nearest match;
never delete a milestone or an issue. The backlog script cannot create these issues: use gh api and
say so.
```
