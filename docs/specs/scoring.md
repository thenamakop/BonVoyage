# Scoring specification

Status: Accepted

Accepted rules: [decision 0004](../decisions/0004-recommendation-rules.md). `n` counts active trip members with a submitted preference; excluded members never count. The group profile is computed on read, not stored.

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
- F3 window: the common window (the intersection of participating members' windows, both ends inclusive) has at least duration_nights + 1 days. No intersection or a shorter window is a blocking group conflict. On a recommendation request, store a diagnostic run with bindingConstraint F3 and no alternatives, then fire conflictDetected (T4) back to collecting_preferences; do not use T6 for F3.
- F4 season: at least one month touched by the common window is in d.best_months.
- F5 budget: estimatedGroupCost(d) <= groupCap, where perPersonCap is the lowest participating member maximum and groupCap = min(budget_total_inr, n x perPersonCap).

The per-person budget band is [highest member minimum, lowest member maximum]. A disjoint band is a warning only, not a blocking conflict. The computed group profile includes this band, the common window, both caps and vote counts per type, activity and climate.

```text
carShare = ceil(n / persons_per_car) x (km x (fuel_price_inr_per_litre / car_km_per_litre
           + toll_inr_per_km) + car_rental_inr_per_day x (duration_nights + 1) / 2) / n
cheapestOneWayPerPerson = min(available bus fare, available train fare, carShare)
estimatedGroupCost = n x 2 x cheapestOneWayPerPerson
  + ceil(n / 2) x duration_nights x stay_budget_inr
  + n x (duration_nights + 1) x (food_per_day_inr + local_per_day_inr)
```

Bus and train fares are from the trip's origin hub. Round up to whole rupees only at the exported function boundary, not during intermediate arithmetic. Only active destinations with all three budget-stay, food and local costs set are candidates; list incomplete destinations in the diagnostic. Distances come from catalogue car rows, then estimateRoadKm; verified rows are curated, draft or computed values estimated. Every Sprint 2 cost is labelled "estimate".

## 3. Member score

s_i(d) = 0.5 x J(T_i, T_d) + 0.3 x J(A_i, A_d) + 0.2 x c_i(d)

- J is Jaccard similarity |X ∩ Y| / |X ∪ Y|, and is 0 when both sets are empty.
- c_i(d) = 1 if the member's climate is "any" or equals d.climate, else 0.
- For types, J is weighted Jaccard: the member weight is 1 for a stated type, 0.5 for a type appearing only through past trips rated 4 or 5, and 0 otherwise. Stated weights are not increased by past trips. Destination weights are 1 for its types and 0 otherwise. Over the union of type keys, WJ = sum(min(memberWeight, destinationWeight)) / sum(max(memberWeight, destinationWeight)); 0 when both are empty. With no past trips this is ordinary Jaccard. Activities use ordinary Jaccard.
- Past trips rated 1 or 2 are ignored for now (future work); rating 3 adds no type weight.

## 4. Group-fit score

GFS(d) = alpha x mean_i s_i(d) + beta x min_i s_i(d) - gamma x sd_i s_i(d)

- sd is the population standard deviation.
- Defaults: alpha 0.5, beta 0.3, gamma 0.2 in apps/api/config/scoring.json, validated at start-up, injected through dependencies and stored on every recommendation run.
- Order by GFS descending, then mean descending, then slug ascending, so the ranking is deterministic.

## 5. Explanation (R7)

For each member, state which of their stated types, activities and climate the destination meets and which it misses; past-trip-only types are not stated wants. These explanations are private: a member sees only their own. Group views show counts and list a preference value only when at least two members share it, never names next to preferences.

Store every feasible destination ranked; the page initially shows five and offers "Show all". Types are soft preferences, not constraints: when at least three destinations satisfy F1 to F5, return a shortlist even if types match nothing. Mark a weak match when the best mean score is below 0.25.

## 6. Diagnostic when fewer than 3 destinations are feasible

- For every infeasible destination, list the constraints it fails and the minimal relaxation for each: extra km, extra nights, extra rupees, or the month shift needed.
- A near miss fails exactly one constraint.
- F4 relaxation is the smallest circular month distance between any month touched by the common window and any best month (wrap December to January); relative relaxation = shift / 12. Other relative relaxations are relaxation / current limit (radius, nights or group cap).
- alternatives = up to 3 near misses, ordered by relative relaxation ascending, then slug ascending.
- bindingConstraint = the constraint with the most near misses; ties are broken in the order F5, F1, F2, F4. It is null when at least three destinations are feasible.
- Suggestions are per constraint among near misses: choose the smallest new limit that unlocks at least one destination and list every slug it unlocks. Round F1's new radius up to 10 km and F5's new group cap up to 500 rupees; F2 gives new nights and F4 gives the month shift. F5 identifies whether the cap comes from the trip or members; for a member cap, also give the new per-person maximum (newGroupCap / n, rounded up to 500 rupees). The organiser cannot raise members' maxima.
- If F3 fails: bindingConstraint = F3, alternatives = [] and suggestions = []; the request uses T4 as specified in section 2.
- Always list incomplete catalogue destinations separately rather than silently dropping them.

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
