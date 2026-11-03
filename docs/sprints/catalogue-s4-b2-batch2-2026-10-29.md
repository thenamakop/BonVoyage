# Catalogue S4-8 batch 2: the remaining 21 draft B2 fares (#126)

This batch covers every B2 row still `draft` after batch 1 ([catalogue-s4-b2-no-service-2026-10-28.md](catalogue-s4-b2-no-service-2026-10-28.md), on branch `data/126-no-service-trains-hold`): 19 bus rows and the 2 Jim Corbett train rows. **It applies on top of that branch**, so Part 2 runs after the held branch merges, or on the same branch.

**Result (Maulik accepted both extensions and every decision on 29 October 2026; see [Review decisions](#review-decisions-maulik-29-october-2026)):**

| Outcome | Rows |
| --- | --- |
| Verified by the original method | 1 (delhi/kasol) |
| Verified with extension R2: the reference-date listing, for sale fares | 4 |
| Verified with extension R1: the nearest town with a redBus page | 10 |
| Verified at a premium-only fare (decision P) | 2 |
| Deleted: no Gurugram bus to the place or its road head | 2 |
| Still draft: Jim Corbett trains (timetable verified; values updated to 175/370/237 and 185/493/268, fare estimated) | 2 |

B2 would go from 85/106 verified (after batch 1) to **102/104**.

**Who checked:** Claude in Cowork, in Maulik's Chrome through the Claude browser extension, without signing in, between about 09:30 and 10:30 UTC on 29 October 2026. `collected_on` is `2026-10-29`. Decision 0002 (amended) needs Maulik's review and a recorded spot check, by Maulik or an independent agent session, before merge.

## Method

The original B2 bus method ([catalogue-b2-bus-2026-10-27.md](catalogue-b2-bus-2026-10-27.md#method)) is unchanged. It uses:
- the redbus.in route page;
- `fare_per_person_inr`: the page's "Cheapest Bus Ticket Price";
- `duration_minutes`: the page's "Avg. Bus Duration";
- `distance_km`: the page's route distance;
- Gurugram rows: the redBus "Gurugram to …" page only;
- a fare below ₹0.60 per km is a sale fare, so the row stays draft.

The same train method applies ([catalogue-b2-train-2026-10-27.md](catalogue-b2-train-2026-10-27.md#method)).

**Proposed extension R1, the nearest town (for Maulik to accept).** Where redBus has no page for the destination, the row uses the redBus page to the nearest town on the way that has one. The report names the town and its distance from the destination. The bus method already does this for Auli (Joshimath, 14 km), Jim Corbett (Ramnagar) and Ranthambore (Sawai Madhopur), and the train method does it for Orchha (Jhansi). The last few kilometres are covered by `local_per_day_inr`, as they are for those rows.

**Proposed extension R2, the reference date (for Maulik to accept).** The route page's headline "Cheapest Bus Ticket Price" is a promotional fare on some routes, below ₹0.60 per km. In that case the row uses the same page with the journey date set to **Saturday 21 November 2026**, the reference night used for the B1 stays:
- If the page's cheapest price for that date is at least ₹0.60 per km, that price is used.
- Otherwise, the row uses the cheapest bus in that date's list, sorted by price, that charges at least ₹0.60 per km.

Duration and distance stay the page's own route figures. This keeps the "cheapest reasonable fare" rule and the ₹0.60 threshold that Maulik accepted on 27 October.

Each page's headline figures were read from its HTML and from the rendered page. The date-specific figures come from the rendered page with `doj=21-Nov-2026`, sorted by price, with the state-corporation group (RSRTC, UPSRTC) expanded.

## Every row

### 1. Verified by the original method

| Row | Was (fare, min, km) | Now | Evidence |
| --- | --- | --- | --- |
| delhi/kasol | 1050, 760, 510 | **446, 633, 529** | [redBus Delhi to Kasol](https://www.redbus.in/bus-tickets/delhi-to-kasol) (October 2026, 142 buses): "Cheapest Bus Ticket Price INR 446.00", "Avg. Bus Duration 10 hrs 33 mins", "approximately 529 kms". ₹0.84 per km, so not a sale fare (on 27 October the headline was ₹309). |

### 2. Sale fares, with extension R2 (21 November 2026)

| Row | Was | Headline (sale) | Now | Evidence for 21 November |
| --- | --- | --- | --- | --- |
| delhi/jaipur | 420, 350, 280 | ₹93 for 287 km (₹0.32/km), RSRTC | **290, 348, 287** | [Delhi to Jaipur](https://www.redbus.in/bus-tickets/delhi-to-jaipur): sorted by price, the cheapest at or above ₹172 (0.60 × 287) is **₹290**, Goldline Super Deluxe, Non A/C Seater / Sleeper (2+1), 14:00, 6 h. Next: RSRTC Express Non AC Seater ₹319, 13:50. Several RSRTC Express seaters show ₹93 (4 on the first read, 6 in the spot check). Avg 5 hrs 48 mins, 287 kms. |
| gurugram/jaipur | 400, 330, 270 | ₹90 for 237 km (₹0.38/km), RSRTC | **290, 285, 237** | [Gurugram to Jaipur](https://www.redbus.in/bus-tickets/gurgaon-to-jaipur): cheapest at or above ₹142 is **₹290**, Goldline Super Deluxe, Non A/C Seater / Sleeper (2+1), 12:20, 5 h 40 min. Six RSRTC Express seaters show ₹90. Avg 4 hrs 45 mins, 237 kms. |
| delhi/dehradun | 550, 370, 260 | ₹99 for 239 km (₹0.41/km) | **179, 326, 239** | [Delhi to Dehradun](https://www.redbus.in/bus-tickets/delhi-to-dehradun): with the date set to 21 November, the page's "Cheapest Bus Ticket Price" is INR 179.00 (₹0.75/km, at or above the threshold). Sorted list also shows ₹339 (GetBookCab, A/C semi sleeper), FlixBus ₹428 and RSRTC Express non-AC seater ₹412. Avg 5 hrs 26 mins, 239 kms. |
| delhi/rishikesh | 500, 370, 240 | ₹99 for 252 km (₹0.39/km) | **179, 324, 252** | [Delhi to Rishikesh](https://www.redbus.in/bus-tickets/delhi-to-rishikesh): 21 November headline INR 179.00 (₹0.71/km). Sorted list also shows City Land Travels ₹314 and UPSRTC Ordinary Non AC Seater ₹446. Avg 5 hrs 24 mins, approximately 252 kms. |

The ₹179 bus on the Dehradun and Rishikesh pages was not among the first sorted cards read. The figure is the page's own statement for that date.

### 3. Premium-only route (decision P)

| Row | Was | Page says | Proposed | Evidence |
| --- | --- | --- | --- | --- |
| delhi/auli | 1150, 820, 510 | INR 2,637; 6 buses; avg 14 hrs 3 mins; approximately 516 kms | **2637, 843, 516** | [Delhi to Joshimath](https://www.redbus.in/bus-tickets/delhi-to-joshimath). On 21 November, 3 FlixBus services at ₹3,266 (A/C sleeper and semi-sleeper). No ordinary or seater bus is listed. |
| gurugram/auli | 1200, 840, 520 | INR 3,909; 1 bus; avg 17 hrs 5 mins; approximately 531 kms | **3909, 1025, 531** | [Gurugram to Joshimath](https://www.redbus.in/bus-tickets/gurgaon-to-joshimath). No bus on 21 November. |

The 27 October review kept these draft, because the only buses are premium sleepers. Their draft fares (₹1,150 and ₹1,200) have no source, and every bus that is actually sold costs at least twice as much. **Recommendation: verify at the page's figures.** They are the only direct buses. The app then labels them curated, and the bus mode stays honest for the 14-hour trip.

### 4. No redBus page for the destination, with extension R1

| Row | Was | Nearest town with a page | Now | Evidence (page headline; all November 2025 or later) |
| --- | --- | --- | --- | --- |
| delhi/chail | 750, 520, 340 | Kandaghat (about 29 km) | **499, 457, 314** | [Delhi to Kandaghat](https://www.redbus.in/bus-tickets/delhi-to-kandaghat): 46 buses, INR 499.00, 7 hrs 37 mins, 314 kms |
| gurugram/chail | 800, 540, 350 | Kandaghat | **630, 569, 378** | [Gurugram to Kandaghat](https://www.redbus.in/bus-tickets/gurgaon-to-kandaghat): 10 buses, INR 630.00, 9 hrs 29 mins, 378 kms |
| delhi/kasauli | 650, 430, 290 | Kalka (about 37 km). Dharampur, 12 km away, has a page with 0 buses. | **315, 351, 258** | [Delhi to Kalka](https://www.redbus.in/bus-tickets/delhi-to-kalka): 42 buses, INR 315.00, 5 hrs 51 mins, 258 kms |
| gurugram/kasauli | 700, 450, 300 | Kalka | **630, 454, 322** | [Gurugram to Kalka](https://www.redbus.in/bus-tickets/gurgaon-to-kalka): 10 buses, INR 630.00, 7 hrs 34 mins, 322 kms |
| delhi/orchha | 750, 620, 470 | Jhansi (about 16 km; the train method's station) | **489, 519, 454** | [Delhi to Jhansi](https://www.redbus.in/bus-tickets/delhi-to-jhansi): 39 buses, INR 489.00, 8 hrs 39 mins, 454 kms. The Orchha page lists 1 bus and no distance. |
| gurugram/orchha | 700, 600, 450 | Jhansi | **899, 523, 424** | [Gurugram to Jhansi](https://www.redbus.in/bus-tickets/gurgaon-to-jhansi): 2 buses, INR 899.00, 8 hrs 43 mins, 424 kms |
| delhi/sariska | 380, 290, 210 | Alwar (about 35 km; B1 uses Alwar for Sariska's local rate too) | **201, 210, 168** | [Delhi to Alwar](https://www.redbus.in/bus-tickets/delhi-to-alwar): 212 buses, INR 201.00, 3 hrs 30 mins, 168 kms |
| gurugram/sariska | 350, 270, 190 | Alwar | **265, 115, 132** | [Gurugram to Alwar](https://www.redbus.in/bus-tickets/gurgaon-to-alwar): 132 buses, INR 265.00, 1 hrs 55 mins, 132 kms. The verified gurugram/alwar row says 239, 120, 132 (26 October); fares moved. |
| delhi/jim-corbett | 450, 400, 250 | Kashipur (about 30 km). redBus "Delhi to Ramnagar" is a different Ramnagar, 627 km away, and Ramnagar (Uttarakhand) has no page. | **374, 314, 234** | [Delhi to Kashipur](https://www.redbus.in/bus-tickets/delhi-to-kashipur) (November 2025): INR 374.00, 5 hrs 14 mins, 234 kms |
| gurugram/jim-corbett | 500, 420, 260 | Kashipur | **1100, 325, 252** | [Gurugram to Kashipur](https://www.redbus.in/bus-tickets/gurgaon-to-kashipur): 2 buses, INR 1100.00, 5 hrs 25 mins, 252 kms (₹4.37/km, see Maulik to check 4) |

### 5. No Gurugram bus to the place or a nearby town: delete (decision D)

| Row | Was | Pages checked | Proposed |
| --- | --- | --- | --- |
| gurugram/dalhousie | 1100, 780, 580 | redBus Gurugram to Dalhousie, Chamba and Banikhet: no page. Gurugram to Pathankot (80 km away) has a page but no distance or duration. | **delete** |
| gurugram/ranthambore | 600, 480, 360 | redBus Gurugram to Sawai Madhopur: no page (Delhi to Sawai Madhopur has 1 bus) | **delete** |

The Gurugram rule ("a Delhi page never supports a gurugram row") rules out using the Delhi pages. Batch 1 already deletes gurugram/ranthambore by train, so Gurugram to Ranthambore becomes car only, which matches the services listed.

### 6. Jim Corbett trains: timetable verified, fare still needed

| Row | Was | Found | Proposed |
| --- | --- | --- | --- |
| delhi/jim-corbett train | 280, 330, 250 | [erail 15013](https://erail.in/train-enquiry/15013): "15013 RANIKHET EXP JSM 02.40 … RMR 04.15, 25.35", so a through service to Ramnagar (RMR) exists, with the coaches running as [25013](https://erail.in/train-enquiry/25013) from Moradabad (MB 02.34, RMR 04.15). Delhi Junction (DLI) departs 22:05, giving **370 min**. Distance: DLI at 986 km, MB at 1147 km, plus MB to RMR 76 km, gives **237 km**. | stays **draft**: duration 370 and distance 237 can be set; the SL fare for 237 km is needed |
| gurugram/jim-corbett train | 280, 330, 260 | The same train from Gurgaon (GGN), departing 20:02: **493 min**, **268 km** (GGN at 955 km) | stays **draft**: SL fare for 268 km needed |

erail prints its fare table only on a station-pair page, and its DLI-to-RMR and GGN-to-RMR pages still say "No Trains found". IRCTC shows fares only after signing in. The verified rows bracket the fares:
- 217 km is ₹165;
- 248 and 253 km are ₹180;
- 276 km is ₹190.

So 237 km is probably ₹175 to ₹180, and 268 km about ₹185 to ₹190. These are estimates, not values to write.

## Demo and test impact

Several fares fall a lot: Dehradun and Rishikesh from ₹550 and ₹500 to ₹179, Jaipur from about ₹400 to ₹290, and Chail, Kasauli and Sariska by a third or more. Cheaper fares can make destinations feasible that were not, so the demo's Tight budget rounds and the Hills shortlist may change. **Apply this batch after the Monday demo, with the held batch 1**, and run the seed and e2e tests (S4-8 Part 2, step 4). Q5 applies: the script and `run-seed.test.ts` change in the same PR if a quoted line moves.

## Review decisions (Maulik, 29 October 2026)

1. **Extension R2 (reference date):** accepted. The 4 sale-fare rows are verified at the figures above.
2. **Extension R1 (nearest town with a page):** accepted for Kandaghat, Kalka, Jhansi, Alwar and Kashipur. The 10 rows are verified at the figures above.
3. **Decision P (Auli):** verify at the premium-only fares (2637 and 3909).
4. **gurugram/jim-corbett bus at ₹1,100:** accepted.
5. **Decision D:** delete gurugram/dalhousie and gurugram/ranthambore by bus.
6. **Jim Corbett trains (updated 29 October 2026, Maulik: "go forward with what you recommend"):** no public source gives the SL fare by the method. erail prints no fare table for DLI or GGN to RMR. IRCTC needs a sign-in. Indian Railways' own [Trains at a Glance 2025 fare table](https://indianrailways.gov.in/railwayboard/uploads/directorate/coaching/TAG_2025/Fares.pdf) lists base fares from before the July and December 2025 revisions, which do not reproduce erail's verified figures: ₹147 base for 216 to 220 km, against erail's ₹165 at 217 km. [etrain.info](https://etrain.info/train/Corbett-Park-Link-25013/schedule) confirms Moradabad to Ramnagar is 76 km. So both rows **stay draft**, with their unsourced values replaced by the timetable and a slab estimate:
   - delhi/jim-corbett train: **175, 370, 237**, draft. The fare is estimated between the verified 217 km (₹165) and 248 km (₹180) rows.
   - gurugram/jim-corbett train: **185, 493, 268**, draft. The fare is estimated between 253 km (₹180) and 276 km (₹190).

   Either row can be verified later from a signed-in IRCTC search, with no other change.

The result is the table at the top: 17 verified, 2 deleted, 2 draft, so B2 is 102/104 after the held batch 1 and this batch.

## Spot check

Record before Part 2 runs (decision 0002, amended), by Maulik or an independent agent session. Open each link and compare with "Now". A fare passes within about 20 %, because redBus prices move daily. Duration and distance must match the page.

| Row | What to open | Result | Checked by, date |
| --- | --- | --- | --- |
| delhi/kasol | Delhi to Kasol page headline | ₹446, 633 min (10 hrs 33 mins), 529 km. Fare, duration and distance match. Holds. | Independent Claude session, 2026-10-29 |
| delhi/jaipur | Delhi to Jaipur, date 21 Nov, sort by price | Headline ₹93 (sale). Cheapest at or above ₹172 (0.60 × 287) is ₹290, Goldline Super Deluxe, 14:00; the RSRTC group goes from ₹93 to ₹319. 348 min (5 hrs 48 mins), 287 km. All match. Holds. | Independent Claude session, 2026-10-29 |
| delhi/chail | Delhi to Kandaghat page headline | ₹499, 457 min (7 hrs 37 mins), 314 km, 46 buses. Fare, duration and distance match. Holds. | Independent Claude session, 2026-10-29 |
| gurugram/sariska | Gurugram to Alwar page headline | ₹265, 115 min (1 hrs 55 mins), 132 km, 132 buses. Fare, duration and distance match. Holds. | Independent Claude session, 2026-10-29 |
