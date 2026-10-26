# Catalogue stage B2: train fares (27 October 2026)

The 44 train rows in `fares.csv` (22 from delhi, 22 from gurugram). **Result:** 32 of 44 verified; 12 stay `draft` because no train runs on that pair (see [Maulik to check](#maulik-to-check)). `collected_on` is 2026-10-26 (UTC; the checker rejects later dates).

**Who checked:** Claude, in a separate session from Claude Code, on 27 October 2026, by direct page fetch. Decision 0002 (amended) applies: Maulik's review and a spot check are needed before merge.

## Method

- **Source:** erail.in's "trains between stations" page for each pair, which lists every train with its classes and duration, and prints the Indian Railways fare table applied to the route distance ("Mail/Express Fare for distance N kms", one row per class). IRCTC fares are only visible after a logged-in search, so erail.in is used as the readable form of the official fare table; see Maulik to check.
- **Delhi rows** use New Delhi (NDLS); erail.in includes trains from the other Delhi stations (Hazrat Nizamuddin, Old Delhi, Delhi Cantt, Anand Vihar, Safdarjung) in the same list, and the row names the station. **Gurugram rows** use Gurgaon (GGN) only; a Delhi train never supports a gurugram row.
- **`fare_per_person_inr`:** the adult sleeper (SL) fare from that table for the route distance. It is the base Mail/Express fare; superfast and other surcharges on individual trains are not added. The 2S fare, where printed, is shown in the report but not used, so every row uses the same class.
- **`duration_minutes`:** the fastest regular train (number not starting with 0, so not a holiday or festival special) that offers SL or 2S, station to station.
- **`distance_km`:** the route distance printed with the fare table.
- **Nearest station:** bhimtal: Kathgodam (nearest station, about 20 km); jim-corbett: Ramnagar; orchha: Jhansi (nearest main station, about 16 km); ranthambore: Sawai Madhopur; rishikesh: Yog Nagari Rishikesh; vrindavan: Mathura (nearest main station, about 12 km).

## Every row

| Row | Station | Was (fare, min, km) | Now (fare, min, km) | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| gurugram/agra | Agra Cantt (AGC) | 280, 230, 210 | 280, 230, 210 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-AGC): no train from Gurugram (GGN) to Agra Cantt on erail.in |
| delhi/agra | Agra Cantt (AGC) | 280, 230, 230 | 140, 125, 187 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-AGC): fare table for 187 km, Adult SL Rs 140, 2S Rs 85; fastest regular train with SL or 2S: 22200 SUSHASAN SF EXP NZM (02:05 h); many trains with SL or 2S |
| gurugram/ajmer | Ajmer (AII) | 350, 420, 390 | 220, 315, 346 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-AII): fare table for 346 km, Adult SL Rs 220, 2S Rs 130; fastest regular train with SL or 2S: 22950 DEE BDTS SF EXP GGN (05:15 h); 29 trains with SL or 2S |
| delhi/ajmer | Ajmer (AII) | 350, 420, 400 | 230, 338, 364 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-AII): fare table for 364 km, Adult SL Rs 230, 2S Rs 135; fastest regular train with SL or 2S: 22452 CDG BDTS EXP DEC (05:38 h); 33 trains with SL or 2S |
| gurugram/alwar | Alwar (AWR) | 170, 200, 160 | 140, 99, 125 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-AWR): fare table for 125 km, Adult SL Rs 140; fastest regular train with SL or 2S: 20940 SLN SBIB SF EXP GGN (01:39 h); 24 trains with SL or 2S |
| delhi/alwar | Alwar (AWR) | 170, 200, 180 | 140, 126, 143 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-AWR): fare table for 143 km, Adult SL Rs 140; fastest regular train with SL or 2S: 12463 RAJ S KRNTI EXP DEE (02:06 h); 29 trains with SL or 2S |
| gurugram/amritsar | Amritsar (ASR) | 500, 480, 460 | 500, 480, 460 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-ASR): no train from Gurugram (GGN) to Amritsar on erail.in |
| delhi/amritsar | Amritsar (ASR) | 500, 480, 470 | 260, 395, 446 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-ASR): fare table for 446 km, Adult SL Rs 260, 2S Rs 155; fastest regular train with SL or 2S: 12379 JALIANWALA B EX DLI (06:35 h); 18 trains with SL or 2S |
| gurugram/bharatpur | Bharatpur (BTE) | 200, 210, 190 | 200, 210, 190 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-BTE): no train from Gurugram (GGN) to Bharatpur on erail.in |
| delhi/bharatpur | Bharatpur (BTE) | 200, 210, 210 | 140, 118, 166 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-BTE): fare table for 166 km, Adult SL Rs 140, 2S Rs 85; fastest regular train with SL or 2S: 22656 NZM ERS SF EXP NZM (01:58 h); 21 trains with SL or 2S |
| gurugram/bhimtal | Kathgodam (KGM) | 300, 390, 310 | 205, 543, 308 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-KGM): fare table for 308 km, Adult SL Rs 205; fastest regular train with SL or 2S: 15013 RANIKHET EXP GGN (09:03 h); 1 trains with SL or 2S |
| delhi/bhimtal | Kathgodam (KGM) | 300, 390, 300 | 190, 405, 277 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-KGM): fare table for 277 km, Adult SL Rs 190, 2S Rs 110; fastest regular train with SL or 2S: 15035 UTR SAMPRK KRTI DLI (06:45 h); 2 trains with SL or 2S |
| gurugram/bikaner | Bikaner (BKN) | 450, 540, 440 | 260, 390, 431 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-BKN): fare table for 431 km, Adult SL Rs 260; fastest regular train with SL or 2S: 22472 INTERCITY EXP GGN (06:30 h); 3 trains with SL or 2S |
| delhi/bikaner | Bikaner (BKN) | 450, 540, 460 | 260, 425, 448 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-BKN): fare table for 448 km, Adult SL Rs 260; fastest regular train with SL or 2S: 22472 INTERCITY EXP NDLS (07:05 h); 6 trains with SL or 2S |
| gurugram/bundi | Bundi (BUDI) | 400, 510, 460 | 400, 510, 460 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-BUDI): no train from Gurugram (GGN) to Bundi on erail.in |
| delhi/bundi | Bundi (BUDI) | 400, 510, 480 | 285, 423, 496 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-BUDI): fare table for 496 km, Adult SL Rs 285; fastest regular train with SL or 2S: 12963 MEWAR EXPRESS NZM (07:03 h); 1 trains with SL or 2S |
| gurugram/dehradun | Dehradun (DDN) | 350, 360, 270 | 220, 618, 348 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-DDN): fare table for 348 km, Adult SL Rs 220; fastest regular train with SL or 2S: 19565 OKHA DDN EXP GGN (10:18 h); 1 trains with SL or 2S |
| delhi/dehradun | Dehradun (DDN) | 350, 360, 260 | 205, 345, 302 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-DDN): fare table for 302 km, Adult SL Rs 205, 2S Rs 120; fastest regular train with SL or 2S: 12055 DDN JANSHTBDI NDLS (05:45 h); 3 trains with SL or 2S |
| gurugram/gwalior | Gwalior (GWL) | 300, 300, 320 | 300, 300, 320 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-GWL): no train from Gurugram (GGN) to Gwalior on erail.in |
| delhi/gwalior | Gwalior (GWL) | 300, 300, 340 | 205, 203, 305 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-GWL): fare table for 305 km, Adult SL Rs 205, 2S Rs 120; fastest regular train with SL or 2S: 12650 YPR S KRANTI NZM (03:23 h); 67 trains with SL or 2S |
| gurugram/haridwar | Haridwar (HW) | 300, 300, 230 | 180, 438, 248 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-HW): fare table for 248 km, Adult SL Rs 180; fastest regular train with SL or 2S: 19565 OKHA DDN EXP GGN (07:18 h); 2 trains with SL or 2S |
| delhi/haridwar | Haridwar (HW) | 300, 300, 220 | 165, 247, 217 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-HW): fare table for 217 km, Adult SL Rs 165, 2S Rs 95; fastest regular train with SL or 2S: 12055 DDN JANSHTBDI NDLS (04:07 h); 17 trains with SL or 2S |
| gurugram/jaipur | Jaipur (JP) | 250, 300, 270 | 190, 227, 276 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-JP): fare table for 276 km, Adult SL Rs 190; fastest regular train with SL or 2S: 20940 SLN SBIB SF EXP GGN (03:47 h); 25 trains with SL or 2S |
| delhi/jaipur | Jaipur (JP) | 250, 300, 280 | 195, 245, 294 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-JP): fare table for 294 km, Adult SL Rs 195; fastest regular train with SL or 2S: 12463 RAJ S KRNTI EXP DEE (04:05 h); 30 trains with SL or 2S |
| gurugram/jim-corbett | Ramnagar (RMR) | 280, 330, 260 | 280, 330, 260 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-RMR): no train from Gurugram (GGN) to Ramnagar on erail.in |
| delhi/jim-corbett | Ramnagar (RMR) | 280, 330, 250 | 280, 330, 250 | draft | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-RMR): no train to Ramnagar listed on erail.in |
| gurugram/jodhpur | Jodhpur (JU) | 550, 660, 600 | 305, 527, 524 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-JU): fare table for 524 km, Adult SL Rs 305; fastest regular train with SL or 2S: 15624 KYQ BGKT EXP GGN (08:47 h); 11 trains with SL or 2S |
| delhi/jodhpur | Jodhpur (JU) | 550, 660, 620 | 315, 555, 555 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-JU): fare table for 555 km, Adult SL Rs 315; fastest regular train with SL or 2S: 12463 RAJ S KRNTI EXP DEE (09:15 h); 13 trains with SL or 2S |
| gurugram/kurukshetra | Kurukshetra (KKDE) | 160, 200, 190 | 160, 200, 190 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-KKDE): no train from Gurugram (GGN) to Kurukshetra on erail.in |
| delhi/kurukshetra | Kurukshetra (KKDE) | 160, 200, 180 | 140, 111, 156 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-KKDE): fare table for 156 km, Adult SL Rs 140, 2S Rs 80; fastest regular train with SL or 2S: 12715 SACHKHAND SF EX NDLS (01:51 h); 21 trains with SL or 2S |
| gurugram/lucknow | Lucknow (LKO) | 450, 480, 550 | 305, 608, 517 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-LKO): fare table for 517 km, Adult SL Rs 305; fastest regular train with SL or 2S: 19601 UDZ NJP EXP GGN (10:08 h); 7 trains with SL or 2S |
| delhi/lucknow | Lucknow (LKO) | 450, 480, 560 | 275, 385, 479 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-LKO): fare table for 479 km, Adult SL Rs 275, 2S Rs 160; fastest regular train with SL or 2S: 22540 ANVT MAU SF EXP ANVT (06:25 h); 52 trains with SL or 2S |
| gurugram/mathura | Mathura (MTJ) | 150, 150, 150 | 150, 150, 150 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-MTJ): no train from Gurugram (GGN) to Mathura on erail.in |
| delhi/mathura | Mathura (MTJ) | 150, 150, 170 | 140, 78, 133 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-MTJ): fare table for 133 km, Adult SL Rs 140, 2S Rs 75; fastest regular train with SL or 2S: 12448 UP SAMPRK KRANTI NZM (01:18 h); 83 trains with SL or 2S |
| gurugram/orchha | Jhansi (VGLJ) | 320, 330, 450 | 320, 330, 450 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-VGLJ): no train from Gurugram (GGN) to Jhansi on erail.in |
| delhi/orchha | Jhansi (VGLJ) | 320, 330, 470 | 245, 281, 402 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-VGLJ): fare table for 402 km, Adult SL Rs 245, 2S Rs 145; fastest regular train with SL or 2S: 12650 YPR S KRANTI NZM (04:41 h); 73 trains with SL or 2S |
| gurugram/ranthambore | Sawai Madhopur (SWM) | 300, 270, 360 | 300, 270, 360 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-SWM): no train from Gurugram (GGN) to Sawai Madhopur on erail.in |
| delhi/ranthambore | Sawai Madhopur (SWM) | 300, 270, 380 | 220, 233, 349 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-SWM): fare table for 349 km, Adult SL Rs 220, 2S Rs 130; fastest regular train with SL or 2S: 22656 NZM ERS SF EXP NZM (03:53 h); 24 trains with SL or 2S |
| gurugram/rishikesh | Yog Nagari Rishikesh (YNRK) | 300, 330, 250 | 190, 523, 284 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-YNRK): fare table for 284 km, Adult SL Rs 190; fastest regular train with SL or 2S: 19031 YOGA EXPRESS GGN (08:43 h); 3 trains with SL or 2S |
| delhi/rishikesh | Yog Nagari Rishikesh (YNRK) | 300, 330, 240 | 180, 420, 253 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-YNRK): fare table for 253 km, Adult SL Rs 180; fastest regular train with SL or 2S: 19609 UDZ YNRK EXP DLI (07:00 h); 9 trains with SL or 2S |
| gurugram/udaipur | Udaipur City (UDZ) | 550, 780, 630 | 350, 693, 641 | verified | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-UDZ): fare table for 641 km, Adult SL Rs 350; fastest regular train with SL or 2S: 20473 CHETAK EXPRESS GGN (11:33 h); 4 trains with SL or 2S |
| delhi/udaipur | Udaipur City (UDZ) | 550, 780, 650 | 355, 705, 668 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-UDZ): fare table for 668 km, Adult SL Rs 355; fastest regular train with SL or 2S: 22986 RAJ HAMSAFAR EXP DEE (11:45 h); 7 trains with SL or 2S |
| gurugram/vrindavan | Mathura (MTJ) | 180, 180, 160 | 180, 180, 160 | draft | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-MTJ): no train from Gurugram (GGN) to Mathura on erail.in |
| delhi/vrindavan | Mathura (MTJ) | 180, 180, 180 | 140, 78, 133 | verified | [erail.in](https://erail.in/trains-between-stations/x-NDLS/y-MTJ): fare table for 133 km, Adult SL Rs 140, 2S Rs 75; fastest regular train with SL or 2S: 12448 UP SAMPRK KRANTI NZM (01:18 h); 83 trains with SL or 2S |

## Maulik to check

1. **gurugram/agra**: no train from Gurugram (GGN) to Agra Cantt on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-AGC)
2. **gurugram/amritsar**: no train from Gurugram (GGN) to Amritsar on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-ASR)
3. **gurugram/bharatpur**: no train from Gurugram (GGN) to Bharatpur on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-BTE)
4. **gurugram/bundi**: no train from Gurugram (GGN) to Bundi on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-BUDI)
5. **gurugram/gwalior**: no train from Gurugram (GGN) to Gwalior on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-GWL)
6. **gurugram/jim-corbett**: no train from Gurugram (GGN) to Ramnagar on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-RMR)
7. **delhi/jim-corbett**: no train to Ramnagar listed on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-NDLS/y-RMR)
8. **gurugram/kurukshetra**: no train from Gurugram (GGN) to Kurukshetra on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-KKDE)
9. **gurugram/mathura**: no train from Gurugram (GGN) to Mathura on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-MTJ)
10. **gurugram/orchha**: no train from Gurugram (GGN) to Jhansi on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-VGLJ)
11. **gurugram/ranthambore**: no train from Gurugram (GGN) to Sawai Madhopur on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-SWM)
12. **gurugram/vrindavan**: no train from Gurugram (GGN) to Mathura on erail.in. Delete the row, or point it at the nearest departure (for Gurugram, Delhi). [check](https://erail.in/trains-between-stations/x-GGN/y-MTJ)
13. **Source standing.** erail.in is not Indian Railways; it prints the official distance-based fare table. Accept it as the readable form of the official table (as the B2 prompt allows: "the official fare table applied to the published distance"), or keep the rows draft.
14. **Fares fall.** Most fares drop (for example delhi/agra Rs 280 to 140), because the old values were rough guesses above the SL fare. The seed integration tests guard the demo margins; run them before merging (see the PR).

## Review decisions (Maulik, 27 October 2026)

- Items 1 to 12: the rows with no train stay draft (shown as estimated); revisit if the B2 bus pass or Sprint 4 needs them.
- Item 13: accepted; erail.in counts as the readable form of the official Indian Railways fare table.
- Item 14: accepted, subject to the seed tests below.

## Spot check

Recorded before merge (decision 0002), as in the stage C batches: at Maulik's request, Claude re-read three rows in the Claude desktop app's built-in browser on 27 October 2026. Maulik's approval of the PR stands in for his own check.

| Row | Value in file | What the source says | Holds |
| --- | --- | --- | --- |
| delhi/agra | Rs 140, 125 min, 187 km | erail.in NDLS to AGC: "Mail/Express Fare for distance 187 kms", Adult SL Rs 140; 22200 Sushasan SF Exp 02.05 hr | yes |
| gurugram/jaipur | Rs 190, 227 min, 276 km | erail.in GGN to JP: "Fare for distance 276 kms", Adult SL Rs 190; 20940 "03.47 hr" | yes |
| delhi/lucknow | Rs 275, 385 min, 479 km | erail.in NDLS to LKO: "Fare for distance 479 kms", Adult SL Rs 275; 22540 "06.25 hr" | yes |

3 of 3 hold.

