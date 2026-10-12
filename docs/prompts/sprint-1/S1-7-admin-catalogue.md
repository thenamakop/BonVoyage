# S1-7: Administrator catalogue re-import

Gives an administrator a page to check and load the catalogue files into the live database, so a verified batch reaches production without a terminal. The administrator role is an email allowlist in an environment variable, which needs no migration and is enough for a course project with one administrator.

**Branch:** `feat/35-admin-catalogue` · **Time box:** 2 hours · **Depends on:** S1-1 merged (run it after S1-6 so the access matrix covers it) · **Issue:** #35

```text
S1-7  ADMINISTRATOR CATALOGUE RE-IMPORT
Branch: feat/35-admin-catalogue   Time box: 2 hours   Issue: #35

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions: follow them), issue #35, packages/db/catalogue/README.md, docs/decisions/0002 (catalogue format and staged verification), and the catalogue code in packages/db/src/catalogue (schemas.ts, load.ts, checks.ts, import.ts) and its scripts (catalogue-check.ts, catalogue-import.ts). If S1-6 is merged, read apps/api/src/test/endpoint-inventory.ts and the access matrix: new routes must be added to both.

Today the catalogue reaches a database only through "pnpm catalogue:import --target ..." from Maulik's machine. importCatalogue upserts by natural keys and refuses files with error-level issues. Only Maulik marks rows verified; this endpoint imports whatever the files say and never changes review_status itself.

GOAL
An administrator opens /admin/catalogue, sees what is in the database and how far verification has got, picks the five catalogue files, checks them (a dry run that writes nothing and shows every issue with its line number) and imports them. Everyone else gets 403. No migration.

STEPS
1. Administrator role:
   - apps/api/src/env.ts: ADMIN_EMAILS, optional, a comma-separated list, trimmed and lowercased; empty means nobody is an administrator. Add it to .env.example with a comment (no real address in the example).
   - isAdmin(email) and a requireAdmin middleware (after requireSession) giving 403 FORBIDDEN "Only administrators can do this."
   - MeResponse and GET /api/me gain isAdmin: boolean. Update the shared schema and its tests.

2. Refactor the catalogue code without changing behaviour:
   - parseCatalogue(files: { hubs, destinations, fares, pois, costRules } as strings, { today }) holds everything loadCatalogue does after reading files: header checks, row validation, cross-file checks; it returns the same result shape including issues.
   - loadCatalogue(dir, { today }) reads the five files and calls parseCatalogue.
   - importParsedCatalogue(tx, parsed) does the upserts and returns counts; importCatalogue(db, dir, { today }) stays as the wrapper the CLI uses.
   - The existing catalogue tests and catalogue:check output must be unchanged. Add unit tests that call parseCatalogue with inline strings.

3. Shared contracts (packages/shared/src/api/admin.ts):
   - CatalogueFiles { hubs, destinations, fares, pois, costRules }, each a string of at most 1,000,000 characters.
   - CatalogueImportInput { files: CatalogueFiles, dryRun: boolean }.
   - CatalogueIssue { file, line, column?, severity, message }.
   - CatalogueCounts: per table (hub, destination, poi, fare_fallback, cost_rule) { inserted, updated }.
   - StageProgress { stage: "a" | "b" | "c", verified, total, dueDate }.
   - CatalogueImportResponse { dryRun, issues: CatalogueIssue[], counts: CatalogueCounts, stages: StageProgress[], notInFiles: string[] } where notInFiles lists destination slugs in the database that the files no longer contain (reported, never deleted).
   - CatalogueStatusResponse { tables: per table row counts, stages: StageProgress[], lastUpdatedAt: string | null }.
   - ERROR_CODES gain CATALOGUE_INVALID and PAYLOAD_TOO_LARGE.

4. Endpoints (router, then service; the admin module lives in apps/api/src/admin/):
   - A route-specific body parser: express.json({ limit: "2mb" }) mounted on /api/admin/catalogue/import BEFORE the global express.json (which keeps its small default). Map body-parser's too-large error to 413 PAYLOAD_TOO_LARGE in the error envelope.
   - POST /api/admin/catalogue/import (requireSession, requireAdmin): validate the body; parseCatalogue with today = indiaDate(clock()); any error-level issue gives 422 CATALOGUE_INVALID "The files have errors. Fix them and check again." with the issues in the envelope (add an optional details field to AppError and the shared envelope schema if it has none). Otherwise run importParsedCatalogue in a transaction; for dryRun, compute the counts the same way and then roll the transaction back on purpose, so a dry run reports exactly what an import would do and writes nothing. Log one info line with the admin's user id, dryRun and the counts (no file contents).
   - GET /api/admin/catalogue/status (requireSession, requireAdmin): row counts, stage progress from the database's review_status and cost_review_status columns (stage A: hubs plus destination identity; B: destination costs, fares, cost rules; C: POIs), and the newest updated_at.

5. API tests (integration):
   - anonymous 401, a signed-in non-administrator 403, an administrator 200 on both endpoints (set ADMIN_EMAILS through the env the test app is built with);
   - a dry run with a changed value returns updated 1 for that table and the database is unchanged afterwards;
   - the same request with dryRun false changes the value; importing the same files again gives 0 updated;
   - a destinations file with a bad header gives 422 CATALOGUE_INVALID with an issue on line 1; a row with an out-of-range latitude gives an issue with its line number;
   - a body over 2 MB gives 413 PAYLOAD_TOO_LARGE in the envelope; a 200 KB body to any other route still gets the global limit's 413;
   - GET /api/me shows isAdmin true only for the listed email (case-insensitive).
   - If S1-6 is merged: add both routes to endpoint-inventory.ts with access "admin", and add an admin actor to the access matrix (admin 200, organiser and the others 403, anonymous 401).

6. Web:
   - RequireAdmin layout route inside RequireAuth: useMe().isAdmin false shows a 403 page "Administrators only" with a link home.
   - The user menu shows "Catalogue" (to /admin/catalogue) only for administrators.
   - /admin/catalogue: a status Card (row counts, a progress line per stage such as "Stage A: 50 of 50 verified, due 18 Oct", last updated); an import Card with five labelled file inputs (hubs.csv, destinations.csv, fares.csv, pois.csv, cost-rules.json; read each with File.text()), a "Check files" button (dryRun true) and an "Import" button that is enabled only after a clean check of the same five files (reset when any file changes), with an inline confirm "Import into this database?" naming the host the page is on.
   - Results: issues grouped by file with line numbers, errors first, as a list (not colour alone: "Error", "Warning" and "Info" in words); counts per table; stage progress; the notInFiles list as a warning.
   - Web tests: a non-administrator sees the 403 page; Import stays disabled until a clean check; issues render with their line numbers.

7. Docs: packages/db/catalogue/README.md gains "Importing from the administrator page" (who can, what dry run means, that it never deletes and never changes review_status by itself). docs/traceability.md: test files on R11. Add ADMIN_EMAILS to the environment table in README or docs where the others are listed.

8. Pull request "feat: administrator catalogue re-import", body starting "Closes #35", with screenshots of the status card, a check with issues and a clean import.

9. HAND OVER to Maulik (3 minutes): in Vercel, Settings, Environment Variables, add ADMIN_EMAILS = your own sign-in email for Production and Preview; redeploy production; sign in and open /admin/catalogue; the status card loads. Do not import from production until stage A is finished (Sunday).

VERIFICATION
Paste the real output of:
  pnpm vitest run --project unit packages/db
  pnpm vitest run --project integration apps/api/src/admin
  pnpm catalogue:check            identical to before the refactor
  pnpm verify
  pnpm vercel-build && pnpm smoke:function
Then ask Maulik to add ADMIN_EMAILS=asha@demo.bonvoyage.test to his local .env (never edit or print .env yourself) and restart pnpm dev. As asha, open /admin/catalogue, check the five files from packages/db/catalogue (0 errors, warnings listed), import (0 inserted, 0 updated on a seeded database); edit one destination's name locally, check again (1 updated), then revert the edit. As rohan, /admin/catalogue shows "Administrators only".
Report: endpoints, refactor summary, test counts, deviations.

IF BLOCKED
- The Vercel function rejects the 2 MB body: Vercel's limit is 4.5 MB, so check the route parser order first; report the response if it persists.
- parseCatalogue cannot be split out without changing catalogue:check output: keep the output identical and say what you moved.
- You think the administrator role needs a database column: not for this sprint. Stop and ask if the allowlist cannot work.
- Never mark rows verified, never change review_status in code, never commit a real email address to the repo.
```
