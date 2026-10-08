# BonVoyage Pre-Development Runbook (Sprint 0)

Oct 8, 2026 · @Maulik

## Where the project stands

Design is complete and no code exists yet. The college submission deadline is Nov 10, 2026, so everything fits into four and a half weeks: Sprint 0 runs from Oct 8, 2026 to Oct 11, 2026, four one-week feature sprints start on Oct 12, 2026, and 8 to 10 November is a buffer for fixes, the report and submission.

Maulik builds everything with coding agents on one machine, so the phases below run in sequence. The synopsis 20-week plan no longer applies: the sprint map at the end replaces it, and anything not done by the feature freeze on 8 November is cut in reverse MoSCoW order.

| Baseline document | What development takes from it |
| --- | --- |
| SRS v1.1 | Functional requirement Tables 5 to 9 become acceptance criteria; Table 10 entities become the schema; section 3.3 targets become test thresholds |
| MoSCoW prioritisation | R1 to R11 (Must) are the MVP; R12 to R16 (Should) follow; R17 and R18 (Could) are contingency; R19 and R20 stay out |
| SE feature description v2 | The ten modules and the feature-to-module map become code ownership |
| Project synopsis | The stack shortlist, the 20-week plan, and the TravelPlanner evidence for constraint-first design |
| Use case diagram | The screen list and the API endpoint list |
| DFD Level 0 and Level 1 | Data stores D1 to D6 become table groups; every flow becomes an API input or output |
| Sequence diagram | The contract of `POST /trips/{id}/recommendations`, including the distance cache and the empty-shortlist branch |
| State transition diagram | The `trip.status` enum and the 20 legal transitions, enforced on the server |
| Phase 1 documentation | The worked example becomes the first golden test for the engine |

**Rules every pull request is reviewed against**

1. Hard constraints run first and are pure arithmetic: distance within the radius, cost within the budget, and a non-empty common date window.
2. The language model never produces a price, distance or availability figure. It writes text from a fact sheet, and its output is checked against that sheet before anyone sees it.
3. Ranking uses the group-fit score below, with α, β and γ stored as configuration, never as constants in code.
4. Every outbound call goes through the External Data Integration module, is cached, and falls back to curated data with a provenance label.
5. Every price shows a group total, a per-person figure and an estimate label (SRS 3.1.1).

```latex
\mathrm{GFS}(d) = \alpha \cdot \frac{1}{n}\sum_{i=1}^{n} s_i(d) + \beta \cdot \min_i s_i(d) - \gamma \cdot \sigma\big(s(d)\big)
```

**How to use this runbook.** Work the phases in order. Each phase lists an owner, a time box, numbered steps, a check that must pass, and the output it leaves in the repo. Agent prompts in Appendix A are written for whichever coding agent you use and follow the Context, Goal, Steps, Verification, If-Blocked format.

## Phase 0: Freeze the design baseline

One agreed copy of every design document goes into the repo, the MVP is fixed at R1 to R11, and five disagreements between the documents are settled in writing before anyone writes code.

**Owner:** Maulik · **When:** Thu 8 Oct · **Time box:** 2 hours

1. Collect the final files in one shared folder today; it moves into the repo as `docs/` in Phase 5.
   - `docs/baseline/`: SRS v1.1, project synopsis, MoSCoW prioritisation, SE description v2, feasibility report, Phase 1 documentation.
   - `docs/design/`: the use case `.drawio` and `.png`, plus `BonVoyage_Design_Lab.drawio` and `.pdf`.
2. Write `docs/baseline/README.md` listing each file with its version and date. Once the repo exists, tag that commit `design-baseline-v1`.
3. Fix the MVP as the eleven Must Have requirements, R1 to R11. Nothing else enters a sprint until every Must Have is done.
4. Settle the disagreements in the table below and record the answers in `docs/decisions/0000-baseline-reconciliation.md`.
5. Fill the three blank rows of synopsis Table 1 and confirm the final demo date. Every later phase is planned backwards from that date.

| # | Where the documents disagree | Proposed resolution |
| --- | --- | --- |
| C1 | SRS 3.2.1 makes a trip ready once two members have submitted; state diagram T3 waits for `pending = 0`; SRS 3.5 says members who never submit must not block the flow | Ready when everyone has submitted and at least two have. The organiser may also close submissions once two have; non-submitters are excluded and notified. Add this as transition T3b |
| C2 | Synopsis Table 3 puts filtering and ranking in Python with NumPy and scikit-learn | Both are arithmetic, so they live in a TypeScript package. Python returns only if phase P3 adds a learned ranking model |
| C3 | SE description v2 allows PostgreSQL or MongoDB | PostgreSQL only: SRS 3.4 and R11 require enforced referential integrity |
| C4 | SRS 2.2 says reminders are a must, but SRS 2.5 puts notifications in optional Phase 4 and no MoSCoW requirement covers them | Treat reminders as Should Have, after R12 to R16: in-app first, email second |
| C5 | SRS 2.5 and the synopsis use two different four-phase schemes | Schedule by the synopsis weeks, scope by MoSCoW; the sprint map at the end joins the two |

**Check:** every member replies "agreed" to the reconciliation note in the team channel, and the MVP list reads R1 to R11.

**Output:** `docs/baseline/`, `docs/design/`, `docs/decisions/0000-baseline-reconciliation.md`.

## Phase 1: Team, roles and working agreement

Each of the ten modules gets exactly one owner, and the team agrees how code moves from a branch to `master` before the first branch exists.

**Owner:** all four members · **When:** Thu 8 Oct · **Time box:** one 90-minute meeting

Proposed split for the four-person team in synopsis Table 1. Swap people freely, but keep one owner per module.

| Role | Person | Owns these modules | Also owns |
| --- | --- | --- | --- |
| Tech lead and planning engine | Maulik | Geospatial & Filtering; Recommendation Engine | Architecture, repo, CI, final review of `packages/engine` |
| Frontend lead | Kushagra | Web client screens for every module | UI kit, layout at 360 px, accessibility, end-to-end tests |
| Data and integrations lead | Manan | External Data Integration; Transport & Cost; Accommodation & Package | Destination catalogue dataset, API keys and quotas |
| AI and quality lead | Parth | AI Itinerary Generator; Notification; Trip & Feedback | Grounding validator, test plan, documentation |
| Shared backend pair | Maulik and Parth | User & Group Management; Preference Management | Authentication and the trip state machine |

**Working agreement** (pasted into `CONTRIBUTING.md` in Phase 5)

1. Sprints run one week, Thursday to Wednesday: planning on Thursday, review and retro on Wednesday.
2. Daily async standup in the team channel by 22:00: done, next, blocked.
3. `master` is always deployable. Work happens on `feat/<issue>-<slug>` or `fix/<issue>-<slug>` branches and is squash-merged.
4. Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
5. Every pull request links its issue, stays under about 400 changed lines, passes CI and is read through as a diff before merging (with one developer there is no second approval). UI changes include screenshots at 360 px and desktop widths.
6. Definition of Done: code and tests written, lint and type checks green, reviewed, merged, visible on the preview deployment, issue closed, traceability row updated.
7. Decisions are written to `docs/decisions/`, never left only in chat.

