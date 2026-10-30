# Privacy: who sees what

This note covers the personal data BonVoyage keeps and who can see each part of it, for the group, reviewers and anyone changing the code. It describes what the code does today; the tests named here fail if that changes. SRS sections 3.4 and 3.5 set the requirement (R10).

## What we store

| Data | Where | Why |
| --- | --- | --- |
| Name and email | Better Auth's `user` table | Signing in; your name is shown to your group |
| Password | Better Auth's `account` table, as a salted hash; the password itself is never stored | Signing in |
| Sessions | Better Auth's `session` table, referenced by an HttpOnly, SameSite cookie | Staying signed in |
| Home city | `user_profile.home_hub_id` | Pre-filling the starting city of a new trip |
| Past trips (place, optional date, rating 1 to 5) | `past_trip` | Ranking destinations from Sprint 2: trips you rated 4 or 5 count towards places like them |
| Trip preferences (kinds of place, activities, climate, travel style, your budget per person, your dates) | `preference`, one row per trip you joined | Finding destinations that suit the group |
| Trip membership (role, active or removed, when you submitted) | `trip_member` | The roster and the dashboard |
| A log of what happened to each trip (the event, who did it, when) | `trip_transition` | The dashboard's "Recent activity" and the audit trail |
| Recommendation runs: the weights, the group profile the run was computed from, and the diagnostic | `recommendation_run` | Each ranking can be checked and reproduced later |
| Each recommended destination's scores and every member's own match explanation (what it meets and misses for them) | `recommendation_item` | Showing each member why a destination suits them |
| In-app notifications (type, trip, a payload of the trip title and the user id of who acted, read or unread) | `notification` | Telling members what needs them without leaving the app (see Notifications) |

## Who sees what

| | You | Your group | The organiser | The administrator | Anyone else |
| --- | --- | --- | --- | --- | --- |
| Your name | Yes | Yes | Yes | Yes | Only the organiser's name, on an invitation link they share |
| Your email | Yes (`/api/me` only) | No | No | Yes | No |
| Your home city and past trips | Yes | No | No | Yes | No |
| Your preferences, including your budget and dates | Yes | No | No | Yes | No |
| Whether you have submitted | Yes | Yes | Yes | Yes | No |
| The trip's details and group budget | Yes | Yes | Yes | Yes | No |
| The trip's activity (who did what, by name) | Yes | Yes | Yes | Yes | No |
| Your own match score and explanation for each recommended destination | Yes | No | No | Yes | No |
| The group profile and the recommendations (combined figures only, see below) | Yes | Yes | Yes | Yes | No |

- **Your group never sees your answers.** Members see each other's names, roles, whether they are still in the trip, and whether they have submitted. Nobody else's preference is ever in a response as they entered it, and no preference is ever shown next to a name. The recommendation steps combine everyone's answers; the group then sees the combined result, not who wanted what (decision 0004 i).
- **What the group does see** (`GET /api/trips/:id/group-profile` and each recommendation run):
  - the common window: the latest first day and the earliest last day across the group;
  - the budget band and caps, rounded to ₹500 (the highest minimum rounded up, the lowest maximum and any cap set by members rounded down), shown only for 3 or more contributing members; below that, only whether budgets overlap. A cap set by the trip budget is always shown, exact, because every member already sees the trip budget;
  - kinds of place, activities and climates by count, naming a value only when at least two members chose it. Values chosen by one member only appear as a single number (`otherInterestCount`);
  - for each recommended destination: the estimated cost, counts such as how many members' climate it suits, and the scores. Every item carries the group score (`gfs`) and the `mean`, `min` and `sd` of the member scores. The screen shows none of these numbers: it states the lowest-to-highest range in words, and only for groups of 3 or more (the API sends no range below 3);
  - in the diagnostic, the F5 budget limit is the same rounded cap, so it never carries one member's exact maximum;
  - after "Ask again" (T21), the order of a later shortlist may favour members whom earlier shortlists served less (R17, decision E1). Only the order and one sentence saying so are shown; no response names who, or carries a weight, a deficit or lambda, and every item keeps the unweighted `gfs`, `mean`, `min` and `sd`. In a 2-member group this reveals nothing beyond what round 1's figures already do (see below).
