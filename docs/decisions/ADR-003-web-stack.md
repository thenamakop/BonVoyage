# ADR-003: Web stack

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

The web client is a single-page application used on phones as well as laptops. `docs/baseline/BonVoyage_SRS_v1.1.md` section 3.3 requires that a trip's state updates without a manual page reload, and the synopsis stack (Table 3) already names React.

## Decision

Build the web app with React and TypeScript on Vite, using React Router, TanStack Query and Tailwind CSS v4. The trip dashboard polls the API every 8 seconds through TanStack Query to satisfy the SRS 3.3 no-reload rule.

Amended 13 October 2026 (S1-5, PR #53): the poll was 10 seconds. It is 8 seconds so the worst case, one interval plus the request, stays within SRS 3.3's 10 seconds on production.

## Consequences

- Easier: fast local development and a static build that Vercel serves as plain files (see ADR-010).
- Easier: TanStack Query provides polling, caching and retry without custom code.
- Harder: polling every 8 seconds means up to about 8 seconds of staleness plus request time, and steady API load, since there are no push updates.
- Harder: no server-side rendering, so pages are blank until the bundle loads.

## Links

- `docs/baseline/BonVoyage_SRS_v1.1.md`, section 3.3
- `docs/RUNBOOK.md`, Phase 2
