# S0-5: Database schema, auth and demo seed

Creates every table the four sprints need in one reviewed migration, wires Better Auth (email and password, sessions in Postgres) into the API, imports the catalogue, and seeds four demo users with a half-filled trip. Before merging you apply the migration to Neon `preview`; after merging, to production.

**Branch:** `feat/s0-schema-auth` · **Time box:** 3.5 hours · **Depends on:** S0-4 merged (catalogue files), S0-3 merged (remote migration script)

```text
S0-5  DATABASE SCHEMA, AUTH AND DEMO SEED
Branch: feat/s0-schema-auth   Time box: 3.5 hours

CONTEXT
Read AGENTS.md (sections 6, 7 and 10), docs/specs/scoring.md section 6.1, docs/decisions (ADR-005, ADR-009, 0001, 0002), docs/RUNBOOK.md Phase 6 and prompt A2, and packages/db/catalogue/README.md. Merged so far: the scaffold (S0-2), CI and deployment with pnpm db:migrate:remote (S0-3), and the catalogue files, vocabularies and loadCatalogue (S0-4).

The logical model is SRS v1.1 Table 10 plus data stores D1 to D6 (RUNBOOK Phase 6 table). Rules that apply to every table below:
- Referential integrity everywhere. Deleting a trip cascades to its members, preferences, invitations, transitions, recommendation runs, packages (with cost items and decisions), itineraries (with items and decisions) and notifications (SRS 3.4).
- Money is a whole-rupee integer column ending in _inr; distance is whole km; durations are minutes; calendar dates are "date"; instants are "timestamp with time zone".
- Primary keys are uuid with defaultRandom(), except Better Auth's tables, which keep its text ids. Every foreign key has an index.
- Column names are snake_case through drizzle's casing setting; TypeScript names are camelCase.
- Enum values come from packages/shared so the API, web and database share one list.

Better Auth facts (checked on 10 October 2026; latest stable 1.7.x, do not use the 1.8 beta):
- Packages: better-auth and @better-auth/drizzle-adapter (import { drizzleAdapter } from "@better-auth/drizzle-adapter").
- Schema generation: npx auth@latest generate --config <file> --output <file>. Secrets: npx auth@latest secret.
- Express: import { toNodeHandler, fromNodeHeaders } from "better-auth/node"; mount app.all("/api/auth/*splat", toNodeHandler(auth)) BEFORE express.json. ESM only.
- Changing hosts (Vercel previews): baseURL: { allowedHosts: ["localhost:5173", "localhost:4000", "*.vercel.app"] }. Allowed hosts are added to trustedOrigins automatically.

GOAL
One migration (0000_init) creates every table below with its constraints and indexes. The API serves Better Auth under /api/auth plus GET /api/me behind a session guard. "pnpm db:reset && pnpm db:seed" builds a local database with the catalogue, four demo users and one demo trip, prints a row count per table, and can run again without duplicating anything. Integration tests prove the cascades, the CHECK constraints and the auth round trip.

STEPS
1. Domain enums in packages/shared/src/domain.ts (const arrays, zod enums and types, exported from the index):
     TRIP_STATUSES         draft, collecting_preferences, ready_for_recommendation, shortlisted, packages_proposed, package_selected, itinerary_proposed, finalised, in_progress, completed, cancelled
     PLANNING_STATUSES     the first seven of those (the UML composite state Planning)
     MEMBER_ROLES          organiser, member
     MEMBER_STATUSES       active, excluded
     INVITATION_STATUSES   active, revoked
     STAY_TIERS            budget, mid, premium
     COST_CATEGORIES       onward, return, stay, food, activities, local
     DECISIONS             accept, modify, reject
     PACKAGE_STATUSES      proposed, hidden, accepted
     ITINERARY_STATUSES    proposed, accepted, rejected, superseded
     ITINERARY_ITEM_KINDS  travel, stay, activity, meal, free
     RECOMMENDATION_KINDS  shortlist, diagnostic
   Provenance (S0-2) and the S0-4 vocabularies are reused as they are.

2. Better Auth
   - apps/api: add better-auth and @better-auth/drizzle-adapter. Create src/auth/auth.ts exporting createAuth({ db, secret, baseURL }) that returns betterAuth({ appName: "BonVoyage", secret, baseURL, basePath: "/api/auth", database: drizzleAdapter(db, { provider: "pg", schema: <the four auth tables> }), emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: true }, session: { expiresIn: 7 days, updateAge: 1 day }, advanced: { cookiePrefix: "bonvoyage" } }). Turn telemetry off if the installed version has that option. Export type Auth = ReturnType<typeof createAuth>.
   - The server and the Vercel entry pass baseURL { allowedHosts: ["localhost:5173", "localhost:4000", "*.vercel.app"] } plus the APP_URL host when it is not covered. Scripts pass a plain string such as "http://localhost:4000". Tests use the same allowedHosts object as the server, so the Origin http://localhost:5173 they send is trusted.
   - src/auth/cli-config.ts exports "auth" built with createAuth on a pool that never connects, only so the CLI can read the options. Generate the tables:
       npx auth@latest generate --config apps/api/src/auth/cli-config.ts --output packages/db/src/schema/auth.ts
     Keep the generated names (user, session, account, verification). Never hand-edit that file; anything our app needs about a user lives in user_profile.
   - src/env.ts gains BETTER_AUTH_SECRET (required, at least 32 characters) and SEED_DEMO_PASSWORD (optional; the seed checks it).
   - src/app.ts: createApp deps gain auth: Auth. Replace the S0-2 marker with app.all("/api/auth/*splat", toNodeHandler(auth)), still before express.json.
   - src/http/session.ts: requireSession middleware calling auth.api.getSession({ headers: fromNodeHeaders(req.headers) }); no session gives 401 UNAUTHENTICATED "Sign in to continue."; otherwise it stores { userId, name, email } in res.locals through a typed helper getSessionUser(res). Add UNAUTHENTICATED and FORBIDDEN to ERROR_CODES.
   - users-groups router: GET /api/me (requireSession) returns { id, name, email, homeHubSlug } with homeHubSlug from user_profile joined to hub, or null.
   - server.ts and vercel-entry.ts build auth with createAuth and pass it in.

3. Drizzle schema in packages/db/src/schema/ (one file per area, all re-exported from index.ts; pgEnum for every enum in steps 1 and S0-4 that a column uses):
   Catalogue (catalogue.ts)
   - hub: id, slug unique, name, state, lat and lng (double precision), source_url, collected_on, review_status, created_at, updated_at.
   - destination: id, slug unique, name, state, lat, lng, types text[], activities text[], climate, best_months smallint[], min_nights smallint, stay_budget_inr, stay_mid_inr, stay_premium_inr, food_per_day_inr, local_per_day_inr (nullable integers), source_url, collected_on, review_status, cost_source_url (nullable), cost_collected_on (nullable), cost_review_status, active boolean default true, created_at, updated_at. CHECKs: lat 6.0 to 37.6 and lng 68.0 to 97.5; min_nights 1 to 14; costs >= 0; stay tiers in order when all three are present.
   - poi: id, destination_id (cascade), poi_key, name, category, typical_minutes, open_time and close_time (time, nullable), closed_days smallint[] default {}, entry_fee_inr default 0, lat, lng, source_url, collected_on, review_status; unique (destination_id, poi_key); CHECKs: open_time and close_time are both null or both set; close_time > open_time.
   - fare_fallback (the RUNBOOK name, kept): id, origin_hub_id (cascade), destination_id (cascade), mode, fare_per_person_inr (nullable), duration_minutes, distance_km, source_url, collected_on, review_status; unique (origin_hub_id, destination_id, mode); CHECK car rows have no fare.
   - cost_rule: key text primary key, value double precision, unit, source_url, collected_on, review_status.
   - distance_cache: id, origin_key text, destination_id (cascade), provider text, distance_km, duration_min (nullable), provenance, fetched_at, expires_at; unique (origin_key, destination_id, provider).
   Trips (trips.ts)
   - user_profile: user_id text primary key referencing user (cascade), home_hub_id (set null), created_at, updated_at.
   - trip: id, title (1 to 120 characters), organiser_id (user, cascade), origin_hub_id (hub, restrict), duration_nights smallint, budget_total_inr integer, radius_km integer, status trip_status default draft, start_date and end_date (date, nullable), created_at, updated_at. CHECKs: duration_nights 1 to 14; budget_total_inr > 0; radius_km > 0; start_date <= end_date when both are set. Indexes on status and organiser_id.
   - trip_member: id, trip_id (cascade), user_id (user, cascade), role, status default active, joined_at, submitted_at (nullable); unique (trip_id, user_id); a partial unique index on trip_id where role = 'organiser' (one organiser per trip).
   - invitation: id, trip_id (cascade), token text unique, created_by (user, cascade), status default active, expires_at, created_at.
   - trip_transition: id, trip_id (cascade), transition_id text (T1 to T18, T3b, I1 to I5), event text, from_status (nullable, null for T1), to_status, actor_user_id (user, set null), created_at. The audit trail written by transitionTrip in S0-6.
   Preferences (preferences.ts)
   - preference: id, trip_member_id unique (cascade), destination_types text[], activities text[], climate (climate_preference enum), travel_style, budget_min_inr, budget_max_inr, date_start, date_end, created_at, updated_at. CHECKs: budget_min_inr >= 0; budget_min_inr <= budget_max_inr; date_start <= date_end.
   - past_trip: id, user_id (cascade), destination_id (set null), place_name text, visited_on (nullable), rating smallint, created_at. CHECK rating 1 to 5.
   Recommendations (recommendations.ts)
   - recommendation_run: id, trip_id (cascade), round smallint default 1, kind, alpha, beta and gamma (double precision, required: never defaults in code), feasible_count, binding_constraint text (nullable), diagnostic jsonb (nullable), created_at.
   - recommendation_item: id, run_id (cascade), destination_id (restrict), rank, gfs, mean, min, sd (double precision), estimated_cost_inr, distance_km, distance_provenance, reasons jsonb; unique (run_id, rank) and (run_id, destination_id).
   Packages (packages.ts)
   - trip_package: id, trip_id (cascade), destination_id (restrict), transport_mode, stay_tier, rooms smallint > 0, start_date, end_date, total_inr, per_person_inr, over_budget boolean default false, status default proposed, created_at.
   - cost_item: id, package_id (cascade), category, label, amount_inr >= 0, provenance, source_ref (nullable).
   - package_decision: id, package_id (cascade), user_id (cascade), decision, note (nullable), created_at.
   Itineraries (itineraries.ts)
   - itinerary: id, package_id (cascade), version >= 1, status default proposed, model (nullable), generated_at; unique (package_id, version).
   - itinerary_item: id, itinerary_id (cascade), day_number >= 1, position, start_time and end_time (nullable), kind, poi_id (set null), note, verified boolean default false; unique (itinerary_id, day_number, position).
   - itinerary_decision: id, itinerary_id (cascade), user_id (cascade), decision, note (nullable), created_at.
   Notifications (notifications.ts)
   - notification: id, user_id (cascade), trip_id (cascade, nullable), type text, payload jsonb default {}, created_at, read_at (nullable); index on (user_id, read_at).
   Write CHECKs with drizzle's check() builder. If one cannot be expressed there, add it to the migration SQL with a comment and say so.

4. Migration: pnpm db:generate -- --name init (or the equivalent flag), then read the SQL in full. Confirm every cascade and CHECK above appears. Commit packages/db/migrations/ including meta/. Run pnpm db:reset (local) and pnpm db:migrate.

5. Catalogue import in packages/db/src/catalogue/import.ts: importCatalogue(db, dir, { today }) calls loadCatalogue, refuses (throws) if there is any error-level issue, and in one transaction upserts hubs and destinations by slug, POIs by (destination, poi_key), fares by (hub, destination, mode) and cost rules by key. Draft rows are imported with their status. It returns inserted and updated counts per table. Package script and root script "catalogue:import" (tsx scripts/catalogue-import.ts) with --target local|preview|production: local uses DATABASE_URL and must be a local host; preview and production read .env.neon exactly as migrate-remote.ts does (move that target-resolution code to packages/db/scripts/lib/remote-target.ts and reuse it); production asks for the typed confirmation "import production".

6. Seed in apps/api (it needs Better Auth, and packages never import apps):
   - src/seed/run-seed.ts exports runSeed({ db, auth, catalogueDir, password }), and scripts/seed.ts calls it. Package script "seed"; root script "db:seed": "pnpm --filter @bonvoyage/api seed".
   - Targets: local by default (DATABASE_URL must be local), or --target preview (resolved through remote-target.ts). Never production. Refuse to run if SEED_DEMO_PASSWORD is missing or shorter than 12 characters.
   - Steps, each idempotent:
     a) importCatalogue;
     b) four demo users through auth.api.signUpEmail, skipping any email that exists: Asha (organiser), Rohan, Meera and Kabir, each named "<Name> (demo)" with email <name>@demo.bonvoyage.test (lowercase; the .test domain is reserved, so mail can never reach a real person) and password SEED_DEMO_PASSWORD;
     c) user_profile rows with home hub gurugram;
     d) one trip "Long weekend in the hills" if Asha has none with that title: origin gurugram, 2 nights, budget_total_inr 48000, radius_km 450, status draft (the column default; a T1 creation, not a status change), and a trip_transition row (T1, createTrip, null to draft, actor Asha);
     e) members: Asha (organiser), Rohan and Meera (member). Kabir stays outside the trip to test invitations later;
     f) preferences for Asha (types mountain|adventure, activities trekking|rafting|camping, climate cold, style budget, budget 12000 to 18000, dates 2026-11-13 to 2026-11-16) and Rohan (spiritual|mountain, yoga_wellness|temples|trekking, mild, comfort, 10000 to 16000, 2026-11-12 to 2026-11-15), with submitted_at set; Meera has none yet (pending);
     g) one active invitation (token from crypto.randomBytes(24).toString("base64url"), expires in 7 days) created by Asha;
     h) one past_trip for Asha: rishikesh, rating 5.
   - Finally print a table of row counts for every table, and the demo emails (never the password).

7. Tests (integration project, against db-test)
   - packages/db/test/schema.test.ts: build a full chain (user rows inserted directly, hub, destination, poi, trip, members, preference, invitation, transition, recommendation run and item, package, cost item, package decision, itinerary, item, decision, notification), delete the trip, and assert zero rows remain for that trip in every dependent table. CHECK violations raise SQLSTATE 23514 for budget_min_inr > budget_max_inr, rating 6, duration_nights 0 and close_time before open_time; a second organiser on one trip raises 23505.
   - packages/db/test/catalogue-import.test.ts: importing a small fixture catalogue twice gives the same row counts; a changed value updates in place; a catalogue with an error-level issue is refused and writes nothing.
   - apps/api/src/auth/auth.test.ts (supertest agent with Host localhost:5173 and Origin http://localhost:5173, which is what the Vite proxy sends): sign up, then GET /api/me gives 200 with the user; sign out, then GET /api/me gives 401 with the UNAUTHENTICATED envelope; a duplicate email is refused and no second user exists; the stored account password differs from the plain text; GET /api/me with no cookie gives 401.
   - apps/api/src/seed/run-seed.test.ts: runSeed twice gives identical row counts; the trip has 3 members, 2 submitted preferences and status draft.

8. Docs
   - docs/decisions/0003-schema-deviations.md (Accepted): trip_package instead of package ("package" is a reserved word in strict-mode TypeScript); user_profile instead of extra columns on Better Auth's user table; trip.origin_hub_id instead of origin_name, origin_lat and origin_lng (no geocoding key, ADR-007; SRS Table 5's "resolves to valid coordinates" is met by curated hub coordinates); link invitations with active and revoked statuses (email waits for reminders, C4); the new trip_transition audit table; cost_rule as a table; destination.active so the administrator deactivates rather than deletes; fare_fallback keeps its RUNBOOK name although curated data is the primary source.
   - AGENTS.md section 5 gains pnpm db:seed and pnpm catalogue:import; section 10 gains "Better Auth owns user, session, account and verification: regenerate them with its CLI, never hand-edit them; app data about a user goes in user_profile".
   - docs/traceability.md: test files for R1, R10 and R11.

VERIFICATION
Paste the real output of:
  pnpm db:reset && pnpm db:seed           row counts per table
  pnpm db:seed                            the same counts again
  pnpm verify
  pnpm db:migrate:remote --target preview --status      1 pending (0000_init)
Then ask Maulik to run, before merging:
  pnpm db:migrate:remote --target preview
  pnpm catalogue:import --target preview
  pnpm db:seed --target preview            (optional, demo users on previews)
and after merging:
  pnpm db:migrate:remote --target production       (types "migrate production")
  pnpm catalogue:import --target production        (types "import production")
After each remote step, /api/health on that deployment must still return {"status":"ok","db":"ok"}. Also: in pnpm db:studio, delete the seeded trip and confirm its members, preferences and invitation disappear, then run pnpm db:seed to restore it.
Report: the table list with row counts, the generated migration's file name and line count, any CHECK written in raw SQL, and every deviation from this prompt.

IF BLOCKED
- The auth CLI cannot load cli-config.ts: write the four tables by hand from Better Auth's documented core schema for the installed version, say so in the report, and keep the file header "Better Auth core schema (hand-written because the CLI failed: <reason>)".
- Better Auth names or types differ from what this prompt assumes: keep Better Auth's names and adapt the foreign keys.
- auth.api.signUpEmail fails in the seed because no request host exists: pass headers with host localhost:4000 and origin http://localhost:4000.
- Sign-up in tests fails with an origin or host error: make sure the test sends the Host and Origin headers above; never disable Better Auth's origin check.
- A table, column or enum not listed here seems necessary: stop and ask.
- The migration fails on a fresh database: fix the schema and regenerate. Never hand-edit generated SQL except to add a CHECK that the builder cannot express.
```
