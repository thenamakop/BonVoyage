# AGENTS.md: BonVoyage

Instructions for coding agents working in this repository. Read this file in full before starting any task.

## 1. What this project is

BonVoyage is a collaborative trip planner for small Indian groups (2 to 8 members, travelling by road or rail, prices in INR). Each member submits preferences, budget and available dates. The system:

1. removes every destination that breaks a hard constraint (radius, budget, common dates),
2. ranks the rest by a group-fit score,
3. builds costed packages,
4. generates a day-wise itinerary.

A language model writes the itinerary text from verified facts; it never supplies the facts.

This is a university Software Engineering project (BML Munjal University). One developer, Maulik, builds it on one Windows 11 machine with the help of coding agents. There is no second human reviewer.

## 2. Read before you work

| Need | Where |
| --- | --- |
| The plan, agent prompts (Appendix A), requirements, transitions and API tables (Appendix B) | `docs/RUNBOOK.md` |
| Requirements and acceptance criteria | `docs/baseline/BonVoyage_SRS_v1.1.md` (Tables 5 to 9 are the acceptance criteria) |
| Priorities (R1 to R20) | `docs/baseline/BonVoyage_MoSCoW_Prioritization.md` |
| Design diagrams (DFD, sequence, state machine) | `docs/design/` (PNGs in `docs/design/png/`) |
| Decisions that override older documents | `docs/decisions/` |

**Which source wins.** When documents disagree, follow this order:

1. `docs/decisions/` (newest first)
2. `docs/RUNBOOK.md` Appendix B
3. the SRS
4. everything else

Never resolve a conflict silently. Name it in your summary.

**Protected folders.** `docs/baseline/` and `docs/design/` are approved documents: do not edit them. To change the design, propose a new file in `docs/decisions/`.

**Branch name.** The default git branch is `master`. Where `docs/RUNBOOK.md` says `main` for git, read `master`. Neon's `main` database branch is a different thing and keeps its name.

## 3. Stack (fixed by ADR-001 to ADR-010)

| Layer | Choice |
| --- | --- |
| Language | TypeScript everywhere, `strict` on |
| Repo | pnpm workspace monorepo, Node 24 LTS |
| Web | React + Vite, React Router, TanStack Query, Tailwind CSS |
| API | Express 5, REST and JSON, every route under `/api` |
| Database | PostgreSQL with Drizzle ORM and versioned SQL migrations (Docker locally, Neon when deployed) |
| Validation | zod schemas in `packages/shared`, used by both web and api |
| Auth | Better Auth, email and password, sessions in Postgres |
| Distances | RoutingProvider in packages/integrations: curated hub road distance, else haversine x 1.3 labelled estimated (ADR-007). A Google Routes adapter only if a key is added. |
| Language model | Gemini on the free tier, behind the `LlmClient` interface |
| Tests | Vitest |
| Hosting | One Vercel project serving the SPA and the API under `/api` |

Do not add frameworks or swap libraries: no Next.js, no Turborepo, no second UI kit, no other ORM. If a task truly needs a new dependency, say why in your summary.

## 4. Repository layout

```text
apps/web/             React SPA (Vite)
apps/api/             Express app: src/app.ts exports it, src/server.ts listens locally; src/vercel-entry.ts is the Vercel function entry (added in S0-3)
  src/modules/        users-groups, preferences, filtering, recommendation, transport-cost,
                      packages, itinerary, trip-feedback, notifications, integration
packages/engine/      PURE logic: feasibility, group-fit score, fairness, trip state machine
packages/integrations/ All third-party calls: Routes, Geocoding, Gemini, catalogue fallback, cache
packages/db/          Drizzle schema, migrations, seed, catalogue CSVs, catalogue check
packages/shared/      zod schemas and types shared by web and api
docs/                 See section 2
```

**Dependency direction.** `apps/*` may import `packages/*`. Packages never import apps. `packages/engine` imports nothing that does I/O.

**Module shape.** Inside `apps/api/src/modules/<name>/`, keep the layers separate: router, then service, then repository.

