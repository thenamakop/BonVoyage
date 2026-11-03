# Catalogue S4-8 C batch 2: Rajasthan places (#39)

This batch takes the 22 draft places of interest in Rajasthan: Udaipur 5, Bundi 5, Neemrana 3, Ranthambore 3, Ajmer 2, Alwar 2, Bharatpur 1 and Sariska 1.

**Result (after Maulik's decisions of 3 November 2026, see [Review decisions](#review-decisions-maulik-3-november-2026)):** 2 rows verified (Ranthambore canter safari, Deeg Palace), 20 stay draft. Four of the draft rows take a best-estimate fee in place of the file's figure; they stay draft and show in the app as "Not verified". Rajasthan publishes no fee table that can be read. The secondary sites that earlier batches relied on (rajasthanplaces.com, TravelTriangle) cover only a few towns, and where both cover a place they disagree. A fee needs the operator's own page or two current pages that agree, so most rows cannot be verified with the sources available today.

**Who checked:** Claude in Cowork, by page fetch, in Maulik's Chrome through the Claude browser extension and in the Claude desktop app's browser, without signing in or paying, on 3 November 2026 (about 22:50 UTC on 2 November to 23:15 UTC). `collected_on` is `2026-11-02`, because the checker compares against the UTC date. Decision 0002 (amended) needs Maulik's review and a recorded spot check before merge.

## Method

As in the earlier C reports ([catalogue-c1-pois-2026-10-26.md](catalogue-c1-pois-2026-10-26.md#method), [catalogue-s4-c-batch1-2026-10-29.md](catalogue-s4-c-batch1-2026-10-29.md)): a fee is verified only from the operator's own page or two current pages that agree. Hours stay from the Google listing.

**ASI monuments.** As in batch 1, ASI publishes fees only inside its ticket portal ([asi.paygov.org.in](https://asi.paygov.org.in/asi-webapp/#/ticketbooking)). With Maulik's permission (3 November), Claude chose the Jaipur circle, ticked "Deeg Bhawan", accepted the default visit date (3 November 2026), chose the Afternoon slot and pressed PROCEED. The next page shows a "SUMMARY" with the amount for 1 Indian adult, above fields for age, email and mobile. Nothing was entered and nothing was paid.

**Estimates (new in this batch, Maulik's decision 2).** Where no fee can be verified, a draft row may carry a best estimate so the app's day-plan costs are closer to real. The rule: take the most recent page found for that place; if it splits the fee into parts a visitor pays together, add them; if a published, dated fee rise applies to the file's figure, apply it; otherwise keep the file's figure. An estimate never makes a row verified, never changes `source_url` or `collected_on`, and is listed in this report so a later batch can replace it.

## Verified

| Row | Field | Was | Now | Evidence |
| --- | --- | --- | --- | --- |
| ranthambore/ranthambore-safari | entry_fee_inr | 900 | **987** | Two current reports of the Rajasthan forest department's annual 10 % rise, effective 1 April 2026: [ETV Bharat, 1 April 2026](https://www.etvbharat.com/en/state/rajasthan-forest-department-hikes-entry-fees-for-ranthambore-sariska-by-10-percent-enn26040104436), canter for Indian visitors "increased to Rs 986.63 from Rs 888"; [Patrika, 1 April 2026](https://www.patrika.com/en/sawai-madhopur-news/ranthambore-tiger-safari-gets-costlier-with-10-fee-hike-20465999), "Canter safari: Previously ₹888, now ₹986.63". Rounded to whole rupees. `source_url` becomes the ETV Bharat report, because the old source (trawell.in) no longer supports the value. |
| bharatpur/deeg-palace | entry_fee_inr | 0 | **20** | [ASI ticket portal](https://asi.paygov.org.in/asi-webapp/#/ticketbooking), Jaipur circle, "Deeg Bhawan": SUMMARY "20 1 = 20", "Total =20" (1 Indian adult, 3 November 2026, Afternoon). The Jaipur circle lists three ticketed monuments (Bhangarh, Abhaneri, Deeg Bhawan). `source_url` stays the Google listing (hours), as for batch 1's ASI rows. |

Ranthambore safari: `entry_fee_inr` 987, `source_url` the ETV Bharat link, `collected_on` 2026-11-02, `review_status` verified. Deeg Palace: `entry_fee_inr` 20, `collected_on` 2026-11-02, `review_status` verified. Every other column unchanged.

## Stay draft, with a best estimate

| Row | File fee | Estimate | Basis |
| --- | --- | --- | --- |
| udaipur/saheliyon-ki-bari | 5 | **30** | Most recent page: rajasthanplaces.com (9 May 2026), "around ₹30". TravelTriangle (2025) says INR 10. |
| udaipur/sajjangarh-palace | 10 | **30** | rajasthanplaces.com (8 May 2026): "around ₹10 for the sanctuary and ₹20 for the palace"; a visitor pays both, 10 + 20. TravelTriangle (2025) says INR 10 with no breakdown. |
| udaipur/bagore-ki-haveli | 30 | **60** | rajasthanplaces.com (10 September 2025): "Rs. 60 (Indian)". The TravelTriangle page no longer exists. |
| sariska/sariska-safari | 800 | **880** | The 1 April 2026 reports above say Sariska's fees rose 10 % from 2 April, with no Sariska figure; 800 × 1.10. This assumes the file's 800 was the 2025-26 fee. |

Each of these four rows: `entry_fee_inr` the estimate, `review_status` stays `draft`, `source_url` and `collected_on` unchanged.

## Stay draft, file fee kept

| Row | File fee | What was found |
| --- | --- | --- |
| udaipur/city-palace-udaipur | 300 | rajasthanplaces.com (14 April 2026): "Indian adults: ₹300". TravelTriangle (2025): INR 250 main entry, INR 50 museum. The totals agree with the file, but the pages describe different tickets, so it is not verified. The official [e-ticket page](https://eticket.citypalacemuseum.org/counter/733995013915) shows only a welcome banner without location access, and the [visit page](https://citypalacemuseum.org/planyourvisit) gives hours (09:00 am to 09:00 pm), no fee. |
| udaipur/shilpgram | 30 | rajasthanplaces.com (28 April 2026): "₹30 per Indian adult", matching the file. One source only. |
| ranthambore/ranthambore-fort | 10 | No current page found. |
| ranthambore/chambal-palighat | 0 | No page with the boat or entry fee found. |
| bundi/taragarh-fort, bundi/bundi-palace, bundi/raniji-ki-baori, bundi/sukh-mahal, bundi/chaurasi-khambon-ki-chhatri | 100, 100, 50, 75, 50 | rajasthanplaces.com has no Bundi pages; no current page that a second page confirms. |
| ajmer/soniji-ki-nasiyan, ajmer/akbari-fort-museum | 10, 20 | No current confirming pair (C1 recorded Museums of India and trawell.in disagreeing for the museum). |
| alwar/alwar-city-palace-museum, alwar/moosi-maharani-chhatri | 20, 0 | No current page found. |
| neemrana/neemrana-fort-palace, neemrana/neemrana-baori, neemrana/gs-waterpark | 2000, 0, 0 | No current page found. The fort is a hotel that sells day packages. |

## Demo and test impact

None of the six changed rows is in a demo trip's day plan (Ranthambore, Bharatpur, Udaipur and Sariska appear at most on shortlists). Higher entry fees can slightly raise a day plan's cost, so Part 2 still runs the seed and e2e tests.

## Review decisions (Maulik, 3 November 2026)

1. **Deeg Palace:** read on the ASI portal the same way as batch 1 (PROCEED, stop at the personal-details page). Done: ₹20, verified.
2. **The rest of Rajasthan:** stay draft. Where a page gives a figure, use it as a best estimate ("hypothetical from our end"), per the estimate rule in Method. Four rows change; sixteen keep the file's figure.

## Spot check

Record before Part 2 runs (decision 0002, amended), by Maulik or an independent agent session. Estimates are not spot-checked: they stay draft.

| Row | Link to open | Result | Checked by, date |
| --- | --- | --- | --- |
| ranthambore/ranthambore-safari | ETV Bharat and Patrika reports of 1 April 2026 | Matches "Now". ETV Bharat: the Indian canter fee "increased to Rs 986.63 from Rs 888", new rates from 1 April. Patrika: the Indian canter fee "was ₹888, which will now be ₹986.63", from 1 April 2026. | Independent Claude session, 2026-11-03 |
| bharatpur/deeg-palace | ASI ticket portal, Jaipur circle, Deeg Bhawan, PROCEED to the SUMMARY (enter nothing, pay nothing) | Matches "Now". SUMMARY reads "Deeg Bhawan, 1 adult, 0 children, November 3, 2026 Afternoon, 20 × 1 = 20" and "Total =20" (origin Indian, country India). Nothing entered; stopped before PROCEED TO PAY. | Independent Claude session, 2026-11-02 |
