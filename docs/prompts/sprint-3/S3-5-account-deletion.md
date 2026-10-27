# S3-5: Account deletion (#54) and admin stage labels (#81)

The last open criterion of R10 (a user can delete their account and their personal data goes with it), plus the Sprint 2 spill: the admin catalogue page still shows the stage plan from before the re-plan.

**Branch:** `feat/s3-5-account-deletion` · **Time box:** 2 hours · **Depends on:** S3-1 merged · **Issue:** S3-5, #54, #81 · **Can run beside S3-2** in a worktree (this one uses db-test; S3-2 does not)

```text
S3-5  ACCOUNT DELETION (#54) AND ADMIN STAGE LABELS (#81)
Branch: feat/s3-5-account-deletion   Time box: 2 hours   Issues: S3-5, #54, #81

CONTEXT
Read AGENTS.md (sections 6.7, 10 and 11), docs/prompts/sprint-3/README.md (P1 to P12),
docs/decisions/0005 j, issue #54 and issue #81 in full (gh api
repos/thenamakop/BonVoyage/issues/54 and /81), docs/security/privacy.md, the Better Auth setup
(apps/api/src/auth), apps/api/src/profile, the cascade rules in packages/db/src/schema,
apps/web/src/pages/Profile, packages/db/src/catalogue/stages.ts, scripts or code behind
pnpm catalogue:check (its A, B1, B2, C stage table and dates), and apps/web/src/pages/Admin.

GOAL
A signed-in user can delete their account from the profile page after confirming with their
password and typing DELETE; their sessions, profile, preferences, package opinions and memberships
are gone, and the rules for trips they organise follow #54 (or 0005 j where #54 is silent). The
admin catalogue page shows stages A, B1, B2 and C with the decision 0004 dates, from the same source
as pnpm catalogue:check.

STEPS
1. Rules: write down in the PR which #54 criteria apply and where 0005 j fills a gap. If #54
   contradicts 0005 j, #54 wins; if #54 asks for something new (for example a grace period or an
   export), stop and ask.
2. API: use Better Auth's own delete-user support if it fits (enable it in the auth config with
   password verification); otherwise one endpoint DELETE /api/profile (JSON body { password,
   confirm: "DELETE" }) that verifies the password through Better Auth, never by hand.
   - Refuse with 422 ACCOUNT_HAS_ACTIVE_TRIPS { trips: [{ id, title, status }] } when the user
     organises a trip in a planning status (0005 j), unless #54 says otherwise.
   - Delete in one transaction: the app data the cascades do not cover first, then the Better Auth
     user (sessions and accounts go with it). Trips the user organised that are finalised,
     completed or cancelled are deleted (cascade). A member's trip_member rows go; recompute
     nothing else.
   - The response clears the session cookie; a later request with the old cookie gets 401.
   - Log only id, method, path, status and userId (the deleted id), never the email.
3. Web: a "Delete account" section at the end of the profile page: what is deleted (one short
   list), a password field, a text field "Type DELETE to confirm", and "Delete my account"
   (disabled until both are filled). On 422 list the trips with links. On success go to the home
   page with "Your account has been deleted."
4. Security: the route in endpoint-inventory.ts and the access matrix (anonymous 401; any signed-in
   user only ever deletes themself); a privacy test: after deletion no row anywhere references the
   user id (check every table with a user_id or userId column, generated from the schema).
5. #81: CATALOGUE_STAGE_ORDER and the stage labels and due dates come from one shared definition
   (A due 26 Oct, B1 due 1 Nov, B2 best effort by 5 Nov, C due 1 Nov, as catalogue:check prints
   them); the admin page and the checker both read it; update the admin page test and the
   endpoint's response shape if needed.
6. docs/security/privacy.md: a short "Account deletion" section. Traceability R10 (close the last
   criterion) and R11. PR "feat: account deletion and admin stage labels", body starts "Closes
   #<S3-5>, closes #54, closes #81".

VERIFICATION
Paste the real output of: pnpm vitest run --project integration apps/api/src/profile
apps/api/src/auth apps/api/src/security apps/api/src/admin ; pnpm vitest run --project web
apps/web/src/pages/Profile apps/web/src/pages/Admin ; pnpm verify. Then in pnpm dev: sign up a
throwaway account, join nothing, delete it, and paste the network responses (status codes only and
the error body if any). Stop every dev server you start.

IF BLOCKED
Better Auth's delete needs an email flow or a setting that sends mail: do not enable mail; use the
endpoint route in step 2 and say why. A cascade would delete another user's data: stop and report the
table.
```
