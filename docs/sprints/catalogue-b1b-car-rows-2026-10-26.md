# Catalogue stage B1b verification: car rows (26 October 2026)

Stage B1b covers the 88 car rows in `fares.csv`: `gurugram` and `delhi` to each of the 44 destinations. Each row's `distance_km` and `duration_minutes` are checked; car rows never carry a fare (`cost-rules.json` prices the car).

**Result:** 88 of 88 rows verified, `collected_on` 2026-10-26.
- With stage B1a (PR #83, merged), `pnpm catalogue:check` shows Stage B1 at 136/137 with 0 errors. The one row left is sariska's destination costs, set back to draft by the B1a spot check.
- Every distance is at least the straight-line distance, and none is more than twice it.

**Who checked:** Claude, the same session as B1a's second pass, read every route in Maulik's own browser (Brave, through the Claude browser extension) on 26 October 2026, between 00:05 and 00:20 UTC. Under decision 0002 (amended 24 October), Maulik's review and a recorded spot check are still needed before merge.

## Method

- **Source:** Google Maps driving directions from the hub's catalogue point to the destination's catalogue point.
  - The departure is set to **07:00 on Saturday 21 November 2026** (the B1a reference weekend), so the times are Google's "typically" times for a weekend morning start, not live traffic.
  - Each row's `source_url` opens that exact search.
- **`distance_km`:** the distance of the first route Google lists (its recommended route for that departure), to the nearest km.
- **`duration_minutes`:** the midpoint of that route's "typically X to Y" range. For example, "typically 3 to 5 hr" gives 240 minutes.
- **Two destinations are routed to where visitors go,** because their catalogue points are inside a national park:
  - Jim Corbett is routed to Ramnagar and Dhikuli (29.43, 79.13);
  - Ranthambore is routed to Ranthambore Road, Sawai Madhopur (26.01, 76.38).

  Both distances are still checked against the straight line to the catalogue point.
- **Limits:**
  - Google's first route is sometimes longer but faster than the alternatives. Ajmer from Gurugram is 419 km by the Delhi-Mumbai Expressway (NE 4), against 362 km by NH 48.
  - The car cost formula prices the distance as listed.
  - The alternatives are in the table so a reviewer can see the choice.

## What changed

- **Distances:** the median change is +6 km. The largest rises are on hill roads, for example Narkanda from Delhi (390 to 461 km) and Kasauli from Delhi (290 to 343 km). The largest falls are where new expressways cut the route, for example Lucknow from Delhi (560 to 496 km, Ganga Expressway).
- **Times:** the median change is -12 minutes. Expressway routes are faster than the draft guessed: Bundi from Gurugram is 540 to 365 minutes, and Ranthambore from Gurugram is 420 to 275. Hill routes are slower.
- **Demo margins:** with B1a and B1b together, the seed tests pass.
  - Hills is at 33 feasible (it was 32, and at least 8 are needed).
  - The tight-budget suggestion is unchanged at ₹14,000.
  - Date clash is unchanged.

## Every row

"Was" is the unsourced draft. "Typically" is Google's range for the first route. The other two routes Google offered follow it.

| Hub | Destination | Was (km, min) | Now (km, min) | Straight line (km) | First route: typically | Other routes | Source |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| gurugram | agra | 210, 240 | **195, 240** | 172 | 3 h 00 to 5 h 00 via NH 44 | 212 km 190-300 min, via Manpur - Sauj Rd/Yamuna Expy; 235 km 190-290 min, via Yamuna Expy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/27.18,78.01/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | agra | 230, 270 | **218, 205** | 177 | 2 h 40 to 4 h 10 via Yamuna Expy | 208 km 160-250 min, via Noida-Greater Noida Expy and Yamuna Expy; 206 km 190-310 min, via NH 44 | [directions](https://www.google.com/maps/dir/28.61,77.23/27.18,78.01/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | ajmer | 390, 420 | **419, 390** | 325 | 4 h 50 to 8 h 10 via NE 4 | 402 km 310-510 min, via NE 4 and NH 48; 362 km 330-560 min, via NH 48 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/26.45,74.64/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | ajmer | 400, 430 | **450, 415** | 351 | 5 h 20 to 8 h 30 via NE 4 | 447 km 320-520 min, via NE 4 and NH 48; 390 km 360-600 min, via NH 48 | [directions](https://www.google.com/maps/dir/28.61,77.23/26.45,74.64/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | almora | 360, 540 | **413, 555** | 286 | 7 h 30 to 11 h 00 via NH 9 | 401 km 520-700 min, via NH 9 and NH 109; 414 km 460-690 min, via NE 3, NH 9 and NH 109 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.6,79.66/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | almora | 350, 520 | **383, 510** | 260 | 6 h 50 to 10 h 10 via NH 9 | 370 km 490-660 min, via NH 9 and NH 109; 352 km 440-600 min, via NH 9, Nainital Rd and NH 109 | [directions](https://www.google.com/maps/dir/28.61,77.23/29.6,79.66/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | alwar | 160, 210 | **145, 145** | 107 | 1 h 50 to 3 h 00 via NE 4 | none | [directions](https://www.google.com/maps/dir/28.4595,77.0266/27.56,76.63/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | alwar | 180, 230 | **175, 170** | 131 | 2 h 10 to 3 h 30 via NH 148NA and NE 4 | 173 km 140-220 min, via NE 4; 173 km 140-230 min, via Chennai - Delhi Hwy, NH 148NA and NE 4 | [directions](https://www.google.com/maps/dir/28.61,77.23/27.56,76.63/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | amritsar | 460, 480 | **488, 475** | 409 | 6 h 00 to 9 h 50 via NE 5 | 512 km 400-620 min, via NE 5 and NH 54 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/31.63,74.87/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | amritsar | 470, 490 | **492, 480** | 405 | 6 h 10 to 9 h 50 via NE 5 | 524 km 500-690 min, via NE 5 and NH 54; 483 km 370-590 min, via NE 5 and NH 7 | [directions](https://www.google.com/maps/dir/28.61,77.23/31.63,74.87/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | auli | 520, 780 | **519, 810** | 337 | 11 h 10 to 15 h 50 via NH 7 | 527 km 690-960 min, via NH 344G and NH 7; 567 km 840-1030 min, via NH 9 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.53,79.57/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | auli | 510, 760 | **492, 770** | 311 | 10 h 40 to 15 h 00 via NH 7 | 500 km 660-910 min, via NH 344G and NH 7; 494 km 650-920 min, via Delhi - Haridwar Rd and NH 7 | [directions](https://www.google.com/maps/dir/28.61,77.23/30.53,79.57/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | bharatpur | 190, 240 | **177, 215** | 145 | 2 h 40 to 4 h 30 via NH 44 | 174 km 210-310 min, via NH 44 and Mathura - Bharatpur Rd; 176 km 200-260 min, via NE 4 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/27.22,77.49/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | bharatpur | 210, 260 | **209, 210** | 157 | 2 h 50 to 4 h 10 via Yamuna Expy | 190 km 220-310 min, via NH 44; 187 km 170-280 min, via NH 148NA and NH 44 | [directions](https://www.google.com/maps/dir/28.61,77.23/27.22,77.49/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | bhimtal | 310, 420 | **349, 425** | 266 | 5 h 30 to 8 h 40 via NH 9 | 355 km 410-580 min, via NH 9 and Rudrapur - Haldwani Rd; 350 km 340-540 min, via NH 9 and NH 109 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.35,79.56/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | bhimtal | 300, 400 | **318, 385** | 241 | 5 h 00 to 7 h 50 via NH 9 | 325 km 380-530 min, via NH 9 and Rudrapur - Haldwani Rd; 302 km 330-510 min, via NH 9 and MDR 65W | [directions](https://www.google.com/maps/dir/28.61,77.23/29.35,79.56/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | bikaner | 440, 480 | **429, 485** | 367 | 6 h 40 to 9 h 30 via NH 11 | 441 km 430-620 min, via NH 48 and NH 11; 432 km 410-570 min, via MDR93 and NH 11 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/28.02,73.31/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | bikaner | 460, 500 | **457, 515** | 389 | 7 h 00 to 10 h 10 via NH 11 | 469 km 460-650 min, via NH 48 and NH 11; 454 km 430-600 min, via NH 334B and NH 11 | [directions](https://www.google.com/maps/dir/28.61,77.23/28.02,73.31/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | bir | 500, 660 | **508, 635** | 399 | 8 h 40 to 12 h 30 via NH 44 | 528 km 620-850 min, via NH154; 525 km 510-760 min, via NE 5 and NH154 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/32.04,76.72/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | bir | 490, 640 | **487, 620** | 385 | 8 h 20 to 12 h 20 via NH 44 | 511 km 580-800 min, via NH154; 529 km 520-760 min, via NE 5 and NH154 | [directions](https://www.google.com/maps/dir/28.61,77.23/32.04,76.72/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | bundi | 460, 540 | **433, 365** | 363 | 5 h 00 to 7 h 10 via NE 4 | 436 km 300-460 min, via NE 4 and NH 52; 424 km 340-500 min, via NE 4 and SH 29 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/25.44,75.64/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | bundi | 480, 560 | **463, 390** | 386 | 5 h 20 to 7 h 40 via NE 4 | 466 km 330-500 min, via NE 4 and NH 52; 455 km 370-530 min, via NE 4 and SH 29 | [directions](https://www.google.com/maps/dir/28.61,77.23/25.44,75.64/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | chail | 350, 480 | **385, 510** | 280 | 6 h 40 to 10 h 20 via NH 44 | 429 km 560-720 min, via NH 344G; 405 km 400-630 min, via NE 5 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.97,77.2/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | chail | 340, 460 | **397, 485** | 262 | 6 h 30 to 9 h 40 via NH 344G | 402 km 530-660 min, via NH 344G and NH 907A; 364 km 390-610 min, via NH 44 | [directions](https://www.google.com/maps/dir/28.61,77.23/30.97,77.2/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | chakrata | 300, 420 | **338, 425** | 262 | 5 h 40 to 8 h 30 via NH 344G | 333 km 360-510 min, via NH 344G and Vikasnagar - Chakrata Rd; 320 km 350-500 min, via NH 344G, Saharanpur Rd - Behat and Vikasnagar - Chakrata Rd | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.7,77.87/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | chakrata | 290, 400 | **311, 380** | 240 | 5 h 10 to 7 h 30 via NH 344G | 306 km 330-460 min, via NH 344G and Vikasnagar - Chakrata Rd; 293 km 320-430 min, via NH 344G, Saharanpur Rd - Behat and Vikasnagar - Chakrata Rd | [directions](https://www.google.com/maps/dir/28.61,77.23/30.7,77.87/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | dalhousie | 580, 720 | **581, 680** | 464 | 8 h 50 to 13 h 50 via NE 5 and NH 44 | 655 km 730-960 min, via NE 5; 602 km 580-870 min, via NH 44 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/32.53,75.97/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | dalhousie | 570, 700 | **584, 690** | 452 | 9 h 00 to 14 h 00 via NE 5 and NH 44 | 615 km 670-930 min, via NH 44; 581 km 560-860 min, via NH 44 and NH 154A | [directions](https://www.google.com/maps/dir/28.61,77.23/32.53,75.97/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | dehradun | 270, 330 | **256, 280** | 231 | 3 h 30 to 5 h 50 via NH 344G | 274 km 260-410 min, via NH 48 and NH 344G; 267 km 220-360 min, via NH 344G and Delhi-Dehradun Expy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.345,78.029/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | dehradun | 260, 310 | **229, 235** | 208 | 3 h 00 to 4 h 50 via NH 344G | 246 km 220-350 min, via NH 709B and NH 344G; 232 km 190-310 min, via NH 344G and Delhi-Dehradun Expy | [directions](https://www.google.com/maps/dir/28.61,77.23/30.345,78.029/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | dhanaulti | 300, 420 | **323, 465** | 251 | 6 h 00 to 9 h 30 via NH 344G | 340 km 410-630 min, via NH 344G and Mussoorie Rd; 350 km 370-590 min, via NH 344M and NH 344G | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.45,78.25/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | dhanaulti | 290, 400 | **296, 415** | 227 | 5 h 30 to 8 h 20 via NH 344G | 313 km 380-570 min, via NH 344G and Mussoorie Rd; 352 km 400-530 min, via NH 344G and NH 507 | [directions](https://www.google.com/maps/dir/28.61,77.23/30.45,78.25/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | dharamshala | 480, 600 | **515, 650** | 424 | 8 h 40 to 13 h 00 via NH 44 | 531 km 610-860 min, via NH 503; 522 km 510-790 min, via NE 5 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/32.22,76.32/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | dharamshala | 470, 580 | **494, 640** | 411 | 8 h 30 to 12 h 50 via NH 44 | 514 km 560-810 min, via NH 503; 526 km 520-800 min, via NE 5 | [directions](https://www.google.com/maps/dir/28.61,77.23/32.22,76.32/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | gwalior | 320, 360 | **310, 395** | 274 | 4 h 50 to 8 h 20 via NH 44 | 325 km 390-580 min, via NH 44 and Agra - Mumbai Rd/Gwalior Rd; 360 km 310-490 min, via Yamuna Expy and NH 44 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/26.22,78.18/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | gwalior | 340, 380 | **333, 370** | 282 | 4 h 40 to 7 h 40 via Yamuna Expy and NH 44 | 347 km 310-490 min, via Greater Noida West Link Rd, Yamuna Expy and NH 44 | [directions](https://www.google.com/maps/dir/28.61,77.23/26.22,78.18/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | haridwar | 230, 300 | **241, 270** | 199 | 3 h 30 to 5 h 30 via NH 344G and NH 334 | 250 km 230-350 min, via NH 344G; 253 km 220-340 min, via NH 344G and NH 344 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.95,78.16/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | haridwar | 220, 280 | **214, 230** | 174 | 3 h 00 to 4 h 40 via NH 344G and NH 334 | 223 km 200-290 min, via NH 344G; 226 km 190-280 min, via NH 344G and NH 344 | [directions](https://www.google.com/maps/dir/28.61,77.23/29.95,78.16/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | jaipur | 270, 300 | **267, 235** | 209 | 3 h 00 to 4 h 50 via NE 4 | 266 km 200-320 min, via NE 4 and NH 21; 288 km 210-330 min, via NE 4 and Jaipur - Bandikui Expy/NE4C | [directions](https://www.google.com/maps/dir/28.4595,77.0266/26.915,75.82/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | jaipur | 280, 310 | **297, 260** | 234 | 3 h 20 to 5 h 20 via NE 4 | 295 km 210-320 min, via NE 4 and Jaipur - Bandikui Expy/NE4C; 297 km 220-350 min, via NE 4 and NH 21 | [directions](https://www.google.com/maps/dir/28.61,77.23/26.915,75.82/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | jim-corbett | 260, 360 | **286, 355** | 222 | 4 h 40 to 7 h 10 via NH 9 | 285 km 350-470 min, via NH 9 and NH309; 269 km 310-430 min, via NH 9, Kanth - Dilari - Thakurdwara Rd and NH309 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.43,79.13/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | jim-corbett | 250, 340 | **255, 320** | 196 | 4 h 10 to 6 h 30 via NH 9 | 254 km 320-430 min, via NH 9 and NH309; 262 km 280-380 min, via NH 9 and MDR 26W | [directions](https://www.google.com/maps/dir/28.61,77.23/29.43,79.13/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | jodhpur | 600, 660 | **624, 605** | 464 | 7 h 40 to 12 h 30 via NE 4 | 588 km 600-820 min, via NH 11; 613 km 480-730 min, via NE 4 and NH 48 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/26.28,73.02/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | jodhpur | 620, 680 | **654, 630** | 490 | 8 h 00 to 13 h 00 via NE 4 | 616 km 630-840 min, via NH 11; 644 km 500-760 min, via NE 4 and NH 48 | [directions](https://www.google.com/maps/dir/28.61,77.23/26.28,73.02/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | kanatal | 310, 430 | **354, 455** | 251 | 6 h 10 to 9 h 00 via NH 344G | 349 km 400-570 min, via NH 344G and NH 34; 326 km 370-580 min, via NH 344G and NH 707A | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.41,78.33/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | kanatal | 300, 410 | **299, 425** | 227 | 5 h 30 to 8 h 40 via NH 344G | 322 km 360-520 min, via NH 344G and NH 34; 327 km 340-490 min, via NH 344G, Delhi-Dehradun Expy and NH 34 | [directions](https://www.google.com/maps/dir/28.61,77.23/30.41,78.33/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | kasauli | 300, 400 | **331, 410** | 271 | 5 h 10 to 8 h 30 via NH 44 | 351 km 310-520 min, via NE 5; 370 km 330-530 min, via NH 344G | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.9,76.96/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | kasauli | 290, 380 | **343, 380** | 256 | 4 h 50 to 7 h 50 via NH 344G | 309 km 300-500 min, via NH 44; 354 km 320-530 min, via NE 5 | [directions](https://www.google.com/maps/dir/28.61,77.23/30.9,76.96/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | kasol | 520, 720 | **522, 645** | 396 | 8 h 40 to 12 h 50 via NH 44 | 550 km 690-920 min, via NH 44; 539 km 510-780 min, via NE 5 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/32.01,77.31/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | kasol | 510, 700 | **501, 630** | 378 | 8 h 20 to 12 h 40 via NH 44 | 533 km 640-870 min, via NH 44 and NH205; 542 km 520-780 min, via NE 5 | [directions](https://www.google.com/maps/dir/28.61,77.23/32.01,77.31/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | kurukshetra | 190, 210 | **202, 210** | 168 | 2 h 50 to 4 h 10 via NH 44 | 209 km 220-320 min, via NH 44; 231 km 170-270 min, via NE 5 and NH 152D | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.9657,76.837/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | kurukshetra | 180, 200 | **181, 195** | 155 | 2 h 30 to 4 h 00 via NH 44 | 192 km 170-260 min, via NH 709A; 187 km 160-250 min, via NH 344G and NH 709A | [directions](https://www.google.com/maps/dir/28.61,77.23/29.9657,76.837/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | lansdowne | 250, 390 | **292, 405** | 222 | 5 h 40 to 7 h 50 via NE 3 | 289 km 390-520 min, via NH534; 297 km 370-500 min, via NH 34 and NH534 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.84,78.68/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | lansdowne | 240, 370 | **261, 365** | 196 | 5 h 10 to 7 h 00 via NE 3 | 258 km 350-480 min, via NH534; 297 km 320-450 min, via NH 344G | [directions](https://www.google.com/maps/dir/28.61,77.23/29.84,78.68/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | lucknow | 550, 540 | **527, 465** | 426 | 6 h 00 to 9 h 30 via Ganga Expy | 538 km 390-650 min, via Agra - Lucknow Expy; 518 km 420-620 min, via Ganga Expy and NH731 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/26.85,80.95/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | lucknow | 560, 560 | **496, 425** | 415 | 5 h 30 to 8 h 40 via Ganga Expy | 533 km 370-600 min, via Yamuna Expy and Agra - Lucknow Expy; 487 km 400-580 min, via Ganga Expy and NH731 | [directions](https://www.google.com/maps/dir/28.61,77.23/26.85,80.95/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | manali | 560, 780 | **541, 645** | 421 | 8 h 30 to 13 h 00 via NH 44 | 558 km 510-790 min, via NH 3; 553 km 540-820 min, via NH 44 and NH 3 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/32.24,77.19/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | manali | 550, 760 | **520, 630** | 404 | 8 h 10 to 12 h 50 via NH 44 | 556 km 660-890 min, via NH 44 and NH205; 561 km 510-790 min, via NH 3 | [directions](https://www.google.com/maps/dir/28.61,77.23/32.24,77.19/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | mathura | 150, 180 | **142, 160** | 125 | 2 h 00 to 3 h 20 via NH 44 | 139 km 170-250 min, via SH28 and NH 44; 165 km 140-230 min, via NH 148NA and NH 44 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/27.49,77.67/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | mathura | 170, 200 | **161, 160** | 132 | 2 h 10 to 3 h 10 via Yamuna Expy | 162 km 130-200 min, via Noida-Greater Noida Expy and Yamuna Expy | [directions](https://www.google.com/maps/dir/28.61,77.23/27.49,77.67/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | mukteshwar | 340, 480 | **392, 530** | 279 | 7 h 00 to 10 h 40 via NH 9 | 399 km 510-700 min, via NH 9 and Bhowali-Ramgarh-Mukteshwar Rd; 389 km 430-630 min, via NH 9 and NH 109 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.47,79.65/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | mukteshwar | 330, 460 | **358, 500** | 254 | 6 h 40 to 10 h 00 via NH 9 | 368 km 480-650 min, via NH 9 and Bhowali-Ramgarh-Mukteshwar Rd; 362 km 390-600 min, via NH 9 and NH 109 | [directions](https://www.google.com/maps/dir/28.61,77.23/29.47,79.65/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | mussoorie | 300, 400 | **286, 380** | 244 | 4 h 40 to 8 h 00 via NH 344G | 303 km 330-540 min, via NH 344G and Mussoorie Rd; 289 km 300-450 min, via NH 344G and Delhi-Dehradun Expy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.46,78.06/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | mussoorie | 290, 380 | **259, 330** | 221 | 4 h 00 to 7 h 00 via NH 344G | 276 km 290-480 min, via NH 344G and Mussoorie Rd; 262 km 260-390 min, via NH 344G and Delhi-Dehradun Expy | [directions](https://www.google.com/maps/dir/28.61,77.23/30.46,78.06/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | nainital | 320, 430 | **320, 415** | 258 | 5 h 40 to 8 h 10 via NH 9 | 339 km 400-550 min, via NH 9 and Nainital Rd; 360 km 350-530 min, via NH 9 and NH 109 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.38,79.46/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | nainital | 310, 410 | **289, 380** | 233 | 5 h 10 to 7 h 30 via NH 9 | 308 km 370-500 min, via NH 9 and Nainital Rd; 330 km 320-490 min, via NH 9 and NH 109 | [directions](https://www.google.com/maps/dir/28.61,77.23/29.38,79.46/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | narkanda | 400, 560 | **449, 645** | 315 | 8 h 30 to 13 h 00 via NH 44 | 494 km 670-870 min, via NH 344G; 470 km 510-790 min, via Zirakpur - Shimla Hwy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/31.27,77.46/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | narkanda | 390, 540 | **461, 620** | 297 | 8 h 10 to 12 h 30 via NH 344G | 467 km 640-830 min, via NH 344G and NH 907A; 428 km 490-770 min, via NH 44 | [directions](https://www.google.com/maps/dir/28.61,77.23/31.27,77.46/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | neemrana | 120, 150 | **90, 135** | 83 | 1 h 40 to 2 h 50 via NH 48 | 97.2 km 120-200 min, via Old Railway Rd and NH 48; 99.5 km 110-180 min, via Kallawas - Kaluwas Rd/Rewari-Shahjahanpur Rd and NH 48 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/27.98,76.38/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | neemrana | 140, 170 | **118, 165** | 109 | 2 h 10 to 3 h 20 via NH 48 | 125 km 150-230 min, via Golden Quadrilateral and NH 48; 127 km 130-210 min, via NH 248BB and NH 48 | [directions](https://www.google.com/maps/dir/28.61,77.23/27.98,76.38/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | orchha | 450, 540 | **444, 550** | 381 | 6 h 50 to 11 h 30 via NH 44 | 465 km 540-800 min, via SH28 and NH 44; 581 km 440-660 min, via Agra - Lucknow Expy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/25.35,78.64/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | orchha | 470, 560 | **467, 525** | 388 | 6 h 50 to 10 h 40 via Yamuna Expy and NH 44 | 481 km 550-800 min, via NH 44; 577 km 410-610 min, via Yamuna Expy | [directions](https://www.google.com/maps/dir/28.61,77.23/25.35,78.64/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | pushkar | 400, 430 | **430, 395** | 328 | 5 h 00 to 8 h 10 via NE 4 | 412 km 310-520 min, via NE 4 and NH 48; 372 km 340-570 min, via NH 48 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/26.49,74.55/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | pushkar | 410, 440 | **460, 420** | 354 | 5 h 20 to 8 h 40 via NE 4 | 458 km 330-530 min, via NE 4 and NH 48; 400 km 370-610 min, via NH 48 | [directions](https://www.google.com/maps/dir/28.61,77.23/26.49,74.55/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | ranikhet | 350, 500 | **406, 540** | 268 | 7 h 20 to 10 h 40 via NH 9 | 394 km 520-690 min, via NH 9 and Nainital Rd; 379 km 480-640 min, via NH 9 and NH309 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/29.64,79.43/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | ranikhet | 340, 480 | **376, 505** | 242 | 6 h 50 to 10 h 00 via NH 9 | 364 km 490-640 min, via NH 9 and Nainital Rd; 348 km 450-600 min, via NH 9 and NH309 | [directions](https://www.google.com/maps/dir/28.61,77.23/29.64,79.43/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | ranthambore | 360, 420 | **327, 275** | 276 | 3 h 30 to 5 h 40 via NE 4 | 311 km 250-360 min, via NE 4 and SH 24; 348 km 240-380 min, via Western Peripheral Expy and NE 4 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/26.01,76.38/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | ranthambore | 380, 440 | **357, 305** | 297 | 4 h 00 to 6 h 10 via NE 4 | 355 km 240-380 min, via NH 48 and NE 4; 342 km 270-390 min, via NH 148NA and NE 4 | [directions](https://www.google.com/maps/dir/28.61,77.23/26.01,76.38/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | rishikesh | 250, 330 | **265, 325** | 221 | 4 h 10 to 6 h 40 via NH 344G and NH 334 | 273 km 270-410 min, via NH 344G; 289 km 250-420 min, via NH 344G and Delhi-Dehradun Expy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/30.1083,78.2972/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | rishikesh | 240, 310 | **237, 280** | 196 | 3 h 40 to 5 h 40 via NH 344G and NH 334 | 246 km 230-360 min, via NH 344G; 262 km 220-360 min, via NH 344G and Delhi-Dehradun Expy | [directions](https://www.google.com/maps/dir/28.61,77.23/30.1083,78.2972/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | sariska | 190, 240 | **216, 250** | 140 | 3 h 40 to 4 h 40 via NE 4 | 203 km 240-310 min, via NE 4 and NH 248A; 237 km 240-330 min, via Western Peripheral Expy and NE 4 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/27.3175,76.4369/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | sariska | 210, 260 | **246, 275** | 163 | 4 h 00 to 5 h 10 via NE 4 | 244 km 240-320 min, via NE 4 and RJ SH 25A; 233 km 270-340 min, via NH 148NA and NE 4 | [directions](https://www.google.com/maps/dir/28.61,77.23/27.3175,76.4369/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | shimla | 360, 480 | **386, 500** | 294 | 6 h 20 to 10 h 20 via NH 44 and Zirakpur - Shimla Hwy | 431 km 550-720 min, via NH 344G; 407 km 380-630 min, via Zirakpur - Shimla Hwy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/31.1,77.17/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | shimla | 350, 460 | **398, 475** | 277 | 6 h 10 to 9 h 40 via NH 344G | 404 km 510-670 min, via NH 344G and NH 907A; 365 km 370-610 min, via NH 44 and Zirakpur - Shimla Hwy | [directions](https://www.google.com/maps/dir/28.61,77.23/31.1,77.17/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | udaipur | 630, 660 | **684, 680** | 545 | 8 h 30 to 14 h 10 via NE 4 | 687 km 510-850 min, via NE 4 and NH 48; 697 km 540-820 min, via NE 4 and NH 27 | [directions](https://www.google.com/maps/dir/28.4595,77.0266/24.58,73.68/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | udaipur | 650, 680 | **714, 700** | 570 | 8 h 50 to 14 h 30 via NH58 | 717 km 530-880 min, via NH 48; 727 km 560-840 min, via NE 4 | [directions](https://www.google.com/maps/dir/28.61,77.23/24.58,73.68/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| gurugram | vrindavan | 160, 200 | **138, 175** | 118 | 2 h 10 to 3 h 40 via NH 44 | 135 km 180-270 min, via SH28 and NH 44; 158 km 140-220 min, via Manpur - Sauj Rd/Yamuna Expy | [directions](https://www.google.com/maps/dir/28.4595,77.0266/27.58,77.7/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |
| delhi | vrindavan | 180, 220 | **154, 145** | 123 | 2 h 00 to 2 h 50 via Yamuna Expy | 155 km 120-180 min, via Noida-Greater Noida Expy and Yamuna Expy; 149 km 140-230 min, via NH 148NA and NH 44 | [directions](https://www.google.com/maps/dir/28.61,77.23/27.58,77.7/data=!4m6!4m5!2m3!6e0!7e2!8j1795244400!3e0) |

## Maulik to check

1. **The duration rule:** the midpoint of Google's "typically" range for a Saturday 07:00 start. The alternative would be the upper end (Google's "arrive around"), which adds 30 to 150 minutes on long routes.
2. **Jim Corbett and Ranthambore:** both are routed to the towns where visitors stay.

## Spot check

To be recorded before merge (decision 0002). Open the row's `directions` link; Google shows a "typically" range for 07:00 Saturday 21 November.

| Row | Expect | Result | Checked by, date |
| --- | --- | --- | --- |
| gurugram > agra | 195 km, typically 3 to 5 hr | pending | |
| delhi > lucknow | 496 km via Ganga Expy, typically 5 h 30 to 8 h 40 | pending | |
| gurugram > kasol | 522 km, typically 8 h 40 to 12 h 50 | pending | |
| delhi > neemrana | 118 km, typically 2 h 10 to 3 h 20 | pending | |
| gurugram > ranthambore | 327 km via NE 4, typically 3 h 30 to 5 h 40 | pending | |

## Checks

- `pnpm catalogue:check` (with B1a merged): 0 errors. Stage B1 is at 136/137 (sariska's costs are draft).
- `pnpm vitest run --project integration apps/api/src/seed apps/api/src/recommendations`: 18 passed. Hills is at 33 feasible.
