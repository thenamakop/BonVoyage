# ADR-007: Distances through a RoutingProvider

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

The RUNBOOK Phase 2 plan relies on the Google Routes API for distances; this ADR replaces that plan. A Google Maps key is not available because billing is unavailable, so distance cannot depend on it. The radius constraint (F1) and the cost estimate still need a distance for every origin and destination pair.

## Decision

Obtain every distance through a RoutingProvider interface. The default provider returns the curated road distance from the catalogue when the origin is a known hub, otherwise the haversine distance multiplied by a 1.3 road factor, labelled "estimated". Add a Google Routes or openrouteservice adapter only if a key becomes available.

## Consequences

- Easier: no key, billing or network is needed, and tests are deterministic.
- Easier: a later adapter plugs in behind the same interface without touching the engine.
- Harder: estimated distances can be wrong by a noticeable margin, so the "estimated" label must always be shown.
- Harder: the curated hub distances must be maintained in the catalogue.

## Links

- https://developers.google.com/maps/billing-and-pricing/pricing-india (future option: Google Maps Platform pricing for India)
- `docs/RUNBOOK.md`, Phase 2 (replaced by this ADR)
- `docs/decisions/ADR-006-travel-data-catalogue.md`
