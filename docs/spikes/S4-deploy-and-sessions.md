# S4: Deploy and sessions

Status: Done

## Question

Can one Vercel project serve the Vite SPA and the whole Express API from a Build Output API directory, with Neon in Singapore behind it, and do sign-in sessions survive on a phone?

## Method

Deployment: `pnpm vercel-build` writes `.vercel/output` with `static/` (the Vite build) and one esbuild bundle at `functions/api.func/index.mjs` that serves every `/api/*` request through Express (ADR-010). `pnpm smoke:function` loads that exact file and checks it in CI. A preview is built from each pull request branch and checked while logged in to Vercel.

Sessions: Maulik checked production on 23 Oct 2026 using a vivo V23e 5G, Android 14 (Funtouch OS 14), Chrome 155.0.8059.84: signed up, survived a reload, still signed in after reopening 10 minutes later. Using the same phone as the second device, the desktop dashboard updated without a reload in under 10 s (not timed more precisely).

## Numbers

| Measure | Value |
| --- | --- |
| Function bundle size (`index.mjs`) | 2.42 MB (2536412 bytes), plus a 4.1 MB source map |
| Build duration (Vercel build log) | 23 s (`Build Completed in /vercel/output [23s]`, no build cache, preview of 5f9f766 on 2026-10-10) |
| First `/api/health` request | 143 ms (200, browser cache disabled, first request after the redeploy) |
| Warm `/api/health` request | about 150 ms typical (five reloads: 139, 152, 156, 157, 206 ms) |

Measured from Maulik's browser in India against the preview, function region sin1, Neon preview branch in aws-ap-southeast-1.

## Decision

Keep the ADR-010 design. The preview served the SPA and every `/api/*` route from `.vercel/output` with one bundled function, and `/api/health` answered in about 150 ms, well inside the SRS 3.3 target of 3 s per screen. The production phone session check passed on 23 Oct 2026: vivo V23e 5G, Android 14, Chrome 155.0.8059.84; sign-up, reload and reopening after 10 minutes all retained the session.
