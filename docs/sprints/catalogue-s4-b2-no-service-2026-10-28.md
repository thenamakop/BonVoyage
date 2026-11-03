# Catalogue S4 batch 1: train rows with no service (28 October 2026)

The 12 draft train rows in `fares.csv` that stayed `draft` on 27 October because erail.in lists no train on the pair (see [catalogue-b2-train-2026-10-27.md](catalogue-b2-train-2026-10-27.md), "Maulik to check" items 1 to 12). **Decision (Maulik, 28 October 2026, S4-8 option a): delete them**, so the app no longer offers or costs a train that does not run. **Result:** 10 rows to delete; the 2 Jim Corbett train rows stay `draft` because a through service exists that erail.in's search does not show (see below). B2 drafts fall from 31 to 21.

**Who checked:** Claude, in the BonVoyage project session (separate from Claude Code), on 28 October 2026, by direct page fetch of erail.in. Decision 0002 (amended) applies: Maulik's review and a recorded spot check are needed before merge.

## Method

- **Source:** erail.in's "trains between stations" page for each pair (accepted on 27 October as the readable form of the official Indian Railways table, train report item 13).
- **Gurugram rows** use Gurgaon (GGN) only, as on 27 October; a Delhi train never supports a gurugram row.
- **Delhi to Jim Corbett** was checked from New Delhi (NDLS), Old Delhi (DLI) and Anand Vihar (ANVT) to Ramnagar (RMR), because erail.in groups some Delhi stations differently by page.
- A row is deleted only when every page checked says "No Trains found for the selected stations".

## Every row

| Row | Station pair checked | Was (fare, min, km) | Now | Evidence (28 October 2026) |
| --- | --- | --- | --- | --- |
| gurugram/agra | GGN to AGC | 280, 230, 210 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-AGC): "No Trains found for the selected stations" |
| gurugram/amritsar | GGN to ASR | 500, 480, 460 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-ASR): "No Trains found for the selected stations" |
| gurugram/bharatpur | GGN to BTE | 200, 210, 190 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-BTE): "No Trains found for the selected stations" |
| gurugram/bundi | GGN to BUDI | 400, 510, 460 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-BUDI): "No Trains found for the selected stations" |
| gurugram/gwalior | GGN to GWL | 300, 300, 320 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-GWL): "No Trains found for the selected stations" |
| gurugram/jim-corbett | GGN to RMR | 280, 330, 260 | **kept draft** | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-RMR): "No Trains found for the selected stations", but see "Jim Corbett" below |
| delhi/jim-corbett | NDLS, DLI and ANVT to RMR | 280, 330, 250 | **kept draft** | [NDLS](https://erail.in/trains-between-stations/x-NDLS/y-RMR), [DLI](https://erail.in/trains-between-stations/x-DLI/y-RMR), [ANVT](https://erail.in/trains-between-stations/x-ANVT/y-RMR): each "No Trains found for the selected stations", but see "Jim Corbett" below |
| gurugram/kurukshetra | GGN to KKDE | 160, 200, 190 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-KKDE): "No Trains found for the selected stations" |
| gurugram/mathura | GGN to MTJ | 150, 150, 150 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-MTJ): "No Trains found for the selected stations" |
| gurugram/orchha | GGN to VGLJ (Jhansi) | 320, 330, 450 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-VGLJ): "No Trains found for the selected stations" |
| gurugram/ranthambore | GGN to SWM | 300, 270, 360 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-SWM): "No Trains found for the selected stations" |
| gurugram/vrindavan | GGN to MTJ (nearest main station) | 180, 180, 160 | deleted | [erail.in](https://erail.in/trains-between-stations/x-GGN/y-MTJ): "No Trains found for the selected stations" |

## Jim Corbett: a link service the search does not show

- [Wikipedia: Corbett Park Link Express](https://en.wikipedia.org/wiki/Corbett_Park_Link_Express) describes trains 25013/25014, Jaisalmer to Ramnagar, daily, running through Delhi Cantonment, Delhi Sarai Rohilla and Delhi Junction as link coaches of the Ranikhet Express and detached at Moradabad for Ramnagar.
- [ixigo: 25013](https://ixigo.com/trains/25013/seat-availability) lists only the Moradabad to Ramnagar portion (02:34 to 04:15, 76 km, daily, SL, 3A, 2A, 1A).
- The 27 October train report used 15013 Ranikhet Express from Gurgaon (GGN) for gurugram/bhimtal, so the same coaches plausibly serve Gurgaon too.
- erail.in's station-pair search lists neither pair, because the through coaches run under a different number for part of the way. That is a gap in the search, not proof of no service, so these two rows are **not deleted**. They stay draft and go to the bus and train re-verification batch (#126), which needs the through-coach timetable (Gurgaon or Delhi departure to Ramnagar arrival) and the SL fare for that distance.

## What changes in the app

- Those 10 pairs lose the train mode: no train package, no train in Change, and the shortlist's "cheapest by" falls back to bus or car for them.
- **The Tight budget demo changes.** Its Round 2 figures for Mathura and Vrindavan were "cheapest by train" from the draft Gurugram rows (₹150 and ₹180). They now use the verified bus fares (gurugram/mathura ₹356, gurugram/vrindavan ₹393) or the car share, so their estimates rise, the closest misses and the "Raise the group budget to ..." amount may change, and Round 2 may list different places. Part 2 must update `docs/demo/sprint-3-demo.md` step 5 and `apps/api/src/seed/run-seed.test.ts` from the running app, and may adjust that demo trip's seeded budget (seed data, not the catalogue) so step 5 still shows a diagnostic, a one-tap fix and a Round 2 with Bikaner's transport comparison.
- No other demo step uses these pairs (Hills trips go to Chakrata by car; Bikaner keeps its verified train).

## Maulik to check

1. **Jim Corbett train rows:** kept draft (see above); re-verify in a later #126 batch.
2. **Bus rows with no route page** (gurugram/chail, delhi/chail, gurugram/dalhousie, gurugram/jim-corbett, gurugram/kasauli, delhi/kasauli, gurugram/orchha, gurugram/ranthambore, gurugram/sariska, delhi/sariska): the same reasoning would delete them too. Not part of this batch; decide separately.

## Spot check

To be recorded by Maulik before merge (decision 0002): open three of the links above (suggested: gurugram/mathura, gurugram/ranthambore, gurugram/agra) and record what each page says.

| Row | What the page says | Holds |
| --- | --- | --- |
| gurugram/mathura | No Trains found for the selected stations | yes |
| gurugram/ranthambore | No Trains found for the selected stations | yes |
| gurugram/agra | No Trains found for the selected stations | yes |
