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

- **Your group never sees your answers.** Members see each other's names, roles, whether they are still in the trip, and whether they have submitted. Nobody else's budget, dates, kinds of place or activities are ever in a response. The recommendation steps from Sprint 2 combine everyone's answers; the group then sees the combined result, not who wanted what.
- **The organiser** has no extra view of anyone's preferences. What they get is control: they create and turn off the invitation link, remove members, close submissions and cancel the trip.
- **"The administrator"** means whoever runs the database (the project's developer), who can read every table directly. The administrator page from S1-7 manages the destination catalogue only; it shows no user data.
- **A removed member** can still read the trip and its activity but can no longer act. Their preferences are deleted when they are removed.

## Invitation links

An invitation link (`/join/<token>`) is the only thing that lets someone outside the group see anything about a trip. The token is 24 random bytes. A link stops working after 14 days, or as soon as the organiser turns it off, and it never shows more than the trip's title, the organiser's name, the member count and whether the trip is still open.

Because a link can be forwarded, the web app sends `Referrer-Policy: same-origin` (a `<meta>` tag in `index.html`, and a header on every page served from Vercel). Following a link from the join page to another site therefore never sends the token along. The API's own responses carry helmet's stricter `no-referrer`.

## Language-model prompts

The itinerary text from Sprint 4 is written by Gemini on its free tier, which may use prompts to improve Google's products. So a prompt contains destination facts only. It never contains names, emails, user ids, member identities or anyone's personal budget (AGENTS.md section 11).

## Logs

Each API request writes one log line with the request id, the method, the path, the status and, when you are signed in, your user id. Request and response bodies are never logged, so passwords, budgets and preferences never reach the logs. Headers are not logged either, and the cookie, authorization and set-cookie headers are also on a redact list in case that ever changes. Emails are not logged; the user id identifies who made a request.

## Writes

Every change to your data goes through a JSON request (`Content-Type: application/json`); anything else gets `415 UNSUPPORTED_MEDIA_TYPE` before it reaches a route. Together with the SameSite session cookie, this stops another website from submitting a form that acts as you.

## Deleting your data

- **Leave a trip** (a member, while preferences are open): your membership and your preferences for that trip are deleted.
- **Removed by the organiser:** your preferences for that trip are deleted; you keep read-only access.
- **Delete your account:** not built yet; tracked in issue #54 for Sprint 3. Until then, ask the administrator, who can delete the account. Deleting a user removes their memberships, preferences, past trips and profile, because each table cascades from the user. A trip the user organises is deleted with it, which is why the planned feature will refuse while you organise an open trip.

## How this is tested

| Test | What it proves |
| --- | --- |
| `apps/api/src/security/routes.test.ts` | Every registered API route is in the endpoint inventory, so none skips the checks below |
| `apps/api/src/security/access-matrix.test.ts` | Each of the 24 endpoints, called as anonymous, non-member, member, removed member and organiser, gives the expected status |
| `apps/api/src/security/no-leak.test.ts` | No response to any caller contains another user's budget, past trips or email; your own email appears only on `/api/me`; the invitation preview holds no budgets, dates, emails or member names |
| `apps/api/src/security/logs.test.ts` | Logs from signing up, signing in and saving a preference hold no password, cookie, email or budget |
| `apps/api/src/security/json-only.test.ts` | Non-JSON writes are refused with 415 |
| `apps/api/src/preferences/preferences.test.ts` | A member only ever reads their own preference |
