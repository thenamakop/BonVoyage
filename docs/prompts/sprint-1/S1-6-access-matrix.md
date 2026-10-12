# S1-6: Privacy and access matrix

Proves, with tests rather than promises, that nobody reads what is not theirs: every endpoint is tried by every kind of caller, every response is searched for other people's data, and the logs are checked for passwords, cookies and budgets. It adds two cheap protections (JSON-only writes and a referrer policy that keeps invitation links from leaking) and writes the privacy note the SRS asks for.

**Branch:** `feat/34-access-rules` · **Time box:** 2 hours · **Depends on:** S1-5 merged · **Issue:** #34

```text
S1-6  PRIVACY AND ACCESS MATRIX
Branch: feat/34-access-rules   Time box: 2 hours   Issue: #34

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions: follow them), issue #34 ("a profile is readable only by its owner; the group sees aggregates"), SRS sections 3.4 and 3.5 (privacy and security), and the access helpers in apps/api/src/trips/access.ts. S1-2 to S1-5 added the endpoints below; each has its own tests, but nothing yet checks them all together or checks what leaks across users.

GOAL
One test fails if any endpoint answers a caller it should not, if any response carries another user's private data, or if a log line holds a password, cookie or budget. Writes accept only JSON. Invitation tokens do not leak through the Referer header. docs/security/privacy.md explains who sees what.

STEPS
1. Endpoint inventory in apps/api/src/test/endpoint-inventory.ts: every route as { method, path, access } where access is public, session, member, activeMember, organiser or owner. Expect at least: GET /api/health; GET /api/me; GET /api/me/trips; GET and PATCH /api/me/profile; POST /api/me/past-trips; DELETE /api/me/past-trips/:id; GET /api/hubs; GET /api/destinations; POST /api/trips; GET and PATCH /api/trips/:id; POST /api/trips/:id/cancel; POST /api/trips/:id/close-submissions; GET /api/trips/:id/activity; POST /api/trips/:id/invitations; GET and DELETE /api/trips/:id/invitations/active; DELETE /api/trips/:id/members/me; DELETE /api/trips/:id/members/:userId; GET and PUT /api/trips/:id/preferences/me; GET /api/invitations/:token; POST /api/invitations/:token/accept. Better Auth's /api/auth/* is out of scope.
   A test reads the routes actually registered (walk the Express 5 router stack of createApp's result) and fails when a registered route is missing from the inventory or an inventory route is not registered. If walking the stack is unreliable in the installed Express, register routes through a small helper that records them, and test that list instead.

2. Access matrix in apps/api/src/security/access-matrix.test.ts (integration). Actors: anonymous, nonMember, member (active, submitted), excludedMember, organiser. Arrange a fresh trip in collecting_preferences per test case (a factory using the S1-2 helpers), with valid bodies so only access decides. Write the expected status for every endpoint and actor by hand in a table inside the test; do NOT derive it from the inventory's access field, or the test proves nothing. The expected rules:
     public: 200 for everyone.
     session and owner: anonymous 401; everyone else succeeds on their own data (owner routes give 404 for someone else's row).
     member reads (GET trip, activity, preferences/me): anonymous 401, nonMember 404, the other three 200.
     activeMember writes (PUT preferences/me, DELETE members/me): anonymous 401, nonMember 404, excludedMember 403, member 200 or 204; the organiser gets 200 on PUT and 422 ORGANISER_CANNOT_LEAVE on leave.
     organiser writes (PATCH trip, cancel, close-submissions, invitations, members/:userId): anonymous 401, nonMember 404, member 403, excludedMember 403, organiser 2xx or the state's 409.
   Print a readable failure: method, path, actor, expected, got.

3. Leak test in apps/api/src/security/no-leak.test.ts. Give each user unmistakable values: budgets such as 123457 and 234571, a past trip placeName "Leaktest-<name>", emails at the .test domain. Then, as each actor, call every GET endpoint and assert on the raw response text:
   - no other user's budget values, past-trip names or email appear anywhere;
   - GET /api/me is the only response containing the caller's own email;
   - the trip's members carry names, roles, statuses and the submitted flag only;
   - GET /api/invitations/:token holds none of: budgets, dates, member names, emails.

4. Logs. Configure pino and pino-http so that request and response bodies are never logged, and redact req.headers.cookie, req.headers.authorization and res.headers["set-cookie"]. Test: capture log output into an in-memory stream while signing up, signing in and saving a preference with budget 987653; assert the output has no password, no cookie value, no "987653" and no email except where you decide it is needed (prefer none; log user ids).

5. JSON-only writes. Middleware on /api (after the Better Auth mount, so /api/auth is untouched): POST, PUT and PATCH must have Content-Type application/json (charset allowed), otherwise 415 UNSUPPORTED_MEDIA_TYPE "Send JSON with the header Content-Type: application/json." DELETE needs no body. Add the code to ERROR_CODES. This makes cross-site form posts fail before they reach a route, alongside Better Auth's SameSite cookies. Make sure fetchJson in the web always sends the header with a body, and that endpoints without a body (close-submissions, accept, invitations) are called with {}. Tests: a text/plain POST and a form-encoded POST both give 415; a JSON POST works.

6. Referrer policy. Invitation tokens live in /join/<token> URLs, so a click to any outside site from that page would send the token in the Referer header. Add <meta name="referrer" content="same-origin"> to apps/web/index.html, and a Referrer-Policy: same-origin header plus X-Content-Type-Options: nosniff on API responses. In scripts/vercel-build.ts, add the same Referrer-Policy header to the static routes in config.json (a headers route with "continue": true before the filesystem handle), and extend smoke:function or a vercel-build test to check it is present.

7. If time remains (otherwise open an issue "Account deletion" on the Sprint 2 milestone): account deletion. Enable Better Auth's user.deleteUser with a beforeDelete check that refuses while the user organises a trip in a planning status (trip.organiser_id cascades, so deleting would delete the whole group's trip): "Cancel the trips you organise before deleting your account." On /me, a "Delete account" section with a typed confirmation of the email. Integration test: a member deletes their account and their trip_member, preference, past_trip and user_profile rows are gone; an organiser of a planning trip is refused.

8. docs/security/privacy.md: what personal data BonVoyage stores (name, email, hashed password via Better Auth, home city, past trips, preferences); a who-sees-what table (yourself, your group, the organiser, the administrator, nobody else); that group members see names and submitted flags but never each other's answers; that language-model prompts never contain names, emails or member identities (AGENTS.md); logs and their redaction; invitation links and their expiry; deletion. Link it from README's docs list and AGENTS.md.

9. docs/traceability.md: the test files on R10. Pull request "feat: access matrix, leak tests and JSON-only writes", body starting "Closes #34", including the matrix table as the test prints it on success (or a summary count per actor).

VERIFICATION
Paste the real output of:
  pnpm vitest run --project integration apps/api/src/security
  pnpm vitest run --project unit
  pnpm verify
  pnpm vercel-build && pnpm smoke:function
Then with pnpm dev:
  curl -si -X POST http://localhost:5173/api/trips -H "Content-Type: text/plain" -d "x"     expect 415 (or 401 first if the session check runs earlier; say which order you chose and why)
  open /join/<any token> and check in the browser's Network tab that the document has the referrer meta tag
After merging, on production: curl -sI https://bonvoyage-orpin.vercel.app/ shows Referrer-Policy: same-origin.
Report: the inventory count, matrix size (endpoints x actors), anything that failed first and how you fixed it, whether step 7 was done.

IF BLOCKED
- The matrix finds a real access bug: fix the endpoint, not the expectation, and list it in the report.
- A rule above disagrees with an existing endpoint's behaviour on purpose (for example a 404 where the matrix says 403): stop and ask before changing either.
- Better Auth's deleteUser options differ in 1.7.7: follow its documentation for that version; if it needs email verification you cannot do, skip step 7 and open the issue.
- The vercel-build headers route breaks static serving: revert that part, keep the meta tag, and open an issue.
```
