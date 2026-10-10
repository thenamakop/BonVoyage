# ADR-006: Travel data from the curated catalogue

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

Live travel inventory is not available to this project. Amadeus decommissioned its Self-Service APIs on 17 July 2026, and the Booking.com Demand API requires partner access (SRS reference [10]). The project also lists nationwide real-time inventory as Won't Have (R20).

## Decision

Source hotels, buses and trains from the curated catalogue, kept as CSV files in the repository and imported into the database. Attach a provenance (live, cached, curated or estimated) and a source URL to every figure.

## Consequences

- Easier: the app works offline from fixtures and tests never need a key.
- Easier: every number can be traced to a source, which supports the rule that the language model never supplies facts.
- Harder: the catalogue is maintained by hand and prices can go stale.
- Harder: a `pnpm catalogue:check` validation step is needed so bad rows are caught before import.

## Links

- https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers (Amadeus Self-Service APIs decommissioned on 17 July 2026)
- Booking.com Demand API requires partner access: `docs/baseline/BonVoyage_SRS_v1.1.md`, reference [10]
- `docs/decisions/0000-baseline-reconciliation.md`
