# Sprint 2 build prompts

Sprint 2 was planned for 19 to 25 October 2026. It was re-planned on 23 October and now runs from Saturday 24 to Tuesday 27 October; S2-1 records the new calendar. **Goal:** the organiser asks for recommendations and the group gets a ranked shortlist that respects every hard constraint and explains itself to each member privately, or a diagnostic that says exactly what to change; the organiser then picks a destination. Requirements: R4 group profile and conflict report, R5 hard constraints, R6 group-fit ranking, R7 meets and misses, R16 one mediating module with caching and quota control, and the R15 shortlist speed target.

## Before you start

1. **Catalogue stage A is the critical path.** It stood at 0 of 50 on 23 October and is now due Monday 26, so about 25 rows a day on Saturday and Sunday. Sprint 2 code runs on draft data, but the demo is only as good as the rows you verify.
2. **Close Sprint 1 before S2-1:** your production results go into PR #57, #37 moves to the Sprint 2 milestone, #57 is merged and the Sprint 1 milestone is closed. It is one short agent prompt.
3. **Monday 26:** last stage A batch, `pnpm catalogue:check --require a`, then import to preview and production (`/admin/catalogue` or the CLI), and close #37.

## Run order

| Planned day | Prompt                                                                       | Time box         | Needs merged first                                |
| ----------- | ---------------------------------------------------------------------------- | ---------------- | ------------------------------------------------- |
| Sat 24      | [S2-1 Kickoff: decisions, backlog, stage B split, re-plan](S2-1-kickoff.md)  | 1.5 h            | Sprint 1 closed (also commits these prompt files) |
| Sat 24      | [S2-2 Migration 0001](S2-2-migration.md)                                     | 1 h              | S2-1                                              |
| Sat 24      | [S2-3 Member score, ranking, explanations, group profile](S2-3-scoring.md)   | 2.5 h            | S2-1                                              |
| Sat 24      | [S2-5 Integrations: routing, cache, quota (R16)](S2-5-integrations.md)       | 2 h              | S2-2                                              |
| Sun 25      | [S2-4 Hard constraints, cost estimate, diagnostic](S2-4-feasibility.md)      | 2.5 h            | S2-3                                              |
| Sun 25      | [S2-6 Recommendation runs and destination choice](S2-6-recommendations.md)   | 3 h              | S2-2, S2-4, S2-5                                  |
| Mon 26      | [S2-7 Group profile, shortlist and diagnostic screens](S2-7-shortlist-ui.md) | 3 h              | S2-6                                              |
| Tue 27      | [S2-8 Demo scenarios, end-to-end flow, speed check](S2-8-demo-scenarios.md)  | 1.5 h            | S2-7                                              |
| Tue 27      | [S2-9 Sprint 2 review](S2-9-review.md)                                       | 45 min           | everything above                                  |
| Every day   | Catalogue: stage A to Mon 26, then B1 and C to Sun 1 Nov (you, not an agent) | 1 to 1.5 h a day | nothing                                           |

The routine is the same as Sprint 1: branch from `master`, fresh agent session, paste the short prompt I give you (it points the agent at `docs/prompts/sprint-2/<file>.md`), check the result, open the pull request with the given title and `Closes #<issue>`, wait for `ci`, squash-merge with `gh pr merge <n> --squash --delete-branch`. S2-3 and S2-5 touch different packages, so on Saturday you can run them in parallel in two agent sessions. Only S2-2 changes the database. If you get ahead, pull the next prompt forward; if a day slips, the later prompts move with it and Sprint 3 starts a day later.

## Sprint 2 conventions

Every Sprint 2 prompt says "follow the Sprint 2 conventions". S2-1 commits this file as `docs/prompts/sprint-2/README.md`. The Sprint 1 conventions (`docs/prompts/sprint-1/README.md`) still apply, with the updates listed first.

