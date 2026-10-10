# ADR-002: pnpm workspace monorepo

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

The project has two deployable apps and several pieces of logic that must be testable without a server or database. The scoring and state-machine logic in particular must be deterministic and free of side effects so that the worked example in `docs/specs/scoring.md` can act as a golden test.

## Decision

Use one pnpm workspace with `apps/web`, `apps/api`, `packages/engine`, `packages/integrations`, `packages/db` and `packages/shared`. Keep `packages/engine` pure (no I/O, no clock, no randomness) and let imports flow from apps to packages only.

## Consequences

- Easier: the engine is unit-tested with plain data and needs no mocks.
- Easier: one install, one lockfile and shared types for all packages.
- Harder: the dependency direction (apps to packages, never the reverse) must be enforced in review and lint rules.
- Harder: anything that needs the current time or a random value must receive it as an argument.

## Links

- `docs/RUNBOOK.md`, Phase 2
- `AGENTS.md`, sections 3 and 4