- **What combined figures can still reveal in small groups.** This is accepted, and stated here so nobody relies on more privacy than there is:
  - The common window is kept for groups of every size (decided on 26 October 2026: R4 needs it, 2 is the smallest group, and the trip's chosen dates are shared with everyone later anyway). In a 2-member group it shows the other member's first or last day wherever theirs is narrower than yours.
  - In a 2-member group, the `gfs`, `mean`, `min` and `sd` every item carries, with your own score, reveal the other member's score; a count such as "suits 1 of 2" with your own answer reveals that answer. Scores are not preference answers (R10); the raw preferences stay private.
  - Budget band, member-set caps, closest-miss amounts and package over-budget amounts: hidden below 3 contributing members when members' maxima set the cap (decision D1, 28 October 2026, #116). The band's figures and the per-person cap are hidden below 3 whatever sets the cap; the window is kept for every size.
  - Still visible, accepted: "Members need to raise their maximum to ₹X per person" (X comes from destination costs only), and the bracket the shortlist itself implies: the cap lies between the cheapest place that failed on budget and the dearest place that passed. Both come from filtering, which R5 requires.
- **The organiser** has no extra view of anyone's preferences. What they get is control: they create and turn off the invitation link, remove members, close submissions and cancel the trip.
- **"The administrator"** means whoever runs the database (the project's developer), who can read every table directly. The administrator page from S1-7 manages the destination catalogue only; it shows no user data.
- **A removed member** can still read the trip and its activity but can no longer act. Their preferences are deleted when they are removed.

## Invitation links

An invitation link (`/join/<token>`) is the only thing that lets someone outside the group see anything about a trip. The token is 24 random bytes. A link stops working after 14 days, or as soon as the organiser turns it off, and it never shows more than the trip's title, the organiser's name, the member count and whether the trip is still open.

Because a link can be forwarded, the web app sends `Referrer-Policy: same-origin` (a `<meta>` tag in `index.html`, and a header on every page served from Vercel). Following a link from the join page to another site therefore never sends the token along. The API's own responses carry helmet's stricter `no-referrer`.

## Notifications

In-app notifications (S5-3, decisions E3 and M4) are rows in the `notification` table, read only inside the app. There is no email, push message or outside service.

- **What is stored:** the person who gets it, the trip, the type, the time, whether it has been read, and a payload of the trip's id and title plus the type's own fields. Those are the user id of the person who acted and, for "not included", a flag. Names are not stored: they are looked up when your list is read (for example "Asha asked for new recommendations"), so a renamed account reads under its new name and a deleted one reads "A former member". The actor's id stays on the server; a response carries only the sentence. The payload never holds a preference, budget, date, score, vote or email. Nine types: a member joined (to the organiser), a reminder (to the one member reminded), preferences closed, shortlist ready, shortlist reopened, package chosen, plan ready, trip finalised and trip cancelled (to the trip's active members, the person who acted left out; preferences closed also tells a member who was left out that they were not included).
- **Who sees it:** only its owner. `GET /api/notifications` returns your own, newest 30 first, with the count of unread ones. Marking one read with someone else's id is a 404, the same as an id that does not exist.
- **Reminders:** the organiser can remind a member who has not submitted, once per member per rolling 24 hours (429 `TOO_MANY_REQUESTS` with `Retry-After` after that). Whether a member has submitted is already visible to the whole group. When the organiser may next remind a member (`canRemindAt` on the trip's members) is sent to the organiser only; other members never learn who was reminded or when.
- **Written with the event:** a notification is written in the same database transaction as the transition or the join, so an event that fails writes none.
- **Deleted with:** your account (all notifications you received) or the trip (all notifications about it). A notification about something you did, such as joining, stays in the organiser's list after you delete your account, but it no longer names you: it reads "A former member joined the trip".

## Language-model prompts

The itinerary text from Sprint 4 is written by Gemini on its free tier, which may use prompts to improve Google's products. So a prompt contains destination facts only. It never contains names, emails, user ids, member identities or anyone's personal budget (AGENTS.md section 11).

## Logs

Each API request writes one log line with the request id, the method, the path, the status and, when you are signed in, your user id. Request and response bodies are never logged, so passwords, budgets and preferences never reach the logs. Headers are not logged either, and the cookie, authorization and set-cookie headers are also on a redact list in case that ever changes. Emails are not logged; the user id identifies who made a request.

## Writes

Every change to your data goes through a JSON request (`Content-Type: application/json`); anything else gets `415 UNSUPPORTED_MEDIA_TYPE` before it reaches a route. Together with the SameSite session cookie, this stops another website from submitting a form that acts as you.

## Deleting your data

- **Leave a trip** (a member, while preferences are open): your membership and your preferences for that trip are deleted.
- **Removed by the organiser:** your preferences for that trip are deleted; you keep read-only access.
- **Delete your account** (S3-5, #54): sign in, open your profile, enter your password and type your email. Your sign-in, sessions, profile, preferences, package opinions, itinerary decisions, notifications, past trips and memberships are deleted; trips you organised that are finalised, completed or cancelled are deleted with it. The request is refused while you organise a trip that is still being planned or is in progress: cancel or finish it first.

## How this is tested

| Test | What it proves |
| --- | --- |
| `apps/api/src/security/routes.test.ts` | Every registered API route is in the endpoint inventory, so none skips the checks below |
| `apps/api/src/security/access-matrix.test.ts` | Each of the 31 endpoints, called as anonymous, non-member, member, removed member, organiser and administrator, gives the expected status |
| `apps/api/src/security/no-leak.test.ts` | No response to any caller contains another user's budget, past trips or email; your own email appears only on `/api/me`; the invitation preview holds no budgets, dates, emails or member names; the group profile and recommendations hold none of another member's own choices or exact budget figures, including the F5 diagnostic when members' maxima set the cap, and name a value only when two or more members chose it; with 2 members no GET a member can call, the packages included, carries the other member's minimum, maximum or the cap they set, and no closest miss rebuilds the cap (D1, #116) |
| `apps/api/src/recommendations/recommendations.test.ts` | Each member's explanation is their own; budgets are rounded inwards; a trip-set cap stays exact; groups of 2 get no score range, no budget band, no per-person cap, no member-set group cap and no F5 amounts against a member-set cap (D1, #116) |
| `apps/api/src/packages/packages.test.ts` | With 2 members an over-budget package against a member-set cap carries no amount; against a trip-set cap it does (D1, #116) |
| `apps/api/src/notifications/notifications.test.ts` | Each of the nine types is written to the right people and nobody else; the reminder is limited to once per member per rolling 24 hours, also under two simultaneous clicks; someone else's notification id is a 404; no notification holds a budget, email, score or answer; deleting the account or the trip deletes the notifications |
| `apps/api/src/security/logs.test.ts` | Logs from signing up, signing in and saving a preference hold no password, cookie, email or budget |
| `apps/api/src/security/json-only.test.ts` | Non-JSON writes are refused with 415 |
| `apps/api/src/preferences/preferences.test.ts` | A member only ever reads their own preference |
| `apps/api/src/profile/profile.test.ts` (DELETE /api/me/profile) | Deleting an account removes every `user_id`/`userId` row, clears the session cookie and leaves the old cookie a 401; an organiser of an active trip gets 422 with the trip list |
