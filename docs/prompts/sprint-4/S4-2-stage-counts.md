# S4-2: Run queries on a transaction one after another

`pnpm verify` prints pg's deprecation "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0". S4-1 traced it to the catalogue import: five parallel SELECTs on one transaction client. pg 9 turns this into an error, which would break the admin import on the next dependency update.

**Branch:** `fix/118-stage-counts-sequential` · **Time box:** 45 minutes · **Depends on:** S4-1 merged · **Issue:** #118 · **Safe before the demo:** yes (no screen changes)

```text
S4-2  RUN QUERIES ON A TRANSACTION ONE AFTER ANOTHER
Branch: fix/118-stage-counts-sequential (from fresh master)   Time box: 45 minutes
Issue: the "stage counts run in parallel on one transaction client" issue (number from
docs/sprints/sprint-4-plan.md). Follow the Sprint 4 conventions (Q1 to Q10).

CONTEXT
Read AGENTS.md (sections 9 and 10), docs/sprints/sprint-4-plan.md (finding 2),
apps/api/src/admin/service.ts and repository.ts, packages/db/src/index.ts (createDb, the Db and
transaction types).
The path: importCatalogue opens db.transaction; at apps/api/src/admin/service.ts:92 it calls
stagesOf(tx); that calls stageCounts(tx) at apps/api/src/admin/repository.ts:31, which runs five
SELECTs (hub, destination, poi, fare, cost_rule) in one Promise.all on the single transaction
client. catalogueStatus (service.ts:111) runs the same Promise.all on the pool, which is allowed
(each query takes its own client). Node prints a deprecation once per process, so a second site
in the same test files may be hidden behind this one.

GOAL
No code path runs two queries at once on one transaction client; no test run prints the
"already executing" deprecation; behaviour and return shapes are unchanged.

STEPS
1. Reproduce first (Q2): run
     $env:NODE_OPTIONS="--trace-deprecation"; pnpm vitest run --project integration apps/api/src/admin/admin.test.ts
   and paste the stack lines that point at repository.ts. Clear NODE_OPTIONS afterwards.
2. stageCounts: run the five queries one after another with await, keeping the return object
   identical. Do not branch on "is this a transaction"; five count queries in sequence cost a few
   milliseconds.
3. Search apps/ and packages/ for every Promise.all (and Promise.allSettled) whose callbacks run
   queries. For each, decide whether the reader can be a transaction client (follow the callers).
   Fix every one that can, the same way. List every site you checked with file:line and
   "pool only" or "fixed".
4. Add a guard test so this cannot come back silently: in the integration setup (or a small test
   in apps/api/src/admin), listen for process 'warning' events during an import and fail if a
   warning's message contains "already executing". If the deprecation fires only once per
   process, run the import first in that file so the test sees it.
5. Run each integration test file on its own with NODE_OPTIONS=--trace-deprecation and confirm
   no "already executing" output (a PowerShell loop over the files is fine; paste the summary).
6. PR "fix: run queries on a transaction one after another", body "Closes #118".

VERIFICATION
Paste: the step 1 stack lines (before); the list from step 3; the per-file loop summary (after,
no warning lines); pnpm format:check; pnpm lint; pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
A site needs parallel queries for speed inside a transaction (for example an import that would
slow noticeably): measure before and after, report the numbers, and stop for a decision.
```
