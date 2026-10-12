# S1-3: Invitation link, join flow and roster (T2)

Lets the organiser share one link, lets friends join through it (signing up on the way if they need to), and lets the organiser remove someone or a member leave. Creating the first link is transition T2, so this prompt also gives `transitionTrip` a small hook for work that must happen in the same transaction.

**Branch:** `feat/31-invitations` · **Time box:** 2.5 hours · **Depends on:** S1-2 merged · **Issue:** #31

```text
S1-3  INVITATION LINK, JOIN FLOW AND ROSTER (T2)
Branch: feat/31-invitations   Time box: 2.5 hours   Issue: #31

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions: follow them), docs/wireframes 04-join.svg and 06-dashboard.svg (the invite and roster parts), issue #31, docs/decisions/0001 and 0003 (link invitations with statuses active and revoked; no email until reminders), and apps/api/src/trips/transition-trip.ts. S1-2 gave you access.ts (parseTripId, loadTripForMember, requireOrganiser, requireActiveMember), the test helpers in apps/api/src/test, the trip contracts and the /trips/:id page.

The invitation table exists: trip_id, token (unique), created_by, status (active or revoked), expires_at, created_at. A trip has 2 to 8 travellers (SRS). T2 (draft, inviteMembers, to collecting_preferences) happens when the organiser creates the first link. Joining is not a state-machine event: it only adds a trip_member row while the trip is collecting preferences.

GOAL
The organiser gets one shareable link per trip, can copy or share it and turn it off. Anyone with the link sees a safe preview, signs in or up, and joins with one tap. Joining is refused clearly when the link has expired, the trip is full or no longer open. The organiser can remove a member and a member can leave, while preferences are still open. Every write is race-safe.

STEPS
1. transitionTrip hook. Add an optional input beforeDecide?: (tx, lockedTrip) => Promise<void>. It runs inside the transaction after the row lock and before the guard context is built and nextState is called. If it throws, or nextState rejects, everything rolls back. Integration tests: the hook sees the locked trip; a throwing hook leaves no trip_transition row and no status change; work the hook writes is rolled back when nextState rejects.

2. Shared (packages/shared/src/api/invitations.ts and the index):
   - MAX_MEMBERS = 8 and INVITATION_TTL_DAYS = 14 (constants, also used by the web).
   - InvitationResponse { token, status, expiresAt }; ActiveInvitationResponse { invitation: InvitationResponse | null }.
   - InvitationPreview { tripTitle, organiserName, memberCount (active), maxMembers, state: "open" | "expired" | "revoked" | "closed" | "full", alreadyMember: boolean }. No budget, no dates, no member names: the link may be forwarded beyond the group.
   - AcceptInvitationResponse { tripId }.
   - ERROR_CODES gain INVITATIONS_CLOSED, INVITATION_EXPIRED, TRIP_FULL, MEMBER_EXCLUDED, CANNOT_REMOVE_ORGANISER, ORGANISER_CANNOT_LEAVE, TRIP_LOCKED.

3. Endpoints (router, then service, then repository):
   - POST /api/trips/:id/invitations (organiser, active member). Tokens are crypto.randomBytes(24).toString("base64url"); expiry is now (from the clock dep) plus INVITATION_TTL_DAYS.
       draft: transitionTrip with event inviteMembers and a beforeDecide that inserts the invitation; respond 201 with it.
       collecting_preferences: lock the trip row; if an active, unexpired invitation exists, return it (200); otherwise create one (201).
       any other status: 409 INVITATIONS_CLOSED "This trip is no longer taking new members."
   - GET /api/trips/:id/invitations/active (organiser): ActiveInvitationResponse with the active, unexpired invitation or null.
   - DELETE /api/trips/:id/invitations/active (organiser): set every active invitation of the trip to revoked; 204; doing it twice is fine.
   - GET /api/invitations/:token (no session required; read the session if present only to fill alreadyMember): an unknown token gives 404 NOT_FOUND "This invitation link is not valid."; otherwise InvitationPreview, with state worked out in this order: revoked, expired, closed (trip not collecting_preferences), full (active members >= MAX_MEMBERS), open.
   - POST /api/invitations/:token/accept (session). One transaction: find the invitation (404 as above), lock the trip row FOR UPDATE, then:
       revoked or expired: 410 INVITATION_EXPIRED "This link has expired or was turned off. Ask the organiser for a new one."
       trip not collecting_preferences: 409 INVITATIONS_CLOSED
       caller already an active member: 200 with the tripId (idempotent, no new row)
       caller is an excluded member: 409 MEMBER_EXCLUDED "You were removed from this trip. Ask the organiser if you think this is a mistake."
       active members >= MAX_MEMBERS: 422 TRIP_FULL "This trip already has 8 travellers."
       otherwise insert trip_member (role member, status active) and respond 200 { tripId }.
   - DELETE /api/trips/:id/members/me (active member, not the organiser): delete the caller's trip_member row (their preference goes with it by cascade) so the trip disappears from their list; the organiser gets 422 ORGANISER_CANNOT_LEAVE "Organisers cannot leave. Cancel the trip instead."; 204. Register this route BEFORE the :userId route, because user ids are text and "me" would match.
   - DELETE /api/trips/:id/members/:userId (organiser): the target must be a member (else 404 NOT_FOUND) and not the organiser (422 CANNOT_REMOVE_ORGANISER); set the member's status to excluded and submitted_at to null and delete their preference row, so it never counts; 204. They can still view the trip read-only (conventions rule 4).
   - Both member routes need the trip in draft or collecting_preferences, else 409 TRIP_LOCKED "Members cannot change after preferences close." Lock the trip row while checking.

4. API tests (integration), the conventions rule 10 matrix for every endpoint, plus:
   - the first POST in draft writes exactly one T2 row and moves the trip to collecting_preferences; a second POST returns the same token with no new transition;
   - two concurrent first POSTs (Promise.allSettled, separate agents of the same organiser) give one T2 row and both responses carry the same token;
   - a revoked link previews as revoked and accept gives 410; a link past its expiry (inject the clock) gives 410;
   - with 7 active members, two different users accepting at once: exactly one 200 and one 422 TRIP_FULL;
   - accepting twice is idempotent; an excluded member gets 409 MEMBER_EXCLUDED;
   - the preview never contains budgetTotalInr, dates, emails or member names (assert on the raw JSON text);
   - removal deletes the preference row; the removed member then gets 403 on PUT preferences/me and on leave, but still 200 on GET /api/trips/:id.

5. Web data hooks in src/features/invitations/api.ts: useActiveInvitation(tripId) (["trip", id, "invitation"]), useCreateInvitation, useRevokeInvitation, useInvitationPreview(token) (["invitation", token]), useAcceptInvitation (invalidate ["trips"]), useRemoveMember and useLeaveTrip (invalidate ["trip", id] and ["trips"]).

6. Web UI:
   - InvitePanel on /trips/:id, organiser only, while the trip is draft or collecting_preferences. Draft: "Invite people" explains that creating the link opens the trip for preferences, plus a "Create invite link" button. With a link: a read-only TextField showing window.location.origin + "/join/" + token, a Copy button (navigator.clipboard.writeText; on failure, select the text and say "Press Ctrl+C to copy"), a Share button only when navigator.share exists, "Expires 27 Oct 2026" via formatDate, "3 of 8 travellers", and "Turn off link" with an inline confirm step. Announce "Link copied" through a role="status" region.
   - Roster on /trips/:id: each member with name, role and, for the organiser, a Remove button with an inline confirm ("Remove Rohan? Their preferences will be deleted."). Excluded members are listed separately as "Removed". A member sees "Leave trip" with an inline confirm; after leaving, go to /trips.
   - /join/:token, a public route outside RequireAuth (wireframe 04): loading, then the preview. open and signed out: "Sign in to join" (to /sign-in?next=/join/<token>) and "Create an account" (to /sign-up with the same next). open and signed in: a Join button; success navigates to /trips/<tripId>. alreadyMember: "You are already in this trip" plus an Open trip link. expired, revoked, closed and full each get one plain sentence and a link to /trips. 404: "This invitation link is not valid."

7. Web tests: the join page signed out shows the sign-in link with next=%2Fjoin%2F<token>; Join navigates to the trip; the expired state shows its sentence; InvitePanel's Copy calls clipboard.writeText with the full URL and announces it; the organiser sees Remove and a member does not.

8. docs/traceability.md: test files on R2. Pull request "feat: invitation link, join flow and roster (T2)", body starting "Closes #31", with screenshots (360 px and desktop) of the invite panel, the join page signed out and signed in, and an expired link.

VERIFICATION
Paste the real output of:
  pnpm vitest run --project integration apps/api/src/trips apps/api/src/invitations
  pnpm vitest run --project web
  pnpm verify
Then with pnpm dev, in two browser profiles: as kabir, create a draft trip and its invite link (status becomes Collecting preferences); in the other profile, sign up a new user through the link and join; back as kabir, reload: the roster shows them. Remove them: their view becomes read-only and shows that they were removed. Turn the link off and open it again: the revoked message. Paste the trip_transition rows for that trip (T1, T2).
Report: endpoints, error codes added, deviations, and anything the state machine did not cover.

IF BLOCKED
- Express 5 path syntax rejects a route pattern: use the Express 5 form and keep the URL the same.
- The concurrency tests flake: they must not. Use separate pool connections and Promise.allSettled; if they still flake, stop and report.
- Removing a member seems to need a new status or column: it does not. Use excluded plus deleting the preference. Stop and ask if you disagree.
- Removing the last pending member leaves everyone else submitted but the trip still collecting: that is expected (no event fires); the organiser uses Close submissions in S1-5. Note it in the report.
```
