# S0-3: CI, Vercel and Neon deployment

Adds the required `ci` check, deploys the SPA and the API as one Vercel project through the Build Output API, connects previews to Neon `preview` and production to Neon's default branch, and protects `master`. Some steps are dashboard clicks only you can do, so the prompt makes the agent stop and hand over at those points.

**Branch:** `chore/s0-ci-deploy` · **Time box:** 3 hours · **Depends on:** S0-2 merged, Vercel account from setup step 7 · **Before pasting:** replace `<POSTGRES_MAJOR>`

```text
S0-3  CI, VERCEL AND NEON DEPLOYMENT
Branch: chore/s0-ci-deploy   Time box: 3 hours
Fill in before pasting: POSTGRES_MAJOR = 18

CONTEXT
Read AGENTS.md, docs/decisions/ADR-010 and README.md first. The S0-2 scaffold is merged: a pnpm workspace with apps/web (Vite SPA), apps/api (Express 5; createApp in src/app.ts, the local server in src/server.ts, env in src/env.ts), packages/db (createDb, probeDb, describeTarget, isLocalHost, scripts/migrate.ts), scripts/bundle-api.ts (the esbuild bundler) and the Vitest projects unit, web and integration.

Deployment design (ADR-010; decided, do not redesign):
- ONE Vercel project at the repo root with framework null. vercel.json sets installCommand and buildCommand only. Do NOT set outputDirectory.
- Our build script writes Vercel's Build Output API (version 3) directory .vercel/output:
    static/                            the Vite build of apps/web
    functions/api.func/index.mjs       ONE esbuild bundle of apps/api/src/vercel-entry.ts, with every workspace package and node_modules dependency inlined
    functions/api.func/.vc-config.json
    config.json                        routes
- Why: Vercel compiles functions file by file, which breaks extensionless ESM imports and workspace TypeScript packages. One pre-bundled function avoids both, and CI can smoke-test the exact file that ships.
- Database: Neon in AWS Singapore. The app uses POOLED connection strings (host contains -pooler). Migrations use DIRECT strings, run only from Maulik's laptop through a guarded script. Previews use the Neon branch "preview"; production uses Neon's default branch. The function runs in sin1 (Singapore), next to Neon.
- Previews are protected by Vercel Authentication, so preview checks happen in Maulik's logged-in browser, not with curl.

You cannot click in dashboards. When a step says HAND OVER, stop, print the numbered instructions for Maulik exactly as written in this prompt, and wait for his reply before continuing.

GOAL
Every pull request runs one job named "ci" (format check, lint, type-check, tests against a Postgres service, the Vercel build and a smoke test of the bundled function) and cannot merge unless it is green. Every push to a pull request branch gets a Vercel preview whose /api/health returns {"status":"ok","db":"ok"} from Neon "preview". Every merge to master deploys production, whose /api/health answers the same from Neon's default branch. Maulik can check or migrate either Neon branch from his laptop with one guarded command.

STEPS
Part A: prove the Vercel mechanism first (about 20 minutes)
1. Write scripts/vercel-proof.ts (run with tsx). It deletes .vercel/output and writes:
   - static/index.html containing "BonVoyage deploy proof";
   - functions/api.func/index.mjs, exporting a default function (req, res) that responds 200 with JSON { ok: true, url: req.url };
   - functions/api.func/.vc-config.json exactly: {"runtime":"nodejs24.x","handler":"index.mjs","launcherType":"Nodejs","shouldAddHelpers":false,"shouldAddSourcemapSupport":true,"regions":["sin1"]}
   - config.json exactly: {"version":3,"routes":[{"src":"^/api(?:/.*)?$","dest":"/api"},{"handle":"filesystem"},{"src":"^/assets/.*$","status":404},{"src":"^/.*$","dest":"/index.html"}]}
2. Write vercel.json at the root: {"$schema":"https://openapi.vercel.sh/vercel.json","framework":null,"installCommand":"pnpm install --frozen-lockfile","buildCommand":"pnpm vercel-build"}. Add the root script "vercel-build": "tsx scripts/vercel-proof.ts" for now.
3. Run pnpm vercel-build locally, list the files it wrote, and commit ("chore: vercel build output proof"). Do not push yet.
4. HAND OVER to Maulik (import the project):
   a) Vercel dashboard: Add New, Project, import the bonvoyage repository. Framework Preset: Other. Root Directory: ./ (the repo root). Leave every Build and Output override switched off; vercel.json controls them. Under Environment Variables add ENABLE_EXPERIMENTAL_COREPACK = 1. Click Deploy. This first production deployment is built from master, which has no vercel.json yet, so it may fail or show the repository files. That is expected until this pull request merges.
   b) Project Settings: Build and Deployment, Node.js Version = 24.x. Functions, Function Region = Singapore (sin1). Environments (or Git), Production Branch = master.
   c) Reply "imported".
5. When Maulik replies "imported", push the branch (git push -u origin chore/s0-ci-deploy). Then HAND OVER (check the proof):
   a) In Vercel, Deployments, open the Preview built from chore/s0-ci-deploy while logged in.
   b) Check four URLs: / shows "BonVoyage deploy proof"; /api/health shows {"ok":true,"url":"/api/health"}; /any/page shows the proof page; /assets/missing.js returns 404.
   c) Reply with what each URL showed, plus the build log lines that mention the Build Output API or .vercel/output.
6. If url is the original path "/api/health" and the other three checks pass, continue. Otherwise stop and follow IF BLOCKED.

Part B: the real build
7. apps/api: add the dependency @vercel/functions. Create src/vercel-entry.ts, which loads env from src/env.ts, calls createDb(env.DATABASE_URL), passes the pool to attachDatabasePool from @vercel/functions (it releases idle clients before Vercel suspends the instance), builds a JSON pino logger at LOG_LEVEL, and has "export default createApp({ db, pool, logger })". An Express app is a (req, res) handler, so this default export serves every /api request. Extend src/env.ts with optional VERCEL, VERCEL_ENV (production | preview | development) and VERCEL_URL; when APP_URL is unset and VERCEL_URL is set, APP_URL defaults to https://${VERCEL_URL}.
8. Replace scripts/vercel-proof.ts with scripts/vercel-build.ts and point "vercel-build" at it. It must:
   a) delete .vercel/output;
   b) run "pnpm --filter @bonvoyage/web build" and copy apps/web/dist to .vercel/output/static;
   c) call bundleApi({ entry: "apps/api/src/vercel-entry.ts", outfile: ".vercel/output/functions/api.func/index.mjs" }) from scripts/bundle-api.ts;
   d) write .vc-config.json as in step 1 plus "maxDuration": 60;
   e) write config.json with these routes in this order: {"src":"^/api(?:/.*)?$","dest":"/api"}, then {"src":"^/assets/(.*)$","headers":{"cache-control":"public, max-age=31536000, immutable"},"continue":true}, then {"handle":"filesystem"}, then {"src":"^/assets/.*$","status":404}, then {"src":"^/.*$","dest":"/index.html"};
   f) print the size of index.mjs and the number of static files, and exit non-zero on any failure.
   Use only Node built-ins (fs/promises, path, child_process, url) plus bundleApi, so it runs on Windows and Linux alike.
9. scripts/smoke-function.ts with the root script "smoke:function". It imports the default export of .vercel/output/functions/api.func/index.mjs (through pathToFileURL, which Windows needs), serves it with node:http on a free port, and asserts: GET /api/health gives 200, the body exactly {"status":"ok","db":"ok"} and an x-request-id header; GET /api/nope gives 404 with error.code NOT_FOUND; .vercel/output/static/index.html exists; the first route in config.json is the /api route. It needs DATABASE_URL: CI provides it, and locally the bundle loads the root .env because VERCEL is unset. It prints one line per assertion and exits 0 only if all pass.
10. packages/db/scripts/migrate-remote.ts, package script "migrate:remote", root script "db:migrate:remote": "pnpm --filter @bonvoyage/db migrate:remote".
   - Usage: pnpm db:migrate:remote --target preview|production [--status]
   - Reads ONLY the root .env.neon file (util.parseEnv; never .env) and takes NEON_PREVIEW_DIRECT_URL or NEON_PRODUCTION_DIRECT_URL by target. Exits 1 if the file or the variable is missing.
   - Refuses with exit 1 and a clear message when the host contains "-pooler" (migrations need a direct connection) or isLocalHost is true.
   - Prints only describeTarget(url). Connects, prints "Postgres <server_version>", and warns if its major version differs from the image tag in docker-compose.yml.
   - --status lists the migrations in migrations/meta/_journal.json, how many are recorded in drizzle.__drizzle_migrations (a missing table counts as 0), and how many are pending. It changes nothing.
   - Without --status, production first asks Maulik to type "migrate production" (node:readline/promises) and aborts on anything else; then drizzle's migrate() runs and the script prints how many migrations it applied. With no journal yet it prints "No migrations yet" after the version check and exits 0.
11. .github/workflows/ci.yml, with one job whose id and name are both "ci":
   - triggers: pull_request, and push to master. Concurrency group ci-${{ github.ref }} with cancel-in-progress. permissions: contents read. runs-on ubuntu-latest, timeout-minutes 15.
   - services.postgres: image postgres:POSTGRES_MAJOR-alpine; POSTGRES_USER bonvoyage, POSTGRES_PASSWORD bonvoyage, POSTGRES_DB bonvoyage_test; ports 5433:5432; health options using pg_isready.
   - job env: TEST_DATABASE_URL and DATABASE_URL both postgres://bonvoyage:bonvoyage@localhost:5433/bonvoyage_test; LIVE_APIS "off"; APP_URL http://localhost:5173; BETTER_AUTH_SECRET set to a fixed, obviously fake value of at least 40 characters that only CI uses (S0-5 starts requiring it).
   - steps: checkout; pnpm/action-setup (version taken from packageManager); setup-node with node-version-file .nvmrc and cache pnpm; pnpm install --frozen-lockfile; pnpm format:check; pnpm lint; pnpm typecheck; pnpm test; pnpm vercel-build; pnpm smoke:function; a "no keys in the repo" step that fails if git grep -nE 'AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{20,}' finds anything.
   - Use each action's current major version tag (check its README).
12. .github/dependabot.yml: npm at "/" weekly on Sunday, minor and patch updates grouped into one pull request, open-pull-requests-limit 3, ignoring major updates of typescript (it stays on 6.x until typescript-eslint supports 7), pnpm and @types/node; github-actions weekly.
13. Issue forms in .github/ISSUE_TEMPLATE/: feature.yml (requirement dropdown R1 to R18, module dropdown with the ten modules, acceptance criteria, sprint), bug.yml (steps, expected, actual, and where: local, preview or production), spike.yml (question, time box, decision), and config.yml keeping blank issues enabled. Apply the labels type:feature, type:bug and type:spike (S0-8 creates them).
14. README.md: a CI badge for ci.yml; a "Deployments" section (a pull request gives a Vercel preview on Neon preview; master gives production on Neon's default branch; migrations run only through pnpm db:migrate:remote, never from CI or a Vercel build); the new scripts in the scripts table.
15. AGENTS.md: section 5 gains pnpm vercel-build, pnpm smoke:function and "pnpm db:migrate:remote --target preview|production (only when a task says so)"; the Neon rule in section 10 ends with "and then only through pnpm db:migrate:remote".
16. docs/spikes/S4-deploy-and-sessions.md, one page with question, method, numbers and decision. The Deployment part is filled in at step 18. The Sessions part says the phone check moves to Sprint 1 issue 1 (sign-in screens), because Sprint 0 has no sign-in UI.
17. HAND OVER to Maulik (environment variables; the values come from his password manager, never from you):
   In Vercel, Settings, Environment Variables, add:
     Name                          Preview                          Production
     DATABASE_URL                  Neon preview POOLED string       Neon default-branch POOLED string
     BETTER_AUTH_SECRET            a new random value               a different new random value
     APP_URL                       (leave unset)                    https://<production domain>
     LIVE_APIS                     on                               on
     GEMINI_API_KEY                the Gemini key                   the Gemini key
     GEMINI_MODEL                  gemini-3.8-flash                 gemini-3.8-flash
     LOG_LEVEL                     info                             info
     ENABLE_EXPERIMENTAL_COREPACK  1                                1
   Generate each secret with: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   Then push the latest commit (or Redeploy the preview) and, logged in, open the preview: the home page shows "API ok · Database ok"; /api/health returns {"status":"ok","db":"ok"}; /some/page shows the app's Not Found page; /api/nope shows the JSON 404 envelope; /assets/missing.js returns 404. Reload /api/health five times and note the first and the typical time in the browser's Network tab, and note the build duration from the build log.
   Run locally: pnpm db:migrate:remote --target preview --status, then the same with --target production. Both must reach Neon and report 0 migrations.
   Reply with the numbers and anything that differed.
18. Write Maulik's numbers into the S4 note: build duration, first and warm /api/health times, and the bundle size from step 8.
19. HAND OVER to Maulik (protect master):
   a) GitHub repository, Settings, Rules, Rulesets, New branch ruleset: name "master", enforcement Active, target the default branch. Turn on Restrict deletions; Require linear history; Require a pull request before merging (required approvals 0, allowed merge method Squash); Require status checks to pass, adding the check "ci"; Block force pushes. Leave the bypass list empty.
   b) Settings, General, Pull Requests: allow squash merging only, and turn on "Automatically delete head branches".
   c) Settings, Code security: secret scanning and push protection on.
   d) Open a throwaway pull request from a branch that adds "const unused = 1;" to apps/api/src/server.ts. CI must fail and merging must be blocked. Close it and delete the branch.
   e) Reply "protected".

VERIFICATION
Paste the real output of:
  pnpm verify
  pnpm vercel-build && pnpm smoke:function
  pnpm db:migrate:remote --target preview --status
  pnpm db:migrate:remote --target production --status
  gh run list --branch chore/s0-ci-deploy --limit 3
  gh api repos/{owner}/{repo}/rulesets
and restate what Maulik reported for steps 5, 17 and 19. After the merge, Maulik runs curl -si https://<production domain>/api/health (production is public; expect 200 and {"status":"ok","db":"ok"}) and adds the production URL to docs/accounts.md in his next pull request.
Report: files created, the deploy-proof result, any setting that differs from this prompt, the function bundle size, open questions.

IF BLOCKED
- The proof preview does not use .vercel/output (the build log shows a framework build, /api/health is 404, or the root lists repository files): stop and report the build log. Do not try other layouts. The fallback (prebuilt deploys from GitHub Actions with "vercel build" and "vercel deploy --prebuilt" using a VERCEL_TOKEN repository secret) changes ADR-010, so I decide it.
- The runtime "nodejs24.x" is rejected: use "nodejs22.x", set the esbuild target to node22, and record it.
- Vercel rejects "regions" in .vc-config.json on the Hobby plan: remove the key and rely on the Function Region setting from step 4b.
- The function sees a different path (url is "/api" for every request): do not change the routes yet. Add a temporary log of req.url and req.originalUrl, redeploy, and report what the function receives.
- esbuild reports an unresolvable or dynamic require: report the package. Only optional native modules such as pg-native may be external, because the function directory has no node_modules.
- pg rejects channel_binding or warns about sslmode: Maulik edits the connection string in Vercel (sslmode=verify-full, or drop channel_binding); never change it in code.
- Vercel installs the wrong pnpm version: confirm ENABLE_EXPERIMENTAL_COREPACK=1 is set for every environment and packageManager is present, then redeploy without the build cache.
- The typed confirmation cannot read input in Git Bash: run that command from PowerShell.
- At 3 hours with deployment still failing: commit the CI part (ci.yml, dependabot, issue forms, scripts), mark the deploy steps as not done in the report, and open an issue "Deploy: <error>". S0-4 and S0-5 can continue locally.
- Never print, log or commit a connection string, secret or key. Never run migrate:remote without --status in this task: no migrations exist yet.
```
