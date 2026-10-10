# ADR-003: Web stack

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

The web client is a single-page application used on phones as well as laptops. `docs/baseline/BonVoyage_SRS_v1.1.md` section 3.3 requires that a trip's state updates without a manual page reload, and the synopsis stack (Table 3) already names React.

## Decision

Build the web app with React and TypeScript on Vite, using React Router, TanStack Query and Tailwind CSS v4. The trip dashboard polls the API every 10 seconds through TanStack Query to satisfy the SRS 3.3 no-reload rule.

## Consequences

- Easier: fast local development and a static build that Vercel serves as plain files (see ADR-010).
- Easier: TanStack Query provides polling, caching and retry without custom code.
- Harder: polling every 10 seconds means up to 10 seconds of staleness and steady API load, since there are no push updates.
- Harder: no server-side rendering, so pages are blank until the bundle loads.

## Links

- `docs/baseline/BonVoyage_SRS_v1.1.md`, section 3.3
- `docs/RUNBOOK.md`, Phase 2