- Routers validate input with zod and call services.
- Services hold the use-case logic and call `packages/engine` and `packages/integrations`.
- Repositories hold the Drizzle queries.

## 5. Commands

Some of these exist only after the scaffold (prompt S0-2). If a command is missing, check whether the scaffold has been merged before inventing a replacement.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm db:up` | Start local Postgres on port 5432 and the test database `db-test` on 5433 (waits until both are healthy) |
| `pnpm dev` | Run web on :5173 and api on :4000; Vite proxies `/api` to the api |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | The three checks every change must pass |
| `pnpm test:unit` | Unit and web tests only (no database needed) |
| `pnpm verify` | Format check, lint, type-check, tests and build in one go |
| `pnpm build` | Production build |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` / `pnpm db:studio` | Database tasks (`db:reset` is local only) |
| `pnpm catalogue:check` | Validate the destination catalogue CSVs |
| `pnpm vitest run --project <unit\|web\|integration> <path>` | Run one test project or file (one root Vitest config, so packages have no test script) |

Health check: `curl -s http://localhost:5173/api/health` returns `{"status":"ok","db":"ok"}`.

## 6. Design rules (non-negotiable)

These come from the SRS and the runbook. Breaking one is a bug, even if tests pass.

1. **Hard constraints first, in plain arithmetic.** A destination is feasible only if:
   - its distance from the origin is within the radius,
   - its estimated cost for the group and duration is within the budget,
   - the members' date windows overlap.

   Filtering happens in `packages/engine` before any ranking or language-model call.
2. **The language model never produces a fact.** Prices, distances, durations, opening hours, availability and place names come from the database, the catalogue or the Routes API.
   - The model receives a fact sheet and only composes and explains.
   - Its output passes `validateItinerary` before anyone sees it. Unverifiable items are marked `verified = false` or dropped.
3. **Ranking uses the group-fit score:** `GFS(d) = alpha * mean(s_i(d)) + beta * min(s_i(d)) - gamma * sd(s_i(d))`.
   - alpha, beta and gamma come from configuration and are stored on each `recommendation_run`. Never write them as literals in code.
   - The member score `s_i(d)` follows `docs/specs/scoring.md`.
4. **Every outbound call goes through `packages/integrations`.** No `fetch` to a third party from `apps/*` or `packages/engine`.
   - Every call is cached.
   - Every call falls back to the curated catalogue when the provider fails.
   - Every figure returned carries a provenance: `live`, `cached`, `curated` or `estimated`.
5. **Every price shown to a user** displays the group total, the per-person figure and an "estimate" label (SRS 3.1.1).
6. **Trip status changes only through the state machine.** Call `transitionTrip()`, which uses `nextState()` in `packages/engine/src/trip-state.ts`.
   - There are 21 legal transitions (T1 to T20 plus T3b) and 4 internal ones; see runbook Appendix B.
   - An illegal event returns HTTP 409.
   - Never update `trip.status` directly.
7. **Privacy.** A preference profile is readable only by its owner. The rest of the trip group sees aggregates only. Enforce this in API queries and test it.
8. **Empty results are not errors.** Fewer than 3 feasible destinations returns `{kind: 'diagnostic', bindingConstraint, alternatives}`, not an exception.

## 7. Domain conventions

- **Units:** money in whole rupees (integer `_inr` columns), distance in kilometres, duration in minutes, dates as ISO `YYYY-MM-DD`, timestamps in UTC.
- **Spelling:** keep the British spelling used in the SRS and the enums (`organiser`, `finalised`, `catalogue`), and keep enum values exactly as listed in the runbook.
- **Trip statuses:** `draft`, `collecting_preferences`, `ready_for_recommendation`, `shortlisted`, `packages_proposed`, `package_selected`, `itinerary_proposed`, `finalised`, `in_progress`, `completed`, `cancelled`.
- **Error format:** every API error returns `{ "error": { "code": "SNAKE_CASE_CODE", "message": "plain sentence", "fields": { "field": "message" } } }` (`fields` is optional and maps field names to messages, used for 400 validation errors, SRS 3.2.1) with the right HTTP status (400 validation, 401, 403, 404, 409 illegal transition, 422 business rule, 503 dependency down).
- **Glossary:** *common availability window* is the intersection of every member's dates. *Hard constraint* means radius, budget, duration or dates. *Soft preference* means types, activities, climate. *Provenance* is where a number came from.

