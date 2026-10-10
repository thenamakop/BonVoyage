# ADR-004: API stack

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

The API serves the web app, validates every input and must report errors the same way everywhere so the client can handle them uniformly. Node.js 24 is the current long-term-support line, which suits a project that must stay maintainable until the submission date and the viva.

## Decision

Build the API on Node.js 24 LTS and Express 5 as REST and JSON under `/api`, validating every boundary with zod. Return every error in one envelope: `{"error":{"code","message","fields"?}}`.

## Consequences

- Easier: one predictable error shape for the client and for tests.
- Easier: zod schemas in `packages/shared` are reused by web and api.
- Harder: every route needs a schema and an error mapping before it is useful.
- Harder: Node 24 must be installed locally and on the hosting platform.

## Links

- https://endoflife.date/nodejs (Node.js 24 LTS status)
- `docs/RUNBOOK.md`, Phase 2
- `AGENTS.md`, section 7 (error format)
