# Catalogue S4-8 batch 1: Sariska destination costs (B1, #38)

The last draft row in stage B1 is `sariska`'s cost columns in `packages/db/catalogue/destinations.csv`: `stay_budget_inr`, `stay_mid_inr`, `stay_premium_inr`, `food_per_day_inr` and `local_per_day_inr`. They went back to `draft` on 26 October, because two browser reads of the mid tier disagreed (₹13,594 and ₹9,945), and because [catalogue-b1-costs-2026-10-26.md](catalogue-b1-costs-2026-10-26.md) left open whether Sariska should be priced from its own lodges or from Alwar (its "Maulik to check" items 3 and 5).

**Result:** all five values re-read from live pages, with the B1 report's method unchanged. Food and local hold exactly. The three stay tiers move by +12 %, −10 % and +1 %. **Decision (Maulik, 29 October 2026): price Sariska from its own lodges (option L).** Part 2 applies the row once the spot check below is recorded.

**Who checked:** Claude in Cowork, in Maulik's Chrome through the Claude browser extension, without signing in. Reads ran from about 22:25 to 22:40 UTC on 28 October 2026 (03:55 to 04:10 IST on 29 October), so `cost_collected_on` is `2026-10-28` (the checker compares against the UTC date). Decision 0002 (amended 24 October) still requires Maulik's spot check before merge.

## Method