## 8. Code style

- TypeScript strict, `noUncheckedIndexedAccess` on.
  - No `any`, no `@ts-ignore`, no non-null `!` without a comment explaining why it is safe.
  - Never loosen compiler or lint settings to get a green build.
- Validate every external input (request bodies, query strings, CSV rows, API responses, model output) with zod at the boundary.
- Pure functions in `packages/engine` take plain data and return plain data: no clock, no randomness, no I/O. Pass `now` in as an argument.
- Names:
  - files: `kebab-case.ts`
  - React components: `PascalCase.tsx`
  - database columns: `snake_case`
  - TypeScript identifiers: `camelCase`
- Comments explain *why*, not *what*. Reference the requirement or transition, for example `// R5, SRS Table 7` or `// T3b`.
- UI must work at 360 px width. Do not convey meaning by colour alone.

## 9. Tests

- Every change ships with tests in the same commit.
- `packages/engine`: unit tests for every function, including edge cases (empty group, empty window, budget exactly at the limit, zero feasible destinations).
- API: integration tests against the `db-test` Postgres container, never against Neon.
- Tests run with `LIVE_APIS=off`: integrations answer from fixtures, so no test spends API quota or needs a key.
- Do not delete or skip a failing test to make the suite pass. Fix the code, or explain why the test is wrong.

## 10. Database

- Change the schema only in `packages/db`, then generate a migration with drizzle-kit and commit the SQL.
- **Never edit a migration that is already on `master`.** Fixes are new migrations.
- Never run migrations, seeds or resets against Neon unless the task explicitly says so.
- Deleting a trip must cascade to its members, preferences, packages and itineraries.

## 11. Secrets and data

- Keys live in `.env`, which is gitignored. Never print, log, echo or commit a key or the contents of `.env`.
- Never paste keys into code, fixtures, test snapshots, docs or commit messages.
- When adding a new variable, add its name (no value) to `.env.example`.
- If a Routes adapter is ever added: Routes API requests always send an `X-Goog-FieldMask` with only the fields used (normally `routes.distanceMeters,routes.duration`).
  - Do not request traffic-aware routing.
  - Prefer one Compute Route Matrix call over many Compute Routes calls.
- Prompts to Gemini contain destination facts only: no member names, emails, user IDs or personal budgets. The free tier may use prompts to improve Google's products.
- Read the model ID from `GEMINI_MODEL`; never hard-code a model name.

## 12. How to work

1. **One task per session.** Restate the task and list the files you expect to touch before editing.
2. **Branch from `master`:** `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/<slug>` or `docs/<slug>`. Never commit directly to `master`; never force-push `master`.
3. **Commits follow Conventional Commits:** `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
4. **Keep each pull request under about 400 changed lines.** Split larger work and say how.
5. **Before you say "done", run:**
   - `pnpm lint && pnpm typecheck && pnpm test`
   - the task's own verification steps

   Paste the real output. Do not claim a check passed without running it.
6. **Update `docs/traceability.md`** with the requirement ID, issue and tests when you implement a requirement.

**Stop and ask instead of guessing when:**

- a requirement is ambiguous, or two documents conflict
- the task needs a new dependency, table, environment variable or external service
- a change would touch the trip state machine, the scoring formula, auth or the privacy rules
- a fix would mean weakening a test, a type or a design rule
- something needs real credentials or a deployed environment

## 13. Definition of done

- [ ] Meets the acceptance criteria quoted in the task or issue
- [ ] Tests added; `pnpm lint`, `pnpm typecheck` and `pnpm test` pass locally
- [ ] No design rule in section 6 broken; no secret in the diff
- [ ] `.env.example`, README and `docs/traceability.md` updated where relevant
- [ ] Summary written: what changed, why, how it was verified (with output), and any open questions
