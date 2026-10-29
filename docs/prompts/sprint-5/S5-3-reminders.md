# S5-3: In-app notifications and reminders

The `notification` table has existed since migration 0000 (`packages/db/src/schema/notifications.ts`: user, trip, type, payload, created and read times, cascading on account and trip deletion), but nothing reads it. The state machine already names the actions `sendInvitations` and `notifyMembers`. This prompt makes those actions write in-app notifications, adds a bell to the app shell, and gives the organiser a rate-limited "Remind" button. There is no email, push or new outbound service (M4).

**Branch:** `feat/<issue>-in-app-reminders` · **Time box:** 4 hours · **Depends on:** S5-1 approved (E3) · **Issue:** the reminders issue from S5-1 · **Migration:** none expected (the table exists) · **Cut:** second, after S5-4

```text
S5-3  IN-APP NOTIFICATIONS AND ORGANISER REMINDERS
Branch: feat/<issue>-in-app-reminders (from fresh master)   Time box: 4 hours
Issue: the "In-app reminders" issue. Follow the Sprint 5 conventions (Q1 to Q10 with V1 to V8).

CONTEXT
Read docs/sprints/sprint-5-plan.md (finding 1c, the reminders design, decision E3: it overrides
anything below), packages/db/src/schema/notifications.ts, packages/engine/src/trip-state.ts (the
actions on T2, T3b and the transitions listed below), apps/api/src/trips (transition-trip.ts,
actions.ts, service.ts, router.ts), apps/api/src/modules/index.ts (where notification already
appears), apps/api/src/profile/repository.ts (account deletion), apps/api/src/test/
endpoint-inventory.ts, apps/api/src/security/access-matrix.test.ts and no-leak.test.ts,
apps/web/src/components/app/AppShell.tsx and UserMenu.tsx, apps/web/src/pages/Trips/TripPage.tsx
and dashboard/, and docs/security/privacy.md.

GOAL
Members learn about what needs them without leaving the app; the organiser can nudge members who
have not submitted, at most once per member per 24 hours; no notification reveals another member's
preferences, budget, score or vote.

DESIGN (the recommended E3; the plan's version wins if it differs)
- Types and recipients (payload holds only trip id, trip name and the type's own fields):
  * trip_opened (T2, sendInvitations): each invited member who has an account.
  * preferences_reminder (organiser's Remind): the one member reminded.
  * submissions_closed (T3b, notifyMembers): every active member; excluded members get
    "You were not included because preferences closed before you submitted".
  * shortlist_ready (T6>T7), package_chosen (T11), plan_ready (T12), trip_finalised (T14),
    trip_cancelled (T15): every active member except the person who caused it.
- Written in the same transaction as the transition, so a rolled-back transition writes nothing.
- Endpoints: GET /api/notifications (own only, newest first, 30 max, plus unreadCount);
  POST /api/notifications/:id/read; POST /api/notifications/read-all;
  POST /api/trips/:id/members/:userId/remind (organiser only; the member must be active
  and have no submitted preference; 409 otherwise; 429 with "You can remind <first name> again
  after <time>" if a reminder for that member exists in the last 24 hours, checked from the
  notification table itself).
- Web: a bell button in AppShell with the unread count as text (not a dot alone), a panel listing
  notifications with a link to the trip, "Mark all as read"; refetch on window focus and every
  60 seconds while visible; a "Remind" button on each pending member row in the trip's members
  list, disabled with the reason after use.

STEPS
1. API module apps/api/src/notifications (repository, service, router) and the writes inside the
   transition paths. Times use the India-day helpers already in the code base where a day matters;
   the 24-hour limit is a rolling 24 hours.
2. endpoint-inventory.ts and access-matrix.test.ts: 4 new endpoints x 6 actors (anonymous,
   non-member, member, excluded member, organiser, admin). Paste the new totals.
3. no-leak.test.ts: every notification body for every type contains no preference value, budget
   figure, score or other member's email; a member never reads another user's notifications
   (404, not 403, for someone else's id).
4. Tests: one per type that the transition writes it, with the right recipients; the reminder's
   409 and 429 paths; mark read; account deletion removes the user's notifications (the cascade);
   AppShell.test.tsx for the bell's count and panel; TripPage test for Remind.
5. privacy.md: a short "Notifications" section (what is stored, who sees it, deleted with the
   account or the trip).
6. Demo impact: the bell appears on every screen. If docs/demo/sprint-3-demo.md describes the
   header, update it (Q5); add one optional line to the demo: "Asha reminds Meera" if the plan says
   so. Run the seed and e2e tests (V6).
7. PR "feat: in-app notifications and organiser reminders", body "Closes #<issue>".

VERIFICATION
Paste: the endpoint and access-matrix counts before and after; pnpm vitest run --project
integration apps/api/src/notifications apps/api/src/trips apps/api/src/security
apps/api/src/seed apps/api/src/e2e; pnpm vitest run --project web; a 360 px check of the panel;
pnpm format:check; pnpm lint; pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
A transition path writes outside a transaction, so a notification could survive a rolled-back
transition: stop and describe the path rather than adding a second write.
```
