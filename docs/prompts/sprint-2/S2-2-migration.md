# S2-2: Migration 0001

The first schema change since `0000_init`: a column for the chosen destination, a nullable place name for past trips (which removes the S1-4 workaround), and the table that counts outside calls for quota control. Small, but it touches every database, so it has its own pull request and a hand-over.

**Branch:** `feat/s2-2-migration` · **Time box:** 1 hour · **Depends on:** S2-1 merged · **Issue:** S2-2

```text
S2-2  MIGRATION 0001: SELECTED DESTINATION, PAST-TRIP PLACE NAME, PROVIDER USAGE
Branch: feat/s2-2-migration   Time box: 1 hour   Issue: S2-2 (gh issue list --milestone "Sprint 2 (24-27 Oct)")

CONTEXT
Read AGENTS.md (section 10), docs/prompts/sprint-2/README.md (rule S5), docs/decisions/0003 and 0004
(k and l), packages/db/src/schema (trips.ts, preferences.ts and the rest), packages/db/migrations
(0000_init.sql and meta), packages/db/scripts/migrate-remote.ts, and apps/api/src/profile/ (S1-4
stores the destination's name in past_trip.place_name because the column is NOT NULL).
This is the first schema change since 0000_init. Remote databases change only through
pnpm db:migrate:remote, run by Maulik.

GOAL
Migration 0001 adds trip.selected_destination_id, makes past_trip.place_name nullable with a CHECK
that exactly one of destination_id and place_name is set, and adds provider_usage. Local and test
databases are on 0001, preview and production get it through the hand-over, and the profile code no
longer copies names.

STEPS
1. Schema:
   - trip.selected_destination_id: uuid, nullable, references destination(id) ON DELETE RESTRICT,
     indexed.
   - past_trip.place_name: nullable, plus CHECK (num_nonnulls(destination_id, place_name) = 1).
     Comment: destinations are deactivated, never deleted (0003), so destination_id is not nulled
     by a delete in practice.
   - provider_usage: provider text, day date, calls integer NOT NULL DEFAULT 0, PRIMARY KEY
     (provider, day), CHECK (calls >= 0). Put it with the other cross-cutting tables (next to
     distance_cache).
2. pnpm db:generate -- --name selected_destination_and_usage (or the drizzle-kit equivalent). Read the
   SQL in full. Before the CHECK is added, the migration must run
   UPDATE past_trip SET place_name = NULL WHERE destination_id IS NOT NULL;
   Add it by hand with a comment if drizzle cannot express it (rule S5). Commit migrations/ with meta.
3. apps/api/src/profile: stop writing place_name when a destination is chosen. The API response does
   not change (placeName stays null when a destination is set). Update the tests; add one proving that
   a row with both destination_id and place_name raises SQLSTATE 23514.
4. TripDetail gains selectedDestination: { slug, name, state } | null (null until S2-6 writes it): shared
   schema, trip repository, web trip-fixture.ts. Nothing on screen yet.
5. Tests: packages/db/test/schema.test.ts covers the new CHECK and the provider_usage primary key;
   the trip cascade test still passes; deleting a destination that a trip has selected is refused
   (SQLSTATE 23503).
6. AGENTS.md section 10: one line "Migration 0001 (Sprint 2): trip.selected_destination_id,
   past_trip.place_name nullable with a one-of CHECK, provider_usage."
7. PR "feat: migration 0001 (selected destination, place name, provider usage)", body starts
   "Closes #<S2-2>", includes the full SQL.
8. HAND OVER to Maulik in your final message:
   before merging: pnpm db:migrate:remote --target preview --status (1 pending), then
   pnpm db:migrate:remote --target preview, then open the latest preview's /api/health;
   after merging: pnpm db:migrate:remote --target production (type "migrate production"), then
   curl.exe -s https://bonvoyage-orpin.vercel.app/api/health.

VERIFICATION
Paste the real output of: the generated SQL ; pnpm db:reset && pnpm db:seed (row counts) ;
pnpm db:migrate (nothing pending) ; pnpm vitest run --project integration packages/db
apps/api/src/profile ; pnpm verify ; pnpm vercel-build && pnpm smoke:function.
Stop any dev server you start.

IF BLOCKED
drizzle-kit wants to drop and recreate a table: stop and show me the SQL. The CHECK fails on
existing rows: the UPDATE must come first in the same migration. A remote migration fails: stop,
never retry with force, paste the error. Never edit .env or print env values.
```
