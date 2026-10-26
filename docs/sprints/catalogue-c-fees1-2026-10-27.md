# Catalogue stage C fee pass 1 (27 October 2026)

The first fee follow-up pass agreed in the C3, C4 and C5 reviews. It changes only `entry_fee_inr` and `review_status` on existing rows; no row is added or removed and no hours, location or `source_url` changes.

**Result:** 6 draft rows become verified (Stage C 196 to 202 of 276). 7 other draft rows get a better placeholder fee and stay draft. The other draft rows found no new source.

**Who checked:** Claude, in a separate session from Claude Code, on 27 October 2026, by direct page fetch and in the Claude desktop app's built-in browser. The rule is the one from C3: a fee is verified from the operator's own page, or from two current (2025 or later) pages that state the same exact figure.

## Changes

| Row | Field | Was | Now |
| --- | --- | --- | --- |
| bharatpur/keoladeo-national-park | entry_fee_inr | 0 | 75 |
| bharatpur/keoladeo-national-park | review_status | draft | verified |
| bikaner/junagarh-fort | entry_fee_inr | 50 | 50 |
| bikaner/junagarh-fort | review_status | draft | verified |
| dharamshala/kangra-fort | entry_fee_inr (draft placeholder) | 0 | 25 |
| gwalior/gwalior-fort | entry_fee_inr (draft placeholder) | 0 | 75 |
| gwalior/gujari-mahal-museum | entry_fee_inr (draft placeholder) | 0 | 10 |
| jaipur/amber-fort | entry_fee_inr (draft placeholder) | 100 | 150 |
| jodhpur/umaid-bhawan-museum | entry_fee_inr | 15 | 30 |
| jodhpur/umaid-bhawan-museum | review_status | draft | verified |
| lucknow/bara-imambara | entry_fee_inr | 0 | 50 |
| lucknow/bara-imambara | review_status | draft | verified |
| lucknow/chota-imambara | entry_fee_inr | 0 | 20 |
| lucknow/chota-imambara | review_status | draft | verified |
| lucknow/residency | entry_fee_inr (draft placeholder) | 0 | 25 |
| nainital/nainital-zoo | entry_fee_inr (draft placeholder) | 50 | 150 |
| sariska/bhangarh-fort | entry_fee_inr | 25 | 25 |
| sariska/bhangarh-fort | review_status | draft | verified |
| udaipur/city-palace-udaipur | entry_fee_inr (draft placeholder) | 0 | 300 |

## Evidence for the verified rows

