# S0-4: Destination catalogue tooling and draft data

Creates the curated data the planner stands on: CSV files with fixed columns, a checker that rejects bad rows, and a first draft of hubs, about 40 destinations, fares and sample places. Every drafted row is marked `draft` until you check its numbers against the source; the checker shows what is still unverified. It runs before the schema prompt because S0-5 builds its catalogue tables from these files.

**Branch:** `feat/s0-catalogue` · **Time box:** 2.5 hours · **Depends on:** S0-2 merged (S0-3 is not needed)

```text
S0-4  DESTINATION CATALOGUE TOOLING AND DRAFT DATA
Branch: feat/s0-catalogue   Time box: 2.5 hours

CONTEXT
Read AGENTS.md, docs/specs/scoring.md (sections 6.1 and 6.2), docs/decisions/ADR-006 and ADR-007, and docs/RUNBOOK.md Phase 6 (catalogue rules). The S0-2 scaffold is merged. This task does not touch the database: S0-5 creates the tables and imports these files.

The catalogue is grounding data. Every price, distance, duration and opening time a user sees comes from it, and the language model only rephrases it (AGENTS.md design rule 2). So every row has fixed columns, a source, a collection date and a review status. An AI may draft rows; only Maulik marks a row verified, after checking its numbers against the source page.

Staged verification (decided for the 10 November deadline; the checker enforces it):
  Stage A, due Sun 18 Oct: hubs, and destination identity fields (name, state, coordinates, types, activities, climate, best months, minimum nights). Needed by Sprint 2 filtering.
  Stage B, due Sun 25 Oct: destination costs, fares and cost rules. Needed by Sprint 3 packages.
  Stage C, due Sun 1 Nov: places (POIs). Needed by Sprint 4 itineraries.

Deviations from RUNBOOK Phase 6 (decided; record them in step 7):
- New hubs.csv. There is no geocoding key (ADR-007), so a trip's origin is picked from curated hubs with known coordinates.
- destinations.csv gains activities, climate and min_nights (scoring spec 6.1), separate provenance columns for costs, and review statuses.
- Every file gains review_status. cost-rules.json lives in packages/db/catalogue/, not config/.

GOAL
packages/db/catalogue/ holds hubs.csv, destinations.csv, fares.csv, pois.csv and cost-rules.json in the formats below, with a README that explains every column. "pnpm catalogue:check" validates them, reports coverage and verification progress, exits 1 on any error, and with --require a|b|c also fails on rows of that stage that are still draft. The drafted data passes with 0 errors (warnings allowed), and every drafted row is marked draft.

STEPS
1. Vocabularies in packages/shared/src/vocab.ts, exported from the package index. Each is a const array, a zod enum and a type, plus a label map for the UI (for example hill_station gives "Hill station"):
     DESTINATION_TYPES    mountain, hill_station, beach, heritage, city, spiritual, adventure, wildlife, lake, desert
     ACTIVITIES           trekking, rafting, camping, paragliding, skiing, wildlife_safari, boating, museums, forts_palaces, temples, yoga_wellness, food_trails, shopping, nightlife
     CLIMATES             cold, mild, warm
     CLIMATE_PREFERENCES  cold, mild, warm, any
     TRAVEL_STYLES        budget, comfort, premium
     TRANSPORT_MODES      bus, train, car
     POI_CATEGORIES       sight, temple, fort_palace, museum, market, nature, adventure, food, viewpoint, wellness
     REVIEW_STATUSES      draft, verified
   Confirm that every value used in docs/specs/scoring.md section 6.7 is in these lists. Unit tests: no duplicates, every value is snake_case, every value has a label.

2. File formats in packages/db/catalogue/. UTF-8, comma-separated, RFC 4180 quoting, the header row exactly as listed. Lists inside a cell are separated by "|". Dates are YYYY-MM-DD; times are HH:MM in 24-hour IST; money is whole rupees; distance is whole kilometres; durations are whole minutes. An empty cell means unknown.
   - hubs.csv: slug, name, state, lat, lng, source_url, collected_on, review_status
     A hub is a starting city a group leaves from.
   - destinations.csv: slug, name, state, lat, lng, types, activities, climate, best_months, min_nights, stay_budget_inr, stay_mid_inr, stay_premium_inr, food_per_day_inr, local_per_day_inr, source_url, collected_on, review_status, cost_source_url, cost_collected_on, cost_review_status
     stay_* is one room for two people for one night in that tier. food_per_day_inr and local_per_day_inr are per person per day. climate is the typical weather in the best months. best_months are the months (1 to 12) when a visit is advisable. min_nights is the shortest sensible stay. source_url, collected_on and review_status cover identity, coordinates, types, activities, climate, months and minimum nights; the cost_* trio covers the five cost columns.
   - fares.csv: origin_hub, destination_slug, mode, fare_per_person_inr, duration_minutes, distance_km, source_url, collected_on, review_status
     One row per hub, destination and mode. bus: the typical cheapest reasonable one-way fare per person (state transport or a common operator's seater). train: the sleeper or second-sitting fare on the most direct service to the nearest station, with station-to-station duration. car: fare_per_person_inr stays empty (cost-rules.json prices the car); distance_km is the road distance on the usual route and is the curated distance the RoutingProvider prefers (ADR-007); duration_minutes is the usual driving time.
   - pois.csv: destination_slug, poi_key, name, category, typical_minutes, open_time, close_time, closed_days, entry_fee_inr, lat, lng, source_url, collected_on, review_status
     poi_key is a stable kebab-case id, unique within its destination. Empty open_time and close_time together mean open at all hours. closed_days lists weekday numbers 0 to 6 with 0 = Sunday. entry_fee_inr is per adult Indian visitor, 0 when free.
   - cost-rules.json: an object with fuel_price_inr_per_litre, car_km_per_litre, toll_inr_per_km, persons_per_car and car_rental_inr_per_day, each { "value": number, "unit": string, "source_url": string, "collected_on": "YYYY-MM-DD", "review_status": "draft" | "verified" }. The car cost formula is specified in Sprint 3; this task only stores the inputs.

3. Schemas, loader and checks in packages/db/src/catalogue/ (add csv-parse as a dependency of @bonvoyage/db, and @bonvoyage/engine for the distance check):
   - schemas.ts: one zod schema per row type that coerces cell strings. Rules: slug and poi_key match ^[a-z0-9]+(-[a-z0-9]+)*$; lat within 6.0 to 37.6 and lng within 68.0 to 97.5 (India's bounding box); types, activities, climate, category and mode come from the vocabularies; best_months is a non-empty set of unique months 1 to 12; min_nights is 1 to 14; money is a whole number of at least 0; typical_minutes is 15 to 600; distance_km is 1 to 3000; duration_minutes is 10 to 3000; collected_on is a real date not after today (today is passed in). source_url must be an https URL when review_status is verified and may be empty while draft; the same pairing holds for cost_source_url and cost_review_status. The five cost columns may be empty only while cost_review_status is draft. bus and train rows need fare_per_person_inr once verified; car rows never have one.
   - load.ts: loadCatalogue(dir, { today }) reads all five files, rejects a header row that differs from the spec, validates every row, and returns { hubs, destinations, fares, pois, costRules, issues }. Each issue is { file, line, column?, severity: "error" | "warning" | "info", message }, with 1-based file line numbers (the header is line 1).
   - checks.ts: pure cross-file rules over parsed rows.
       Errors: duplicate hub or destination slug, duplicate poi_key within a destination, duplicate (origin_hub, destination_slug, mode); a fare or POI that references an unknown hub or destination; stay tiers out of order (budget <= mid <= premium when all three are present); only one of open_time and close_time set, or close_time not after open_time; a car distance_km shorter than the straight-line distance (impossible).
       Warnings: a destination more than 800 km from the gurugram hub by estimateRoadKm (RUNBOOK scope rule); a destination type with fewer than 2 destinations; a destination with fewer than 6 POIs; a destination without car rows from both gurugram and delhi; a car distance_km more than twice the straight-line distance.
       Info: "no beach destination within range: a beach-only group gets the empty-shortlist diagnostic" when beach has 0 destinations.
   - Unit tests with small inline fixtures: every error and warning rule fires on a crafted bad row and stays silent on a good one; one temporary-directory test proves loadCatalogue rejects a wrong header with the right line number.

4. packages/db/scripts/catalogue-check.ts, with the package script "catalogue:check" (tsx) and the root script "catalogue:check": "pnpm --filter @bonvoyage/db catalogue:check". It prints:
   - errors, warnings and info grouped by file, with line numbers;
   - a verification table: for stage A (hubs, destination identity), B (destination costs, fares, cost rules) and C (POIs), verified / total and the due date;
   - coverage: destinations per type, POIs per destination (minimum and median), fare rows per hub and mode.
   With --require a|b|c, rows of that stage and every earlier stage that are still draft become errors. It accepts --today YYYY-MM-DD for tests and otherwise uses the system date (scripts may read the clock; only the engine must not). Exit 1 on any error, else 0.

5. Draft the data. You draft; Maulik verifies later. Never mark anything verified.
   - hubs.csv: delhi, gurugram, noida, faridabad, chandigarh and jaipur, at the city centre or main railway station. source_url is the city's Wikipedia article; collected_on is today; review_status draft.
   - destinations.csv: about 40 destinations reachable by road or rail within roughly 800 km of Gurugram, with each type present at least twice where geography allows (no beach is in range, and desert has few options), mixing weekend trips under 350 km with longer ones. Fill the identity columns from your own knowledge with source_url = the destination's Wikipedia article. For the five costs, draft typical 2026 prices for that place and tier. If you have a web browsing tool, find a source page for the costs and put it in cost_source_url; otherwise leave cost_source_url empty. Never invent a URL. Both statuses draft.
   - fares.csv: from gurugram and from delhi to every destination: one car row; one bus row where a direct or common bus service exists; one train row where a railway station lies within about 30 km. Sources only if you can browse. All draft.
   - pois.csv: 6 to 8 POIs each for rishikesh, jaipur and mussoorie (S0-7's spike uses rishikesh), with realistic opening hours, closed days and fees. All draft. The other destinations get POIs in stage C.
   - cost-rules.json: Delhi petrol price per litre, 15 km per litre, a typical national-highway car toll per km, 4 persons per car, and a typical self-drive hatchback rental per day. All draft, sources only if you can browse.

6. packages/db/catalogue/README.md: what the catalogue is for; a column dictionary for every file (name, type, unit, meaning, rule); a pointer to packages/shared/src/vocab.ts; how to verify a row (open the source, check each number, set collected_on to the day you checked, set the status to verified, and record the page you actually used, preferring official or operator pages); the stage table with due dates; and the rule "never mark a number verified that you have not checked yourself".

7. docs/decisions/0002-catalogue-format.md (the S0-1 template, Status: Accepted): the deviations from CONTEXT, the staged verification plan and why, the rule that only Maulik marks rows verified, and the 800 km scope warning.

8. docs/traceability.md: add the catalogue test files to the Tests column of R11 and R14.

VERIFICATION
Paste the real output of:
  pnpm catalogue:check                  0 errors; warnings expected (POIs missing for most destinations, everything draft)
  pnpm catalogue:check --require a      must FAIL and list the draft rows: correct until stage A is verified
  pnpm test:unit
  pnpm verify
Then print the destinations per type, and every destination slug with its straight-line distance from gurugram (rounded km), sorted ascending.
Report: rows per file; which cost or fare sources you found (if you could browse); an "unsure" list of slugs or numbers you had low confidence in.

IF BLOCKED
- A type cannot reach 2 destinations in range (beach, desert): leave it short and let the warning stand. Do not stretch the range.
- Unsure about a coordinate or number: draft it anyway, add it to the unsure list, and keep the row draft. An empty source_url is fine for drafts; an invented one is not.
- A value in scoring.md section 6.7 is missing from the vocabularies: stop and tell me. Do not edit the spec.
- The data takes longer than the time box: finish the tooling and hubs, commit at least 20 destinations with their car rows, and list the rest as follow-up in the report.
```
