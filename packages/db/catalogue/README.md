# Destination catalogue

Curated grounding data for BonVoyage (ADR-006). Every price, distance, duration and
opening time a user sees comes from these files; the language model only rephrases
them (AGENTS.md design rule 2). S0-5 imports them into Postgres; until then they are
plain files validated by `pnpm catalogue:check`.

## Verification stages

A row is `draft` until Maulik checks every number in it against the source page and
sets `review_status` to `verified` with `collected_on` = the day it was checked.

| Stage | Due | Covers |
| --- | --- | --- |
| A | 2026-10-18 | `hubs.csv` rows; destination identity columns |
| B | 2026-10-25 | Destination cost columns (`cost_*` trio), `fares.csv`, `cost-rules.json` |
| C | 2026-11-01 | `pois.csv` |

`pnpm catalogue:check --require a|b|c` fails while rows of that stage or any earlier
stage are still `draft`.

**How to verify a row.** Open the source, check each number, set `collected_on` to
the day you checked, set `review_status` to `verified`, and record the page you
actually used — prefer official or operator pages (IRCTC, state transport, ASI,
hotel sites). Never mark a number verified that you have not checked yourself.

## File format

UTF-8, comma-separated, RFC 4180 quoting, one header row exactly as listed. Lists
inside a cell are separated by `|`. Dates are `YYYY-MM-DD`; times are `HH:MM`
(24-hour IST); money is whole rupees; distance is whole kilometres; durations are
whole minutes. An empty cell means unknown. Enumerated values come from
`packages/shared/src/vocab.ts`.

### hubs.csv

A hub is a starting city a group leaves from (ADR-007: no geocoding key, so the
origin is picked from hubs with known coordinates).

| Column | Type / unit | Meaning |
| --- | --- | --- |
| slug | kebab-case id | Unique hub identifier |
| name | text | Display name |
| state | text | State or UT |
| lat, lng | degrees | City centre or main railway station; lat 6.0–37.6, lng 68.0–97.5 |
| source_url | https URL or empty | Where the identity fields came from |
| collected_on | date | Day the row was collected |
| review_status | draft \| verified | `verified` needs a non-empty https `source_url` |

### destinations.csv

| Column | Type / unit | Meaning |
| --- | --- | --- |
| slug | kebab-case id | Unique destination identifier |
| name | text | Display name |
| state | text | State or UT |
| lat, lng | degrees | Town/attraction centre, within India's bounding box |
| types | list of DESTINATION_TYPES | What the place is |
| activities | list of ACTIVITIES | What a visitor can do |
| climate | CLIMATES | Typical weather in the best months |
| best_months | list of month numbers 1–12 | Months when a visit is advisable |
| min_nights | 1–14 | Shortest sensible stay |
| stay_budget_inr, stay_mid_inr, stay_premium_inr | INR | One room for two people per night in that tier; budget <= mid <= premium |
| food_per_day_inr | INR | Food per person per day |
| local_per_day_inr | INR | Local transport/sundries per person per day |
| source_url, collected_on, review_status | as above | Cover identity, coordinates, types, activities, climate, months, min_nights |
| cost_source_url, cost_collected_on, cost_review_status | as above | Cover the five cost columns; they may be empty only while `cost_review_status` is `draft` |

### fares.csv

One row per origin hub, destination and mode.

| Column | Type / unit | Meaning |
| --- | --- | --- |
| origin_hub | hub slug | Where the trip starts |
| destination_slug | destination slug | Where it goes |
| mode | TRANSPORT_MODES | bus, train or car |
| fare_per_person_inr | INR or empty | Bus: typical cheapest reasonable one-way fare (state transport or a common seater). Train: sleeper or second-sitting on the most direct service to the nearest station. Car: always empty — `cost-rules.json` prices the car |
| duration_minutes | 10–3000 | Bus: typical trip time. Train: station-to-station. Car: usual driving time |
| distance_km | 1–3000 | For car rows this is the road distance on the usual route — the curated distance the RoutingProvider prefers (ADR-007); it can never be shorter than the straight-line distance |
| source_url, collected_on, review_status | as above | Provenance and review state |

### pois.csv

| Column | Type / unit | Meaning |
| --- | --- | --- |
| destination_slug | destination slug | Owning destination |
| poi_key | kebab-case id | Stable id, unique within its destination |
| name | text | Display name |
| category | POI_CATEGORIES | Kind of place |
| typical_minutes | 15–600 | Typical visit length |
| open_time, close_time | HH:MM or both empty | Both empty means open at all hours; close must be after open |
| closed_days | list of weekday numbers or empty | 0 = Sunday through 6 = Saturday |
| entry_fee_inr | INR, >= 0 | Per adult Indian visitor; 0 when free |
| lat, lng | degrees | Location, within India's bounding box |
| source_url, collected_on, review_status | as above | Provenance and review state |

### cost-rules.json

Inputs for the car cost formula (specified in Sprint 3; this file only stores the
inputs). Each key holds `{ value, unit, source_url, collected_on, review_status }`:

| Key | Unit | Meaning |
| --- | --- | --- |
| fuel_price_inr_per_litre | INR/litre | Delhi petrol price |
| car_km_per_litre | km/litre | Typical mileage |
| toll_inr_per_km | INR/km | Typical national-highway toll rate |
| persons_per_car | persons | Seats assumed per car |
| car_rental_inr_per_day | INR/day | Typical self-drive hatchback rental |