| Row | Fee (Rs) | Kind | Evidence |
| --- | --- | --- | --- |
| lucknow/bara-imambara | 50 | official | lucknowimambara.com (Husainabad & Allied Trust ticket page): "Bara Imambara (Bhool Bhulaiya + Bauli)" Indian adult Rs 50 (combined pass with Chhota Imambara, Picture Gallery and Satkhanda Rs 60); timings 6 AM to 6 PM. [page](https://lucknowimambara.com/) |
| lucknow/chota-imambara | 20 | official | lucknowimambara.com (Husainabad & Allied Trust ticket page): "Chhota Imambara" Indian adult Rs 20 (combined pass Rs 60). [page](https://lucknowimambara.com/) |
| bharatpur/keoladeo-national-park | 75 | secondary | easeindiatrip.com (modified 20 June 2025): "Indian Visitors" Rs 75; kadambkunj.com (modified 4 May 2026): "The ticket is Rs. 75 for Indian tourists." [page](https://www.easeindiatrip.com/blog/keoladeo-national-park-entry-fee-safari-timings-how-to-reach/) |
| bikaner/junagarh-fort | 50 | secondary | rajasthanplaces.com (4 May 2026): "The ticket price is 50 rupees for Indians."; TravelTriangle (updated 2026): "INR 50 for Indian adults". [page](https://www.rajasthanplaces.com/bikaner/junagarh-fort/) |
| jodhpur/umaid-bhawan-museum | 30 | secondary | rajasthanplaces.com (25 April 2026): "The entry fee for Umaid Bhawan Palace museum is Rs 30 for Indians."; TravelTriangle (updated 2026): Rs 30. [page](https://www.rajasthanplaces.com/jodhpur/umaid-bhawan-palace/) |
| sariska/bhangarh-fort | 25 | secondary | jaipurmetroroutes.com (2026): "Rs 25 for Indians, Rs 200 for foreigners"; bhangarhfort.com FAQ (2026): "an ASI fee of Rs 25 for Indians". [page](https://www.jaipurmetroroutes.com/places/bhangarh-fort) |

## Placeholders updated (still draft)

| Row | New placeholder (Rs) | Why it stays draft |
| --- | --- | --- |
| nainital/nainital-zoo | 150 | Sources disagree and rise over time: nainitaltourism.org.in (23 April 2026) Rs 150, closed Thursday (matches the Google listing); hotelwoodlandnainital.com (December 2023) Rs 100; kiomoi.com (undated) Rs 50. |
| lucknow/residency | 25 | ASI site. district.in, which lists the Residency as organised by the ASI, shows "Rs 20 onwards" online; the ASI's online discount is Rs 5, which suggests Rs 25 at the counter, but no page states Rs 25 directly. |
| dharamshala/kangra-fort | 25 | Only one dated page: easeindiatrip.com (15 July 2025) "Rs 25 for Indian nationals". |
| gwalior/gwalior-fort | 75 | Only one page, unofficial and undated: gwaliorfort.in, Man Mandir Palace "Rs 75 (Indians)", described as the Gwalior Fort ticket that also covers Teli Ka Mandir and the Sas-Bahu temples. |
| gwalior/gujari-mahal-museum | 10 | Only one page, unofficial and undated: gwaliorfort.in "Rs 10 (Indians)". |
| udaipur/city-palace-udaipur | 300 | Sources disagree: rajasthanplaces.com (14 April 2026) palace complex entry "Indian adults: Rs 300"; travzzy.com gives Rs 30 (palace grounds); the official ticket page needs location access. |
| jaipur/amber-fort | 150 | Sources still disagree after this pass: jaipurstuff.com (July 2025) Rs 150; rajasthantourtrip.com (September 2026) "commonly reported at Rs 200" with some sources at Rs 100; pinkcitytours.com (2026) Rs 100. |

## Maulik to check

1. **What is left.** After this pass, 74 rows are still draft. Three of them are the Jim Corbett safari rows and two the Ranthambore and Sariska safaris, kept draft by the C2 and C3 decisions; ten are draft for hours (some for hours and fee). Most of the rest are smaller sites with no page online that states a fee. The fastest remaining source is the ticket-board photos on each Google Maps listing, which need a person to read them; see the list in the PR description.
2. **Bara Imambara and Chhota Imambara** use the ticket page at lucknowimambara.com, which names the Husainabad & Allied Trust as manager but also carries a payment provider's branding. Accept it as the operator's page, or keep the two rows draft.

## Review decisions (Maulik, 27 October 2026)

- Item 1: accepted; remaining drafts stay for a second pass from ticket-board photos.
- Item 2: accepted; lucknowimambara.com counts as the operator's page.

## Spot check

Recorded before merge (decision 0002), as in batches C3 to C5: at Maulik's request, Claude re-read three of the six sources in the built-in browser on 27 October 2026. Maulik's approval of the PR stands in for his own check.

| Row | Value in file | What the source says | Holds |
| --- | --- | --- | --- |
| lucknow/bara-imambara, lucknow/chota-imambara | Rs 50; Rs 20 | lucknowimambara.com table: "2 Bara Imambara (Bhool Bhulaiya + Bauli) Rs 50", "3 Chhota Imambara Rs 20" (Indian adult column) | yes |
| bikaner/junagarh-fort | Rs 50 | rajasthanplaces.com: "The ticket price is 50 rupees for Indians" | yes |
| sariska/bhangarh-fort | Rs 25 | jaipurmetroroutes.com: "Rs 25 for Indians, Rs 200 for foreigners" | yes |

3 of 3 hold.