The same as [catalogue-b1-costs-2026-10-26.md, Method](catalogue-b1-costs-2026-10-26.md#method):

- **Stays:** Booking.com, one room, 2 adults, Saturday 21 to Sunday 22 November 2026, INR including "taxes and charges". Search "Sariska, Rajasthan, India" (Booking resolves it to "Sariska National Park").
  - **Budget:** the median of the 5 cheapest rooms rated "Good: 7+" in the list sorted by price.
  - **Mid and premium:** the 50th and 80th percentiles (linear interpolation) of all results in Booking's default order (fewer than 50 exist).
  - **Left out:** dormitory beds; whole houses, villas or apartments with 2 or more bedrooms; properties more than 20 km from Booking's centre. Rounded to the nearest ₹100.
- **Food:** Google Maps "restaurants" centred on the catalogue point (27.3175, 76.4369) at zoom 14, English, India. The median of the "price per person" range midpoints, with ranges wider than ₹400 counted as their lowest ₹400, "₹2,000+" as ₹2,000 and a lower bound of ₹1 as ₹0. Food per day = 2.5 meals, to the nearest ₹50.
- **Local:** CabBazar's full-day AC hatchback rate (8 hours, 80 km) ÷ `persons_per_car` (4), to the nearest ₹50. CabBazar still has no Sariska page (`/city/Sariska` shows no rates), so Alwar (35 km) is used, as on 26 October.

## Every row

| Column | Was (file) | Now | Change | Evidence |
| --- | --- | --- | --- | --- |
| stay_budget_inr | 4,200 | **4,700** | +12 % | [Sorted list, rated 7+](https://www.booking.com/searchresults.en-gb.html?ss=Sariska%2C+Rajasthan%2C+India&checkin=2026-11-21&checkout=2026-11-22&group_adults=2&no_rooms=1&group_children=0&selected_currency=INR&order=price&nflt=review_score%3D70): Fort View Guest House 2,363 (9.9 km); Hotel Wow, Relish in the Wild 3,990 (13.4 km); **The Vanashva 4,726** (9.5 km); Green Valley Sariska 5,723 (8.7 km); Shivir Aranya 6,615 (16.8 km). Median 4,726. |
| stay_mid_inr | 13,600 | **12,300** | −10 % | [Default list](https://www.booking.com/searchresults.en-gb.html?ss=Sariska%2C+Rajasthan%2C+India&checkin=2026-11-21&checkout=2026-11-22&group_adults=2&no_rooms=1&group_children=0&selected_currency=INR): 29 found, 29 priced, 28 used (Mehaay Wilderness left out: "Two-Bedroom House"). All within 16.8 km. p50 12,289 (between The Sariska Retreat 11,799 and The Grand Sariska Baagh 12,778). |
| stay_premium_inr | 17,600 | **17,800** | +1 % | Same list: p80 17,818 (between Kadamb Bagh 17,110 and Little Affair 18,290). |
| food_per_day_inr | 750 | **750** | holds | [Map](https://www.google.com/maps/search/restaurants/@27.3175,76.4369,14z?hl=en&gl=in): 60 results read, 40 priced, median meal ₹300; 2.5 × 300 = 750. |
| local_per_day_inr | 350 | **350** | holds | [CabBazar Alwar](https://cabbazar.com/city/Alwar): "Hatchback, Wagon-R, Indica or similar, Full day taxi price ₹1400"; 1,400 ÷ 4 = 350. |

**Row after the change (option L, chosen 29 October 2026):**

```text
cost_source_url  = the Booking.com sorted-list URL above (unchanged)
cost_collected_on = 2026-10-28
cost_review_status = verified
stay_budget_inr 4700, stay_mid_inr 12300, stay_premium_inr 17800, food_per_day_inr 750, local_per_day_inr 350
```

budget <= mid <= premium holds (4,700 <= 12,300 <= 17,800).

### Why the mid tier moves between reads

| Read | When (UTC) | Found | p50 | p80 |
| --- | --- | --- | --- | --- |
| B1 second pass | 25 October, ~23:30 | 29 | 13,594 | 17,600 |
| Re-read (b) | 26 October, ~17:30 | 29 (25 priced) | 9,945 | about 14,700 |
| This read | 28 October, ~22:35 | 29 (29 priced, 28 used) | 12,289 | 17,818 |

The market is 29 lodges, and 4 of them were unpriced on 26 October. When a few lodges drop out or change rates, the median moves by thousands. Today's read lies between the two earlier ones, and every list was complete. Premium is stable (17,600 to 17,800).

## Demo and test impact

`rg -i sariska docs/demo apps/api/src/seed apps/api/src/e2e packages/engine/src` finds nothing. No demo line or seed test quotes Sariska. A higher budget tier (4,700) slightly raises Sariska's estimated group cost, so Part 2 must still run the seed and e2e tests (S4-8 Part 2, step 4).

## Decision needed (Maulik)

The open item from 26 October: price Sariska from its own lodges, or from Alwar?

| | **L: Sariska lodges (recommended)** | **A: Alwar town** |
| --- | --- | --- |
| Stay (budget / mid / premium) | 4,700 / 12,300 / 17,800 (this report) | Today's Alwar read: budget 2,600 (Hotel Atlantic 2,100; Aangan House 2,520; **Lotus Vista 2,592**; Sariska Celebration 2,625; Sparrow Hotels 3,193); default list 36 found, 29 used, p50 2,100 and p80 4,900. The p50 is below the budget tier, so the tiers would need a rule change. |
| Consistent with the method | Yes: every other destination is priced where the visitor sleeps, within 20 km of Booking's centre. | No: it would be the only destination priced from a town 35 km away. |
| What it misses | Cheap lodges that are not on Booking (the same limit as Chakrata and Kanatal). | About 70 km a day between Alwar and the reserve, which `local_per_day_inr` (80 km a day, shared by four) mostly absorbs but no line labels. |
| What the app shows | Sariska stays pricey; a budget group is steered to cheaper places, which is honest. | Sariska looks cheaper than staying there really is. |

**Recommendation: L.** It keeps one method for all 44 destinations. Alwar is already its own catalogue destination (2,500 / 2,600 / 6,100), so a budget group that wants the reserve can be shown Alwar.

## Review decisions (Maulik, 29 October 2026)

- **Lodges or Alwar:** L, Sariska's own lodges.
- **Mid tier volatility:** not decided separately; option L's figures use today's 12,300 (a complete list, between the two earlier reads). Maulik may still ask for a fourth read before the spot check.

## Spot check

Record before Part 2 runs (decision 0002, amended). A row passes if the page shows the same kind of list and the figure is within about 20 % of "Now". S4-8 Part 2 refuses to start while this table is empty.

| Column | Link to open | Your result | Checked by, date |
| --- | --- | --- | --- |
| stay_budget_inr | sorted list, rated 7+ | ₹4,726: median of the 5 cheapest rated 7+ (2,363; 3,990; 4,726; 5,723; 6,615), ₹4,700 rounded. Same lodges and distances. Holds (0 %). | Independent Claude session, 2026-10-29 |
| stay_mid_inr | default list | ₹12,288.5 (p50): 29 found, 29 priced, 28 used (Mehaay Wilderness, "Two-Bedroom House", left out), all within 16.8 km; ₹12,300 rounded. p80 is 17,818. Holds (0 %). | Independent Claude session, 2026-10-29 |
| local_per_day_inr | CabBazar Alwar | Hatchback full day taxi price ₹1,400; 1,400 ÷ 4 = ₹350. Holds (0 %). | Independent Claude session, 2026-10-29 |
