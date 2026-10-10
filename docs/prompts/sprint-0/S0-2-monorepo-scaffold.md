# S0-2: Monorepo scaffold

Builds the whole skeleton in one pull request: both apps, the four packages, Docker Postgres, every quality command, and a health check that proves the API reaches the database through the Vite proxy. Every later prompt relies on the names, ports and scripts fixed here.

**Branch:** `chore/s0-scaffold` · **Time box:** 3 hours · **Depends on:** S0-1 merged · **Before pasting:** replace `<POSTGRES_MAJOR>` with the Neon version you noted (for example 17)

```text
S0-2  MONOREPO SCAFFOLD
Branch: chore/s0-scaffold   Time box: 3 hours
Fill in before pasting: POSTGRES_MAJOR = 18

CONTEXT
You are working in the BonVoyage repository (default branch master) on Windows 11, with Git Bash and PowerShell. Read AGENTS.md first, then docs/decisions (ADR-001 to ADR-010, 0000 and 0001). The repo holds only docs/, AGENTS.md and git files. This task creates the code skeleton that every later prompt builds on, so the names, ports, scripts and paths below are fixed: use them exactly.

Where this prompt and docs/RUNBOOK.md prompt A1 differ, this prompt wins (it reflects later decisions):
- No Vercel files in this task. Deployment uses the Build Output API (ADR-010) and arrives in S0-3. Do not create apps/web/api/, vercel.json or any Vercel config.
- No routing key exists. Do not add GOOGLE_MAPS_API_KEY anywhere (ADR-007).
- The error envelope has an optional "fields" map (ADR-004).
- Tests needing Postgres live in apps/api/src and packages/db/test; every other test is a unit test.

Toolchain rules (checked on 10 October 2026; confirm with "npm view <pkg> version" before installing):
- Node 24.x and pnpm 10.x. Never pnpm 11: Vercel supports pnpm only up to 10.
- TypeScript 6.0.x, NOT 7.x. TypeScript 7.0 ships no compiler API yet and typescript-eslint's peer range stops below 6.1, so typed linting breaks on 7. Install typescript ~6.0 once, at the root.
- TypeScript 6 defaults "types" to [], so every tsconfig lists its types explicitly: ["node"] for Node code, ["vite/client"] for browser code. Do not use baseUrl, moduleResolution node or node10, or esModuleInterop false (deprecated in 6.0). Never set ignoreDeprecations.
- Use the current stable major at install time of: react 19, vite (8 at the time of writing) with @vitejs/plugin-react, react-router (v7, data mode), @tanstack/react-query 5, tailwindcss 4 with @tailwindcss/vite, express 5, zod 4, drizzle-orm and drizzle-kit (latest stable, never a beta or release candidate), pg 8, vitest (5 at the time of writing) with @vitest/coverage-v8, eslint with typescript-eslint, prettier 3, tsx, esbuild, @types/node 24.
- Never install: dotenv, nodemon, ts-node, jest, next, turbo, lerna, nx, axios, any UI kit, any CSS-in-JS library.

GOAL
A fresh clone on Windows runs "pnpm install", "pnpm db:up", "pnpm db:migrate" and "pnpm dev". Then http://localhost:5173 shows "BonVoyage" with a live status line "API ok · Database ok"; "curl http://localhost:5173/api/health" returns {"status":"ok","db":"ok"} through the Vite proxy with an x-request-id header; and "pnpm verify" (format check, lint, type-check, tests, build) exits 0. Stopping the database turns the health check into a 503 with the error envelope and the page says so, without anything crashing. Starting it again recovers on its own.

STEPS
1. Root workspace files
   - package.json: "name": "bonvoyage", "private": true, "type": "module", "packageManager": "pnpm@<exact output of pnpm -v>", "engines": {"node": ">=24 <25"}. Scripts, with exactly these names:
       dev            pnpm --parallel --filter @bonvoyage/api --filter @bonvoyage/web run dev
       build          pnpm -r build
       typecheck      tsc -p tsconfig.json && pnpm -r typecheck
       lint           eslint .
       format         prettier --write .
       format:check   prettier --check .
       test           vitest run
       test:unit      vitest run --project unit --project web
       test:watch     vitest
       verify         pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
       db:up          docker compose up -d --wait db db-test
       db:down        docker compose down
       db:generate    pnpm --filter @bonvoyage/db generate
       db:migrate     pnpm --filter @bonvoyage/db migrate
       db:reset       pnpm --filter @bonvoyage/db reset
       db:studio      pnpm --filter @bonvoyage/db studio
     Root devDependencies: typescript, @types/node, tsx, esbuild, eslint, @eslint/js, typescript-eslint, globals, eslint-config-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, prettier, vitest, @vitest/coverage-v8, plus @vitejs/plugin-react and jsdom (the root vitest.config.ts loads them, and pnpm's strict node_modules does not let the root see apps/web's dependencies).
   - pnpm-workspace.yaml: packages apps/* and packages/*. Add onlyBuiltDependencies listing only packages that pnpm reports under "Ignored build scripts" and that genuinely need their script (expected: esbuild, possibly @tailwindcss/oxide). Never set dangerouslyAllowAllBuilds.
   - .npmrc: shell-emulator=true (pnpm runs scripts the same way in PowerShell and Git Bash) and engine-strict=true.
   - .nvmrc: 24. .editorconfig: utf-8, lf, 2-space indent, final newline.
   - .gitattributes: "* text=auto eol=lf" plus "binary" lines for png, jpg, jpeg, ico, pdf, zip. Then run "git ls-files --eol | grep i/crlf". If it lists files, run "git add --renormalize ." and commit that alone as "chore: normalise line endings", listing the files in your report. This is the only change allowed to docs/baseline and docs/design.
   - .gitignore: keep the existing entries and make sure it has node_modules, dist, coverage, .vercel, *.tsbuildinfo, .env, .env.*, !.env.example, packages/integrations/spikes/**/out/, .DS_Store and Thumbs.db.
   - .prettierrc.json: {"singleQuote": true, "printWidth": 100, "trailingComma": "all"}. .prettierignore: pnpm-lock.yaml, dist, coverage, .vercel, docs, *.md, packages/db/migrations.
   - .env.example: every variable with a one-line comment and a safe value. DATABASE_URL=postgres://bonvoyage:bonvoyage@localhost:5432/bonvoyage and TEST_DATABASE_URL=postgres://bonvoyage:bonvoyage@localhost:5433/bonvoyage_test (local Docker only, not secrets), BETTER_AUTH_SECRET= (empty), APP_URL=http://localhost:5173, PORT=4000, LOG_LEVEL=info, LIVE_APIS=off, GEMINI_API_KEY= (empty), GEMINI_MODEL=gemini-3.8-flash, SEED_DEMO_PASSWORD= (empty). Do not open, read or copy the real .env.

2. TypeScript
   - tsconfig.base.json: target ES2023, lib ["ES2023"], module ESNext, moduleResolution Bundler, strict, noUncheckedIndexedAccess, noImplicitOverride, noFallthroughCasesInSwitch, noUnusedLocals, noUnusedParameters, verbatimModuleSyntax, isolatedModules, resolveJsonModule, skipLibCheck, forceConsistentCasingInFileNames, noEmit, types [].
   - Root tsconfig.json extends the base with types ["node"] and includes the root *.ts files and scripts/**/*.ts, so root config files and scripts are type-checked and lint-checked.
   - Every package and app has its own tsconfig.json extending ../../tsconfig.base.json with its own "types" and "include" (src, test and the config files it owns) and a script "typecheck": "tsc -p tsconfig.json". apps/web keeps the create-vite layout (tsconfig.json referencing tsconfig.app.json and tsconfig.node.json) with typecheck "tsc -b"; the app config adds lib DOM and DOM.Iterable, jsx react-jsx and types ["vite/client"].
   - Workspace packages ship TypeScript source with no build step: "exports": {".": "./src/index.ts"}. Apps depend on them as "workspace:*".

3. ESLint (eslint.config.js, flat config)
   - Use defineConfig from "eslint/config" with @eslint/js recommended and typescript-eslint recommendedTypeChecked, with languageOptions.parserOptions.projectService true and tsconfigRootDir import.meta.dirname.
   - Rules (error unless noted): @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, @typescript-eslint/consistent-type-imports, @typescript-eslint/no-explicit-any, eqeqeq, no-console as a warning (off in scripts/** and */*/scripts/**).
   - apps/web/**: eslint-plugin-react-hooks with its current flat recommended config, eslint-plugin-react-refresh (only-export-components as a warning), and no-restricted-imports forbidding @bonvoyage/db, @bonvoyage/integrations and @bonvoyage/shared/node.
   - packages/engine/**: no-restricted-imports forbidding node:*, pg, drizzle-orm, @bonvoyage/db and @bonvoyage/integrations. The engine stays pure (AGENTS.md section 4).
   - Plain JavaScript files (*.js, *.mjs) use tseslint.configs.disableTypeChecked. Ignore dist, coverage, .vercel, packages/db/migrations and docs. eslint-config-prettier goes last.

4. Docker (docker-compose.yml)
   - Top-level "name: bonvoyage", so every checkout of the repo shares the same containers.
   - Service db: image postgres:POSTGRES_MAJOR-alpine; POSTGRES_USER=bonvoyage, POSTGRES_PASSWORD=bonvoyage, POSTGRES_DB=bonvoyage; ports "127.0.0.1:5432:5432"; named volume bonvoyage-pgdata; healthcheck "pg_isready -U bonvoyage -d bonvoyage" every 2 s with 20 retries.
   - Service db-test: same image and credentials; POSTGRES_DB=bonvoyage_test; ports "127.0.0.1:5433:5432"; a tmpfs instead of a volume (the data is throwaway); the same healthcheck with -d bonvoyage_test.
   - Mount path depends on the major version: for 18 or later, mount the volume and the tmpfs at /var/lib/postgresql; for 17 or earlier, at /var/lib/postgresql/data. The postgres 18 image refuses to start with the old path.

5. Vitest (one vitest.config.ts at the root with three inline projects)
   - unit: include packages/*/src/**/*.test.ts, environment node.
   - web: root apps/web, environment jsdom, the React plugin, setupFiles a file that imports @testing-library/jest-dom/vitest, include src/**/*.test.{ts,tsx}.
   - integration: include apps/api/src/**/*.test.ts and packages/db/test/**/*.test.ts, environment node, fileParallelism false, globalSetup packages/db/test/global-setup.ts, and env { DATABASE_URL: <the test database URL>, LIVE_APIS: "off", LOG_LEVEL: "silent" }.
   - The config resolves the test database URL like this: if a root .env exists, parse it with util.parseEnv and copy only keys that are not already in process.env (the real environment always wins, which is how CI injects its own value); then use TEST_DATABASE_URL, defaulting to postgres://bonvoyage:bonvoyage@localhost:5433/bonvoyage_test. Config files never import workspace packages; repeat these few lines where needed.
   - Coverage: v8 provider at the root only, reporters text and html, no thresholds yet.

6. packages/shared (@bonvoyage/shared)
   - src/index.ts exports zod 4 schemas with their inferred types:
       HealthOk          { status: "ok", db: "ok" }
       ErrorEnvelope     { error: { code: string matching ^[A-Z][A-Z0-9_]*$, message: string, fields?: Record<string, string> } }
       Provenance        "live" | "cached" | "curated" | "estimated"
       ERROR_CODES       a const object of the server codes used so far: VALIDATION_ERROR, INVALID_JSON, PAYLOAD_TOO_LARGE, NOT_FOUND, DB_UNAVAILABLE, INTERNAL
   - src/node/index.ts, exported as the subpath "./node" (Node only; the web app must never import it): loadRootEnv(fromDir) walks up from fromDir to the folder holding pnpm-workspace.yaml and, if a .env file exists there, parses it with util.parseEnv and sets only the keys missing from process.env. It does nothing when process.env.VERCEL is set or NODE_ENV is production, and it never logs values.
   - Tests: the envelope accepts a fields map and rejects a lowercase code; loadRootEnv never overwrites an existing variable (use a temporary directory with its own pnpm-workspace.yaml and .env).

7. packages/engine (@bonvoyage/engine), pure
   - src/geo.ts: haversineKm(a, b) on { lat, lng } points with mean Earth radius 6371.0088 km; throws RangeError for non-finite numbers, latitude outside -90..90 or longitude outside -180..180. ROAD_FACTOR = 1.3 with a comment citing ADR-007. estimateRoadKm(a, b) returns { distanceKm: Math.round(haversineKm(a, b) * ROAD_FACTOR), provenance: "estimated" }.
   - src/index.ts re-exports them. The engine may import types and schemas from @bonvoyage/shared and nothing else from the workspace.
   - Tests: Delhi (28.6139, 77.2090) to Mumbai (19.0760, 72.8777) is 1148.1 km, asserted within 1 per cent of 1148; the same point gives 0; a to b equals b to a; each RangeError case; estimateRoadKm for Delhi to Mumbai gives 1493 with provenance "estimated".

8. packages/integrations (@bonvoyage/integrations): interfaces only, no implementations and no network code.
   - src/routing.ts: GeoPoint { lat, lng }; RoutingPlace { id: string, point: GeoPoint, hubSlug?: string }; DistanceResult { distanceKm: number, durationMin: number | null, provenance: Provenance, source: string }; interface RoutingProvider { readonly name: string; distance(from: RoutingPlace, to: RoutingPlace): Promise<DistanceResult>; matrix(from: RoutingPlace, to: readonly RoutingPlace[]): Promise<DistanceResult[]> }.
   - src/llm.ts: LlmUsage { inputTokens: number, outputTokens: number, thinkingTokens?: number }; LlmResult<T> { data: T, usage: LlmUsage, latencyMs: number, model: string }; interface LlmClient { generateStructured<T>(request: { system: string, prompt: string, schema: z.ZodType<T>, schemaName: string }): Promise<LlmResult<T>> }.
   - src/catalogue.ts: interface CatalogueSource { roadDistanceKm(hubSlug: string, destinationSlug: string): Promise<number | null> }. Later prompts extend it.
   - src/errors.ts: class IntegrationError extends Error with readonly provider: string and readonly retryable: boolean.
   - src/index.ts re-exports everything; one test file with expectTypeOf checks, so the package has a test.

9. packages/db (@bonvoyage/db)
   - Dependencies drizzle-orm, pg, @bonvoyage/shared; devDependencies drizzle-kit, @types/pg.
   - drizzle.config.ts: dialect postgresql, schema ./src/schema/index.ts, out ./migrations, casing snake_case, strict true, verbose true, dbCredentials.url from DATABASE_URL (read the root .env with the same few lines as vitest.config.ts).
   - src/schema/index.ts: "export {};" for now. The schema arrives in S0-5.
   - src/client.ts: createDb(url) returns { db, pool }, where pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 }) and db = drizzle({ client: pool, casing: "snake_case", schema }). Export the Db type. Export probeDb(pool, timeoutMs = 2_000): Promise<boolean>, which runs "select 1" and resolves false on any error or timeout. Nothing connects at import time.
   - src/target.ts: describeTarget(url) returns "host:port/database" (never the user or password) and isLocalHost(url) returns true only for localhost, 127.0.0.1 and ::1. Every script prints targets through describeTarget.
   - scripts/migrate.ts: calls loadRootEnv, prints "Migrating <describeTarget>", and if migrations/meta/_journal.json does not exist prints "No migrations yet (the schema arrives in S0-5)" and exits 0; otherwise runs migrate() from drizzle-orm/node-postgres/migrator with migrationsFolder ./migrations, then ends the pool.
   - scripts/reset.ts: local only. Exits 1 with a clear message unless isLocalHost(DATABASE_URL). Drops and recreates the schemas public and drizzle, then runs the migrate step.
   - test/global-setup.ts (the integration project's globalSetup, which runs in the main process, so test.env does not reach it): reads TEST_DATABASE_URL (default postgres://bonvoyage:bonvoyage@localhost:5433/bonvoyage_test); refuses to run unless that URL is local and its database name ends in _test; drops and recreates public and drizzle on the test database; runs migrations if any exist; returns a teardown that ends its pool.
   - test/connection.test.ts: probeDb on the test database resolves true; probeDb on postgres://bonvoyage:bonvoyage@127.0.0.1:1/x resolves false within 3 seconds.
   - Package scripts: generate (drizzle-kit generate), migrate (tsx scripts/migrate.ts), reset (tsx scripts/reset.ts), studio (drizzle-kit studio), typecheck.

10. scripts/bundle-api.ts (root, reused by S0-3)
   - Exports bundleApi({ entry, outfile }) using esbuild: bundle true, platform node, format esm, target node24, sourcemap true, external ["pg-native"], and a banner that defines require with createRequire(import.meta.url) for CommonJS dependencies. Workspace packages and node_modules are bundled in. When run directly it takes --entry and --out arguments.

11. apps/api (@bonvoyage/api)
   - Dependencies express, helmet, pino, pino-http, zod, @bonvoyage/shared, @bonvoyage/db; devDependencies supertest, @types/express, @types/supertest, pino-pretty.
   - src/env.ts: calls loadRootEnv(import.meta.dirname) once, then validates process.env with zod: NODE_ENV (development | test | production, default development), PORT (default 4000), DATABASE_URL (required URL), APP_URL (default http://localhost:5173), LOG_LEVEL (fatal | error | warn | info | debug | trace | silent, default info), LIVE_APIS (on | off, default off). On failure it prints each failing variable name with the problem, never the value, and exits 1. Later prompts add variables here.
   - src/http/errors.ts: class AppError(status, code, message, fields?); zodFieldErrors(error) maps each issue path joined with "." (or "_root") to its first message; parseOrThrow(schema, data) returns the parsed value or throws AppError(400, "VALIDATION_ERROR", "Some fields are invalid.", zodFieldErrors(error)); notFoundHandler; errorHandler (4 arguments). The error handler maps AppError to its status and envelope, body-parser errors with type entity.parse.failed to 400 INVALID_JSON and entity.too.large to 413 PAYLOAD_TOO_LARGE, and anything else to a req.log.error entry plus 500 INTERNAL "Something went wrong." with no stack or internal message in the body.
   - src/app.ts: export function createApp(deps: { db: Db; pool: Pool; logger: Logger }): Express. No listen and no module-level state. createApp never reads process.env and never imports src/env.ts: callers pass everything in, which keeps tests free of environment setup. In order:
       app.set("trust proxy", 1); app.disable("x-powered-by");
       helmet();
       pino-http with the given logger and genReqId: reuse an incoming x-request-id if it matches ^[A-Za-z0-9-]{8,64}$, else crypto.randomUUID(); always set the x-request-id response header; redact the authorization and cookie request headers and the set-cookie response header;
       a comment block marking where S0-5 mounts Better Auth: app.all("/api/auth/*splat", toNodeHandler(auth)) must come BEFORE express.json, because Better Auth reads the raw body;
       express.json({ limit: "100kb" });
       GET /api/health: probeDb(pool) true gives 200 {"status":"ok","db":"ok"}; false gives 503 with the envelope DB_UNAVAILABLE "The database is not reachable.";
       an apiRouter mounted at /api that mounts the ten module routers;
       notFoundHandler: 404 NOT_FOUND "No route for <METHOD> <path>.";
       errorHandler.
   - src/modules/<name>/router.ts for the ten modules (users-groups, preferences, filtering, recommendation, transport-cost, packages, itinerary, trip-feedback, notifications, integration). Each exports an empty express.Router() and sits next to a README.md stating: the SRS module name; the academic owner (users-groups and preferences: Maulik and Parth; filtering and recommendation: Maulik; transport-cost, packages and integration: Manan; itinerary, trip-feedback and notifications: Parth; Kushagra owns the web screens for every module); the requirements it serves (from docs/traceability.md); and the router, then service, then repository rule. Add one line to each README: "Implemented by Maulik with coding agents."
   - src/server.ts: creates the logger (pino at LOG_LEVEL), createDb(DATABASE_URL), createApp, listens on PORT, logs "api listening on http://localhost:<PORT>", and on SIGINT or SIGTERM closes the server and then the pool, exiting within 5 seconds.
   - Scripts: dev = "tsx watch --clear-screen=false src/server.ts | pino-pretty"; build = "tsx ../../scripts/bundle-api.ts --entry src/server.ts --out dist/server.mjs"; start = "node --enable-source-maps dist/server.mjs"; typecheck.
   - Tests in src/app.test.ts with supertest against createApp, a real pool on the test database and a silent logger: health 200 with the exact body and an x-request-id header; a valid incoming x-request-id is echoed and an invalid one is replaced; health 503 with the DB_UNAVAILABLE envelope when the pool points at 127.0.0.1:1; GET /api/nope gives the 404 envelope; POST /api/health with Content-Type application/json and body "{bad" gives 400 INVALID_JSON (express.json runs before routing); a 150 kB JSON body gives 413 PAYLOAD_TOO_LARGE.
   - Tests in src/http/errors.test.ts with a tiny express app that uses errorHandler: a thrown Error("secret detail") gives 500 INTERNAL and the body does not contain "secret detail"; parseOrThrow with a zod object missing "title" gives 400 VALIDATION_ERROR with fields { title: <message> }; a nested path appears as "a.b".

12. apps/web (@bonvoyage/web)
   - React 19, TypeScript and Vite from the official create-vite react-ts template, with the demo assets and CSS removed. Dependencies react-router, @tanstack/react-query, @bonvoyage/shared; devDependencies tailwindcss, @tailwindcss/vite, @vitejs/plugin-react, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom.
   - vite.config.ts: plugins react() and tailwindcss(); server.port 5173 with strictPort true; server.proxy { "/api": { target: "http://localhost:4000" } } WITHOUT changeOrigin, so the API sees the browser's Host header and auth cookies stay first-party later.
   - src/index.css: @import "tailwindcss"; and a system font stack. No other CSS framework.
   - src/lib/api.ts: fetchJson(path, schema, init?) calls fetch with credentials "same-origin", validates 2xx JSON bodies with the given zod schema, and throws ApiError { status, code, message, fields? } otherwise: code from the envelope when the body is one; BAD_RESPONSE when a non-2xx body is not an envelope (the Vite proxy answers 500 with no envelope when the API is down); NETWORK_ERROR with status 0 when fetch itself rejects.
   - Routing: createBrowserRouter from react-router and RouterProvider from react-router/dom. "/" is Home and "*" is NotFound, inside a Layout with a header reading "BonVoyage" and a main landmark. QueryClientProvider wraps the router.
   - Home: the heading "BonVoyage", the line "Plan a group trip everyone agrees on.", and a status panel using useQuery(["health"]) with retry false and refetchInterval 10_000. It shows "API ok · Database ok" on 200, "API ok · Database unreachable" on 503 DB_UNAVAILABLE, and "API unreachable" for anything else. Each state has an icon and text (never colour alone) inside role="status". The page works at 360 px wide.
   - NotFound: "Page not found" with a link home.
   - Tests: Home renders each of the three states (stub fetch with vi.stubGlobal); NotFound renders for an unknown path (createMemoryRouter).
   - Scripts: dev = vite, build = vite build, preview = vite preview, typecheck = tsc -b.

13. Governance files
   - README.md: what BonVoyage is (two sentences); prerequisites (Node 24, pnpm 10, Docker Desktop); first-run commands (copy .env.example to .env only on a fresh machine, then pnpm install, pnpm db:up, pnpm db:migrate, pnpm dev); a scripts table; ports (5173 web, 4000 api, 5432 db, 5433 db-test); "Read AGENTS.md before using a coding agent".
   - CONTRIBUTING.md: the working agreement for one developer: one-week sprints from Monday to Sunday with a review on Sunday; branch names and Conventional Commits from AGENTS.md section 12; every change by pull request, CI green, squash merge; pull requests under about 400 changed lines (the scaffold and generated migrations are exempt); UI changes include screenshots at 360 px and desktop widths; the Definition of Done from AGENTS.md section 13.
   - .github/CODEOWNERS: "* @<login>", where <login> is the output of "gh api user -q .login".
   - .github/pull_request_template.md: linked issue; what changed and why; how it was verified (pasted output); screenshots at 360 px and desktop for UI changes; checklist (tests added, pnpm verify passes, no secrets in the diff, docs/traceability.md updated).

14. AGENTS.md (the only edits to existing docs in this task)
   - Section 3, Distances row: "RoutingProvider in packages/integrations: curated hub road distance, else haversine x 1.3 labelled estimated (ADR-007). A Google Routes adapter only if a key is added."
   - Section 4: the apps/web line becomes "React SPA (Vite)". The apps/api line adds "src/vercel-entry.ts is the Vercel function entry (added in S0-3)".
   - Section 5: add pnpm db:up, pnpm test:unit and pnpm verify; replace "runbook prompt A1" with "prompt S0-2"; replace the "pnpm --filter @bonvoyage/<package> test" row with "pnpm vitest run --project <unit|web|integration> <path>" (there is one root Vitest config, so packages have no test script).
   - Section 7: the error format gains an optional "fields" object that maps field names to messages, used for 400 validation errors (SRS 3.2.1).
   - Section 11: the Routes API bullet starts "If a Routes adapter is ever added:".

Commit in this order: workspace and tooling; packages; api; web; governance and AGENTS.md. This pull request is exempt from the 400-line guideline.

VERIFICATION
Commit everything, then check a fresh clone in Git Bash (the shared compose name means the same containers are reused):
  git clone --branch chore/s0-scaffold . ../bv-check && cd ../bv-check && cp .env.example .env
  pnpm install --frozen-lockfile
  pnpm db:up
  pnpm db:migrate                                   expect "No migrations yet (the schema arrives in S0-5)"
  pnpm dev                                          leave running; use a second terminal below
  curl -si http://localhost:5173/api/health         expect 200, an x-request-id header, {"status":"ok","db":"ok"}
  curl -si http://localhost:5173/api/nope           expect 404 and {"error":{"code":"NOT_FOUND",...}}
  docker compose stop db && curl -si http://localhost:5173/api/health      expect 503 DB_UNAVAILABLE
  docker compose start db                           the page shows "API ok · Database ok" again within 10 s
  pnpm verify
  pnpm --filter @bonvoyage/api build && pnpm --filter @bonvoyage/api start, then curl -s http://localhost:4000/api/health
Then in PowerShell, from the original checkout: pnpm lint and pnpm test:unit.
Delete ../bv-check afterwards. Take a 360 px wide screenshot of the home page (browser dev tools, device mode) for the pull request.
Report: versions from "pnpm list -r --depth 0" for typescript, vite, react, react-router, @tanstack/react-query, tailwindcss, express, zod, drizzle-orm, drizzle-kit, pg, vitest, eslint and typescript-eslint, plus node -v and pnpm -v; the list of files created; every deviation from this prompt and why.

IF BLOCKED
- A library's current major differs from this prompt: use the current stable major if it installs cleanly and the APIs used here still exist; otherwise pin the previous major. Record the choice in the report.
- typescript-eslint rejects the TypeScript version: pin TypeScript to the newest version inside typescript-eslint's peer range ("npm view typescript-eslint peerDependencies").
- Type-aware lint fails on a config file: add the file to a tsconfig include, or apply disableTypeChecked to that file only. Never switch rules off project-wide.
- Vitest's project syntax differs: follow vitest.dev/guide/projects for the installed version and keep the project names unit, web and integration (scripts depend on them). If a project cannot have its own globalSetup, move that setup into the integration project's setupFiles behind a run-once guard.
- util.parseEnv is missing: Node is not 24. Stop and tell me.
- Port 5173, 4000, 5432 or 5433 is busy: stop and tell me which process holds it ("netstat -ano | findstr :5432" in PowerShell). Do not change ports.
- Piping into pino-pretty misbehaves on Windows: drop the pipe from the dev script and say so.
- pnpm asks to approve a build script for a package not named above: tell me which package and why it needs one.
- Never create or edit .env, never print environment values, never invent secrets.
```
