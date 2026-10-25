# Catalogue stage B1a verification: cost rules and destination costs (26 October 2026)

Stage B1a covers the 5 cost rules in `cost-rules.json` and the 5 cost columns (`stay_budget_inr`, `stay_mid_inr`, `stay_premium_inr`, `food_per_day_inr`, `local_per_day_inr`) of the 44 destinations in `destinations.csv`: 49 rows. The 88 car rows in `fares.csv` (the rest of B1) are not part of this batch.

**Result:** 4 of 49 rows verified: the fuel price, car mileage, toll rate and persons per car. The car rental rate and all 44 destination cost rows stay `draft`, because no readable, current source supports them; they are on the [Maulik to check](#maulik-to-check) list. `pnpm catalogue:check` shows Stage B1 at 4/137 with 0 errors. One value changed: car mileage, 15 to 19 km/litre.

**Who checked:** Claude (AI assistant, this session) read every source on 26 October 2026 India time. Pages were read between 22:00 and 23:00 UTC on 25 October, so `collected_on` is `2026-10-25`: the checker compares against the UTC date. Under decision 0002 (amended 24 October), an independent spot check and Maulik's review are still to come before merge.

## Method

### Cost rules

- **`fuel_price_inr_per_litre`:** the Delhi retail petrol price for today from a dated report, as published (2 decimals). The Indian Oil and BPCL pages were not used; Goodreturns' page dated "26th Oct, 2026" was. Aaj Tak's New Delhi table was a cross-check.
- **`car_km_per_litre`:** a road-tested real-world highway figure for a typical petrol hatchback, the Maruti Swift (fourth generation, 1.2-litre Z-series, manual), from Autocar India.
- **`toll_inr_per_km`:** NHAI's one-way private-vehicle toll on one named route from Delhi, NH48 Delhi to Jaipur, divided by that stretch's length. **₹395 ÷ 242 km = 1.632, which rounds to 1.6 ₹/km** (1 decimal).
  - ₹395 is NHAI's figure after the July 2026 revision, quoted by IANS (LatestLY) and NewKerala.
  - 242 km is Wikipedia's length for NH48 Delhi–Jaipur, Kherki Daula toll plaza to Daulatpura toll plaza.
  - No per-plaza table for all plazas was readable; the NHAI total is the sum of the plaza fees on the route.
- **`persons_per_car`:** the Swift seats five (Autocar India). **4 is an assumption:** five seats, with luggage for a road trip.
- **`car_rental_inr_per_day`:** wanted a typical self-drive hatchback day rate in Delhi NCR from an operator page or a dated report. None was readable (see [Maulik to check](#maulik-to-check)).

### Destination costs

- **Sources tried:**
  - Official tariffs (GMVN, KMVN, HPTDC, RTDC, UP and MP tourism): searches found no static, readable tariff page. The booking portals render client-side.
  - Each destination's English Wikivoyage article: read as raw wikitext from wikivoyage.org itself. That form includes each listing's `price=` and `lastedit=` fields.
- **What a verified row needs:** `cost_review_status` covers all five columns together, so a row is verified only if all five have a quotable source:
  - **Stays:** priced listings under the page's Budget, Mid-range and Splurge headings, a double room per night, the typical price per tier to the nearest ₹100.
  - **Food:** meal prices at budget to mid-range places, three meals per person to the nearest ₹50.
  - **Local:** local fares for two to four rides, to the nearest ₹50.
- **Recency rule (applied in this batch, for Maulik to confirm):** a price counts only when the page dates it to 2023 or later, through the listing's `lastedit=` or a year in the text.
  - Most Wikivoyage prices carry no date. Where they do, they are mostly 2012 to 2016: Amritsar's room prices are tagged "(2014)" and "(2015)", Jaipur's mid-range says "as of June 2012", and Bharatpur lists a ₹90 double room.
  - A 2014 price does not support a 2026 in-season figure, and copying it in would understate F5 and package costs.
- **Outcome:**
  - **Every column quoted, but not current:** 6 articles (Rishikesh, Haridwar, Shimla, Jaipur, Udaipur, Amritsar) quote all five columns, but undated or with old dates.
  - **Missing a column outright:** 33 articles have a page but lack at least one column at any date: no priced Splurge tier, no food prices or no local fares.
  - **No usable page:** Kasol, Kanatal, Sariska and Neemrana have no Wikivoyage article. Agra keeps its listings on district sub-pages that were not read.
  - **Rows passing the recency rule:** none has all five columns dated 2023 or later.

## Changes (1)

| Row | Field | Was | Now | Why |
| --- | --- | --- | --- | --- |
| car_km_per_litre | value | `15` | `19` | Autocar India's real-world highway figure for the Swift manual: "19kpl for the manual" (+27%) |

Unchanged values that are now verified, with new sources and dates: `fuel_price_inr_per_litre` 102.12, `toll_inr_per_km` 1.6, `persons_per_car` 4. No destination value changed.

## Every row

### Cost rules

| Key | Value | Source | Quote | Status |
| --- | --- | --- | --- | --- |
| fuel_price_inr_per_litre | 102.12 | [Goodreturns](https://www.goodreturns.in/petrol-price-in-delhi-s10.html), page dated "26th Oct, 2026" | "Today's petrol price in Delhi (New Delhi) stands at ₹102.12 per litre." Cross-checks: [Aaj Tak](https://www.aajtak.in/fuel-price/petrol-price-in-new-delhi-today) gives ₹102.12 for every day from 15 to 25 October 2026 ("OCT 25, 2026 / PETROL (₹/L) / ₹102.12"); [The Hans India](https://www.thehansindia.com/business/petrol-and-diesel-prices-today-in-hyderabad-delhi-chennai-and-mumbai-on-18-october-2026-1133517), 18 Oct 2026: "the petrol price in Delhi is at Rs. 102.12 per litre". | verified |
| car_km_per_litre | 19 | [Autocar India](https://www.autocarindia.com/auto-features/maruti-swift-mileage-real-world-fuel-efficiency-tested-explained-432911), 19 Sep 2024 | "The Swift's fuel efficiency numbers during our highway test cycle, with an average speed of 54kph, were 19kpl for the manual and 19.1kpl for the AMT." Car: "The fourth-generation Swift, with its all-new Z-series 1.2-litre 3-cylinder petrol engine". | verified |
| toll_inr_per_km | 1.6 | [LatestLY (IANS)](https://www.latestly.com/india/news/jaipur-delhi-travel-gets-costlier-as-nhai-hikes-toll-charges-by-up-to-12-7525622.html), 21 Jul 2026; length from [Wikipedia](https://en.wikipedia.org/wiki/Delhi%E2%80%93Jaipur_Expressway) | "For private vehicle owners driving between Jaipur and New Delhi via National Highway 48 (NH-48), a single trip now costs ₹395, up from the previous rate of INR 375." [NewKerala](https://www.newkerala.com/news/a/nhai-hikes-toll-rates-across-jaipur-highways-jaipur-delhi-242.htm) quotes NHAI: "Private vehicle owners travelling between Jaipur and Delhi will now have to pay Rs 395 in one-way toll charges". Wikipedia: "Length 242 km"; "It starts from Kherki Toll Plaza in Gurugram and terminate near Daulatpura Toll Plaza at Jaipur." 395 ÷ 242 = 1.63. | verified |
| persons_per_car | 4 | [Autocar India, Swift](https://www.autocarindia.com/cars/maruti-suzuki/swift) | "The Maruti Suzuki Swift is a five-seat premium hatchback"; spec block "Seating 5". 4 is the stated assumption (luggage). | verified |
| car_rental_inr_per_day | 2500 (unchanged) | none | See [Maulik to check](#maulik-to-check) | draft |

### Destinations (all draft; values unchanged)

Values are budget / mid / premium stay, food per day, local per day. "Quoted" means the article has prices for that column at all; the last column says why the row is not verified.

| Row | Current values | Source read | What the source gives | Why still draft |
| --- | --- | --- | --- | --- |
| agra | 900 / 2200 / 6000 / 500 / 300 | [Agra](https://en.wikivoyage.org/wiki/Agra) | Tier bands only ({{sleeppricerange\|Under ₹1,000\|₹1,000–6,000\|Over ₹6,000}}); listings on district pages; no food prices; e-rickshaw "₹150-200 per e-rickshaw", auto "about ₹200", cycle rickshaw "₹40" (undated) | Stays and food not read; local undated |
| ajmer | 800 / 2000 / 5000 / 450 / 250 | [Ajmer](https://en.wikivoyage.org/wiki/Ajmer) | No room prices; "Dishes are ₹50-100"; tempos "₹10 in 2019" | No stays |
| almora | 1100 / 2600 / 6000 / 500 / 300 | [Almora](https://en.wikivoyage.org/wiki/Almora) | No prices in Sleep, Eat or Get around | No prices |
| alwar | 900 / 2200 / 5500 / 450 / 250 | [Alwar](https://en.wikivoyage.org/wiki/Alwar) | One room price "Single/double from ₹250/₹300" (untiered, undated); food "₹60-100"; no local fares | No tiers or local |
| amritsar | 900 / 2400 / 6000 / 550 / 350 | [Amritsar](https://en.wikivoyage.org/wiki/Amritsar) | All five quoted, e.g. "Double ₹1250 (2015)", many tagged "(2014)"; meals "₹40–60"; auto "around ₹20" (undated) | Prices dated 2014–2015 or undated |
| auli | 1500 / 3500 / 9000 / 700 / 400 | [Auli](https://en.wikivoyage.org/wiki/Auli) | One untiered price "price=4500" (lastedit 2023-09-18); food "₹60/pp" (undated); cable car "₹1000 for round trip" | No tiers; food and local undated |
| bharatpur | 900 / 2300 / 5500 / 450 / 250 | [Bharatpur](https://en.wikivoyage.org/wiki/Bharatpur) | "Single: ₹80, Double: ₹90"; "₹1,800" (untiered, undated); no food prices; autos "₹10-20 (shared)" | No tiers or food |
| bhimtal | 1200 / 3000 / 7500 / 600 / 350 | [Bhimtal](https://en.wikivoyage.org/wiki/Bhimtal) | No prices | No prices |
| bikaner | 900 / 2400 / 6500 / 500 / 300 | [Bikaner](https://en.wikivoyage.org/wiki/Bikaner) | Untiered rooms ₹800–28000 (undated); no food prices; auto day hire "shouldn't cost more than ₹250" | No tiers or food |
| bir | 1000 / 2600 / 6500 / 550 / 350 | [Bir](https://en.wikivoyage.org/wiki/Bir) | "Rates range from ₹200 to ₹2000 per night (2019)"; "Meals ... between ₹20 and ₹200 per person (2019)"; no fares in Get around | No tiers; 2019 |
| bundi | 800 / 2000 / 5000 / 450 / 250 | [Bundi](https://en.wikivoyage.org/wiki/Bundi) | Budget and Mid-range only (undated); "thali ₹100-180"; "Auto rickshaw charges are ₹30-50 within city" (undated) | No Splurge tier; undated |
| chail | 1300 / 3200 / 8000 / 600 / 350 | [Chail](https://en.wikivoyage.org/wiki/Chail) | Budget and Splurge dated 2023-08-22 (Chail Palace rooms "₹5,200–10,400"); no Mid-range; no food or local fares | No Mid-range, food or local |
| chakrata | 1100 / 2600 / 6000 / 500 / 300 | [Chakrata](https://en.wikivoyage.org/wiki/Chakrata) | No prices | No prices |
| dalhousie | 1200 / 3000 / 7500 / 600 / 350 | [Dalhousie (India)](https://en.wikivoyage.org/wiki/Dalhousie_(India)) | Untiered rooms ₹400–6,000 (undated); no food prices; no local fares | No tiers, food or local |
| dehradun | 1000 / 2600 / 6500 / 550 / 300 | [Dehradun](https://en.wikivoyage.org/wiki/Dehradun) | Budget "From ₹3,500"; Splurge "3000" (2024-07-18); no Mid-range price; no food or local fares | No Mid-range, food or local |
| dhanaulti | 1200 / 2800 / 6500 / 500 / 300 | [Dhanaulti](https://en.wikivoyage.org/wiki/Dhanaulti) | No prices | No prices |
| dharamshala | 1100 / 2800 / 7500 / 600 / 350 | [Dharamsala](https://en.wikivoyage.org/wiki/Dharamsala) | Budget and Mid-range (undated, one 2019); no Splurge price; food dated 2023-08 (e.g. "Dal ₹90"); shared taxi "₹20 (2023)" | No Splurge; stays undated |
| gwalior | 900 / 2200 / 5500 / 450 / 250 | [Gwalior](https://en.wikivoyage.org/wiki/Gwalior) | Untiered, in euros ("€13/23 per night" to "€124 per night", undated); no food or local fares | No tiers, food or local |
| haridwar | 800 / 2000 / 5000 / 450 / 250 | [Haridwar](https://en.wikivoyage.org/wiki/Haridwar) | All five quoted, mostly undated (Hotel Golden "₹500", 2015); food "₹45 per head" (2023); cycle rickshaw "₹10 ... ₹25" (undated) | Stays and local undated |
| jaipur | 1000 / 2600 / 8000 / 550 / 350 | [Jaipur](https://en.wikivoyage.org/wiki/Jaipur) | All five quoted. Splurge dated 2026 (e.g. "₹4,560 per night", "₹7,599 per night"); Budget and Mid-range 2012–2017 or undated; auto day hire "₹450 to ₹550 (as of 2018)" | Budget, Mid-range and local not current |
| jim-corbett | 1500 / 3800 / 9500 / 700 / 400 | [Jim Corbett National Park](https://en.wikivoyage.org/wiki/Jim_Corbett_National_Park) | "Around ₹2500 ... for double bed room" (Dhikala, undated); "₹9000" (2015), "₹5000" (2019); no food prices; gypsy "₹1800-2500 ... for two days" | No tiers or food |
| jodhpur | 950 / 2500 / 7500 / 500 / 300 | [Jodhpur](https://en.wikivoyage.org/wiki/Jodhpur) | Budget and Mid-range (2015–2025 mixed); no Splurge price; "Thalis are ₹300-400"; no fares in Get around | No Splurge or local |
| kanatal | 1300 / 3200 / 8000 / 600 / 350 | no article (404) | — | No source |
| kasauli | 1300 / 3200 / 8000 / 600 / 350 | [Kasauli](https://en.wikivoyage.org/wiki/Kasauli) | Untiered "2000" (2019), "3500-3700 ₹" (2024); no food or local fares | No tiers, food or local |
| kasol | 900 / 2400 / 6000 / 550 / 350 | no article (404) | — | No source |
| kurukshetra | 800 / 2000 / 5000 / 400 / 250 | [Kurukshetra](https://en.wikivoyage.org/wiki/Kurukshetra) | No prices | No prices |
| lansdowne | 1100 / 2700 / 6500 / 500 / 300 | [Lansdowne (India)](https://en.wikivoyage.org/wiki/Lansdowne_(India)) | One price "From ₹4,500" (2017); no food prices; only Kotdwar shared taxi "₹75" (Get in) | No tiers, food or local |
| lucknow | 900 / 2400 / 6500 / 550 / 350 | [Lucknow](https://en.wikivoyage.org/wiki/Lucknow) | Budget "600" (2024-10-21); Mid "Double room ₹1800" (undated); Splurge "₹5,984 per night", "₹6,174 per night" (2026-08-01); no food or local fares | No food or local |
| manali | 1200 / 3200 / 9000 / 650 / 400 | [Manali](https://en.wikivoyage.org/wiki/Manali) | "As of May 2023 ... around ₹800" (budget); Mid "₹900 per night" (2025-09-11); no Splurge price; food "₹80" (undated); bus "₹10" (undated) | No Splurge |
| mathura | 800 / 2000 / 5000 / 450 / 250 | [Mathura](https://en.wikivoyage.org/wiki/Mathura) | One room price "₹2000" (2017); street food "₹15"; no local fares | No tiers or local |
| mukteshwar | 1300 / 3200 / 8000 / 550 / 350 | [Mukteshwar](https://en.wikivoyage.org/wiki/Mukteshwar) | No prices | No prices |
| mussoorie | 1300 / 3200 / 8500 / 600 / 350 | [Mussoorie](https://en.wikivoyage.org/wiki/Mussoorie) | Untiered doubles ₹500–1,850 (undated; one "₹900 per night", 2025); "₹200-500 pp" food; cycle rickshaw "approximately ₹20" | No tiers; undated |
| nainital | 1200 / 3200 / 8500 / 600 / 350 | [Nainital](https://en.wikivoyage.org/wiki/Nainital) | Budget and Mid-range (undated, 2016); no Splurge price; "₹200 for two person" (2016); cycle rickshaw "₹20" | No Splurge; old |
| narkanda | 1200 / 3000 / 7500 / 550 / 350 | [Narkanda](https://en.wikivoyage.org/wiki/Narkanda) | No prices | No prices |
| neemrana | 2500 / 6000 / 14000 / 600 / 300 | no article (404) | — | No source |
| orchha | 900 / 2300 / 6000 / 450 / 300 | [Orchha](https://en.wikivoyage.org/wiki/Orchha) | Budget (undated); Mid-range incl. "₹1500 per night" (2025-09-29); no Splurge tier; food "₹150–250", "₹200–300" (2025); "Rickshaw ... ₹50 (2025)" | No Splurge; Budget undated |
| pushkar | 800 / 2200 / 6000 / 500 / 300 | [Pushkar](https://en.wikivoyage.org/wiki/Pushkar) | Three tiers (mostly undated, 2015–2018); "two thali places for ₹60"; no fares in Get around | No local; undated |
| ranikhet | 1100 / 2800 / 7000 / 550 / 300 | [Ranikhet](https://en.wikivoyage.org/wiki/Ranikhet) | No room or food prices; Kathgodam taxi only | No prices |
| ranthambore | 1400 / 3600 / 10000 / 600 / 350 | [Ranthambhore National Park](https://en.wikivoyage.org/wiki/Ranthambhore_National_Park) | No stays or food ("Visitors ... stay in ... Sawai Madhopur"); safari "₹500-600 per person" | No stays or food |
| rishikesh | 900 / 2400 / 7000 / 550 / 350 | [Rishikesh](https://en.wikivoyage.org/wiki/Rishikesh) | All five quoted, mostly undated (2016–2021 where dated); "Meals starts from ₹100"; vikram "Tapovan – ₹20 (2023)" | Stays and food undated |
| sariska | 1100 / 2800 / 8000 / 500 / 300 | no article (404) | — | No source |
| shimla | 1300 / 3400 / 9500 / 650 / 400 | [Shimla](https://en.wikivoyage.org/wiki/Shimla) | All five quoted. Tier bands {{sleeppricerange\|Under ₹1,500\|₹1,500–6,000\|₹6,000+}}; Mid and Splurge 2017–2018 or undated; food "₹50-150" (undated); bus "₹10" (undated) | Not current |
| udaipur | 1100 / 3000 / 9000 / 550 / 350 | [Udaipur](https://en.wikivoyage.org/wiki/Udaipur) | All five quoted, mostly undated (2015–2023 where dated); "Unlimited thali: ₹150"; "A tuk-tuk will usually cost around ₹50" (undated) | Not current |
| vrindavan | 800 / 2000 / 5500 / 450 / 250 | [Vrindavan](https://en.wikivoyage.org/wiki/Vrindavan) | Untiered "A/C double room ₹900" etc. (undated); no food prices; cycle rickshaw "₹20 per person" | No tiers or food |

## Maulik to check

1. **`car_rental_inr_per_day` (2500, draft).**
   - [nriinformation.com, "Car rentals in India, a 2026 guide"](https://nriinformation.com/cars/car-rentals) (updated 29 Sep 2026) gives "Hatchback / ₹1,500–₹2,500" per day, self-drive, fuel not included. It is an indicative India range, not a Delhi operator rate, so no single figure is supported.
   - [Zoomcar Delhi](https://www.zoomcar.com/in/delhi) and the [Skyscanner New Delhi page](https://skyscanner.co.in/car-hire-in/car-hire-in-new-delhi/27540706.html) render their prices client-side, so their pages came back empty.
   - A day rate for a self-drive hatchback in Delhi, read in a browser from an operator, would settle it.
2. **The recency rule.**
   - Confirm that prices must be dated 2023 or later.
   - If undated Wikivoyage prices are acceptable instead, 6 rows (Rishikesh, Haridwar, Shimla, Jaipur, Udaipur, Amritsar) have quotes for all five columns. Their values would fall a long way: for example, Amritsar's quoted meals are ₹30–80 against a draft ₹550 a day. The seed tests would then need re-running, since lower costs can move the tight-budget demo across its 1.25 × ₹7,000 margin.
3. **All 44 destination cost rows.**
   - The official tariffs are the most reliable source for budget and mid stays, but they need a browser:
     - GMVN for Garhwal (gmvnonline.com)
     - KMVN for Kumaon (kmvn.in)
     - HPTDC (hptdc.in)
     - RTDC (rtdc.tourism.rajasthan.gov.in)
     - MP Tourism (mpstdc.com)
     - UP Tourism (uptourism.gov.in)

     I did not open these domains in this session.
   - A current hotel listing for premium stays, a dated price page for food, and a fare notice or Get around section for local transport complete a row.
   - Rows whose Wikivoyage article had nothing usable: almora, bhimtal, chakrata, dhanaulti, kurukshetra, mukteshwar, narkanda, ranikhet. Rows with no article at all: kanatal, kasol, neemrana, sariska.

## Checks

- `pnpm catalogue:check`: 0 errors, Stage B1 4/137.
- `pnpm vitest run --project unit packages/db`: 50 passed.
- `pnpm vitest run --project integration apps/api/src/seed apps/api/src/recommendations`: 18 passed. The demo margins hold, with hills at 32 feasible.
