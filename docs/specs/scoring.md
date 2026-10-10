# Scoring specification

Status: Draft for review by Maulik

## 1. Inputs

Member profile:

- destination_types
- activities
- climate (cold | mild | warm | any)
- travel_style (budget | comfort | premium)
- budget_min_inr and budget_max_inr
- date_start and date_end
- past trips, each with a rating from 1 to 5

Destination:

- types
- activities
- climate (cold | mild | warm)
- best_months (1-12)
- min_nights
- stay_budget_inr, stay_mid_inr and stay_premium_inr (per room per night, two people per room)
- food_per_day_inr and local_per_day_inr (per person)

## 2. Hard constraints

Evaluated first, in plain arithmetic. Each has an id.

- F1 radius: distanceKm(origin, d) <= radius_km. The distance comes from the RoutingProvider (ADR-007).
- F2 duration: duration_nights >= d.min_nights.
- F3 window: the common window (the intersection of all member windows) has at least duration_nights + 1 days. This is a group-level gate: if it fails, nothing is feasible and the diagnostic names F3.
- F4 season: at least one month touched by the common window is in d.best_months.
- F5 budget: estimatedGroupCost(d) <= budget_total_inr, where estimatedGroupCost = n x 2 x cheapestOneWayPerPerson (bus or train fare; car = car trip cost from cost rules divided by seats) + ceil(n / 2) x duration_nights x stay_budget_inr + n x (duration_nights + 1) x (food_per_day_inr + local_per_day_inr).

## 3. Member score

s_i(d) = 0.5 x J(T_i, T_d) + 0.3 x J(A_i, A_d) + 0.2 x c_i(d)

- J is Jaccard similarity |X ∩ Y| / |X ∪ Y|, and is 0 when both sets are empty.
- c_i(d) = 1 if the member's climate is "any" or equals d.climate, else 0.
- Past trips rated 4 or 5 add their destination's types to T_i at weight 0.5, using weighted Jaccard.
- Past trips rated 1 or 2 are ignored for now (future work).

## 4. Group-fit score

GFS(d) = alpha x mean_i s_i(d) + beta x min_i s_i(d) - gamma x sd_i s_i(d)

- sd is the population standard deviation.
- Defaults: alpha 0.5, beta 0.3, gamma 0.2. They are stored on every recommendation run.
- Order by GFS descending, then mean descending, then slug ascending, so the ranking is deterministic.

## 5. Explanation (R7)

For each member, state which of their types, activities and climate the destination meets and which it misses.

## 6. Diagnostic when fewer than 3 destinations are feasible

- For every infeasible destination, list the constraints it fails and the minimal relaxation for each: extra km, extra nights, extra rupees, or the month shift needed.
- A near miss fails exactly one constraint.
- alternatives = up to 3 near misses, ordered by relative relaxation (relaxation divided by the current limit).
- bindingConstraint = the constraint with the most near misses; ties are broken in the order F5, F1, F2, F4.
- If F3 fails: bindingConstraint = F3 and alternatives = [].

## 7. Worked example (golden test data)

```text
Weights: alpha 0.5, beta 0.3, gamma 0.2. No past trips.
m1: types {mountain, adventure}; activities {trekking, rafting, camping}; climate cold
m2: types {heritage, city}; activities {museums, food_trails, shopping}; climate warm
m3: types {mountain, spiritual}; activities {yoga_wellness, temples, trekking}; climate mild
d1: types {spiritual, adventure, mountain}; activities {rafting, yoga_wellness, temples, camping}; climate mild
d2: types {heritage, city}; activities {forts_palaces, museums, food_trails, shopping}; climate warm
d3: types {mountain, adventure, hill_station}; activities {trekking, paragliding, camping, skiing}; climate cold
Member scores (m1, m2, m3): d1 = (0.453333, 0, 0.653333); d2 = (0, 0.925, 0); d3 = (0.653333, 0, 0.175)
d1: mean 0.368889, min 0, sd 0.273324, GFS 0.129780
d2: mean 0.308333, min 0, sd 0.436049, GFS 0.066957
d3: mean 0.276111, min 0, sd 0.276138, GFS 0.082828
Ranking by GFS: d1, d3, d2. Ranking by mean alone would be d1, d2, d3: the disagreement penalty lifts d3 above d2 because only one member likes d2. Engine tests must assert these values to within 1e-6.
```

Verified: recomputed independently on 2026-10-10; every value matches to 6 decimal places.
