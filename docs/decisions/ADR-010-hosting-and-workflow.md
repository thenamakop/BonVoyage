# ADR-010: Hosting and workflow

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

Maulik is the only developer, working with coding agents on Windows 11, and the project is submitted on 10 November 2026. Sprint 0 ends on 11 Oct; the feature sprints are S1 12-18 Oct, S2 19-25 Oct, S3 26 Oct-1 Nov and S4 2-7 Nov, with a buffer on 8-10 Nov. To fit that time, R17 (fairness rounds), R18 (voting), reminders and email (C4) and the user study are deferred. This ADR replaces the RUNBOOK Phase 2 hosting plan.

## Decision

Deploy one Vercel project at the repo root whose build script writes the Build Output API directory (`.vercel/output`): the Vite SPA as static files plus one esbuild-bundled Node.js function that serves every `/api/*` route through Express. Use Neon Postgres in AWS Singapore (aws-ap-southeast-1) with Vercel function region sin1, production on Neon's default branch and previews on a Neon branch named `preview`. Every change goes through a pull request with CI passing and required approvals set to 0, because GitHub does not allow approving your own pull request.

## Consequences

- Easier: one deployment serves the site and the API, and the function stays close to the database.
- Easier: the pull request and CI rule gives a checkpoint even without a second reviewer.
- Harder: the custom build script must produce a valid `.vercel/output` layout and is not covered by framework defaults.
- Harder: all previews share one Neon branch, so preview data can collide.
- Harder: the scope cut means R17, R18, reminders and email, and the user study are not delivered by 10 November.

## Links

- https://vercel.com/docs/build-output-api
- https://neon.com/docs/introduction/regions
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- `docs/RUNBOOK.md`, Phase 2 (replaced by this ADR)
