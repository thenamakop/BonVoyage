# Sprint 1 build prompts

Sprint 1 runs from Tuesday 13 to Sunday 18 October 2026, one day shorter than planned because Sprint 0 ended on 12 October. **Goal:** an organiser signs up, creates a trip and shares an invitation link; members join and submit their preferences; everyone watches the dashboard update without reloading. Catalogue stage A is verified by Sunday.

## Run order

| Day       | Prompt                                                                                  | Issue | Time box        | Needs merged first               |
| --------- | --------------------------------------------------------------------------------------- | ----- | --------------- | -------------------------------- |
| Tue 13    | [S1-8 Wireframes](S1-8-wireframes.md) (commits these prompt files too)                  | #36   | 1.5 h           | nothing                          |
| Tue 13    | [S1-1 App shell, UI kit and sign-in](S1-1-app-shell-auth.md)                            | #29   | 3 h             | S1-8                             |
| Wed 14    | [S1-2 Create, list and edit trips](S1-2-create-trip.md)                                 | #30   | 3 h             | S1-1                             |
| Wed 14    | [S1-3 Invitation link, join and roster](S1-3-invitations.md)                            | #31   | 2.5 h           | S1-2                             |
| Thu 15    | [S1-4 Preference form and profile](S1-4-preferences.md)                                 | #32   | 3 h             | S1-3                             |
| Fri 16    | [S1-5 Live trip dashboard](S1-5-dashboard.md)                                           | #33   | 2.5 h           | S1-4                             |
| Fri 16    | [S1-6 Privacy and access matrix](S1-6-access-matrix.md)                                 | #34   | 2 h             | S1-5                             |
| Sat 17    | [S1-7 Administrator catalogue import](S1-7-admin-catalogue.md)                          | #35   | 2 h             | S1-1 (can run any time after it) |
| Sun 18    | [S1-9 Sprint 1 review](S1-9-review.md)                                                  | none  | 45 min          | everything above                 |
| Every day | [Catalogue stage A checks](#catalogue-stage-a-your-daily-checks-37) (you, not an agent) | #37   | about 1 h a day | nothing                          |

The routine is the same as Sprint 0: branch from `master`, fresh agent session, paste the prompt (or point the agent at `docs/prompts/sprint-1/<file>.md`), check the result yourself, open the pull request with the title the prompt gives and `Closes #<issue>` in its body, wait for `ci`, squash-merge. Sprint 1 needs no database migration; if an agent says it needs one, stop it and ask me.

## Sprint 1 conventions

Every Sprint 1 prompt says "follow the Sprint 1 conventions". These are them; S1-8 commits this file as `docs/prompts/sprint-1/README.md` so agents can read it.

```text
SPRINT 1 CONVENTIONS (apply to every Sprint 1 prompt)

State of the repo (end of Sprint 0, 12 Oct 2026)
- Versions: Node 24, pnpm 10.33, TypeScript 6.0, Vite 8, React 19, React Router 8 (data mode), TanStack Query 5, Tailwind CSS 4, Express 5, zod 4, Drizzle 0.45, Better Auth 1.7.7, Vitest 5.
- API: createApp(deps) in apps/api/src/app.ts; Better Auth mounted at /api/auth before express.json; requireSession and getSessionUser(res) in src/http/session.ts; AppError, parseOrThrow and zodFieldErrors in src/http/errors.ts; GET /api/me; POST /api/trips/:id/cancel; transitionTrip in src/trips/transition-trip.ts.
- Engine: nextState and legalEvents in packages/engine/src/trip-state.ts (18 rows, I1 to I5).
- Schema names (decision 0003): trip, trip_member (role organiser|member, status active|excluded, submitted_at), invitation (token, status active|revoked, expires_at), preference (one per trip_member), past_trip, user_profile (home_hub_id), hub, destination, trip_transition.
- Web: fetchJson(path, schema) and ApiError in apps/web/src/lib/api.ts; Home with the health panel; Tailwind only.
- Demo users: asha, rohan, meera and kabir @demo.bonvoyage.test, password = SEED_DEMO_PASSWORD.

1. API contracts live in packages/shared/src/api/<area>.ts as zod schemas with inferred types: every request body and every response. Routers validate requests with parseOrThrow; tests parse every response with the shared schema; the web passes the same schema to fetchJson. Export them from the shared index.
2. Layers: router (HTTP only), then service (rules, transitions, clock), then repository (Drizzle queries). No Drizzle in routers, no req/res in services.
3. Every /api route requires a session (requireSession) except /api/health, /api/auth/* and GET /api/invitations/:token.
4. Trip access goes through apps/api/src/trips/access.ts (created in S1-2): loadTripForMember(db, tripId, userId) returns the trip and the caller's membership or throws 404 NOT_FOUND (never reveal that a trip exists to a non-member); requireOrganiser(membership) throws 403 FORBIDDEN. Excluded members can read the trip but cannot act.
5. trip.status changes only through transitionTrip (and T1 inside createTrip). Never write trip.status anywhere else outside tests.
6. Errors use the envelope: 400 VALIDATION_ERROR with fields keyed by the request field name (camelCase, as in the shared schema), 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 for state conflicts (ILLEGAL_TRANSITION, GUARD_FAILED, PREFERENCES_LOCKED, TRIP_CLOSED and the new codes each prompt names), 422 for business rules. Add every new code to ERROR_CODES in packages/shared. Messages are plain sentences a user can act on.
7. Time: services receive clock: () => Date through deps. "Today" means the Asia/Kolkata date (reuse the helper transitionTrip uses). Never call new Date() inside a rule.
8. Web structure: routes in apps/web/src/routes.tsx; pages in src/pages/<Area>/<Page>.tsx; data hooks in src/features/<area>/api.ts (TanStack Query; query keys ["me"], ["trips"], ["trip", id], ["trip", id, "preference"], ["hubs"]); mutations invalidate the keys they change. No new state or form library: plain React state plus the shared zod schemas for client-side checks, and server fields mapped onto the same inputs.
9. UI rules: components from src/components/ui (S1-1); every query has loading, empty and error states; every input has a visible label and its error is linked with aria-describedby; touch targets at least 44 px; works at 360 px with no horizontal scroll; never colour alone; British English; money with formatInr (src/lib/format.ts, Intl en-IN, no decimals); every price or budget figure shows the group total and the per-person amount, and estimates say "estimate".
10. Tests ship with the code. API: for each endpoint, the happy path, a validation error with its field, 401 without a session, 404 for a non-member, 403 for the wrong role, and 409 for the wrong state where those apply. Web: each form's validation message, a successful submit, and the error state. Use vi.stubGlobal for fetch and vi.mock for the auth client; do not add MSW or Playwright.
11. No database migration in Sprint 1. If a change seems to need one, stop and ask.
12. Pull requests: title as the prompt gives; body starts with "Closes #<issue>" and includes the Verification output and 360 px plus desktop screenshots for UI; docs/traceability.md gets the new test files. Keep pnpm verify green.
13. Never commit .env files, keys or connection strings; never print environment values.
```

## Catalogue stage A: your daily checks (#37)

This one is yours, not an agent's. Decision 0002 says only you mark a catalogue row verified, because "verified" means a person looked at the source. Stage A is 50 rows: the 6 hubs in `packages/db/catalogue/hubs.csv` and the identity columns of the 44 destinations in `packages/db/catalogue/destinations.csv`. It is due Sunday 18 October, and Sprint 2's filtering reads exactly these columns. About 9 rows a day gets you there with a day to spare.

**What stage A covers.** For a hub: name, state, lat, lng. For a destination: name, state, lat, lng, types, activities, climate, best\_months and min\_nights. Leave the five cost columns and the `cost_*` trio alone: they are stage B, next week.

| Column       | Where to check                                                           | What "right" means                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name, state  | Wikipedia, then the state tourism site                                   | The common English spelling; the state the place is actually in                                                                                         |
| lat, lng     | Google Maps or OpenStreetMap: right-click the spot, copy the coordinates | Hub: main railway station or city centre. Destination: the town centre or the main cluster visitors stay in. Within about 1 km is fine; keep 4 decimals |
| types        | State tourism page                                                       | Only values from `packages/shared/src/vocab.ts`; a type only if a visitor would honestly call it that                                                   |
| activities   | State tourism page, an operator page for adventure sports                | Each activity can really be done there or within about 30 km (rafting needs commercial rafting, skiing needs a slope that operates)                     |
| climate      | Weather in the best months                                               | cold: days mostly below 15 °C; mild: 15 to 25 °C; warm: above 25 °C                                                                                     |
| best\_months | The tourism board's "best time to visit"                                 | Drop monsoon months for landslide-prone hill roads; months are 1 to 12 separated by `\|`                                                                |
| min\_nights  | Your judgement                                                           | The shortest stay that makes sense after the journey: 1 for weekend places under about 300 km, 2 for most hills, 3 or more for far or spread-out places |

When a row is right (or you have corrected it), set three cells: `source_url` to the page you actually used (https; prefer the state tourism site or Wikipedia), `collected_on` to today's date as YYYY-MM-DD, and `review_status` to `verified`.

**The daily routine (about an hour)**

1. In Git Bash: `git switch master && git pull`, then `git switch -c chore/37-catalogue-a-batch-<n>` (n = 1, 2, 3...).
2. Run `pnpm catalogue:check`. The stage table shows A as verified / 50; the warnings list the draft rows. Do the rows from the S0-4 "unsure" list first, because they are the likeliest to be wrong.
3. Open the CSV in VS Code, not Excel (Excel rewrites dates and quoting). The Rainbow CSV extension colours the columns so you can read them.
4. Check and mark your 9 rows using the table above.
5. Run `pnpm catalogue:check` again: 0 errors. A verified row with an empty or non-https `source_url` is an error, which is the point.
6. Commit as `chore: verify catalogue stage A (batch <n>)`, push, open the pull request with `Refs #37` in the body (use `Closes #37` only in the last batch), wait for `ci`, squash-merge.

| Day              | Rows                                 |
| ---------------- | ------------------------------------ |
| Tue 13           | the 6 hubs and 3 unsure destinations |
| Wed 14 to Sat 17 | 9 destinations a day                 |
| Sun 18           | the last 5, then the finish below    |

**Finish on Sunday.** `pnpm catalogue:check --require a` must pass (it fails while any stage A row is draft). Then load the verified rows into both databases: `pnpm catalogue:import --target preview`, then `pnpm catalogue:import --target production` (type `import production` when asked). If S1-7 is merged by then, its administrator page shows the same counts; use whichever you like, not both.

**When something is off**

- A destination is wrong for the product (too far, unsafe in its best months, no road or rail access): keep it draft, say why in the pull request, and we decide in the S1-9 review. Do not delete rows; the database deactivates destinations instead.
- No vocabulary value fits an activity or type: pick the closest one, note it in the pull request, and do not edit `vocab.ts` (the scoring spec depends on it).
- Never copy coordinates or facts from an AI answer, including mine. Look at the map yourself.
- Agents never touch `review_status`. If an agent's diff changes it, reject that part.

## When Sprint 1 is done

Send me the PASTE THIS BACK block from S1-9. The Sprint 2 prompts (19 to 25 October) will be written against what is actually in the repo then. What Sprint 2 covers, so you can plan your week:

- **Scoring (R6):** `memberScore` and `rankDestinations` in the engine, proven against the golden fixture from S0-6 (the two `it.todo` tests become real).
- **Hard filters and the empty shortlist:** radius, budget overlap, dates, minimum nights and best months, with the diagnostic when fewer than 3 destinations fit (T6>T8).
- **Recommendation run (T6>T7):** the endpoint that stores a ranked shortlist, and the shortlist screen from wireframes 07 and 08.
- **Destination choice (T9):** the organiser picks one destination, which opens Sprint 3's packages.
- **Catalogue stage B (#38):** destination costs, fares and cost rules, due Sunday 25 October. It is more rows than stage A, so start it on Monday.

If anything in Sprint 1 spills, the S1 spill issues go first, before any of the above.
