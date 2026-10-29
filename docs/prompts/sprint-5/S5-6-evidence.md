# S5-6: Evidence and traceability for Sprint 5

Each Sprint 5 feature closes its issue with cited evidence, as S4-9 does for the Must and Should requirements. The traceability matrix and the requirement documents must stop calling R17 and R18 "deferred".

**Branch:** `docs/s5-6-evidence` · **Time box:** 1 hour · **Depends on:** S5-2 to S5-5 merged or cut · **Issues:** #27, #28, the reminders and harness issues

```text
S5-6  EVIDENCE AND TRACEABILITY FOR SPRINT 5
Branch: docs/s5-6-evidence (from fresh master)   Time box: 1 hour
Follow the Sprint 5 conventions (Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/sprints/sprint-5-plan.md, docs/sprints/replan-2026-10-29.md, docs/traceability.md
(rows R7, R16, R17, R18 and any row a Sprint 5 PR touched), docs/RUNBOOK.md (Appendix B rows R17
and R18, the out-of-scope line), docs/specs/scoring.md, docs/security/privacy.md,
docs/evaluation/results-*.md, and each issue (gh issue view <n>).

STEPS
1. For each Sprint 5 issue, a table in your report: criterion, evidence (test file and name, PR,
   results file line), met or not. Run the cited tests so each citation is current and paste the
   summaries.
2. Comment the table on each issue (gh issue comment <n> --body-file <file>) and close the met
   ones. A cut item: comment why it was cut and leave it open on the Buffer milestone.
3. traceability.md: R17 and R18 rows with sprint S5, PRs and tests; R16 or R7 rows if S5-2's
   explanation line or S5-3's notifications changed their evidence; a note under the table that
   the evaluation results live in docs/evaluation.
4. RUNBOOK Appendix B: R17 and R18 "S5 (29 Oct-7 Nov)" instead of "after 10 Nov"; the
   out-of-scope line keeps email and the user study only.
5. PR "docs: Sprint 5 evidence and traceability", no Closes line (issues were closed in step 2).

VERIFICATION
Paste: each issue's table, the test summaries, the gh output (comment URLs, closes), pnpm
format:check and the CI result.

IF BLOCKED
A criterion has no evidence: leave the issue open and list it for Maulik.
```