**Check:** the owners table has four real names, everyone is in the team channel and the shared folder, and nobody objects to the working agreement.

**Output:** the owners table (it becomes `CODEOWNERS` in Phase 5) and the working agreement text.

## Phase 2: Technical decisions (ADRs)

Ten decisions are made once, written as ADRs and not reopened mid-sprint. They keep the synopsis stack (React, TypeScript, Express, PostgreSQL), replace the shut-down Amadeus source with curated data, and leave Google Maps as the only account that needs billing.

**Owner:** Maulik drafts, the team reviews · **When:** 8 to 9 Oct · **Time box:** 3 hours

| ADR | Decision | Why |
| --- | --- | --- |
| 001 | TypeScript for web, API, engine and scripts | One toolchain and one set of shared types and validation schemas; the synopsis allows Express (C2) |
| 002 | pnpm workspace monorepo: `apps/web`, `apps/api`, `packages/engine`, `packages/integrations`, `packages/db`, `packages/shared` | The engine stays pure, with no I/O, so feasibility and scoring are unit-tested in isolation |
| 003 | Web: React and TypeScript on Vite, React Router, TanStack Query, Tailwind CSS | Synopsis Table 3; a 10-second poll on the trip dashboard meets the SRS 3.3 no-reload rule |
| 004 | API: Node.js 24 LTS and Express 5, REST and JSON under `/api` | SRS 3.1.4. Node 24 has security support until 30 April 2028, while Node 26 is still Upcoming LTS ([endoflife.date](https://endoflife.date/nodejs)) |
| 005 | PostgreSQL with Drizzle ORM and versioned SQL migrations; no PostGIS | SRS 3.4 needs referential integrity and cascades; a catalogue under 500 rows needs only a haversine function |
| 006 | Hotels, buses and trains come from the curated catalogue, with every figure labelled by its source | Amadeus announced that its [Self-Service APIs](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers) (SRS references \[8\] and \[9\]) would be decommissioned on 17 July 2026, with keys disabled; Booking.com Demand needs partner access (SRS reference \[10\]) |
| 007 | Distances from the Google Routes API (Compute Routes, Compute Route Matrix) and Geocoding, always cached | On the [India price list](https://developers.google.com/maps/billing-and-pricing/pricing-india), each of these SKUs includes 70,000 free calls a month |
| 008 | Language model behind an `LlmClient` interface: a Gemini adapter on the free tier with JSON-schema output | [Free-tier content is used to improve Google products](https://ai.google.dev/gemini-api/docs/pricing), so prompts carry destination facts only: no names, emails or personal budgets |
| 009 | Auth with Better Auth: email and password, sessions in Postgres | Salted hashes in our own database (SRS 3.4, R10) with no hand-written crypto |
| 010 | Public GitHub repo; one Vercel project serving the web app and the API under `/api`; Neon Postgres | See the notes below |

**Why ADR-010 looks this way**

- On GitHub Free, protected branches work only in public repositories ([GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).
- Vercel Hobby blocks deployments of collaborators' commits on private repositories, while public repositories are free to collaborate on ([Vercel Community](https://community.vercel.com/t/hobby-account-private-repo-collaborators-deployment-blocked/1030)).
- Express runs on Vercel as a single function with Fluid compute ([Vercel Docs](https://vercel.com/docs/frameworks/backend/express)). Serving it under `/api` on the web app's own domain keeps session cookies first-party on every preview.
- Neon Free needs no card and gives each project 1 GB and up to 10 branches ([Neon](https://neon.com/pricing)): `main` for the demo, `preview` for pull requests.
- Render, the synopsis alternative, spins free services down after 15 minutes, takes about a minute to wake them, and expires free Postgres after 30 days ([Render](https://render.com/docs/free)). A one-minute wake breaks the 3-second target.
- If the instructor requires private code, settle it before Day 2: branch protection then needs GitHub Pro or Team, and team deploys need Vercel Pro.
- Email (SRS 3.1.4) waits for reminders (C4). MVP invitations use a shareable link, which SRS 2.2 already allows.

1. Create one file per decision in `docs/decisions/` from the template below.
2. Fill Context in one paragraph, Decision in one sentence, and Consequences as what gets easier and what gets harder.
3. Merge all ten in one reviewed pull request with status Accepted. Changing one later takes a new ADR that supersedes it.

```markdown
# ADR-00N: <title>
Status: Accepted · Date: YYYY-MM-DD · Supersedes: none
## Context
## Decision
## Consequences
```

**Check:** ten ADR files are merged, and every one that rests on an outside fact links its source.

**Output:** `docs/decisions/ADR-001` to `ADR-010`.

## Phase 3: Accounts, access and secrets

Every account the project needs exists, every key is restricted to the APIs it uses and capped by a quota, and no secret ever reaches git.

**Owner:** Maulik (GitHub, Vercel, Neon) and Manan (Google Cloud, Gemini) · **When:** Fri 9 Oct · **Time box:** 3 hours

1. GitHub: create the free organisation `bonvoyage-bmu` and the public repository `bonvoyage` with a README. Invite all four members, enable Issues and Projects, and turn off the Wiki.
2. GitHub security: under Settings, Code security, turn on secret scanning and push protection.
3. Vercel: on Maulik's Hobby account, install the Vercel GitHub app for the organisation. The project itself is created in Phase 8.
4. Neon: create the project `bonvoyage` in the region nearest India that Neon lists, then add a `preview` branch beside `main`. Save both pooled connection strings.
5. Google Cloud: create the project `bonvoyage-maps`, link a billing account, and enable only the Routes API and the Geocoding API.
6. Create one API key restricted to those two APIs. Cap each API at 1,000 requests a day, which stays under the free monthly allowance, and add a ₹500 budget with alerts at 50, 90 and 100 per cent. The quota is the real cap; a budget only sends email.
7. Gemini: create a key in Google AI Studio on the free tier and note the exact model ID from the pricing page. Model names change often, so the ID lives in `GEMINI_MODEL`, never in code.
8. Secrets: keep every key in one shared password-manager entry owned by Manan. Keys never go into chat, commits or screenshots.

| Variable | Used by | Local `.env` | Vercel Preview | Vercel Production | CI |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | api, db scripts | Docker Postgres | Neon `preview` | Neon `main` | service container |
| `BETTER_AUTH_SECRET` | api | random 32 bytes | own value | own value | test value |
| `APP_URL` | api, web | `http://localhost:5173` | the deployment URL | the production URL | `http://localhost:5173` |
| `GOOGLE_MAPS_API_KEY` | integrations | dev key | dev key | production key | unset |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | integrations | dev key | dev key | production key | unset |
| `LIVE_APIS` | integrations | `off` | `on` | `on` | `off` |

With `LIVE_APIS=off`, the integration module answers from fixtures and the curated catalogue, so tests and local runs spend no quota.

**Check** (Git Bash, keys exported in the shell):

```bash
curl -s -X POST "https://routes.googleapis.com/directions/v2:computeRoutes" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H "X-Goog-FieldMask: routes.distanceMeters,routes.duration" \
  -d '{"origin":{"address":"Gurugram, Haryana"},"destination":{"address":"Rishikesh, Uttarakhand"},"travelMode":"DRIVE"}'

curl -s "https://generativelanguage.googleapis.com/v1beta/models/$GEMINI_MODEL:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Reply with the single word ok"}]}]}'

git log -p | grep -cE 'AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{20,}'
```

Pass when the first call returns `distanceMeters` and `duration`, the second returns text containing "ok", and the last command prints 0.

**Output:** `docs/accounts.md` listing each account and its owner (never the keys), and `.env.example` with every variable name.

## Phase 4: Local development environment

Every laptop runs the same toolchain, proved by six commands, before the scaffold lands. Steps are for Windows 11; macOS and Linux use the same tools through Homebrew or the distro's package manager.

**Owner:** each member on their own laptop · **When:** Fri 9 Oct · **Time box:** 90 minutes

1. Git: from PowerShell run `winget install --id Git.Git -e`, then run the Git settings block below in Git Bash.
2. SSH (optional; skip it if you sign in over HTTPS with the GitHub CLI in step 7): run `ssh-keygen -t ed25519 -C "you@example.com"`, add `~/.ssh/id_ed25519.pub` to GitHub under Settings, SSH and GPG keys, then run `ssh -T git@github.com`.
3. Node 24 through fnm: `winget install Schniz.fnm`. Add `eval "$(fnm env --use-on-cd --shell bash)"` to `~/.bashrc` and `fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression` to your PowerShell profile, then run `fnm install 24` and `fnm default 24`.
4. pnpm: `npm install -g pnpm`. The repo's `packageManager` field then pins one exact version for everyone.
5. Docker Desktop: run `wsl --install` in an administrator PowerShell and reboot, then `winget install Docker.DockerDesktop` and start it once with the WSL 2 engine.
6. Editor: VS Code with the ESLint, Prettier, EditorConfig, Tailwind CSS IntelliSense and Vitest extensions. Neovim works too: configure the `vtsls`, `eslint` and `tailwindcss` language servers, with Prettier as the formatter.
7. GitHub CLI: `winget install GitHub.cli`, then `gh auth login`.
8. API client: install Bruno. Its collections are plain files, so requests are versioned in the repo under `docs/api/`.

Git settings (step 1):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch master
git config --global core.autocrlf false
git config --global core.longpaths true
```

| Check command | Expected |
| --- | --- |
| `git --version` | any 2.x release |
| `node -v` | starts with `v24.` |
| `pnpm -v` | any version; the repo pins its own |
| `docker run --rm hello-world` | prints "Hello from Docker!" |
| `gh auth status` | logged in to github.com |
| `ssh -T git@github.com` | "You've successfully authenticated" (only if you set up SSH) |

**Output:** each member posts the six outputs in the team channel.

## Phase 5: Monorepo scaffold

One merged pull request creates the whole skeleton: both apps, the four packages, Docker Postgres, the lint, format, type-check and test commands, and a health check that proves the API reaches the database.

**Owner:** Maulik, using prompt A1 · **When:** Sat 10 Oct · **Time box:** half a day including review

```text
bonvoyage/
  apps/
    web/              React + Vite SPA; on Vercel it also hosts the /api function
    api/              Express 5: src/app.ts exports the app, src/server.ts listens locally
      src/modules/    one folder per SRS module (ten folders)
  packages/
    engine/           pure TypeScript: feasibility, group-fit score, fairness, trip state machine
    integrations/     External Data Integration: Routes, Gemini, catalogue fallback, cache
    db/               Drizzle schema, migrations, seed scripts, catalogue CSV files
    shared/           Zod schemas and types shared by web and api
  docs/               baseline, design, decisions, specs, spikes, api, traceability.md
  .github/            workflows, CODEOWNERS, pull request and issue templates, dependabot.yml
  docker-compose.yml  Postgres for local work and tests
  package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js
  .editorconfig  .gitattributes  .nvmrc  .env.example
```

The ten module folders are `users-groups`, `preferences`, `filtering`, `recommendation`, `transport-cost`, `packages`, `itinerary`, `trip-feedback`, `notifications` and `integration`. The `filtering` and `recommendation` folders stay thin: they load data, call `packages/engine` and save the result.

1. Clone the empty repo and run prompt A1 from Appendix A in your coding agent.
2. Review the diff against the tree above and reject anything extra: no Next.js, no Turborepo, no second UI kit.
3. Open the pull request `chore: scaffold monorepo`, read the diff, squash-merge, and tag the commit `design-baseline-v1` once `docs/` is in.
4. Every member clones fresh and runs the check below.

```bash
pnpm install
docker compose up -d db
pnpm db:migrate
pnpm dev                                   # web on :5173, api on :4000
curl -s http://localhost:5173/api/health   # {"status":"ok","db":"ok"} through the Vite proxy
pnpm lint && pnpm typecheck && pnpm test
```

**Output:** the scaffold on `master`, a `README.md` with these commands, `CONTRIBUTING.md` holding the working agreement, and `CODEOWNERS` built from the Phase 1 owners table.

## Phase 6: Database, trip state machine and seed catalogue

The schema implements SRS Table 10 and data stores D1 to D6, `trip.status` accepts only the 21 legal transitions, and a verified catalogue of about 40 destinations lets the whole planning flow run with no live API.

**Owner:** Maulik and Parth (schema and state machine, prompts A2 and A3); Manan (catalogue data) · **When:** 10 to 11 Oct; catalogue complete by 18 Oct · **Time box:** two days, in parallel

| Store | Tables | Rules |
| --- | --- | --- |
| D1 User Accounts | Better Auth's `user`, `session`, `account`, `verification`; `user` gains `home_city`, `home_lat`, `home_lng` | Salted password hashes only (SRS 3.4) |
| D2 Trips & Memberships | `trip`, `trip_member`, `invitation` | `trip.status` enum; positive duration, budget and radius; deleting a trip cascades to members, preferences, packages and itineraries |
| D3 Preference Profiles | `preference`, `past_trip` | One preference per member per trip; budget minimum not above maximum; start date not after end date; rating 1 to 5 |
| D4 Destination Catalogue | `destination`, `poi`, `fare_fallback` | Every number carries `source_url` and `collected_on`; editable by the administrator without a release |
| Recommendation (sequence diagram) | `recommendation_run`, `recommendation_item`, `distance_cache` | α, β and γ stored per run; the empty-shortlist diagnostic stored as JSON; cache rows expire |
| D5 Packages & Cost Items | `package`, `cost_item`, `package_decision` | Cost categories onward, return, stay, food, activities, local; provenance live, cached, curated or estimated (R14) |
| D6 Itineraries | `itinerary`, `itinerary_item`, `itinerary_decision` | A new version per regeneration; a `verified` flag on every item (SRS Table 9) |
| Notifications (C4) | `notification` | Created now so later features add no migration to other tables |

Money is stored as whole rupees, distances in kilometres and durations in minutes. Trip status values are `draft`, `collecting_preferences`, `ready_for_recommendation`, `shortlisted`, `packages_proposed`, `package_selected`, `itinerary_proposed`, `finalised`, `in_progress`, `completed` and `cancelled`; Appendix B lists every transition.

| Catalogue file | Columns |
| --- | --- |
| `destinations.csv` | slug, name, state, lat, lng, types, best\_months, stay\_budget\_inr, stay\_mid\_inr, stay\_premium\_inr, food\_per\_day\_inr, local\_per\_day\_inr, source\_url, collected\_on |
| `pois.csv` | destination\_slug, poi\_id, name, category, typical\_minutes, open\_time, close\_time, closed\_days, entry\_fee\_inr, lat, lng, source\_url, collected\_on |
| `fares.csv` | origin\_hub, destination\_slug, mode (bus, train, car), fare\_per\_person\_inr, duration\_minutes, distance\_km, source\_url, collected\_on |

Car costs follow a rule (distance × fuel price ÷ mileage, plus tolls), so `config/cost-rules.json` holds the fuel price, mileage and toll rate, each with its source and date.

**Catalogue rules**

1. Scope: about 40 destinations reachable by road or rail within 800 km of Gurugram, at least 6 POIs each, and fares from the hubs groups actually leave from (start with Delhi and Gurugram).
2. Cover every destination type in the preference vocabulary at least twice where geography allows. No beach lies in range, so a beach-only group should receive the empty-shortlist diagnostic.
3. An AI assistant may draft rows, but a person checks every number against its source page before commit. The catalogue is grounding data, so one unchecked number breaks rule 2 of this runbook.
4. `pnpm catalogue:check` rejects missing fields, coordinates outside India, stay tiers out of order, and opening hours that close before they open.

**Steps**

1. Maulik writes `docs/specs/scoring.md` before any engine code: the member score sᵢ(d) on a 0 to 1 scale, the conflict rules, and the diagnostic format. A starting proposal is below.
2. Re-express the Phase 1 worked example (three members, a three-day common window) with Indian catalogue rows. Work out the feasible set and ranking by hand and commit them as `packages/engine/test/golden.test.ts`, skipped until its Sprint 4 issue un-skips it.
3. Run prompt A2 (schema, migrations, seed) and prompt A3 (state machine).
4. Manan fills the three CSV files and runs `pnpm catalogue:check`.
5. Seed the local database and the Neon `preview` branch.

```latex
s_i(d) = 0.5\,J(T_i, T_d) + 0.3\,J(A_i, A_d) + 0.2\,c_i(d), \qquad J(X, Y) = \frac{|X \cap Y|}{|X \cup Y|}
```

Here T is a set of destination types, A a set of activities, and c the climate match (0 or 1). Past trips rated 4 or 5 add their destination's types to the member's set at half weight.

**Check**

```bash
pnpm db:reset && pnpm db:seed           # prints a row count per table
pnpm catalogue:check                    # 0 errors
pnpm --filter @bonvoyage/engine test    # 21 legal transitions pass, illegal events are rejected
```

Then, in Drizzle Studio (`pnpm db:studio`), delete a seeded trip and confirm its members, preferences, packages and itineraries are gone.

**Output:** the schema and first migration, the seed, three catalogue files and `cost-rules.json`, `trip-state.ts` with its tests, the scoring spec, and the skipped golden test.

## Phase 7: Integration spikes

Four time-boxed spikes answer the questions that could still change the design: how fast distances come back, whether a free-tier model can be held to the facts, whether any live fare source is usable, and whether sessions survive on preview URLs.

**For the 10 November deadline, run only S2 and S4.** S1 waits until a routing key exists, since distances use the straight-line estimate until then. S3 is skipped because curated data is already the decision.

**When:** Sun 11 Oct · **Rule:** each spike ends with a one-page note in `docs/spikes/` (question, method, numbers, decision). Its code is throwaway unless the note says otherwise.

| Spike | Owner | Time box | Question | Done when |
| --- | --- | --- | --- | --- |
| S1 Distance matrix and cache | Manan | 1 day | Can one Route Matrix call from Gurugram to every catalogue destination finish inside the 10-second shortlist budget? | Latency and element count recorded; the second run is served from `distance_cache` with zero API calls |
| S2 Grounded itinerary | Parth, prompt A6 | 1.5 days | Does a free-tier Gemini model return valid JSON built only from fact-sheet places and numbers? | 20 runs scored by the validator; an injected fake price is caught; median latency compared with the 30-second target |
| S3 Live fares and hotels | Manan | half a day | Is any free source of live bus, train or hotel prices permitted for this use? | Each candidate's terms checked and the decision recorded; curated data is expected to stay primary |
| S4 Sessions on previews | Maulik | 2 hours | Does a Better Auth session survive on a Vercel preview through `/api` in mobile browsers? | Sign-up, sign-in and sign-out work in Chrome and Safari on a phone |

The S2 validator rules become the acceptance tests of the AI Itinerary Generator:

1. Every place ID in the output exists in the fact sheet.
2. Every number in the text (price, distance, time) appears in the fact sheet; otherwise the item is marked unverified (SRS Table 9).
3. The day count equals nights plus one, and the first and last days hold the onward and return journeys.
4. No activity falls outside its place's opening hours, and no day exceeds the configured limit (start at 10 hours).

**Check:** four notes are merged, and a spike that changes an ADR produces a superseding ADR the same day.

**Output:** `docs/spikes/S1` to `S4`.

## Phase 8: CI/CD and quality gates

Every pull request is linted, type-checked, tested against a real Postgres and built before review, and every merge to `master` deploys to production on its own.

**Owner:** Maulik, using prompt A4 · **When:** Sat 10 Oct · **Time box:** half a day

1. Run prompt A4. It adds `.github/workflows/ci.yml` (frozen-lockfile install, lint, type-check, tests against a Postgres service container, build), `dependabot.yml` and the issue templates.
2. Protect `master` under Settings, Branches: require a pull request with 0 approvals (GitHub does not let you approve your own pull request) and the `ci` check, block force pushes, allow squash merging only, and delete branches after merge.
3. Create the Vercel project from the repo with root directory `apps/web`. Add the Phase 3 variables to Preview and Production, pointing at Neon `preview` and `main` respectively, and set the function region nearest your Neon region.
4. Migrations: the author applies a new migration to Neon `preview` before review; Maulik applies it to Neon `main` after merge. A merged migration is never edited; a fix is a new migration.
5. Optional: add Sentry to the web app and the API, with alerts sent to the team channel.

**Check**

1. A test pull request with a deliberate lint error turns CI red and cannot be merged.
2. After the fix, CI is green, the preview URL loads, and `/api/health` on that preview returns `{"status":"ok","db":"ok"}` from Neon `preview`.
3. After merge, the production URL returns the same from Neon `main`.

**Output:** a green CI badge in the README and the production URL in `docs/accounts.md`.

## Phase 9: Backlog, board and traceability

The 18 in-scope requirements (R1 to R18) become epics on one GitHub Project board, each traceable to its SRS section, use case, DFD process, module and tests, and Sprint 1 is planned before the gate.

**Owner:** Parth with Maulik, using prompt A5; Kushagra for wireframes · **When:** Sun 11 Oct · **Time box:** 3 hours, plus wireframes

1. Create the GitHub Project `BonVoyage` with fields Status (Backlog, Ready, In progress, In review, Done), Priority (Must, Should, Could), Module (the ten), Requirement (R1 to R18), Sprint (one-week iterations from 12 October) and Estimate (1, 2, 3, 5, 8).
2. Create the labels `type:feature`, `type:bug`, `type:chore`, `type:docs`, `type:spike` and `type:test`.
3. Run prompt A5 to create one epic per requirement from Appendix B, with acceptance criteria copied from SRS Tables 5 to 9. R19 and R20 get no issues; the MoSCoW document already records them as Won't Have.
4. Copy the Appendix B requirements table into `docs/traceability.md`. Every new issue and test adds its ID to the matching row.
5. Kushagra sketches the five SRS 3.1.1 screens (trip dashboard, preference form, ranked shortlist, package comparison, itinerary view) at 360 px and desktop widths, and the team reviews them.
6. Plan Sprint 1 from the table below: estimate each issue and give it one owner.

Sprint 1 goal: an organiser signs up, creates a trip with origin, duration, budget and radius, and invites members by link; members join and submit a preference profile; the dashboard shows who has submitted.

| # | Sprint 1 issue | Requirement | Owner |
| --- | --- | --- | --- |
| 1 | Sign up, sign in, sign out, session middleware | R1, R10 | Maulik |
| 2 | Create a trip with origin, duration, budget and radius (T1) | R2, R9 | Parth |
| 3 | Shareable invitation link, join flow and roster (T2) | R2 | Parth |
| 4 | Preference form; a submission completes T3 | R3 | Kushagra |
| 5 | Trip dashboard with submission status and a 10-second poll | R3 | Kushagra |
| 6 | Access rules: a profile is readable by its owner only; the group sees aggregates | R10 | Maulik |
| 7 | Catalogue CSV import and an administrator re-import command | R11 | Manan |
| 8 | API tests for issues 1 to 7 against Docker Postgres | R11 | Parth |

**Check:** every in-scope requirement has an epic, the wireframes are reviewed, and every Sprint 1 issue is estimated, assigned and in Ready.

**Output:** the board, labels and epics, `docs/traceability.md`, and the wireframes in `docs/design/wireframes/`.

## Phase 10: Exit gate (Definition of Ready)

Sprint 1 starts on Oct 12, 2026 only if every box below is ticked at the gate review on Oct 11, 2026. A box that cannot be ticked becomes the first Sprint 1 issue, ahead of any feature.

**Owner:** all four members · **When:** Sun 11 Oct, evening · **Time box:** 45 minutes

- [ ] Baseline documents and the reconciliation note are in `docs/` and tagged `design-baseline-v1`.
- [ ] ADR-001 to ADR-010 are merged with status Accepted.
- [ ] Every member has cloned the repo, run `pnpm dev` and seen `/api/health` return ok.
- [ ] CI is green on `master`, and `master` accepts changes only through pull requests that pass CI.
- [ ] The preview and production deployments both answer `/api/health` from Neon.
- [ ] Migrations and seed run cleanly on an empty database, and the catalogue check reports 0 errors.
- [ ] The trip state machine passes all 21 legal transitions and rejects illegal events.
- [ ] The scoring spec and the golden test are committed.
- [ ] Spike notes S1 to S4 are merged, and every changed decision has a superseding ADR.
- [ ] Every key is restricted and quota-capped, and git history contains no key.
- [ ] Wireframes for the five core screens are reviewed.
- [ ] Sprint 1 issues are estimated, assigned and in Ready.

## After pre-dev: the sprint map

Four one-week feature sprints run from 12 October to 7 November 2026, followed by a three-day buffer: the group recommendation flow must work at gate G1, the MVP (R1 to R11) is accepted at G2, and G3 is submission on 10 November.

&#91;embedded content: sprint map · 3 phases, 14 sprints, 3 gates\]

The next phase starts only when its gate holds. Features freeze on 8 November; after that, only fixes, demo data and the report.

| Sprint | Dates | Goal | Requirements |
| --- | --- | --- | --- |
| S0 | 8 to 11 Oct | Tools, accounts, scaffold, CI and deploy, schema, state machine, Gemini spike | R11 |
| S1 | 12 to 18 Oct | Accounts, trips, link invitations, preference form, dashboard, access rules; catalogue complete | R1, R2, R3, R9, R10 |
| S2 | 19 to 25 Oct | Group profile and conflicts, feasibility filter with distance estimate, group-fit ranking, reasons, diagnostic | R4, R5, R6, R7, R16 |
| S3 | 26 Oct to 1 Nov | Transport comparison, three or more costed packages, provenance labels, package decisions | R8, R14 |
| S4 | 2 to 7 Nov | Grounded itinerary and validator; accept, modify or reject; trip history | R12, R13 |
| Buffer | 8 to 10 Nov | Feature freeze; fixes, response-time check, demo data, report, submission | R15 |

Out of scope for 10 November: R17 fairness rounds, R18 voting, reminders (C4), email and the user study. R16 is met by the integrations module with the straight-line distance estimate; live routing (Google or openrouteservice) is added only if a key is ready by S2. If S3 slips, cut R13's modify step first, then R12. A Must Have is never cut.

## Appendix A: Agent prompts

Each prompt is self-contained: paste it into your coding agent at the repo root, review the diff, and open a pull request. They assume the Phase 2 decisions; if the agent proposes a different library, it must say why in the pull request.

**A1. Scaffold the monorepo (Phase 5)**

```text
CONTEXT
Repo: bonvoyage (empty except docs/). BonVoyage is a group trip planner for small Indian groups (2 to 8 members, road or rail, prices in INR). Decisions are fixed in docs/decisions (ADR-001 to ADR-010): TypeScript everywhere, a pnpm workspace, a React + Vite SPA, an Express 5 API mounted under /api, PostgreSQL with Drizzle, Node 24 LTS. Developers use Windows 11, so every script must run in Git Bash and PowerShell.

GOAL
A monorepo skeleton where a fresh clone installs, starts Postgres, migrates, runs web and api together, and passes lint, type-check and tests.

STEPS
1. Root files: package.json (private; packageManager set to the exact output of `pnpm -v`; engines node >=24 <25), pnpm-workspace.yaml (apps/*, packages/*), tsconfig.base.json (strict, noUncheckedIndexedAccess, target ES2023, moduleResolution bundler), .nvmrc containing 24, .editorconfig, .gitattributes ('* text=auto eol=lf'), .gitignore, and .env.example with DATABASE_URL, BETTER_AUTH_SECRET, APP_URL, GOOGLE_MAPS_API_KEY, GEMINI_API_KEY, GEMINI_MODEL and LIVE_APIS=off.
2. Tooling: ESLint flat config with typescript-eslint and the React hooks plugin, Prettier, and Vitest with one config per package. Root scripts: dev (web and api in parallel), build, lint, typecheck, test, format, db:migrate, db:seed, db:reset, db:studio.
3. docker-compose.yml: service db from the official postgres image, pinned to the same major version as the team's Neon project (ask if unknown), port 5432, a named volume and a pg_isready healthcheck; service db-test on port 5433 for tests.
4. packages/shared: a zod schema HealthResponse and its exported type.
5. packages/engine: src/geo.ts with haversineKm(a, b) and a test: Delhi (28.6139, 77.2090) to Mumbai (19.0760, 72.8777) is about 1148 km, asserted within 1 per cent.
6. packages/integrations: interfaces only (RoutingProvider, LlmClient, CatalogueSource); no implementations yet.
7. packages/db: Drizzle config, src/client.ts creating a pooled client from DATABASE_URL, an empty schema index, and migrate and seed scripts wired to the root scripts.
8. apps/api: src/app.ts builds and exports the Express app with every route under /api (helmet, 100 kB JSON limit, request id, one error handler returning {error:{code,message}}); src/server.ts listens on PORT or 4000. GET /api/health runs 'select 1' and returns {"status":"ok","db":"ok"}, or 503. Add src/modules/ with ten folders (users-groups, preferences, filtering, recommendation, transport-cost, packages, itinerary, trip-feedback, notifications, integration), each with a router stub.
9. apps/web: React + TypeScript on Vite with React Router, TanStack Query and Tailwind CSS. The Vite dev server proxies /api to http://localhost:4000. The home page shows 'BonVoyage' and the live /api/health result, and works at 360 px width.
10. Vercel: apps/web/api/[...path].ts imports the Express app and serves every /api/* request on the same origin; apps/web/vercel.json adds the SPA fallback for every non-/api path.
11. Governance: README.md (setup commands), CONTRIBUTING.md (paste the Phase 1 working agreement), CODEOWNERS (paste the Phase 1 owners table) and .github/pull_request_template.md (issue link, change summary, screenshots at 360 px and desktop, checklist).
Add nothing that is not listed: no Next.js, no Turborepo, no second UI kit.

VERIFICATION
On a clean clone in Git Bash: pnpm install; docker compose up -d db; pnpm db:migrate; pnpm dev. Then http://localhost:5173 shows 'BonVoyage' with health ok, curl http://localhost:5173/api/health returns {"status":"ok","db":"ok"}, and pnpm lint, pnpm typecheck and pnpm test all exit 0. Paste the outputs into the pull request.

IF BLOCKED
If a library's current major differs from what this prompt implies, use the current stable one and note it in the pull request. If Vercel does not pick up the catch-all file name, use apps/web/api/index.ts with a rewrite from /api/(.*) to /api. If the function cannot import workspace TypeScript, build the packages to dist with tsup and point their exports at dist. Never loosen TypeScript strictness to get a green build.
```

**A2. Schema, migrations and seed (Phase 6)**

```text
CONTEXT
BonVoyage monorepo: pnpm, TypeScript, Drizzle, PostgreSQL. The logical model is SRS v1.1 Table 10 (USER, TRIP, TRIP_MEMBER, PREFERENCE, PAST_TRIP, DESTINATION, PACKAGE, COST_ITEM, ITINERARY, ITINERARY_ITEM) plus data stores D1 to D6 of the Level 1 DFD; the runbook's Phase 6 table maps each store to tables. Rules: referential integrity everywhere; deleting a trip cascades to members, preferences, packages and itineraries; credentials only as salted hashes (Better Auth owns those tables); money as integer rupees; every catalogue and cost figure carries its provenance.

GOAL
The full schema, the first migration and an idempotent seed in packages/db.

STEPS
1. Install Better Auth with its Drizzle adapter, generate its tables, and extend user with home_city, home_lat and home_lng.
2. Enums: trip_status (draft, collecting_preferences, ready_for_recommendation, shortlisted, packages_proposed, package_selected, itinerary_proposed, finalised, in_progress, completed, cancelled); member_role (organiser, member); invitation_status; transport_mode (bus, train, car); cost_category (onward, return, stay, food, activities, local); provenance (live, cached, curated, estimated); decision (accept, modify, reject).
3. Tables: trip (title, organiser_id, origin_name, origin_lat, origin_lng, duration_nights, budget_total_inr, radius_km, status, timestamps); trip_member (unique trip_id and user_id, role, submitted_at); invitation (unique token, expires_at, status); preference (one per trip_member: destination_types text[], activities text[], climate, travel_style, budget_min_inr, budget_max_inr, date_start, date_end); past_trip (user_id, destination_slug or name, visited_on, rating); destination, poi and fare_fallback from the catalogue columns in the runbook; distance_cache (origin_cell, destination_id, provider, distance_km, duration_min, fetched_at, expires_at; unique on origin_cell, destination_id, provider); recommendation_run (trip_id, round, alpha, beta, gamma, feasible_count, diagnostic jsonb); recommendation_item (run_id, destination_id, gfs, mean, min, sd, reasons jsonb); package; cost_item (package_id, category, amount_inr, provenance, source_ref); package_decision; itinerary (package_id, version, generated_at, status); itinerary_item (itinerary_id, day_number, start_time, end_time, poi_id nullable, kind, note, verified); itinerary_decision; notification (user_id, type, payload jsonb, read_at).
4. CHECK constraints: duration, budget and radius above 0; budget_min_inr <= budget_max_inr; date_start <= date_end; rating between 1 and 5. ON DELETE CASCADE from trip downwards. An index on every foreign key and on trip.status.
5. Generate the migration with drizzle-kit and commit the SQL. Never edit a migration after merge.
6. Seed: four demo users (password from env), one trip with three members in collecting_preferences, and the catalogue imported from packages/db/catalogue/*.csv with an upsert on slug, so the seed can run repeatedly.
7. packages/db/scripts/catalogue-check.ts implements the runbook's catalogue rules and runs as pnpm catalogue:check.

VERIFICATION
pnpm db:reset && pnpm db:seed prints a row count per table; pnpm catalogue:check reports 0 errors; a test deletes a seeded trip and finds no rows left for it in trip_member, preference, package and itinerary; inserting budget_min_inr above budget_max_inr fails with a CHECK violation.

IF BLOCKED
If Better Auth's generated table names differ, keep its names and adapt the foreign keys. If a CHECK cannot be written in Drizzle's builder, put it in the migration SQL with a comment. Ask before adding a table that is not listed.
```

**A3. Trip state machine (Phase 6)**

```text
CONTEXT
BonVoyage's Trip lifecycle is the state transition diagram in docs/design (Design Lab, page 4.4): 11 states, a Planning composite state, a choice node and transitions T1 to T20, plus T3b from docs/decisions/0000-baseline-reconciliation.md. The full table is in the runbook, Appendix B. The server must reject any event that is illegal in the current state.

GOAL
A pure, fully tested state machine in packages/engine/src/trip-state.ts that the API uses for every status change.

STEPS
1. Define TripStatus (the 11 trip_status values) and TripEvent: createTrip, inviteMembers, preferenceSubmitted, closeSubmissions, conflictDetected, preferenceRevised, recommendationRequested, destinationSelected, packageModified, packageRejected, packageAccepted, generateItinerary, itineraryModified, itineraryRejected, itineraryAccepted, cancelTrip, tripStarted, tripEnded. tripStarted and tripEnded are the time events at(startDate) and at(endDate), sent by a daily job.
2. Encode the transitions as one readonly table of rows {id, from, event, guard?, to, actions[]}, one row per T-number, keeping the T-number as id. Guards read a context {pendingCount, submittedCount, feasibleCount, alternativesLeft, now, startDate}.
3. Export nextState(status, event, ctx) returning {ok: true, to, actions} or {ok: false, reason}. Model the choice after recommendationRequested as two rows: feasibleCount >= 3 goes to shortlisted; otherwise back to collecting_preferences with the diagnostic action.
4. Internal transitions return ok with an unchanged status: preferenceSubmitted with pendingCount > 0, packageModified, packageRejected with alternativesLeft, and itineraryModified.
5. Composite rule: cancelTrip is legal from every Planning substate (draft to itinerary_proposed), and from finalised only when now < startDate.
6. Vitest: one test per row; a table-driven test proving every (status, event) pair outside the table is rejected; both branches of the choice; T3b requires submittedCount >= 2.
7. In apps/api, add transitionTrip(tripId, event, ctx): load the trip, call nextState, then persist the status and run the actions in one transaction; on rejection return 409 with the reason.

VERIFICATION
pnpm --filter @bonvoyage/engine test passes with 100 per cent branch coverage of trip-state.ts, and an API test shows that accepting a package on a trip in collecting_preferences returns 409.

IF BLOCKED
If the diagram and Appendix B disagree, follow Appendix B and list the difference in the pull request instead of guessing.
```

**A4. CI, Vercel and repo hygiene (Phase 8)**

```text
CONTEXT
BonVoyage monorepo on a public GitHub repo, deployed as one Vercel project rooted at apps/web that serves the SPA and the Express API under /api. Postgres is Neon in deployments (branch main for production, preview for previews) and Docker locally. Node 24, pnpm.

GOAL
A required ci check on every pull request; master deploys to production; previews use the Neon preview branch.

STEPS
1. .github/workflows/ci.yml with one job named ci, on pull_request and on push to master: actions/checkout, pnpm/action-setup, actions/setup-node with node-version-file .nvmrc and the pnpm cache, pnpm install --frozen-lockfile, pnpm lint, pnpm typecheck, pnpm test against a postgres service container (same major as docker-compose) with DATABASE_URL pointing at it and LIVE_APIS=off, then pnpm build. Cancel superseded runs; time out after 15 minutes.
2. .github/dependabot.yml: npm at the root weekly, with minor and patch updates grouped, and github-actions weekly.
3. Issue templates: feature (requirement ID, module, acceptance criteria), bug (steps, expected, actual), spike (question, time box, decision).
4. apps/web/vercel.json: a build command that builds the workspace packages and then the web app, the SPA fallback for non-/api paths, and the function region nearest the Neon project.
5. packages/db: a db:migrate:deploy script that refuses to run unless the DATABASE_URL host is on an allow-list, for applying migrations to Neon from a laptop.
6. README: CI badge, setup, a scripts table and deployment notes.

VERIFICATION
A pull request with a deliberate lint error fails the ci check. After the fix, ci passes, the Vercel preview loads, and /api/health on the preview returns {"status":"ok","db":"ok"}. After merge, production returns the same.

IF BLOCKED
If the Vercel build cannot resolve workspace packages, build them first with pnpm -r --filter './packages/*' build. If session cookies fail on preview URLs, stop and report: do not switch to tokens in localStorage without a new ADR.
```

**A5. Backlog from the requirements (Phase 9)**

```text
CONTEXT
BonVoyage has 20 MoSCoW requirements, listed in the runbook's Appendix B: R1 to R18 are in scope, R19 and R20 are Won't Have. Acceptance criteria come from SRS v1.1 Tables 5 to 9. The GitHub Project 'BonVoyage' exists with the fields Status, Priority, Module, Requirement, Sprint and Estimate.

GOAL
One epic issue per in-scope requirement, labelled and on the board, plus the eight Sprint 1 issues.

STEPS
1. Write scripts/backlog/requirements.csv (id, title, type, priority, module, srs_ref, acceptance) from Appendix B, with acceptance criteria separated by semicolons.
2. Write scripts/backlog/create-issues.sh using the gh CLI: create any missing labels; create each issue titled like '[R5] Eliminate infeasible destinations before ranking' with the requirement text, its SRS reference and the acceptance criteria as a checklist; add it to the project with gh project item-add and set Priority, Module and Requirement with gh project item-edit.
3. Make the script idempotent: skip any requirement whose '[Rn]' issue already exists.
4. Create the eight Sprint 1 issues from the runbook's Phase 9 table as sub-issues of their epics, with Sprint set to Sprint 1.

VERIFICATION
gh issue list --label type:feature --limit 50 shows 18 epics and 8 Sprint 1 issues; a second run of the script creates nothing; every item on the board has Priority and Module set.

IF BLOCKED
If gh project item-edit needs field or option IDs, read them first with gh project field-list --format json. If sub-issues are unavailable, link the epic in each child issue's body instead.
```

**A6. Grounded itinerary spike and validator (Phase 7, S2)**

```text
CONTEXT
BonVoyage's AI Itinerary Generator only composes and explains; it never invents a price, distance, time or place (SRS 2.1 and Table 9). Facts come from the catalogue and the package's cost breakdown. The model is reached through the LlmClient interface in packages/integrations with a Gemini free-tier adapter. Free-tier content may be used by Google to improve its products, so prompts must contain no names, emails or personal budgets.

GOAL
Spike S2: measure whether a free-tier Gemini model returns a valid day-wise itinerary built only from a fact sheet, and build the validator that catches any departure from it.

STEPS
1. Create packages/integrations/spikes/itinerary/fact-sheet.json for one catalogue destination: dates and nights, onward and return legs (mode, depart, arrive, cost per person), the stay, 6 to 8 POIs (id, name, category, typical minutes, opening and closing times, entry fee) and the package total.
2. Define the output as a zod schema, also exported as JSON Schema: {days: [{day, items: [{start, end, kind: travel, stay, activity, meal or free, poiId?, note}]}], summary, reasons: [string]}.
3. Implement GeminiLlmClient.generateStructured(schema, prompt) with Google's official GenAI SDK for JavaScript, the model ID from GEMINI_MODEL, temperature 0.3 and structured JSON output.
4. Implement validateItinerary(output, facts): every poiId exists in facts; every number in note, summary and reasons appears in facts, else that item is flagged unverified; the day count equals nights + 1; the first and last days contain the onward and return legs; no activity falls outside its POI's hours; no day exceeds MAX_DAY_HOURS (default 10).
5. Run 20 generations, then one run with a fake price injected into the output, and write docs/spikes/S2-grounded-itinerary.md: pass rate, failure types, median and p95 latency, tokens per run, and a recommendation.

VERIFICATION
The injected fake price is flagged, the note reports all five measures, and no logged prompt contains personal data.

IF BLOCKED
If the free tier rate-limits you, add a delay between runs and record the limit you hit. If structured output fails repeatedly, record it, retry once with the schema embedded in the prompt, and say so in the note.
```

## Appendix B: Reference tables

These three tables are the contract between the documents and the code: every requirement with its trace and sprint, every Trip transition, and the first API surface. Environment variables are listed in Phase 3.

**B1. Requirements and traceability** (MoSCoW document, Table 1)

| Req | Requirement | Priority | Module | SRS | Use case and DFD process | Sprint |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Register, authenticate, keep a secure session | Must | User & Group Management | 2.2 | Manage Trip Group, 1.0 | S1 |
| R2 | Create a trip, invite members, manage the roster | Must | User & Group Management | Table 5 | Manage Trip Group, 1.0 | S1 |
| R3 | Structured preference and availability form | Must | Preference Management | Table 6 | Submit Preference Profile, 2.0 | S1 |
| R4 | Group profile, common window, conflict report | Must | Preference Management | Table 6 | Aggregate Group Preferences, 3.0 | S2 |
| R5 | Eliminate destinations over budget, duration or radius | Must | Geospatial & Filtering | Table 7 | Filter by Hard Constraints, 4.0 | S2 |
| R6 | Group-fit score and ranked shortlist | Must | Recommendation Engine | Table 7 | Rank by Group-Fit Score, 4.0 | S2 |
| R7 | Preferences each recommendation meets and misses | Must | Recommendation Engine | Table 7, 3.5 | Recommend Destinations, 4.0 | S2 |
| R8 | Several packages with itemised group and per-person costs | Must | Transport & Cost; Accommodation & Package | Table 8 | Generate Trip Packages, 5.0 | S3 |
| R9 | Organiser sets origin, duration, budget and radius | Must | User & Group Management | Table 5 | Manage Trip Group, 1.0 | S1 |
| R10 | Preference privacy and salted credential hashes | Must | User & Group Management; Preference Management | 3.4, 3.5 | D1 and D3 | S1 |
| R11 | Relational persistence with referential integrity | Must | all modules | 3.4 | D1 to D6 | from Sprint 0 |
| R12 | Grounded day-wise itinerary | Should | AI Itinerary Generator | Table 9 | Generate Itinerary, 6.0 | S4 |
| R13 | Accept, modify or reject generated output | Should | Trip & Feedback | 2.2, Table 9 | Review & Decide on Itinerary, 7.0 | S4 |
| R14 | Cached or curated fallback, labelled by provenance | Should | External Data Integration | 3.5, Table 8 | 5.0 and D4 | S3 |
| R15 | Screens within 3 s, shortlist within 10 s | Should | all modules | 3.3 | none | Buffer |
| R16 | One mediating module with caching and quota control | Should | External Data Integration | 3.1.3 | 4.0, 5.0 and 6.0 | S2 |
| R17 | Fairness across recommendation rounds | Could | Recommendation Engine | none | Recommend Destinations | after 10 Nov |
| R18 | Voting on the shortlist | Could | Trip & Feedback | 2.5 | none yet | after 10 Nov |
| R19 | Online payment and booking | Won't | none | 1.2 | none | none |
| R20 | Nationwide real-time inventory | Won't | none | 2.4 | none | none |

**B2. Trip transitions** (state transition diagram, plus T3b from C1)

| # | From | Event \[guard\] / action | To |
| --- | --- | --- | --- |
| T1 | initial | createTrip / assignOrganiser | Draft |
| T2 | Draft | inviteMembers / sendInvitations | Collecting Preferences |
| T3 | Collecting Preferences | preferenceSubmitted \[pending = 0 and submitted >= 2\] | Ready for Recommendation |
| T3b | Collecting Preferences | closeSubmissions \[submitted >= 2\] / excludeNonSubmitters, notifyMembers | Ready for Recommendation |
| T4 | Ready for Recommendation | conflictDetected / reportConflict | Collecting Preferences |
| T5 | Ready for Recommendation | preferenceRevised (self-transition: re-entry recomputes the group profile) | Ready for Recommendation |
| T6 | Ready for Recommendation | recommendationRequested / filterByHardConstraints | choice |
| T7 | choice | \[feasible >= 3\] / rankByGroupFit | Shortlisted |
| T8 | choice | \[else\] / showEmptyShortlistDiagnostic | Collecting Preferences |
| T9 | Shortlisted | destinationSelected | Packages Proposed |
| T10 | Packages Proposed | packageRejected \[no alternative left\] | Shortlisted |
| T11 | Packages Proposed | packageAccepted | Package Selected |
| T12 | Package Selected | generateItinerary | Itinerary Proposed |
| T13 | Itinerary Proposed | itineraryRejected | Package Selected |
| T14 | Itinerary Proposed | itineraryAccepted | Finalised |
| T15 | any Planning substate | cancelTrip | Cancelled |
| T16 | Finalised | cancelTrip \[now < startDate\] | Cancelled |
| T17 | Finalised | at(startDate) | In Progress |
| T18 | In Progress | at(endDate) / requestRatings | Completed |
| T19 | Completed | completion | final state |
| T20 | Cancelled | completion | final state |

Internal transitions keep the state unchanged: preferenceSubmitted \[pending > 0\] / updateProgress; packageModified / recomputeCost; packageRejected \[alternatives left\] / hidePackage; itineraryModified / revalidate.

**B3. API surface, version 0** (use case diagram and sequence diagram)

| Method and path | Use case | Transitions |
| --- | --- | --- |
| `POST /api/auth/*` | Register, sign in, sign out (Better Auth) | none |
| `POST /api/trips` | Create a trip | T1 |
| `PATCH /api/trips/:id` | Edit draft parameters | none |
| `POST /api/trips/:id/invitations` | Invite members by link | T2 |
| `POST /api/invitations/:token/accept` | Join a trip | none |
| `DELETE /api/trips/:id/members/:userId` | Remove a member | none |
| `PUT /api/trips/:id/preferences/me` | Submit or revise a profile | T3, T5 |
| `POST /api/me/past-trips` | Record a past trip and rating | none |
| `POST /api/trips/:id/close-submissions` | Organiser closes submissions | T3b |
| `GET /api/trips/:id/group-profile` | Group profile, common window, conflicts | none |
| `POST /api/trips/:id/recommendations` | Recommend destinations | T6 to T8 |
| `POST /api/trips/:id/destination` | Select a destination; entry generates packages | T9 |
| `GET /api/trips/:id/transport` | Compare transport options | none |
| `GET /api/trips/:id/packages` | View packages and cost breakdowns | none |
| `POST /api/packages/:id/decision` | Accept, modify or reject a package | T10, T11 |
| `POST /api/trips/:id/itinerary` | Generate the itinerary | T12 |
| `POST /api/itineraries/:id/decision` | Accept, modify or reject the itinerary | T13, T14 |
| `POST /api/trips/:id/cancel` | Cancel a trip | T15, T16 |
| `GET /api/me/trips` | View trip history | none |
| `GET /api/me/notifications` | Receive notifications | none |
| `/api/admin/destinations`, `POST /api/admin/catalogue/import` | Manage the destination catalogue and fallback data | none |
| `GET /api/health` | Health check | none |

`POST /api/trips/:id/recommendations` returns either `{kind: 'shortlist', items}` or `{kind: 'diagnostic', bindingConstraint, alternatives}`, matching the two operands of the sequence diagram's alt fragment.

**Sources** (pages opened on 8 October 2026)

- [endoflife.date: Node.js release status](https://endoflife.date/nodejs)
- [PhocusWire: Amadeus to shut down its self-service APIs portal](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers)
- [Google Maps Platform: India pricing](https://developers.google.com/maps/billing-and-pricing/pricing-india)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [GitHub Docs: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Vercel Community: Hobby account, private repo and collaborators](https://community.vercel.com/t/hobby-account-private-repo-collaborators-deployment-blocked/1030)
- [Vercel Docs: Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Neon pricing](https://neon.com/pricing)
- [Render Docs: Deploy for free](https://render.com/docs/free)
