# 0002: Catalogue file format and staged verification

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

RUNBOOK Phase 6 specifies three CSVs (`destinations.csv`, `pois.csv`, `fares.csv`)
plus `config/cost-rules.json`, to be verified by 18 Oct. S0-4 builds the catalogue
before the schema exists (S0-5 imports it), and two earlier decisions change the
shape of the data: ADR-007 removes the geocoding key, and the scoring spec
(`docs/specs/scoring.md`) needs per-destination activities, climate and minimum
nights.

## Decision

The catalogue lives in `packages/db/catalogue/` and deviates from RUNBOOK Phase 6
in these ways:

- **`hubs.csv` is new.** With no geocoding key, a trip's origin is picked from
  curated hubs with known coordinates.
- **`destinations.csv` gains columns:** `activities`, `climate` and `min_nights`
  (required by the scoring spec), plus a separate provenance trio
  (`cost_source_url`, `cost_collected_on`, `cost_review_status`) for the five cost
  columns, so identity and costs can be verified on different schedules.
- **Every file gains `review_status`** (`draft` | `verified`), and
  `cost-rules.json` lives in `packages/db/catalogue/` rather than `config/` so all
  grounding data sits in one place.

**Staged verification**, replacing the single 18 Oct deadline:

- Stage A, due 2026-10-18: hubs and destination identity fields — needed by
  Sprint 2 filtering.
- Stage B, due 2026-10-25: destination costs, fares and cost rules — needed by
  Sprint 3 packages.
- Stage C, due 2026-11-01: POIs — needed by Sprint 4 itineraries.

An AI may draft rows, but only Maulik marks a row `verified`, after checking its
numbers against the source page. `pnpm catalogue:check --require a|b|c` fails on
rows of that stage and every earlier stage that are still `draft`.

A destination more than 800 km from the `gurugram` hub by `estimateRoadKm` is a
warning, not an error: it leaves the catalogue out of the RUNBOOK's scope rule but
still parseable, so nothing has to be deleted if scope ever widens.

## Links

- `docs/RUNBOOK.md`, Phase 6 (deviations recorded above)
- `docs/decisions/ADR-006-travel-data-catalogue.md`
- `docs/decisions/ADR-007-distances-routing-provider.md`
- `docs/specs/scoring.md`
- `packages/db/catalogue/README.md`
