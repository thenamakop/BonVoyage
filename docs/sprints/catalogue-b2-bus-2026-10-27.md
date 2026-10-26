# Catalogue stage B2: bus fares (27 October 2026)

The 72 bus rows in `fares.csv` (36 from delhi, 36 from gurugram). **Result:** 53 of 72 verified, 19 stay `draft` (26%; see [Maulik to check](#maulik-to-check)). `collected_on` is 2026-10-26 (UTC; the checker rejects later dates).

**Who checked:** Claude, in a separate session from Claude Code, on 27 October 2026, by direct page fetch. Decision 0002 (amended) applies.

## Method

- **Source:** the redbus.in route page for each pair (for example redbus.in/bus-tickets/delhi-to-shimla). Each page is dated by month in its title (all are November 2025 or later) and states "Cheapest Bus Ticket Price", the route distance, the average journey time and the number of daily services, across private operators and the state corporations it sells (HRTC, UTC, UPSRTC, RSRTC, PEPSU). The state corporations' own fare pages are search forms that were not submitted; see Maulik to check.
- **Gurugram rows** use the redbus "Gurugram to ..." page, which lists only departures from Gurugram; a Delhi page never supports a gurugram row.
- **`fare_per_person_inr`:** the page's cheapest ticket price, which is the README's "cheapest reasonable one-way fare ... or a common seater". Two exclusions keep it reasonable: a cheapest fare below Rs 0.60 per km is treated as a sale fare and the row stays draft; and a route served only by premium sleepers (Auli) stays draft.
- **`duration_minutes`:** the page's average journey time. **`distance_km`:** the page's route distance.
- **Nearest stop:** auli: Joshimath (the road head for Auli, 14 km); jim-corbett: Ramnagar; ranthambore: Sawai Madhopur.

## Every row

| Row | Was (fare, min, km) | Now (fare, min, km) | Status | Evidence |
| --- | --- | --- | --- | --- |
| gurugram/agra | 450, 270, 210 | 377, 294, 196 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-agra) (Nov, 2025): cheapest Rs 377, 196 km, average 4 hrs 54 mins, 80 services |
| delhi/agra | 500, 300, 230 | 248, 246, 221 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-agra) (Oct, 2026): cheapest Rs 248, 221 km, average 4 hrs 6 mins, 684 services, includes UPSRTC |
| gurugram/ajmer | 600, 480, 390 | 499, 413, 368 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-ajmer) (Oct, 2026): cheapest Rs 499, 368 km, average 6 hrs 53 mins, 105 services |
| delhi/ajmer | 650, 500, 400 | 319, 493, 418 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-ajmer) (Aug, 2026): cheapest Rs 319, 418 km, average 8 hrs 13 mins, 116 services |
| gurugram/almora | 700, 600, 360 | 695, 657, 375 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-almora) (Oct, 2026): cheapest Rs 695, 375 km, average 10 hrs 57 mins, 8 services, includes UTC |
| delhi/almora | 650, 570, 350 | 655, 603, 357 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-almora) (Oct, 2026): cheapest Rs 655, 357 km, average 10 hrs 3 mins, 11 services, includes UTC |
| gurugram/alwar | 300, 240, 160 | 239, 120, 132 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-alwar) (Sep, 2026): cheapest Rs 239, 132 km, average 2 hrs 0 mins, 135 services |
| delhi/alwar | 320, 260, 180 | 201, 212, 168 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-alwar) (Sep, 2026): cheapest Rs 201, 168 km, average 3 hrs 32 mins, 179 services |
| gurugram/amritsar | 800, 540, 460 | 482, 646, 466 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-amritsar) (Sep, 2026): cheapest Rs 482, 466 km, average 10 hrs 46 mins, 27 services |
| delhi/amritsar | 850, 560, 470 | 341, 518, 459 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-amritsar) (Oct, 2026): cheapest Rs 341, 459 km, average 8 hrs 38 mins, 78 services, includes PEPSU |
| gurugram/auli | 1200, 840, 520 | 1200, 840, 520 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-joshimath) (Oct, 2026): cheapest Rs 3909, 531 km, average 17 hrs 5 mins, 1 services; **draft:** the cheapest listed fare (Rs 3909) is a premium sleeper with 1 service(s); no ordinary or seater service is listed, so it is not a "cheapest reasonable" fare |
| delhi/auli | 1150, 820, 510 | 1150, 820, 510 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-joshimath) (Oct, 2026): cheapest Rs 2884, 516 km, average 14 hrs 6 mins, 4 services; **draft:** the cheapest listed fare (Rs 2884) is a premium sleeper with 4 service(s); no ordinary or seater service is listed, so it is not a "cheapest reasonable" fare |
| gurugram/bharatpur | 350, 270, 190 | 475, 233, 177 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-bharatpur) (Oct, 2026): cheapest Rs 475, 177 km, average 3 hrs 53 mins, 2 services |
| delhi/bharatpur | 380, 290, 210 | 208, 324, 202 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-bharatpur) (Oct, 2026): cheapest Rs 208, 202 km, average 5 hrs 24 mins, 4 services, includes RSRTC |
| gurugram/bhimtal | 600, 480, 310 | 1170, 569, 334 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-bhimtal) (Oct, 2026): cheapest Rs 1170, 334 km, average 9 hrs 29 mins, 8 services |
| delhi/bhimtal | 550, 460, 300 | 963, 471, 316 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-bhimtal) (Aug, 2026): cheapest Rs 963, 316 km, average 7 hrs 51 mins, 9 services |
| gurugram/bikaner | 700, 540, 440 | 810, 580, 418 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-bikaner) (Oct, 2026): cheapest Rs 810, 418 km, average 9 hrs 40 mins, 3 services |
| delhi/bikaner | 750, 560, 460 | 537, 685, 426 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-bikaner) (Oct, 2026): cheapest Rs 537, 426 km, average 11 hrs 25 mins, 13 services, includes RSRTC |
| gurugram/bundi | 700, 600, 460 | 599, 440, 448 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-bundi) (Oct, 2026): cheapest Rs 599, 448 km, average 7 hrs 20 mins, 15 services |
| delhi/bundi | 750, 620, 480 | 550, 489, 498 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-bundi) (Sep, 2026): cheapest Rs 550, 498 km, average 8 hrs 9 mins, 21 services, includes RSRTC |
| gurugram/chail | 800, 540, 350 | 800, 540, 350 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-chail); **draft:** redbus.in has no route page for this pair |
| delhi/chail | 750, 520, 340 | 750, 520, 340 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-chail); **draft:** redbus.in has no route page for this pair |
| gurugram/dalhousie | 1100, 780, 580 | 1100, 780, 580 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-dalhousie); **draft:** redbus.in has no route page for this pair |
| delhi/dalhousie | 1050, 760, 570 | 802, 755, 564 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-dalhousie) (Oct, 2026): cheapest Rs 802, 564 km, average 12 hrs 35 mins, 10 services, includes HRTC |
| gurugram/dehradun | 600, 390, 270 | 208, 397, 303 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-dehradun) (Nov, 2025): cheapest Rs 208, 303 km, average 6 hrs 37 mins, 132 services |
| delhi/dehradun | 550, 370, 260 | 550, 370, 260 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-dehradun) (Oct, 2026): cheapest Rs 99, 239 km, average 5 hrs 26 mins, 465 services, includes UTC; **draft:** the cheapest listed fare (Rs 99 for 239 km, Rs 0.41 per km) looks like a sale fare, well below a normal seater fare |
| gurugram/dharamshala | 1000, 660, 480 | 1417, 727, 557 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-dharamshala) (Oct, 2026): cheapest Rs 1417, 557 km, average 12 hrs 7 mins, 4 services |
| delhi/dharamshala | 950, 640, 470 | 450, 644, 493 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-dharamshala) (Oct, 2026): cheapest Rs 450, 493 km, average 10 hrs 44 mins, 81 services, includes HRTC |
| gurugram/gwalior | 600, 420, 320 | 799, 424, 310 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-gwalior) (Oct, 2026): cheapest Rs 799, 310 km, average 7 hrs 4 mins, 4 services |
| delhi/gwalior | 650, 440, 340 | 399, 395, 341 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-gwalior) (Nov, 2025): cheapest Rs 399, 341 km, average 6 hrs 35 mins, 70 services |
| gurugram/haridwar | 500, 360, 230 | 189, 353, 238 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-haridwar) (Aug, 2026): cheapest Rs 189, 238 km, average 5 hrs 53 mins, 135 services |
| delhi/haridwar | 450, 340, 220 | 199, 301, 234 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-haridwar) (Oct, 2026): cheapest Rs 199, 234 km, average 5 hrs 1 mins, 430 services |
| gurugram/jaipur | 400, 330, 270 | 400, 330, 270 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-jaipur) (Nov, 2025): cheapest Rs 90, 237 km, average 4 hrs 45 mins, 330 services; **draft:** the cheapest listed fare (Rs 90 for 237 km, Rs 0.38 per km) looks like a sale fare, well below a normal seater fare |
| delhi/jaipur | 420, 350, 280 | 420, 350, 280 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-jaipur) (Oct, 2026): cheapest Rs 93, 287 km, average 5 hrs 47 mins, 377 services; **draft:** the cheapest listed fare (Rs 93 for 287 km, Rs 0.32 per km) looks like a sale fare, well below a normal seater fare |
| gurugram/jim-corbett | 500, 420, 260 | 500, 420, 260 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-ramnagar); **draft:** redbus.in has no route page for this pair |
| delhi/jim-corbett | 450, 400, 250 | 450, 400, 250 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-ramnagar); **draft:** the redbus.in "Delhi to Ramnagar" page gives 627 km, so it is a different Ramnagar, not Ramnagar (Uttarakhand), about 250 km away |
| gurugram/jodhpur | 900, 720, 600 | 950, 656, 560 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-jodhpur) (Sep, 2026): cheapest Rs 950, 560 km, average 10 hrs 56 mins, 19 services |
| delhi/jodhpur | 950, 740, 620 | 814, 732, 569 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-jodhpur) (Nov, 2025): cheapest Rs 814, 569 km, average 12 hrs 12 mins, 22 services, includes RSRTC |
| gurugram/kasauli | 700, 450, 300 | 700, 450, 300 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-kasauli); **draft:** redbus.in has no route page for this pair |
| delhi/kasauli | 650, 430, 290 | 650, 430, 290 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-kasauli); **draft:** redbus.in has no route page for this pair |
| gurugram/kasol | 1100, 780, 520 | 699, 782, 593 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-kasol) (Oct, 2026): cheapest Rs 699, 593 km, average 13 hrs 2 mins, 12 services |
| delhi/kasol | 1050, 760, 510 | 1050, 760, 510 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-kasol) (Oct, 2026): cheapest Rs 309, 529 km, average 10 hrs 36 mins, 148 services; **draft:** the cheapest listed fare (Rs 309 for 529 km, Rs 0.58 per km) looks like a sale fare, well below a normal seater fare |
| gurugram/kurukshetra | 350, 240, 190 | 399, 297, 218 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-kurukshetra) (Oct, 2026): cheapest Rs 399, 218 km, average 4 hrs 57 mins, 53 services |
| delhi/kurukshetra | 320, 220, 180 | 310, 208, 154 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-kurukshetra) (Oct, 2026): cheapest Rs 310, 154 km, average 3 hrs 28 mins, 415 services |
| gurugram/lucknow | 900, 600, 550 | 437, 583, 468 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-lucknow) (Oct, 2026): cheapest Rs 437, 468 km, average 9 hrs 43 mins, 53 services |
| delhi/lucknow | 950, 620, 560 | 315, 534, 491 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-lucknow) (Oct, 2026): cheapest Rs 315, 491 km, average 8 hrs 54 mins, 746 services |
| gurugram/manali | 1200, 840, 560 | 580, 820, 612 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-manali) (Aug, 2026): cheapest Rs 580, 612 km, average 13 hrs 40 mins, 13 services |
| delhi/manali | 1150, 820, 550 | 364, 692, 548 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-manali) (Oct, 2026): cheapest Rs 364, 548 km, average 11 hrs 32 mins, 221 services, includes HRTC |
| gurugram/mathura | 300, 210, 150 | 356, 224, 140 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-mathura) (Oct, 2026): cheapest Rs 356, 140 km, average 3 hrs 44 mins, 79 services |
| delhi/mathura | 330, 230, 170 | 156, 185, 164 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-mathura) (Oct, 2026): cheapest Rs 156, 164 km, average 3 hrs 5 mins, 560 services, includes UPSRTC |
| gurugram/mussoorie | 650, 450, 300 | 299, 530, 364 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-mussoorie) (Oct, 2026): cheapest Rs 299, 364 km, average 8 hrs 50 mins, 38 services |
| delhi/mussoorie | 600, 430, 290 | 329, 461, 299 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-mussoorie) (Oct, 2026): cheapest Rs 329, 299 km, average 7 hrs 41 mins, 120 services |
| gurugram/nainital | 600, 480, 320 | 479, 520, 312 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-nainital) (Oct, 2026): cheapest Rs 479, 312 km, average 8 hrs 40 mins, 49 services |
| delhi/nainital | 550, 460, 310 | 399, 470, 294 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-nainital) (Oct, 2026): cheapest Rs 399, 294 km, average 7 hrs 50 mins, 133 services |
| gurugram/neemrana | 350, 180, 120 | 285, 131, 91 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-neemrana) (Sep, 2026): cheapest Rs 285, 91 km, average 2 hrs 11 mins, 58 services |
| delhi/neemrana | 400, 200, 140 | 279, 192, 139 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-neemrana) (Aug, 2026): cheapest Rs 279, 139 km, average 3 hrs 12 mins, 60 services |
| gurugram/orchha | 700, 600, 450 | 700, 600, 450 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-orchha); **draft:** redbus.in has no route page for this pair |
| delhi/orchha | 750, 620, 470 | 750, 620, 470 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-orchha); **draft:** redbus.in lists one bus at Rs 1000 and gives no distance |
| gurugram/pushkar | 650, 500, 400 | 499, 464, 380 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-pushkar) (Oct, 2026): cheapest Rs 499, 380 km, average 7 hrs 44 mins, 13 services |
| delhi/pushkar | 700, 520, 410 | 549, 563, 430 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-pushkar) (Sep, 2026): cheapest Rs 549, 430 km, average 9 hrs 23 mins, 15 services |
| gurugram/ranthambore | 600, 480, 360 | 600, 480, 360 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-sawai-madhopur); **draft:** redbus.in has no route page for this pair |
| delhi/ranthambore | 650, 500, 380 | 600, 540, 355 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-sawai-madhopur) (Oct, 2026): cheapest Rs 600, 355 km, average 9 hrs 0 mins, 1 services |
| gurugram/rishikesh | 550, 390, 250 | 201, 375, 257 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-rishikesh) (Oct, 2026): cheapest Rs 201, 257 km, average 6 hrs 15 mins, 124 services |
| delhi/rishikesh | 500, 370, 240 | 500, 370, 240 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-rishikesh) (Oct, 2026): cheapest Rs 99, 252 km, average 5 hrs 24 mins, 442 services; **draft:** the cheapest listed fare (Rs 99 for 252 km, Rs 0.39 per km) looks like a sale fare, well below a normal seater fare |
| gurugram/sariska | 350, 270, 190 | 350, 270, 190 | draft | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-sariska); **draft:** redbus.in has no route page for this pair |
| delhi/sariska | 380, 290, 210 | 380, 290, 210 | draft | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-sariska); **draft:** redbus.in has no route page for this pair |
| gurugram/shimla | 800, 540, 360 | 649, 635, 410 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-shimla) (Oct, 2026): cheapest Rs 649, 410 km, average 10 hrs 35 mins, 11 services |
| delhi/shimla | 750, 520, 350 | 449, 531, 346 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-shimla) (Oct, 2026): cheapest Rs 449, 346 km, average 8 hrs 51 mins, 77 services, includes HRTC |
| gurugram/udaipur | 1100, 720, 630 | 499, 695, 630 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-udaipur) (Sep, 2026): cheapest Rs 499, 630 km, average 11 hrs 35 mins, 72 services |
| delhi/udaipur | 1150, 740, 650 | 599, 777, 681 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-udaipur) (Oct, 2026): cheapest Rs 599, 681 km, average 12 hrs 57 mins, 80 services |
| gurugram/vrindavan | 320, 240, 160 | 393, 186, 133 | verified | [redbus.in](https://www.redbus.in/bus-tickets/gurgaon-to-vrindavan) (Sep, 2026): cheapest Rs 393, 133 km, average 3 hrs 6 mins, 53 services |
| delhi/vrindavan | 350, 260, 180 | 234, 182, 157 | verified | [redbus.in](https://www.redbus.in/bus-tickets/delhi-to-vrindavan) (Oct, 2026): cheapest Rs 234, 157 km, average 3 hrs 2 mins, 161 services, includes UPSRTC |

## Maulik to check

1. **gurugram/auli**: the cheapest listed fare (Rs 3909) is a premium sleeper with 1 service(s); no ordinary or seater service is listed, so it is not a "cheapest reasonable" fare. [check](https://www.redbus.in/bus-tickets/gurgaon-to-joshimath)
2. **delhi/auli**: the cheapest listed fare (Rs 2884) is a premium sleeper with 4 service(s); no ordinary or seater service is listed, so it is not a "cheapest reasonable" fare. [check](https://www.redbus.in/bus-tickets/delhi-to-joshimath)
3. **gurugram/chail**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/gurgaon-to-chail)
4. **delhi/chail**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/delhi-to-chail)
5. **gurugram/dalhousie**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/gurgaon-to-dalhousie)
6. **delhi/dehradun**: the cheapest listed fare (Rs 99 for 239 km, Rs 0.41 per km) looks like a sale fare, well below a normal seater fare. [check](https://www.redbus.in/bus-tickets/delhi-to-dehradun)
7. **gurugram/jaipur**: the cheapest listed fare (Rs 90 for 237 km, Rs 0.38 per km) looks like a sale fare, well below a normal seater fare. [check](https://www.redbus.in/bus-tickets/gurgaon-to-jaipur)
8. **delhi/jaipur**: the cheapest listed fare (Rs 93 for 287 km, Rs 0.32 per km) looks like a sale fare, well below a normal seater fare. [check](https://www.redbus.in/bus-tickets/delhi-to-jaipur)
9. **gurugram/jim-corbett**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/gurgaon-to-ramnagar)
10. **delhi/jim-corbett**: the redbus.in "Delhi to Ramnagar" page gives 627 km, so it is a different Ramnagar, not Ramnagar (Uttarakhand), about 250 km away. [check](https://www.redbus.in/bus-tickets/delhi-to-ramnagar)
11. **gurugram/kasauli**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/gurgaon-to-kasauli)
12. **delhi/kasauli**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/delhi-to-kasauli)
13. **delhi/kasol**: the cheapest listed fare (Rs 309 for 529 km, Rs 0.58 per km) looks like a sale fare, well below a normal seater fare. [check](https://www.redbus.in/bus-tickets/delhi-to-kasol)
14. **gurugram/orchha**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/gurgaon-to-orchha)
15. **delhi/orchha**: redbus.in lists one bus at Rs 1000 and gives no distance. [check](https://www.redbus.in/bus-tickets/delhi-to-orchha)
16. **gurugram/ranthambore**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/gurgaon-to-sawai-madhopur)
17. **delhi/rishikesh**: the cheapest listed fare (Rs 99 for 252 km, Rs 0.39 per km) looks like a sale fare, well below a normal seater fare. [check](https://www.redbus.in/bus-tickets/delhi-to-rishikesh)
18. **gurugram/sariska**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/gurgaon-to-sariska)
19. **delhi/sariska**: redbus.in has no route page for this pair. [check](https://www.redbus.in/bus-tickets/delhi-to-sariska)
20. **Source standing.** redbus.in is a ticket seller, not a state transport corporation. Its route pages are the readable, dated source for current fares; the corporations' fare pages need a search form submitted. Accept, or keep the rows draft.
21. **Sale-fare threshold** (below Rs 0.60 per km treated as a sale fare). Accept, or set another threshold.
22. **Seed margins.** Bus fares move both ways (for example delhi/agra Rs 500 to 248, gurugram/bhimtal Rs 600 to 1170). Run the seed integration tests before merging.

## Review decisions (Maulik, 27 October 2026)

- Items 1 to 19: stay draft (shown as estimated).
- Item 20: accepted; redbus.in route pages count as the readable, dated source for bus fares.
- Item 21: accepted; fares below Rs 0.60 per km are treated as sale fares.
- Item 22: accepted, subject to the seed tests below.

## Spot check

Recorded before merge (decision 0002), as in the stage C batches: at Maulik's request, Claude re-read three rows in the Claude desktop app's built-in browser on 27 October 2026, a few minutes after collection. Maulik's approval of the PR stands in for his own check.

| Row | Value in file | What the source says | Holds |
| --- | --- | --- | --- |
| delhi/agra | Rs 248, 246 min, 221 km | "Cheapest Bus Ticket Price : INR 248.00" (Oct, 2026) | yes |
| delhi/shimla | Rs 449, 531 min, 346 km | "Cheapest Bus Ticket Price : INR 449.00"; "a distance of 346 kms, in around 8 hrs 51 mins" | yes |
| gurugram/udaipur | Rs 499, 695 min, 630 km | "Cheapest Bus Ticket Price : INR 500.00"; journey time now "11 hrs 32 mins" | yes, within Rs 1 and 3 minutes |

3 of 3 hold. The gurugram/udaipur re-read shows that these pages are live: the cheapest fare and average time move day to day. The file keeps the values read at collection.

