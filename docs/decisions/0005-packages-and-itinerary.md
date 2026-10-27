# 0005: Packages, package decisions and the grounded itinerary

Status: Accepted when the S3-1 pull request is merged (Maulik's merge is the acceptance) · Date: 27 October 2026 · Sprint 3

## Context

On 27 October the demo deadline moved: Maulik shows a working end-to-end journey on Monday 2 November. Sprint 3 therefore builds R8 (costed packages), R14 (provenance labels), the last R10 criterion (account deletion, #54) and the core of R12 and R13 (the grounded day plan and its accept, reject and modify steps), which were planned for Sprint 4. The tables already exist (`trip_package`, `cost_item`, `package_decision`, `itinerary`, `itinerary_item`); the state machine already has T9 to T14 and I3 to I5. This decision fixes every rule the Sprint 3 code needs, so no prompt has to invent one. A case it does not cover: stop and ask.

Earlier decisions still hold, in particular 0004 (n, group cap, the F5 cost formula, the car formula, provenance) and AGENTS.md section 6.

## Decisions

### a) Group size, rooms and dates

- **n** = the member count of the recommendation run the destination was chosen from (the newest run of kind shortlist). Reason: the packages must cost the same group the shortlist costed.
- **rooms** = ceil(n / 2), as in 0004 d.
- **startDate** = the first day of the group's common window (0004 b) at the moment of T9; **endDate** = startDate + nights; the trip has nights + 1 **days**. Reason: the common window is the only date range every member can make.

### b) Which packages are built (generateAndCostPackages, T9 entry action)

Modes available for the trip's origin hub and the destination:

- **bus** and **train** when `fares.csv` has a row for that hub, destination and mode with a fare;
- **car** always (its distance is the curated car row, else the estimate, as in 0004 f).

Packages, in this order, skipping a (mode, tier) pair already built and a tier whose rate is missing:

| # | Label | Transport | Stay tier |
| --- | --- | --- | --- |
| 1 | Saver | the cheapest mode (0004 tie rule: train, then bus, then car) | budget |
| 2 | Balanced | the cheapest mode | mid |
| 3 | Quickest | the mode with the shortest `duration_minutes` (ties: train, bus, car) | mid; if that pair is already built, premium and the label becomes Comfort |
| 4 | Comfort | car | premium |

Labels are unique. When Quickest has become Comfort, row 4 (car, premium) is labelled "Comfort by car".

At least three packages exist whenever the destination has all three stay rates. If fewer than three can be built, build the ones that can and say "Only N packages could be costed for <destination>"; never invent a rate.

### c) Cost lines (R8)

Each package has one line per category in `COST_CATEGORIES`:

| Category | Amount | Label (example) |
| --- | --- | --- |
| onward | n x one-way fare per person for the mode (car: the car share per person from 0004 d, which already includes half the rental) | "Train, 3 people, one way" |
| return | the same as onward | "Train, 3 people, return" |
| stay | rooms x nights x the tier's rate | "Mid-range stay, 2 rooms x 2 nights" |
| food | n x days x `food_per_day_inr` | "Food, 3 people x 3 days" |
| local | n x days x `local_per_day_inr` | "Local travel, 3 people x 3 days" |
| activities | n x the sum of `entry_fee_inr` of the places the day planner (e) schedules for this package | "Entry fees, 3 people, 5 places" |

Each line is rounded up to whole rupees once; the total is the sum of the rounded lines; per person = ceil(total / n). Every price on screen still shows the group total, the per-person figure and the word "estimate" (AGENTS.md 6.5).

### d) Provenance per line (R14) and the budget flag

- A line is **curated** when every catalogue value behind it is verified: the fare row for bus and train; the car row and all five cost rules for car; the destination's `cost_review_status` for stay, food and local; every scheduled place for activities. Otherwise it is **estimated**. `cost_item.source_ref` names the rows, for example `fares:gurugram/rishikesh/train` or `pois:rishikesh/triveni-ghat,rishikesh/ram-jhula`.
- **over_budget** = total > the group cap (0004 b) at T9. An over-budget package is still shown, with "₹X over the group budget"; it is never hidden.

### e) The day planner (R12): the engine plans, the model only writes words

The engine builds the plan from catalogue facts. It is deterministic and pure.

- **Leg times.** Onward departs 06:00 on day 1 and arrives after the leg's `duration_minutes` (the fare row; the car row for car). Return departs on the last day at clamp(22:00 minus the duration, 06:00, 16:00). These are planned times, not a timetable, and the screen says so.
- **Day 1:** the onward leg, a 60-minute `stay` item (check-in) from arrival, then activities until 19:00 if time remains.
- **Middle days:** activities from 09:00 to 19:00, at most 3, with 30 minutes between them and a 60-minute `meal` from 13:00 (or straight after the activity running at 13:00).
- **Last day:** activities from 09:00 until 60 minutes before the return departure, then the return leg.
- A `free` item fills a day that has fewer than 2 activities and at least 2 hours left.
- **Fit.** An activity takes the place's `typical_minutes`. It fits only if the whole slot is inside `open_time` to `close_time` (both empty = open at all hours) and the day's weekday (0 = Sunday) is not in `closed_days`.
- **Choice.** Group interests are the activities chosen by 2 or more members (the group profile's votes; never one member's list). A place scores 2 if its category matches a group interest through the table below, plus 1 if its row is verified. Order: score descending, then `typical_minutes` ascending, then `poi_key` ascending. Each place appears at most once in an itinerary.

| Activity | Place categories |
| --- | --- |
| trekking, camping, boating | nature, viewpoint |
| rafting, paragliding, skiing | adventure |
| wildlife_safari | nature, adventure |
| museums | museum |
| forts_palaces | fort_palace |
| temples | temple |
| yoga_wellness | wellness, temple |
| food_trails | food, market |
| shopping | market |
| nightlife | market, sight |

- `limits.maxDayHours` in the fact sheet is 15.
- **Template notes.** Every item gets a plain note from a fixed template ("Visit Triveni Ghat (temple). Entry ₹0 per person.", "Check in to your mid-range stay.", "Lunch break.", "Free time to explore."). Notes never contain times; the only numbers are entry fees, which are in the fact sheet.

### f) Words from the language model (optional, R12)

- With `LIVE_APIS=off` (every test, and any deployment without a key) the itinerary uses the template notes and records `model = 'catalogue-planner'`. The screen says "Planned from the BonVoyage catalogue".
- With `LIVE_APIS=on`, Gemini (`GEMINI_MODEL`; the spike recommends gemini-3.5-flash-lite) receives the fact sheet and the planned skeleton and returns **wording only**: a summary (up to 600 characters), 1 to 5 reasons and one note per item (up to 200 characters). Times, places and amounts never come from the model. The call has a 20-second timeout and one attempt.
- The assembled itinerary goes through `validateItinerary`. An item whose model note fails (for example an unverified number) gets its template note back. If the call fails, times out or its output fails the zod schema, the whole itinerary uses the templates. `model` records the model id actually used. The screen says "Written with <model> from catalogue facts".
- Prompts carry facts only: no member names, emails, ids or personal budgets (`assertNoPersonalData`).
- **Item verified** = the validator's verdict for that item and, for an activity, the place's row being verified. An unverified item shows "Not verified" with its reason.

### g) Package decisions (R8 with T9 to T11, I3, I4)

- **Opinions.** Any active member can mark each proposed package "Works for me" (`accept`) or "Not for me" (`reject`), one opinion per member per package, changeable. Everyone sees counts ("2 of 3 say it works"); each member sees their own. No notes, no names next to an opinion.
- **Choose** (organiser): `packageAccepted` (T11, to `package_selected`). The package becomes `accepted`; the other proposed packages become `hidden` (lockPackage).
- **Remove** (organiser): `packageRejected`. If other proposed packages remain, I4 (the package becomes `hidden`). If it was the last one, T10 (back to `shortlisted`, `selected_destination_id` cleared); the organiser can choose another destination, and T9 builds new packages.
- **Change** (organiser, I3 `packageModified`): set the transport mode and/or the stay tier of a proposed package to a combination that can be costed; recomputeCost rebuilds its lines and totals, and the opinions on that package are cleared because they were about a different package.

### h) Itinerary decisions (R13 with T12 to T14, I5), organiser only

- **Plan the days:** `generateItinerary` (T12, `package_selected` to `itinerary_proposed`). Each plan is a new version (1, 2, ...).
- **Accept:** `itineraryAccepted` (T14, to `finalised`); the itinerary becomes `accepted`.
- **Reject:** `itineraryRejected` (T13, back to `package_selected`); the itinerary becomes `rejected`. "Plan again" then makes the next version.
- **Modify** (I5 `itineraryModified`): remove an activity, or replace it with an unused place that fits the same slot (e). The itinerary is revalidated and the verified flags recomputed; the version stays.
- Members read the plan and its status; they do not decide.

### i) Trip history

The Trips page lists planning trips under "Planning" and finalised, in-progress, completed and cancelled trips under "Past and finalised trips".

### j) Account deletion (#54)

Issue #54's acceptance criteria rule. Where #54 is silent:

- the user confirms with their password and by typing DELETE;
- if they organise a trip in a planning status, deletion is refused with 422 `ACCOUNT_HAS_ACTIVE_TRIPS` listing those trips ("Cancel or finish these trips first");
- otherwise the account, sessions, profile, preferences and package opinions are deleted, and their memberships are removed; trips they organised that are finalised, completed or cancelled are deleted with them (cascade).

### k) Cut order if Sprint 3 slips

1. Itinerary Modify (I5).
2. Package Change (I3).
3. Live model wording (templates only).

Packages, choosing a package, planning, accepting and rejecting the day plan, and account deletion are never cut.

## Consequences

- Migration 0002 (S3-3) adds what the tables lack: a unique (package_id, user_id) on `package_decision`, `trip_package.label`, `itinerary.summary`, `itinerary.reasons` and `itinerary_item.unverified_reason`.
- Sprint 4 (3 to 7 November) becomes hardening: fixes from the Monday demo, the production checks (#94) if not done, fee pass 2, and anything cut under (k).