```text
SPRINT 2 CONVENTIONS (apply to every Sprint 2 prompt, on top of the Sprint 1 conventions)

State of the repo (end of Sprint 1, closed 23 Oct 2026)
- Sprint 1 rules 1 to 13 still apply, updated as follows: rule 11 (no migration) is replaced by S5
  below; the dashboard polls every 8 s through useTrip(id, { live: true }) and nothing else polls;
  non-JSON writes return 415 before 401; request logs carry id, method, path, status and userId only.
- Endpoints: 26, listed in apps/api/src/test/endpoint-inventory.ts. Trip-scoped routes are registered
  in apps/api/src/trips/router.ts; their logic lives in feature folders (invitations/, preferences/,
  profile/, admin/). GET /api/destinations sits next to GET /api/hubs.
- Contracts: packages/shared/src/api/{auth,trips,invitations,preferences,profile,admin}.ts and
  packages/shared/src/time.ts (indiaDate).
- Web: src/components/ui (Alert, Badge, Button/ButtonLink, Card, ChipGroup, EmptyState, PageHeader,
  RadioGroup, Select, Skeleton, Spinner, TextField); src/lib/format.ts (formatInr, formatDate,
  formatHub, perPersonShare); src/pages/Trips/dashboard/; web test fixture trip-fixture.ts.
- API tests: createTestUser(app, name, email?), ensureHub, createTripAs, setTripStatus. createApp deps
  include clock and adminEmails; Sprint 2 adds scoringWeights (S2-6) and routing (S2-5).
- Engine: nextState/legalEvents (trip-state.ts), estimateRoadKm, the scoring golden fixture
  (packages/engine/src/scoring/golden.fixture.ts) with two it.todo tests for S2-3.
- Known gaps carried: joins, leaves and removals are not state-machine events; removing the last
  pending member does not advance the trip (Close submissions does).

Sprint 2 rules
S1  Engine purity. packages/engine has no I/O, no clock, no env, no randomness. New engine modules
    (scoring, group, costs, feasibility) need 100 per cent branch coverage.
S2  docs/decisions/0004-recommendation-rules.md and docs/specs/scoring.md (both Accepted in S2-1) are
    the rules. A case they do not cover: stop and ask; never invent a rule in code.
S3  Weights alpha, beta, gamma come only from apps/api/config/scoring.json through createApp deps and
    are stored on every recommendation run. No literal weights in application code (tests may pass
    their own).
S4  Explanations are private. A member's meets and misses go only to that member. Group views show
    counts and list a type or activity only when 2 or more members share it. Never print a member's
    name next to a preference.
S5  Migrations: only S2-2 changes the schema. Generated by drizzle-kit, the SQL read in full; the only
    hand edits allowed are a data UPDATE or a CHECK drizzle cannot express, each with a comment.
    Remote databases change only through pnpm db:migrate:remote, run by Maulik.
S6  Distances (and later every outside call) go through packages/integrations (R16). Every distance
    and cost carries provenance: a verified catalogue row is curated, a draft row or a computed value
    is estimated. Every Sprint 2 cost on screen says "estimate".
S7  Slow work outside the lock: compute first, then insert run rows inside transitionTrip's
    beforeDecide with a staleness check. Never write trip.status directly.
S8  Rounding: money up to whole rupees, distance up to whole km, only at the edges of exported
    functions, never in between.
S9  Every new endpoint goes into endpoint-inventory.ts and the access matrix in the same PR, and into
    the leak test when it returns member data.
S10 Determinism: the same inputs give the same ranking (GFS desc, then mean desc, then slug asc).
```

## Catalogue stage B1: your daily checks (#38)

Stage B is 253 rows, far more than a week of evenings, so S2-1 splits it (decision 0004). **B1 is due Sunday 1 November and is what packages and the budget filter need:** the 5 cost rules, the cost columns of the 44 destinations, and the distance and driving time of the 88 car rows (Gurugram and Delhi to every destination). That is 137 rows. **B2, the 116 bus and train fares, is best effort by Thursday 5 November;** until a fare is verified the app labels it an estimate, so nothing false is shown. Start B1 as soon as stage A is finished (due Monday 26 October).

| Rows                                                                               | Where to check                                                                                              | What to set                                                                                                    |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `cost-rules.json`: fuel price                                                      | The day's Delhi petrol price on a fuel-price page                                                           | `value` in rupees per litre, `source_url`, `collected_on`, `review_status: verified`                           |
| `cost-rules.json`: km per litre, persons per car                                   | A typical hatchback's real-world mileage page; 4 seats is the convention                                    | as above                                                                                                       |
| `cost-rules.json`: toll per km                                                     | NHAI fee information for a common route (total toll divided by km)                                          | as above, rupees per km                                                                                        |
| `cost-rules.json`: car rental per day                                              | A self-drive hatchback listing in Delhi                                                                     | as above                                                                                                       |
| Destination costs (44 rows): `stay_budget_inr`, `stay_mid_inr`, `stay_premium_inr` | A hotel booking site for that town, in the travel season: a typical room for two for one night in each tier | whole rupees; keep budget below mid below premium                                                              |
| Destination costs: `food_per_day_inr`, `local_per_day_inr`                         | A travel guide or price page for the town, per person per day                                               | whole rupees, then `cost_source_url`, `cost_collected_on`, `cost_review_status: verified`                      |
| Car rows in `fares.csv` (88): `distance_km`, `duration_minutes`                    | Google Maps directions from the hub's point in `hubs.csv` to the destination's point                        | whole km and minutes on the usual route; `source_url` = the directions link; `fare_per_person_inr` stays empty |

**Daily routine:** the same as stage A. Branch `chore/38-catalogue-b1-batch-<n>`, check about 20 rows (car rows take a minute each, destination costs about four), run `pnpm catalogue:check` (0 errors), commit `chore: verify catalogue stage B1 (batch <n>)`, pull request with `Refs #38`, merge. **Finish on Sunday 1 November:** `pnpm catalogue:check --require b1` passes, then import to preview and production. Agents never touch review statuses.

## When Sprint 2 is done

Send me the PASTE THIS BACK block from S2-9 and I'll write Sprint 3 (Wednesday 28 October to Monday 2 November) against what is actually in the repo:

- **Packages (R8):** at least three costed packages for the chosen destination, mixing transport mode and stay tier, each itemised (onward, return, stay, food, activities, local) with group and per-person totals, reusing the S2-4 car formula. This fills the `packages_proposed` state that T9 now reaches.
- **Provenance (R14):** every cost line labelled curated or estimated, driven by the catalogue's review status.
- **Package decisions:** accept, modify or reject per member, with T10, T11, I3 and I4.
- **Account deletion (#54):** moved from Sprint 2 by the re-plan; it is the last open criterion of R10.
- **Catalogue:** B1 and stage C (places of interest), both due Sunday 1 November, then B2 fares (best effort by Thursday 5 November). Only rishikesh, jaipur and mussoorie have places of interest today, which limits Sprint 4's itineraries.
