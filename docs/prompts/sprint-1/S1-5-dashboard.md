# S1-5: Live trip dashboard and close submissions (T3b)

Turns the plain trip page into the dashboard the group watches: where the trip stands, who has submitted, what to do next and what just happened, refreshed every 10 seconds without a reload (SRS 3.3). It also gives the organiser the Close submissions button (T3b) for when one member never answers.

**Branch:** `feat/33-dashboard` · **Time box:** 2.5 hours · **Depends on:** S1-4 merged · **Issue:** #33

```text
S1-5  LIVE TRIP DASHBOARD AND CLOSE SUBMISSIONS (T3b)
Branch: feat/33-dashboard   Time box: 2.5 hours   Issue: #33

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions: follow them), docs/wireframes/06-dashboard.svg and 06-dashboard-desktop.svg, issue #33, SRS section 3.3 (changes visible to the group without a reload), and docs/decisions/0001 (f: closing submissions excludes non-submitters). S1-2 to S1-4 built TripDetail, the trip page, InvitePanel, the roster, the preference form and the profile. transitionTrip already implements the excludeNonSubmitters action for T3b.

The dashboard polls; there are no websockets or server-sent events (Vercel functions are request-response). Polling every 10 seconds while the tab is visible is the agreed way to meet SRS 3.3.

GOAL
/trips/:id is a dashboard that explains the trip's state in words, shows progress and the roster, offers each viewer exactly the actions they may take (with the reason when one is disabled), lists recent activity, and updates within 10 seconds of a change made by someone else. The organiser can close submissions once at least 2 members have submitted.

STEPS
1. Shared (packages/shared/src/api/trips.ts):
   - TripProgress { activeCount, submittedCount, pendingCount, excludedCount, maxMembers }.
   - TripAction { action: "invite" | "editDetails" | "editPreferences" | "closeSubmissions" | "cancelTrip" | "leaveTrip", enabled: boolean, reason?: string }.
   - TripDetail gains progress, availableActions: TripAction[] and lastActivityAt. Keep legalEvents.
   - ActivityItem { id, transitionId, event, fromStatus: string | null, toStatus, actorName: string | null, createdAt, summary }; ActivityResponse { items: ActivityItem[] }.
   - EVENT_SUMMARIES: a function or map from (event, kind) to a sentence with the actor's name, for example createTrip "Asha created the trip", inviteMembers "Asha opened the trip for preferences", preferenceSubmitted "Meera submitted preferences", preferenceRevised "Rohan updated preferences", closeSubmissions "Asha closed submissions", cancelTrip "Asha cancelled the trip". A missing actor reads "Someone". Unit test: every TRIP_EVENTS value has a summary.

2. apps/api/src/trips/actions.ts: tripActions({ status, myRole, myStatus, mySubmitted, progress }) returns TripAction[], pure, using legalEvents and the guard thresholds. Rules: excluded members get no actions; invite for the organiser in draft or collecting_preferences; editDetails for the organiser in draft; editPreferences for active members in collecting_preferences or ready_for_recommendation (disabled in draft with "Preferences open once the invite link exists."); closeSubmissions for the organiser in collecting_preferences, disabled with "At least 2 members need to submit first." while submittedCount < 2; cancelTrip for the organiser in any planning status; leaveTrip for active non-organisers in draft or collecting_preferences. Unit tests for organiser and member in draft, collecting (0, 1 and 2 submitted), ready, shortlisted, excluded, cancelled.

3. API:
   - GET /api/trips/:id returns the enriched TripDetail (progress counts from trip_member; lastActivityAt from the newest trip_transition).
   - POST /api/trips/:id/close-submissions (organiser, active member; an empty JSON body {}): transitionTrip with closeSubmissions; returns the updated TripDetail. GUARD_FAILED and ILLEGAL_TRANSITION come from transitionTrip as 409 with the engine's message.
   - GET /api/trips/:id/activity (any member, excluded included): the newest 20 trip_transition rows, newest first, with the actor's name (never the email) and the summary.

4. API tests (integration), the rule 10 matrix plus:
   - close-submissions with 3 active members and 2 submitted: 200, status ready_for_recommendation, one T3b row, the non-submitter now excluded and progress shows excludedCount 1; with 1 submitted: 409 GUARD_FAILED and nothing changes; a member: 403; a non-member: 404; a draft trip: 409 ILLEGAL_TRANSITION;
   - activity: newest first, at most 20, names and summaries present, no "@" anywhere in the JSON (no emails);
   - TripDetail.progress and availableActions for the organiser and for a member.

5. Web data: useTrip(id) gets refetchInterval 10000 while the status is not cancelled or completed, refetchIntervalInBackground false and refetchOnWindowFocus true; useTripActivity(id) on ["trip", id, "activity"] with the same polling; useCloseSubmissions and useCancelTrip invalidate ["trip", id], ["trip", id, "activity"] and ["trips"]. A failed background refetch keeps the last data on screen.

6. Dashboard at /trips/:id (wireframe 06; two columns on desktop, one at 360 px). Split into components in src/pages/Trips/dashboard/:
   - StatusBanner: the status label as a heading, its explanation, and a step line such as "Step 2 of 7: Collecting preferences" for planning statuses (cancelled and completed get their own wording).
   - TripParameters: origin, nights, group budget with formatInr plus "about ₹16,000 each" (group total divided by active members, rounded down to the nearest 500), radius; dates once set.
   - ProgressCard: a progress bar (role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax and aria-valuetext) and the same fact as text: "2 of 3 travellers have submitted".
   - Roster: one chip per active member with the name, "Organiser" when it applies, and "Submitted" or "Waiting" in words (an icon may add to the words, never replace them); removed members listed below as "Removed". Remove and Leave from S1-3 stay here.
   - NextStep callout, worded for the viewer: "Fill in your preferences" with a button (active member, not submitted); "Create the invite link to open the trip" (organiser, draft); "Waiting for Meera" (names of up to 3 pending members, then "and 2 others"); "Everyone is in. Recommendations arrive in the next release." (ready_for_recommendation); "You were removed from this trip, so you can only view it." (excluded).
   - OrganiserActions driven only by availableActions: InvitePanel, Edit details, Close submissions (inline confirm that names who will be excluded: "Meera has not submitted and will be left out of planning."), Cancel trip (inline confirm, then the existing cancel endpoint). A disabled action shows its reason as text next to it.
   - RecentActivity: the summaries with relative times ("5 minutes ago", title attribute with the full date and time), collapsed to 5 with "Show all".
   - A footer line "Updated 5 seconds ago" that ticks every 5 seconds from the query's dataUpdatedAt, a Refresh button, and a warning Alert "Could not refresh. Trying again." while background refetches fail.
   - A visually hidden aria-live="polite" region that announces status changes between polls ("Trip status changed to Ready for recommendation").

7. Web tests (vi.useFakeTimers where timing matters): progress text and aria values; advancing 10 s triggers a second fetch and a changed status is announced; a failed refetch keeps the old data and shows the warning; a disabled closeSubmissions shows its reason; the next-step text for a pending member and for the organiser in draft; polling stops for a cancelled trip.

8. docs/traceability.md: test files on R3. Pull request "feat: live trip dashboard and close submissions (T3b)", body starting "Closes #33", with screenshots (360 px and desktop) of the organiser's and a member's view and the result of the two-browser test below.

VERIFICATION
Paste the real output of:
  pnpm vitest run --project unit
  pnpm vitest run --project integration apps/api/src/trips
  pnpm vitest run --project web
  pnpm verify
Then the SRS 3.3 check with pnpm db:reset && pnpm db:seed and pnpm dev, two browser profiles side by side:
  - Asha watches the demo trip; Meera submits her preferences. Note how many seconds pass before Asha's dashboard shows 3 of 3 and the new status, without touching her browser (must be 10 s or less). Repeat twice and report the three times.
  - Reset again; as Asha, Close submissions is enabled (2 submitted); confirm it: Meera is listed as removed, the status is Ready for recommendation, and within 10 s Meera's browser shows the removed message.
  - Switch Asha's tab away for 30 s and back: the network tab shows no requests while hidden and one on return.
Report: the measured times, the activity list for the demo trip, deviations.

IF BLOCKED
- TanStack Query keeps polling in a hidden tab: check refetchIntervalInBackground is false and the document visibility handling of the installed version.
- Fake timers break TanStack Query in tests: advance with vi.advanceTimersByTimeAsync and wrap in act; or set a 0 ms retry and real timers for that one test.
- You want websockets, server-sent events or a push service: no. Polling is the decision for this sprint.
- Any number on the dashboard needs a new column: stop and ask.
```
