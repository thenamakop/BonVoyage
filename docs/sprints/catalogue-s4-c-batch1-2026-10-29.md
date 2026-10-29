# Catalogue S4-8 C batch 1: demo-shortlist and ticketed places (#39)

Stage C has 74 draft places of interest. This batch takes 16: the places on demo shortlists (Bikaner 2, Mathura 1), then the ticketed monuments the C reports could not settle (Gwalior 4, Orchha 4, Lucknow 2, Amritsar 2, Kurukshetra 1). Chakrata's Tiger Falls stays draft on purpose: it is the demo's "Not verified" item (S4-8, batch 4 note).

**Result (after Maulik's decisions of 29 October 2026, see [Review decisions](#review-decisions-maulik-29-october-2026)):** 10 rows verified, 6 stay draft. A first pass verified 4 rows. Maulik then accepted Orchha Fort's second source, accepted MP Tourism's 2023-dated page, and allowed reading the ASI and Gobindgarh fees inside their booking flows. That settled 6 more.

**Who checked:** Claude in Cowork, by page fetch and in Maulik's Chrome through the Claude browser extension, without signing in or starting any booking, on 29 October 2026 (about 10:45 to 11:30 UTC). `collected_on` is `2026-10-29`. Decision 0002 (amended) needs Maulik's review and a recorded spot check before merge.

## Method

As in the C reports ([catalogue-c1-pois-2026-10-26.md](catalogue-c1-pois-2026-10-26.md#method), [catalogue-c5-pois-2026-10-27.md](catalogue-c5-pois-2026-10-27.md#method)): a fee is verified only from the operator's own page or two current pages that agree. Hours stay from the Google listing unless another page supplied them (none did in this batch), so `source_url` stays the listing; the fee page is named in the row.

Pages used as official for the first time in this batch, each a government site:
- **mptourism.com**, Madhya Pradesh Tourism Board (Gujari Mahal is a state archaeology museum).
- **incredibleindia.gov.in**, Ministry of Tourism (its pages for the Sri Krishna Museum and the camel centre).
- **museumsofindia.org**, Ministry of Culture's museum portal (accepted as official for Bharatpur's museum in C1).
- **punjabtourism.punjab.gov.in** and **amritsar.nic.in**, Punjab Government and the district administration.

**ASI monuments.** ASI publishes fees only inside its ticket portal ([asi.paygov.org.in](https://asi.paygov.org.in/asi-webapp/#/ticketbooking)). With Maulik's permission (29 October), Claude chose the circle, ticked the monument, accepted the default visit date (30 October 2026) and the Forenoon slot, and pressed PROCEED. The next page shows a "SUMMARY" with the amount for 1 Indian adult, above fields for age, email and mobile. Nothing was entered and nothing was paid. These are ASI's online prices; counter prices may differ. Two Lok Sabha answers (2017, 2023) list the monuments' ticket revenue but no fees, and a 9 September 2026 report of a *proposed* re-categorisation (Gwalior Fort and the Residency in Category B) gives no fees and is not in force.

## Every row

### Verified

| Row | Field | Was | Now | Evidence |
| --- | --- | --- | --- | --- |
| gwalior/gujari-mahal-museum | entry_fee_inr | 10 | **20** | [MP Tourism](https://www.mptourism.com/gujari-mahal-state-archaeological-museum-gwalior.html): "The entry fee for Indian citizens is just Rs. 20", "from 10:00 AM to 5:00 PM", "closed on Mondays and all Government of Madhya Pradesh holidays". Hours and closed day match the file (10:00 to 17:00, closed 1). |
| kurukshetra/krishna-museum | entry_fee_inr | 0 | **30** | [Incredible India](https://www.incredibleindia.gov.in/en/haryana/kurukshetra/sri-krishna-museum): "Adult- Rs.30/- per head", "Opening time - 10:00 AM - 05:00 PM", "(Closed on Mondays)". Hours and closed day match the file. |
| lucknow/ambedkar-park | entry_fee_inr | 0 | **15** | [Museums of India](https://museumsofindia.org/museum/12347/dr-bhimrao-ambedkar-samajik-parivartan-prateek-sthal) (Dr. Bhimrao Ambedkar Samajik Parivartan Prateek Sthal, Vipul Khand, Gomti Nagar): "₹15 for adults", open every day 11 am to 9 pm, "closed on public holidays". Hours match the file (11:00 to 21:00); no weekly closed day. |
| amritsar/ranjit-singh-panorama | entry_fee_inr | 0 | **10** | [Punjab Tourism, "Maharajah Ranjit Singh Museum and Panorama"](https://punjabtourism.punjab.gov.in/maharajah-ranjit-singh-museum-and-panorama1.php): "Entry: Rs10", "Closed: Monday & Public Holidays". [amritsar.nic.in](https://amritsar.nic.in/tourist-place/maharaja-ranjit-singh-museum/) (the museum in the same Ram Bagh complex): "Rs. 10 Per Person", closed Mondays. Closed day matches the file; hours kept from the Google listing (09:30 to 17:30), see Maulik to check 3. |
| gwalior/gwalior-fort | entry_fee_inr | 75 | **20** | [ASI ticket portal](https://asi.paygov.org.in/asi-webapp/#/ticketbooking), Bhopal circle, "Gwalior Fort ( Centrally Protected Monument )": SUMMARY "1 adult … 20 1 = 20, Total =20" (Indian). This is the only ASI ticket listed for Gwalior. |
| gwalior/teli-ka-mandir | entry_fee_inr | 0 | **0** (covered) | ASI sells no separate ticket. Teli Ka Mandir is a centrally protected monument inside Gwalior Fort, covered by the fort's ₹20 ticket above; the row keeps 0 so a day plan does not charge twice. |
| gwalior/sas-bahu-temple | entry_fee_inr | 0 | **0** (covered) | As Teli Ka Mandir: covered by the Gwalior Fort ticket; no separate ASI ticket. |
| lucknow/residency | entry_fee_inr | 25 | **20** | ASI ticket portal, Lucknow circle, "Residency Buildings": SUMMARY "20 1 = 20, Total =20" (Indian adult). |
| amritsar/gobindgarh-fort | entry_fee_inr | 0 | **380** | [fortgobindgarh.com, Indian guests](https://fortgobindgarh.com/indian-guests-tickets/) (the operator): the basic ticket "₹ 380 per ticket" (Entry, 7D Show, Live Performances, Pagri Museum), 10 AM to 5 PM; "OPENING HOURS Mon – Fri 10:00am – 10pm, Sat – Sun 10am – 10pm", matching the file (10:00 to 22:00). The fort has no entry-only ticket. |
| orchha/orchha-fort | entry_fee_inr | 0 | **10** | Decision O, accepted (Review decisions, item 1): India Someday (May 2025) and Outlook Traveller (June 2024) agree on INR 10 for Indians. |

Each of these ten rows: `collected_on` 2026-10-29, `review_status` verified, every other column unchanged.

### Stay draft

| Row | Why | What was found |
| --- | --- | --- |
| bikaner/camel-research-centre | No fee on any official page, and the official hours disagree with the file | [Incredible India](https://www.incredibleindia.gov.in/en/rajasthan/bikaner/national-camel-research-centre): "Opening time - 02:00 PM", "Closing time - 06:00 PM", "(Closed on Sundays and public holidays)"; no fee. [ICAR-NRCC](https://nrccamel.icar.gov.in/) mentions the museum, camel rides and safari, with no fees or hours. The file has Google's 11:00 to 18:30 daily and ₹20. |
| bikaner/lalgarh-palace | No official page for the Shri Sadul Museum | Only travel pages; none current with an exact fee that a second page confirms. |
| mathura/government-museum | No fee on any official page | [Incredible India](https://www.incredibleindia.gov.in/en/uttar-pradesh/mathura/government-museum): "Opening time - 10:30 AM", "Closing time - 04:30 PM" (matches the file); no fee and no closed day. |
| orchha/laxmi-narayan-temple | One page only, and it conflicts with the C5 note | India Someday: "Free", 09:00 to 17:00 (both match the file). C5 recorded it as covered by the composite ticket; no second page settles it. |
| orchha/chhatris | Pages disagree | India Someday: "Same ticket as the Orchha Fort Complex", 10:30 to 17:00, closed Mondays. Outlook Traveller: "INR 250 for adults", 8 AM to 7:30 PM. The file has 09:00 to 18:00, fee 0. |
| orchha/wildlife-sanctuary | No page with a fee | MP Tourism calls it the "Orchha Bird Sanctuary" and gives no fee or hours. |

## Demo and test impact

None of the ten rows is in a demo trip's day plan. The demo plans Chakrata; Bikaner and Mathura appear only on shortlists, and their rows here stay draft. The fees feed `entry_fee_inr` on day plans for Gwalior, Kurukshetra, Lucknow, Amritsar and Orchha. Part 2 still runs the seed and e2e tests.

## Review decisions (Maulik, 29 October 2026)

1. **Decision O (Orchha Fort ₹10):** accepted. The June 2024 Outlook Traveller page counts as the second source, as it agrees with the May 2025 page.
2. **Booking flows:** Claude may press ASI's PROCEED and Gobindgarh's Book Now, stopping at the first page that asks for personal details or payment. Done. Gobindgarh's prices were on its Indian-guests page, so Book Now was not needed. Result: Gwalior Fort, Teli Ka Mandir, Sas-Bahu, the Residency and Gobindgarh Fort verified.
3. **Gujari Mahal ₹20:** accepted from MP Tourism's page, the operator's own, though the page is dated 31 October 2023.
4. **Still open, for a later batch:** the Ranjit Singh Panorama's official hours differ from Google's (the file keeps Google's, per the method). The camel centre's official hours (2 to 6 pm, closed Sundays) differ from Google's (11 am to 6:30 pm daily); this matters once a fee is found.
5. **Note on Teli Ka Mandir and Sas-Bahu:** they are recorded as 0 because the Gwalior Fort ticket covers them. If a later source shows separate tickets, they change.

## Spot check

Record before Part 2 runs (decision 0002, amended), by Maulik or an independent agent session. Open each link and compare with "Now"; fees and hours must match the page.

| Row | Link to open | Result | Checked by, date |
| --- | --- | --- | --- |
| gwalior/gujari-mahal-museum | MP Tourism Gujari Mahal page | Matches "Now". Page states: fee "Rs. 20" for Indian citizens (Rs. 400 for foreigners); hours 10:00 AM to 5:00 PM; "closed on Mondays and all Government of Madhya Pradesh holidays". Fee 20, hours 10:00 to 17:00, closed day Monday all agree. | Independent Claude session, 2026-10-29 |
| kurukshetra/krishna-museum | Incredible India Sri Krishna Museum page | Matches "Now". Page states: adult fee "Rs.30/- per head" (child Rs.10); "Opening time - 10:00 AM - 05:00 PM"; "(Closed on Mondays)". Fee 30, hours 10:00 to 17:00, closed day Monday all agree. | Independent Claude session, 2026-10-29 |
| lucknow/ambedkar-park | Museums of India page | Matches "Now". Page states: fee "₹15 for adults" (free for children under 5 and some other groups); open every day 11 am to 9 pm; "closed on public holidays", no weekly closed day. Fee 15, hours 11:00 to 21:00, no weekly closed day all agree. | Independent Claude session, 2026-10-29 |
| amritsar/gobindgarh-fort | fortgobindgarh.com Indian guests tickets page (no booking) | Matches "Now". Page lists 8 Indian guest tickets from ₹380 to ₹855; the cheapest is ₹380 (10 AM to 5 PM slot, and the same price after 5 PM). Hours stated: "Mon – Fri 10:00am – 10pm" and "Sat – Sun 10am – 10pm"; no closed day listed. Fee 380 and hours 10:00 to 22:00 both agree. | Independent Claude session, 2026-10-29 |