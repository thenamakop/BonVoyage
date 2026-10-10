# ADR-009: Authentication with Better Auth

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

Requirement R10 asks for preference privacy and salted credential hashes (`docs/baseline/BonVoyage_SRS_v1.1.md` section 3.4). Writing password handling by hand is a known source of security mistakes.

## Decision

Use Better Auth with email and password, keeping sessions in Postgres through its Drizzle adapter. Store passwords only as salted hashes.

## Consequences

- Easier: session and password handling come from a maintained library rather than custom code.
- Easier: sessions live in the same database as the rest of the data.
- Harder: the auth tables follow the library's schema and must be kept in step with Drizzle migrations.
- Harder: any change to auth needs an explicit decision, because it touches privacy rules.

## Links

- `docs/baseline/BonVoyage_SRS_v1.1.md`, section 3.4
- `docs/RUNBOOK.md`, Phase 2
- `docs/decisions/ADR-005-data-postgres-drizzle.md`
