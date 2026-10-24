# 0004: Recommendation rules and Sprint 2 re-plan

Status: Accepted · Date: 2026-10-24 · Supersedes: scoring draft; earlier rules only where stated below

## Context

Sprint 2 implements R4 to R7 and R16, with the R15 shortlist speed target. Sprint 1 closed on 23 October with catalogue stage A at 0/50. These decisions fix the recommendation rules before implementation; the [re-plan](../sprints/replan-2026-10-23.md) fixes the calendar without cutting a Must have.

## Decision

### a) Who counts

`n` counts active trip members with a submitted preference. Excluded members never count. Reason: recommendations must represent the participating group, not removed or unanswered profiles.

### b) Group profile on read

Compute the group profile on read; never store it. The common window is the intersection of member date ranges, counting both ends. The per-person budget band is `[highest member minimum, lowest member maximum]`; the per-person cap is the lowest member maximum; the group cap is `min(trip budget, n × per-person cap)`. Count votes for each destination type, activity and climate. The `computeGroupProfile` action handler remains a no-op with a comment pointing to this decision when S2-6 implements the read path. Reason: reading current preferences avoids stale duplicate aggregates.

### c) Date conflicts and budget warnings

No common window, or fewer than `duration_nights + 1` inclusive days, is a blocking F3 group conflict. A recommendation request then fires `conflictDetected` (T4, back to `collecting_preferences`) and stores a diagnostic run with `bindingConstraint = F3`, no items and no alternatives. Disjoint budget bands are a warning only; the lowest maximum still caps spending. This amends scoring sections 2 and 6. Reason: dates must fit the whole trip, whereas a below-minimum plan is still affordable.

### d) F5 cost formula

```text
cars = ceil(n / persons_per_car)
carShare = cars × (km × (fuel_price_inr_per_litre / car_km_per_litre
           + toll_inr_per_km) + car_rental_inr_per_day × (nights + 1) / 2) / n
cheapestOneWayPerPerson = min(available origin-hub bus fare, available origin-hub train fare, carShare)
estimatedGroupCost = n × 2 × cheapestOneWayPerPerson
  + ceil(n / 2) × nights × stay_budget_inr
  + n × (nights + 1) × (food_per_day_inr + local_per_day_inr)
```

Compare the estimated group cost with the group cap from b), not just the trip budget. Round money up to whole rupees only at exported function boundaries, never intermediate arithmetic within a function. Sprint 3 reuses the car formula. Reason: cars and rooms come in whole units, and the estimate must respect every member's maximum.

### e) Candidate completeness

Candidates are active destinations with `stay_budget_inr`, `food_per_day_inr` and `local_per_day_inr` all set. List the rest as incomplete in the run's diagnostic; never silently drop them. Reason: missing catalogue facts must not masquerade as a hard-constraint rejection.

### f) Distance and provenance

The integrations module first tries the curated car distance from `fare_fallback`, then `estimateRoadKm`. A verified catalogue row has provenance `curated`; a draft row or computed value is `estimated`. Every Sprint 2 cost carries the word "estimate". Reason: known routes are preferable, but draft data and arithmetic are not verified facts.

### g) Types are soft preferences

Apply F1 to F5 before ranking, even if no candidate matches the group's requested types. Return a shortlist when at least three are feasible; show a weak-match message when the best mean member score is below 0.25. This supersedes RUNBOOK Phase 6's beach-only diagnostic rule. Reason: a preference mismatch is not a hard constraint.

### h) Configured weights

Weights live in `apps/api/config/scoring.json`: alpha 0.5, beta 0.3, gamma 0.2. Validate them at start-up, inject them through application dependencies and store them on every run. Reason: configuration and persisted weights make each ranking reproducible.

### i) Private explanations

Each member sees only their own meets and misses. Group views show counts and list a preference value only when at least two members share it; never associate a member's name with a preference. Reason: explanations must not reveal another member's answers.

### j) Editing and retrying

The organiser can edit title, origin, nights, budget and radius in `draft`, `collecting_preferences` and `ready_for_recommendation`; they lock at `shortlisted`. This replaces S1-2's draft-only parameter rule, not decision 0001(b)'s preference-revision rule. After T4 or T6>T8 returns the trip, edit parameters or revise preferences, then Close submissions (T3b) marks it ready again. Reason: a diagnostic needs an actionable retry path without bypassing the state machine.

### k) Chosen destination

Migration 0001 (S2-2) adds nullable `trip.selected_destination_id`; T9 writes it. Reason: the chosen destination must survive beyond a recommendation response.

### l) Provider quotas

`provider_usage(provider, day, calls)` counts calls per provider per India day. A provider with a daily limit falls back to the next provider when its limit is reached. Curated and estimate providers have no limit; Gemini receives one in Sprint 4. Reason: central quota accounting protects free-tier availability and keeps callers independent of providers.

### m) Deterministic ranking

Sort by GFS descending, mean descending, then slug ascending. Store every feasible destination ranked; show the first five with "Show all". A shortlist requires at least three (T6 guard). Reason: complete persisted results and deterministic ordering make retries auditable.

## Catalogue stage B split and dates

- Stage A: 50 hub/identity rows, due Monday 26 October, moved to Sprint 2 (#37).
- B1: 137 rows due Sunday 1 November: five cost rules in `cost-rules.json`, the cost columns of 44 destinations, and distance/duration in 88 car rows in `fares.csv`.
- B2: 116 bus/train fare rows, best effort by Thursday 5 November; draft fares remain labelled estimated.
- Stage C: POIs, due Sunday 1 November, unchanged.

Reason: B1 is the minimum verified input for filtering and packages; splitting the 253-row workload keeps optional fare verification from hiding the critical path. Only Maulik verifies catalogue rows.

The checker reports A, B1, B2 and C. `--require a`, `b1`, `b2`, `b` (B1 and B2), and `c` include earlier stages in that order. Dates amend decision 0002; file formats do not change.

## Consequences

- No application logic, schema, state-machine implementation or catalogue verification changes in S2-1; S2-2 to S2-8 implement these rules.
- The accepted scoring specification retains its golden example unchanged; with no past trips, weighted type Jaccard reduces to ordinary Jaccard and reproduces every golden number.
- The re-plan moves Sprint 2 to 24–27 October, Sprint 3 to 28 October–2 November and Sprint 4 to 3–7 November. Feature freeze on 8 November and submission on 10 November remain fixed. Cut R13's modify step first, then R12, never a Must have.

## Links

- [Scoring specification](../specs/scoring.md)
- [Re-plan](../sprints/replan-2026-10-23.md)
- [Sprint 2 conventions](../prompts/sprint-2/README.md)
- [Catalogue format](0002-catalogue-format.md)
- [Trip state clarifications](0001-state-machine-clarifications.md)
