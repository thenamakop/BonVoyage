# S0-8: Backlog, labels and Sprint 1 issues

Turns the requirements into a GitHub backlog with one script you can re-run safely: labels, sprint milestones, a project board with Priority, Module, Requirement, Sprint, Estimate and Academic owner fields, 18 epics with acceptance criteria from the SRS, and the Sprint 1 issues as sub-issues of their epics.

**Branch:** `chore/s0-backlog` · **Time box:** 1.5 hours · **Depends on:** S0-1 merged and the `project` scope from setup step 3; it can run any time after S0-1

```text
S0-8  BACKLOG, LABELS AND SPRINT 1 ISSUES
Branch: chore/s0-backlog   Time box: 1.5 hours

CONTEXT
Read AGENTS.md, docs/RUNBOOK.md Phase 9, prompt A5 and Appendix B1, docs/traceability.md, docs/baseline/BonVoyage_SRS_v1.1.md (sections 2.2, 3.1.3, 3.3, 3.4, 3.5 and Tables 5 to 9) and docs/baseline/BonVoyage_MoSCoW_Prioritization.md. Run "gh auth status" first: it must list the project scope, otherwise stop and tell Maulik to run "gh auth refresh -s project".

Maulik builds everything himself with coding agents, so every issue is assigned to his GitHub login ("gh api user -q .login"). The team names stay visible as an "Academic owner" field, taken from the RUNBOOK Phase 1 table, because the course grades the team plan.

Scope for 10 November: R1 to R16 are planned across Sprints 1 to 4 and the buffer; R17 and R18 are deferred (epics exist with the label deferred and no milestone); R19 and R20 are Won't Have and get no issue.

GOAL
scripts/backlog/create-backlog.ts creates or updates, idempotently: the labels, five milestones, the GitHub Project "BonVoyage" with its fields, 18 epics (R1 to R18) and the Sprint 1 and catalogue issues as sub-issues of their epics, every item on the board with its fields set. A second run changes nothing. docs/traceability.md lists the epic numbers.

STEPS
1. Data files in scripts/backlog/ (RFC 4180 CSV, header row first):
   - requirements.csv: id, title, priority, modules, srs_ref, use_case_dfd, sprint, academic_owner, acceptance. Rows R1 to R18 from RUNBOOK Appendix B1, with sprint values as in docs/traceability.md. acceptance holds 3 to 6 criteria separated by ";", taken from the SRS text for that requirement (Table 5 for R2 and R9, Table 6 for R3 and R4, Table 7 for R5 to R7, Table 8 for R8 and R14, Table 9 for R12 and R13, 2.2 for R1, 3.4 and 3.5 for R10 and R11, 3.3 for R15, 3.1.3 for R16, the MoSCoW document for R17 and R18). Paraphrase closely; never invent a criterion the SRS does not support. Titles read like "[R5] Eliminate destinations over budget, duration or radius".
   - issues.csv: key, title, epics, module, academic_owner, estimate, milestone, labels, acceptance. These rows (estimate in points):
       S1-1  Sign-up, sign-in and sign-out screens with session handling; check sessions on a preview from a phone (spike S4)   R1,R10  User & Group Management  Maulik    5  Sprint 1
       S1-2  Create a trip with origin hub, duration, budget and radius (T1)                                                      R2,R9   User & Group Management  Parth     5  Sprint 1
       S1-3  Shareable invitation link, join flow and roster (T2)                                                                  R2      User & Group Management  Parth     5  Sprint 1
       S1-4  Preference form; a submission records T3 or I1                                                                         R3      Preference Management    Kushagra  5  Sprint 1
       S1-5  Trip dashboard with submission status and a 10-second poll                                                             R3      Preference Management    Kushagra  3  Sprint 1
       S1-6  Access rules: a profile is readable only by its owner; the group sees aggregates                                       R10     Preference Management    Maulik    3  Sprint 1
       S1-7  Administrator catalogue re-import endpoint and administrator role                                                      R11     External Data Integration Manan    3  Sprint 1
       S1-8  Wireframes for the five SRS 3.1.1 screens at 360 px and desktop                                                        R3      User & Group Management  Kushagra  2  Sprint 1
       CAT-A Catalogue stage A: verify hubs and destination identity (due 18 Oct)                                                   R11,R14 External Data Integration Manan    5  Sprint 1
       CAT-B Catalogue stage B: verify destination costs, fares and cost rules (due 25 Oct)                                         R14     External Data Integration Manan    5  Sprint 2
       CAT-C Catalogue stage C: verify places of interest (due 1 Nov)                                                               R14     External Data Integration Manan    3  Sprint 3
     Write 3 to 6 specific acceptance criteria for each, consistent with the merged code and decisions. Examples: S1-1 "sign-up rejects a password under 12 characters", "the session survives a reload on the preview in Chrome on Android"; S1-4 "budget minimum above maximum is rejected against the field", "a date window in the past is rejected"; CAT-A "pnpm catalogue:check --require a exits 0". Labels: type:feature, except S1-8 (type:docs) and CAT-A to CAT-C (type:chore plus catalogue).

2. scripts/backlog/create-backlog.ts (tsx; root script "backlog"). It shells out to gh with child_process.execFileSync("gh", args) (no shell, so it works in PowerShell and Git Bash), parses JSON output, and supports --dry-run, which prints every intended change and makes none. In order:
   a) Repository and owner from "gh repo view --json nameWithOwner,owner"; owner type from "gh api repos/{owner}/{repo} -q .owner.type" (use --owner @me for a user, the login for an organisation).
   b) Labels (create or update colour and description): type:feature, type:bug, type:chore, type:docs, type:spike, type:test, epic, deferred, catalogue.
   c) Milestones with due dates (end of day, IST): "Sprint 1 (12-18 Oct)" 2026-10-18, "Sprint 2 (19-25 Oct)" 2026-10-25, "Sprint 3 (26 Oct-1 Nov)" 2026-11-01, "Sprint 4 (2-7 Nov)" 2026-11-07, "Buffer (8-10 Nov)" 2026-11-10. Use the REST milestones endpoint through gh api.
   d) Project: find a project titled "BonVoyage" for the owner (gh project list --format json) or create it, then link it to the repository (gh project link). Create the missing fields: Priority (Must, Should, Could), Module (the ten SRS module names), Requirement (R1 to R18), Sprint (S0, S1, S2, S3, S4, Buffer, Deferred), Estimate (number), Academic owner (Maulik, Kushagra, Manan, Parth). Keep the built-in Status field as it is. Read field and option ids from "gh project field-list <number> --owner <owner> --format json".
   e) Epics: for each requirements.csv row, find an issue whose title starts with "[Rn] " (list all issues once with "gh issue list --state all --limit 500 --json number,title,id" and match locally; search indexes lag). Create it if missing, with labels type:feature and epic (plus deferred for R17 and R18), the milestone for its sprint (none for deferred), assignee Maulik, and a body holding the requirement, priority, modules, SRS reference, use case and DFD process, sprint, the acceptance criteria as a "- [ ]" checklist, and "Traceability: docs/traceability.md".
   f) Issues from issues.csv the same way, matched by exact title. The body holds the goal, the acceptance checklist, the epics, the module, the academic owner, the estimate and "Definition of Done: AGENTS.md section 13". Then attach each issue as a sub-issue of every listed epic: "gh api --method POST repos/{owner}/{repo}/issues/<epic number>/sub_issues -F sub_issue_id=<child issue id>", where the id is the numeric REST id, not the issue number. An issue can have only one parent, so attach it to its FIRST epic and mention the others in its body.
   g) Add every epic and issue to the project (gh project item-add --format json gives the item id) and set Priority, Module (first module), Requirement (first epic), Sprint, Estimate and Academic owner with gh project item-edit. Setting the same value again is harmless, so do it every run.
   h) Print a summary: created, updated, unchanged.
   Pause about 300 ms between write calls to avoid GitHub's secondary rate limit.

3. Run it with --dry-run, review the plan, then run it for real, then run it a second time (it must report 0 created).

4. docs/traceability.md: fill the Issues column with each epic's number (and the S1-x and CAT-x numbers on their requirement rows). Add one line under the table: "Board: <project URL>".

5. HAND OVER to Maulik (2 minutes): in the project, add a Board layout grouped by Status and a Table layout grouped by Sprint (the gh CLI cannot create views), then reply "views added".

VERIFICATION
Paste the real output of:
  pnpm backlog --dry-run              (after the real run: no changes planned)
  gh label list
  gh api repos/{owner}/{repo}/milestones -q ".[].title"
  gh issue list --label epic --state all --limit 50          18 epics
  gh issue list --milestone "Sprint 1 (12-18 Oct)" --limit 50  the 9 Sprint 1 issues plus the Sprint 1 epics
  gh api repos/{owner}/{repo}/issues/<R2 epic number>/sub_issues -q ".[].title"
  gh project item-list <number> --owner <owner> --format json --limit 200   (count items; every item has Sprint and Priority set)
Report: the project URL, the epic numbers R1 to R18, the Sprint 1 issue numbers, and anything the script could not set.

IF BLOCKED
- Missing project scope or permission errors: stop and tell Maulik the exact gh error.
- gh project item-edit rejects a value: re-read the field and option ids; never create a duplicate field.
- The sub-issues endpoint fails (feature unavailable or a parent already set): write "Parent: #<epic>" at the top of the child body and add the child to a task list in the epic body instead. Say so in the report.
- Never edit, close or delete an issue whose title is not in the two CSV files.
```
