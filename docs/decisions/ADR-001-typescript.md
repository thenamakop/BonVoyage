# ADR-001: TypeScript everywhere

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

BonVoyage has a web client, an API, a pure decision engine and several scripts, all written by one developer working with coding agents. Sharing one language lets the same zod schemas and types be used on both sides of the API, and strict typing catches mistakes that agents tend to introduce.

## Decision

Use TypeScript with `strict` enabled for the web app, the API, the engine and all scripts. Do not loosen compiler settings to obtain a green build.

## Consequences

- Easier: one language and one set of shared types and zod schemas across web, api and engine.
- Easier: the compiler checks agent-written code before any test runs.
- Harder: every script needs a TypeScript toolchain, so no quick throwaway shell or Python scripts in the repository.
- Harder: strict settings such as `noUncheckedIndexedAccess` make some code more verbose.

## Links

- `docs/RUNBOOK.md`, Phase 2
- `docs/decisions/0000-baseline-reconciliation.md`, item C2 (filtering and ranking live in TypeScript)
