# S4: Deploy and sessions

Status: In progress

## Question

Can one Vercel project serve the Vite SPA and the whole Express API from a Build Output API directory, with Neon in Singapore behind it, and do sign-in sessions survive on a phone?

## Method

Deployment: `pnpm vercel-build` writes `.vercel/output` with `static/` (the Vite build) and one esbuild bundle at `functions/api.func/index.mjs` that serves every `/api/*` request through Express (ADR-010). `pnpm smoke:function` loads that exact file and checks it in CI. A preview is built from each pull request branch and checked while logged in to Vercel.

Sessions: the check on a real phone moves to Sprint 1 issue 1 (sign-in screens), because Sprint 0 has no sign-in UI.

## Numbers

| Measure | Value |
| --- | --- |
| Function bundle size (`index.mjs`) | 2.42 MB (2536412 bytes), plus a 4.1 MB source map |
| Build duration (Vercel build log) | to be filled at step 18 |
| First `/api/health` request | to be filled at step 18 |
| Warm `/api/health` request | to be filled at step 18 |

## Decision

Pending the numbers above. The mechanism itself is decided in ADR-010.
