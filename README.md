# BonVoyage

[![ci](https://github.com/thenamakop/BonVoyage/actions/workflows/ci.yml/badge.svg)](https://github.com/thenamakop/BonVoyage/actions/workflows/ci.yml)

BonVoyage is a collaborative trip planner for small Indian groups. Members submit preferences, budget and dates; the system removes destinations that break hard constraints, ranks the rest by a group-fit score, builds costed packages and drafts a day-wise itinerary.

It is a BML Munjal University Software Engineering project, built by Maulik with coding agents.

## Prerequisites

- Node 24 (see `.nvmrc`)
- pnpm 10 (never 11)
- Docker Desktop

## First run

```sh
cp .env.example .env   # only on a fresh machine
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

Then open http://localhost:5173. The status line should read "API ok · Database ok".

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Run the web app and the API together |
| `pnpm build` | Production build of every package |
| `pnpm typecheck` | Type-check the root, packages and apps |
| `pnpm lint` | ESLint over the whole repository |
| `pnpm format` / `pnpm format:check` | Write or check Prettier formatting |
| `pnpm test` | All tests (needs `pnpm db:up`) |
| `pnpm test:unit` | Unit and web tests only (no database) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm verify` | Format check, lint, type-check, tests and build |
| `pnpm vercel-build` | Write the Vercel Build Output API directory `.vercel/output` |
| `pnpm smoke:function` | Smoke-test the bundled API function (needs `DATABASE_URL`) |
| `pnpm db:migrate:remote` | Check or migrate a Neon branch (`--target preview\|production [--status]`) |
| `pnpm db:up` / `pnpm db:down` | Start or stop the local Postgres containers |
| `pnpm db:generate` / `pnpm db:migrate` | Generate or apply migrations |
| `pnpm db:reset` | Drop and rebuild the local database (local only) |
| `pnpm db:studio` | Open Drizzle Studio |

## Ports

| Port | Service |
| --- | --- |
| 5173 | Web (Vite) |
| 4000 | API (Express) |
| 5432 | Postgres |
| 5433 | Test Postgres (`db-test`) |

## Deployments

- A pull request gets a Vercel preview that uses the Neon branch `preview`.
- A merge to `master` deploys production, which uses Neon's default branch.
- Migrations run only through `pnpm db:migrate:remote`, never from CI or a Vercel build.

Read `AGENTS.md` before using a coding agent. The plan and decisions live in `docs/`.
