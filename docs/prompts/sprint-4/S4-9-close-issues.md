# S4-9: Close the requirement issues with evidence

The requirement issues stay open until someone cites the evidence. This prompt writes one comment per issue (tests, dry-run lines, PRs), closes the ones whose every criterion is met, and leaves the rest open with what is missing.

**Branch:** `docs/s4-9-close-issues` (only if traceability changes) · **Time box:** 1 hour · **Depends on:** S4-3, S4-5 merged; S4-7 done or cut · **Issues:** #18, #20, #21, #22, #23, #24 (and #25 stays on Buffer)

```text
S4-9  CLOSE THE REQUIREMENT ISSUES WITH EVIDENCE
Branch: docs/s4-9-close-issues (from fresh master, only if a file changes)   Time box: 1 hour
Follow the Sprint 4 conventions (Q1 to Q10).

CONTEXT
Read docs/sprints/sprint-4-plan.md ("Requirement issues still open" and decisions D2 to D4),
docs/sprints/sprint-3-review.md (dry-run and production evidence), docs/traceability.md, the S4-7
results (if run) and each issue's acceptance criteria (gh issue view <n>).

STEPS
1. For each issue, build a table in your report: criterion, evidence (test file and test name,
   dry-run step and quoted line, or PR), met or not. Run the cited test files so each citation is
   current: pnpm vitest run <files> and paste the summaries.
2. Rules per issue:
   - #18 R8: close only if S4-5 merged (travel time on the card).
   - #20 R10: closed by S4-3 (D2); if still open, close with the evidence.
   - #21 R11: close (schema.test.ts cascades, the --fresh-demos no-orphan test, the import).
   - #22 R12: if S4-7 passed, close citing it; if S4-6/S4-7 were cut, comment that the model path
     is tested (itinerary.test.ts, wording.test.ts) but deployments use templates (D4 cut), and
     leave it open for the Buffer.
   - #23 R13: its text was amended per D3; close citing itinerary.test.ts (T13, T14, I5),
     ItineraryPage.test.tsx and dry-run step 4.
   - #24 R14: close (curated then estimate routing, template fallback, provenance on every line
     and item: dry-run steps 3 and 4).
   - #25 R15: comment with the measured times (Sprint 3 review, S4-7) and leave it on Buffer.
3. Post each comment with gh issue comment <n> --body-file <file>, then gh issue close <n> for the
   met ones. Never close an issue with an unmet criterion.
4. If any traceability row cites a stale file or misses an issue, fix it in a docs PR "docs:
   evidence for the requirement issues".

VERIFICATION
Paste: each issue's table, the test summaries, the gh output (comment URLs, closes), and the CI
result if a PR was opened.

IF BLOCKED
A criterion has no evidence and no prompt covers it: leave the issue open, list it for Maulik.
```
