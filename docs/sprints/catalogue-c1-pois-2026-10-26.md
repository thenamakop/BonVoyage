# Catalogue stage C batch C1: places of interest (26 October 2026)

Batch C1 covers the 21 existing POI rows (rishikesh, mussoorie, jaipur) and new rows for almora, auli, bhimtal, chakrata, dehradun and dhanaulti: 57 rows in `pois.csv`, at least 6 per destination.

**Result:** 42 of 57 rows verified, 15 left `draft` (see [Maulik to check](#maulik-to-check)). `collected_on` is 2026-10-26.
- Every destination in the batch now has 6 or more POIs, so the checker's "fewer than 6 POIs" warning is gone for all nine.
- Two existing rows are removed and replaced (see [Changes](#changes-to-existing-rows)). The importer never deletes, so their old draft rows stay in any database already imported; see Maulik to check.

| Destination | POIs | verified | draft |
| --- | --- | --- | --- |
| rishikesh | 7 | 5 | 2 |
| mussoorie | 7 | 6 | 1 |
| jaipur | 7 | 3 | 4 |
| almora | 6 | 5 | 1 |
| auli | 6 | 4 | 2 |
| bhimtal | 6 | 4 | 2 |
| chakrata | 6 | 5 | 1 |
| dehradun | 6 | 5 | 1 |
| dhanaulti | 6 | 5 | 1 |

**Who checked:** Claude, in a separate session from Claude Code, read every place in Maulik's own browsers on 26 October 2026: Google Maps listings in Brave (through the Claude browser extension), and fee and hours pages in the Claude desktop app's built-in browser. Under decision 0002 (amended 24 October), Maulik's review and a recorded spot check are still needed before merge.

## Method

- **Choice of places:** each destination's best-known sights first, then a mix of categories. Places that are closed for the season or listed as closed on Google are left out. Every place is within 25 km (straight line) of the destination's catalogue point; the farthest are Neelkanth Mahadev (Rishikesh) and Jageshwar (Almora), both visited from the town.
- **Location (`lat`, `lng`):** the place's own Google Maps listing, rounded to 4 decimals. Each row links that listing by its stable `cid` link (`https://maps.google.com/?cid=...`), which opens the exact listing.
- **Hours (`open_time`, `close_time`, `closed_days`):**
  - From the Google listing's weekly hours. `open_time` is the earliest opening and `close_time` the latest closing across the open days. A midday break (for example 12:00 to 14:00 at many temples) is not stored; the report row says "break". Days marked Closed become `closed_days` (0 = Sunday).
  - "Open 24 hours" on every day, and open-air places with no gate and no listed hours (ghats, bridges, street markets, lakes, viewpoints, forest trails), leave both times empty, which the README defines as open at all hours. For markets this means the street is always open; shops keep their own hours.
  - Where Google lists no hours, the hours come from another page (named in the row), and that page becomes the row's `source_url`.
  - A place that has a gate or set hours, but no page states them, stays `draft`.
- **Fee (`entry_fee_inr`, per adult Indian visitor):**
  - `free`: public places with no ticket (temples, ghats, bridges, markets, lakes, viewpoints, open meadows and trails). Optional paid extras (boating, ropeways, telescopes, ski hire) are not counted and are named in the row.
  - `official` / `operator`: the operator's own page. `secondary`: a travel guide page that states an exact fee (trawell.in, © 2026), used where the operator publishes none.
  - A place that charges entry but has no page stating an exact, current fee stays `draft`. Its file value is the best figure seen (named in the row) or 0 when none was seen.
- **`typical_minutes`:** no source publishes visit length, so it follows a convention per category: temple 60, fort_palace 150, museum 90, sight 60, viewpoint 45, nature 120, market 90, adventure 180, wellness 120, food 60. Rows that differ say why in the table ("min" column shows the default in brackets).
- **`source_url`:** the Google listing (`cid` link) unless another page supplied the hours, in which case that page. The fee page is named in the row.

## Changes to existing rows

The 21 existing rows were never sourced (`source_url` empty). Every one was re-read; this lists what changed.

| Row | Field | Was | Now |
| --- | --- | --- | --- |
| rishikesh/laxman-jhula | name | Laxman Jhula | Bajrang Setu (Laxman Jhula glass bridge) |
| rishikesh/laxman-jhula | lat,lng | 30.102,78.285 | 30.1264,78.3295 |
| rishikesh/ram-jhula | lat,lng | 30.1133,78.284 | 30.1233,78.3144 |
| rishikesh/triveni-ghat | typical_minutes | 90 | 60 |
| rishikesh/triveni-ghat | open_time | 05:00 | (empty) |
| rishikesh/triveni-ghat | close_time | 21:00 | (empty) |
| rishikesh/triveni-ghat | lat,lng | 30.098,78.29 | 30.1037,78.2993 |
| rishikesh/beatles-ashram | row | present | removed |
| rishikesh/neelkanth-temple | lat,lng | 30.074,78.342 | 30.0811,78.3407 |
| rishikesh/ganga-rafting | name | Ganga rafting run (Brahmapuri to NIM beach) | Ganga rafting, Shivpuri to NIM Beach |
| rishikesh/ganga-rafting | open_time | 08:00 | (empty) |
| rishikesh/ganga-rafting | close_time | 16:00 | (empty) |
| rishikesh/ganga-rafting | entry_fee_inr | 1000 | 800 |
| rishikesh/ganga-rafting | lat,lng | 30.121,78.293 | 30.1371,78.3897 |
| rishikesh/parmarth-ganga-aarti | open_time | 18:00 | (empty) |
| rishikesh/parmarth-ganga-aarti | close_time | 19:00 | (empty) |
| rishikesh/parmarth-ganga-aarti | lat,lng | 30.116,78.287 | 30.1194,78.3117 |
| jaipur/amber-fort | open_time | 08:00 | 07:00 |
| jaipur/amber-fort | close_time | 17:30 | 21:00 |
| jaipur/amber-fort | entry_fee_inr | 550 | 100 |
| jaipur/amber-fort | lat,lng | 26.9855,75.8513 | 26.9855,75.8513 |
| jaipur/hawa-mahal | typical_minutes | 60 | 45 |
| jaipur/hawa-mahal | close_time | 16:30 | 18:30 |
| jaipur/hawa-mahal | entry_fee_inr | 200 | 50 |
| jaipur/hawa-mahal | lat,lng | 26.9239,75.8267 | 26.9241,75.8267 |
| jaipur/city-palace | close_time | 17:00 | 18:30 |
| jaipur/city-palace | entry_fee_inr | 1000 | 400 |
| jaipur/city-palace | lat,lng | 26.9258,75.8237 | 26.9258,75.8237 |
| jaipur/jantar-mantar | typical_minutes | 75 | 60 |
| jaipur/jantar-mantar | close_time | 16:30 | 18:30 |
| jaipur/jantar-mantar | entry_fee_inr | 200 | 50 |
| jaipur/jantar-mantar | lat,lng | 26.9247,75.8246 | 26.9248,75.8246 |
| jaipur/nahargarh-fort | entry_fee_inr | 200 | 50 |
| jaipur/nahargarh-fort | lat,lng | 26.937,75.8155 | 26.9402,75.8170 |
| jaipur/jal-mahal | name | Jal Mahal | Jal Mahal (viewed from the lakeside promenade) |
| jaipur/jal-mahal | open_time | (empty) | 06:00 |
| jaipur/jal-mahal | close_time | (empty) | 18:00 |
| jaipur/jal-mahal | lat,lng | 26.9535,75.8463 | 26.9535,75.8461 |
| jaipur/johari-bazaar | typical_minutes | 120 | 90 |
| jaipur/johari-bazaar | open_time | 10:00 | (empty) |
| jaipur/johari-bazaar | close_time | 21:00 | (empty) |
| jaipur/johari-bazaar | lat,lng | 26.92,75.826 | 26.9211,75.8279 |
| mussoorie/gun-hill | typical_minutes | 90 | 60 |
| mussoorie/gun-hill | lat,lng | 30.46,78.06 | 30.4593,78.0743 |
| mussoorie/kempty-falls | typical_minutes | 120 | 90 |
| mussoorie/kempty-falls | open_time | 08:00 | (empty) |
| mussoorie/kempty-falls | close_time | 17:00 | (empty) |
| mussoorie/kempty-falls | lat,lng | 30.483,78.035 | 30.4878,78.0367 |
| mussoorie/mall-road | typical_minutes | 120 | 90 |
| mussoorie/mall-road | lat,lng | 30.459,78.066 | 30.4598,78.0645 |
| mussoorie/camels-back-road | name | Camel Back Road walk | Camel's Back Road walk |
| mussoorie/camels-back-road | typical_minutes | 90 | 60 |
| mussoorie/camels-back-road | lat,lng | 30.457,78.071 | 30.4607,78.0759 |
| mussoorie/lal-tibba | typical_minutes | 60 | 45 |
| mussoorie/lal-tibba | open_time | 08:00 | 07:00 |
| mussoorie/lal-tibba | close_time | 18:00 | 20:00 |
| mussoorie/lal-tibba | lat,lng | 30.465,78.087 | 30.4667,78.0950 |
| mussoorie/company-garden | row | present | removed |
| mussoorie/george-everest | name | George Everest house | Sir George Everest House and Park Estate |
| mussoorie/george-everest | typical_minutes | 120 | 90 |
| mussoorie/george-everest | open_time | 10:00 | 06:00 |
| mussoorie/george-everest | close_time | 17:00 | 18:00 |
| mussoorie/george-everest | lat,lng | 30.453,78.016 | 30.4587,78.0231 |

Removed rows:
- `rishikesh/beatles-ashram`: Google shows the Beatles Ashram as temporarily closed; replaced by tera-manzil-temple.
- `mussoorie/company-garden`: Google has no listing for the garden (only a food court); replaced by christ-church.

## Every row

| Row | Name | Category, min | Hours | Fee (₹) | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| rishikesh/laxman-jhula | Bajrang Setu (Laxman Jhula glass bridge) | sight, 45 (60) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=11760206936042890982): "Bajrang Setu – Glass Bridge, Rishikesh", 442 reviews; hours: Open 24 hours (all days); Laxman Jhula itself has been closed to visitors since 2022; Bajrang Setu replaced it beside the old bridge. |
| rishikesh/ram-jhula | Ram Jhula | sight, 45 (60) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=9487165647415702138): "Ram Jhula", no reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Pedestrian suspension bridge. |
| rishikesh/triveni-ghat | Triveni Ghat | temple, 60 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=6608578785824212171): "Triveni Ghat", 62998 reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Ghat; the evening aarti is at sunset. |
| rishikesh/tera-manzil-temple | Trayambakeshwar Temple (Tera Manzil) | temple, 45 (60) | 06:00 to 19:00 (break) | 0 | verified | [Google listing](https://maps.google.com/?cid=15255503586025066229): "Trayambakeshwar Temple, Rishikesh", 1696 reviews; hours: Daily 6 am to 12 pm, 2 to 7 pm; New row; replaces beatles-ashram. |
| rishikesh/neelkanth-temple | Neelkanth Mahadev Temple | temple, 90 (60) | 05:00 to 18:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=2030926007771354519): "Shree Neelkanth Mahadev Temple", 43144 reviews; hours: Daily 5 am to 6 pm; About 30 km by road from Rishikesh; the visit includes the drive. |
| rishikesh/ganga-rafting | Ganga rafting, Shivpuri to NIM Beach | adventure, 180 | not confirmed | 800 | draft | [Google listing](https://maps.google.com/?cid=6321688372866159924): "Shivpuri Rafting point", 1467 reviews; hours: -; fee (operator): Treks and Trails: "Shivpuri to NIM Beach - Rs 800 per head" (treksandtrails.org/tours/river-rafting-in-rishikesh-96231, © 2026); **draft:** no source gives operating hours for the rafting runs |
| rishikesh/parmarth-ganga-aarti | Parmarth Niketan Ganga aarti | temple, 60 | not confirmed | 0 | draft | [Google listing](https://maps.google.com/?cid=6358407534919545907): "Parmarth Niketan Ghat,Rishikesh", 3253 reviews; hours: -; **draft:** the aarti is at sunset; no readable page states its time |
| mussoorie/gun-hill | Gun Hill | viewpoint, 60 (45) | 10:00 to 18:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=2638080859765499824): "Gun Hill, Mussoorie", 12105 reviews; hours: Daily 10 am to 6 pm; fee (free): Reached on foot or by the ropeway (paid, optional). |
| mussoorie/kempty-falls | Kempty Falls | nature, 90 (120) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=12631880684081121928): "Kempty Waterfall", 62228 reviews; hours: Open 24 hours (all days) |
| mussoorie/mall-road | Mall Road | market, 90 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=8180084519345980577): "Mall Rd", no reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Street; shops keep their own hours. |
| mussoorie/camels-back-road | Camel's Back Road walk | nature, 60 (120) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=3890750486899502448): "Camels Back Rd", no reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Road walk. |
| mussoorie/lal-tibba | Lal Tibba viewpoint | viewpoint, 45 | 07:00 to 20:00 (varies by day) | 0 | verified | [Google listing](https://maps.google.com/?cid=5017784450187230160): "Lal Tibba Scenic Cafe", 20415 reviews; hours: Mon to Thu 7:30 am to 7 pm; Fri, Sat 7:30 am to 8 pm; Sun 7 am to 8 pm; fee (free): The viewpoint is the Lal Tibba Scenic Cafe terrace; telescopes are paid and optional. |
| mussoorie/george-everest | Sir George Everest House and Park Estate | viewpoint, 90 (45) | 06:00 to 18:00 | 0 | draft | [Google listing](https://maps.google.com/?cid=10712705421260023541): "George Everest House", 10426 reviews; hours: Daily 6 am to 6 pm; fee (draft): The estate charges entry; no readable page states the current fee.; **draft:** The estate charges entry; no readable page states the current fee. |
| mussoorie/christ-church | Christ Church | sight, 30 (60) | 07:00 to 18:30 | 0 | verified | [Google listing](https://maps.google.com/?cid=5236151717781852487): "Christ Church", 418 reviews; hours: [www.trawell.in](https://www.trawell.in/uttarakhand/mussoorie/christ-church) "Timings: 7 AM - 6:30 PM from Monday - Saturday and 8 AM - 6:30 PM on Sunday."; New row; replaces company-garden, which has no listing of its own. |
| jaipur/amber-fort | Amber Fort | fort_palace, 150 | 07:00 to 21:00 | 100 | draft | [Google listing](https://maps.google.com/?cid=7071178524615540267): "Amber Palace", 173664 reviews; hours: Daily 7 am to 9 pm; fee (draft): Official booking site (obms-tourist.rajasthan.gov.in) unreachable on 26 Oct; secondary pages disagree (Rs 100 and Rs 200 for Indians).; **draft:** Official booking site (obms-tourist.rajasthan.gov.in) unreachable on 26 Oct; secondary pages disagree (Rs 100 and Rs 200 for Indians). |
| jaipur/hawa-mahal | Hawa Mahal | sight, 45 (60) | 09:00 to 18:30 | 50 | draft | [Google listing](https://maps.google.com/?cid=9659760862336692748): "Hawa Mahal", 168500 reviews; hours: Daily 9 am to 6:30 pm; fee (draft): Official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100).; **draft:** Official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100). |
| jaipur/city-palace | City Palace | fort_palace, 120 (150) | 09:30 to 18:30 | 400 | verified | [Google listing](https://maps.google.com/?cid=4935968491820645216): "The City Palace", 59769 reviews; hours: [citypalace.org](https://citypalace.org/visit) "The City Palace Museum, Jaipur is open from 9.30 AM to 6.30 PM, seven days a week."; fee (official): citypalace.org/visit: Indian National/Resident, Adult Rs 400; "open from 9.30 AM to 6.30 PM, seven days a week". |
| jaipur/jantar-mantar | Jantar Mantar | sight, 60 | 09:00 to 18:30 | 50 | draft | [Google listing](https://maps.google.com/?cid=16810253135964384190): "Jantar Mantar", 43331 reviews; hours: Daily 9 am to 6:30 pm; fee (draft): Official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100).; **draft:** Official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100). |
| jaipur/nahargarh-fort | Nahargarh Fort | viewpoint, 120 (45) | 10:00 to 17:30 | 50 | draft | [Google listing](https://maps.google.com/?cid=768610193590099595): "Nahargarh Fort", 79280 reviews; hours: Daily 10 am to 5:30 pm; fee (draft): Official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100).; **draft:** Official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100). |
| jaipur/jal-mahal | Jal Mahal (viewed from the lakeside promenade) | sight, 30 (60) | 06:00 to 18:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=10940174856982080466): "Jal Mahal", 40709 reviews; hours: Daily 6 am to 6 pm; fee (free): The palace is closed to visitors; it is seen from the Man Sagar promenade. |
| jaipur/johari-bazaar | Johari Bazaar | market, 90 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=14661966290454385460): "Johri Bazar", no reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Street market; shops keep their own hours. |
| almora/kasar-devi-temple | Kasar Devi Temple | temple, 60 | 07:00 to 17:30 | 0 | verified | [Google listing](https://maps.google.com/?cid=15033002957335123375): "Kasar Devi Mandir", 7691 reviews; hours: Daily 7 am to 5:30 pm |
| almora/nanda-devi-temple | Nanda Devi Temple | temple, 30 (60) | 06:00 to 22:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=9835279865041730690): "Maa Nanda Devi Mandir, Almora", 1060 reviews; hours: [www.trawell.in](https://www.trawell.in/uttarakhand/almora/nanda-devi-temple) "Timings: 6 AM to 10 PM"; Google lists 6 am to 10 pm, and Sunday open 24 hours. |
| almora/chitai-golu-devta | Chitai Golu Devta Temple | temple, 45 (60) | not confirmed | 0 | draft | [Google listing](https://maps.google.com/?cid=15998439399403208348): "Chitai Golu Devta Temple", 9204 reviews; hours: -; **draft:** no readable page states the temple hours |
| almora/bright-end-corner | Bright End Corner | viewpoint, 45 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=7567226709559161938): "Bright End Corner", 44 reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Roadside viewpoint. |
| almora/jageshwar-dham | Jageshwar Dham temples | temple, 90 (60) | 04:00 to 18:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=15164700073469314578): "Jageshwar Dham Temple", 5084 reviews; hours: [www.trawell.in](https://www.trawell.in/uttarakhand/almora/jageshwar-dham) "Timings: 4 AM to 6 PM"; fee (free): The ASI museum opposite is separate and not included.; About 35 km by road from Almora. |
| almora/lala-bazaar | Lala Bazaar | market, 60 (90) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=6659136746634901618): "Lala Bazar Rd", no reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Street market. |
| auli/auli-ski-slopes | Auli ski slopes | adventure, 180 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=7949463914179556927): "Ski Resort Auli", 33 reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); fee (free): No entry fee; ski hire and lessons are paid.; Open slope. |
| auli/gorson-bugyal | Gorson Bugyal meadow trek | nature, 240 (120) | 06:30 to 15:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=14678288536092439355): "Gurson Bugyal", 905 reviews; hours: Daily 6:30 am to 3 pm |
| auli/auli-artificial-lake | Auli artificial lake | sight, 30 (60) | 06:00 to 18:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=8709735059752525943): "Auli lake", 166 reviews; hours: Daily 6 am to 6 pm |
| auli/auli-chairlift | Auli chair lift | adventure, 45 (180) | not confirmed | 500 | draft | [Google listing](https://maps.google.com/?cid=1839336499259601377): "Chair Lift Platform Auli", 58 reviews; hours: -; fee (draft): euttaranchal.com says Rs 500 return but the page is undated; no GMVN page states the fare or hours.; **draft:** no source gives operating hours; euttaranchal.com says Rs 500 return but the page is undated; no GMVN page states the fare or hours. |
| auli/narsingh-temple | Narsingh Temple, Joshimath | temple, 45 (60) | 05:00 to 21:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=14085058807828902025): "Shri Narsingh Mandir, Joshimath", 4042 reviews; hours: Daily 5 am to 9 pm |
| auli/shankaracharya-math | Jyotirmath (Shankaracharya Math), Joshimath | temple, 45 (60) | not confirmed | 0 | draft | [Google listing](https://maps.google.com/?cid=11707304052662848246): "Adi Shankaracharya temple Jyotirmath", 206 reviews; hours: -; **draft:** no readable page states the hours |
| bhimtal/bhimtal-lake | Bhimtal Lake | nature, 90 (120) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=14970924696884724025): "Bhimtal Lake", 2088 reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); fee (free): Boating is paid and optional.; Lake and promenade. |
| bhimtal/bhimtal-island-aquarium | Bhimtal island aquarium | sight, 30 (60) | 09:30 to 19:00 | 0 | draft | [Google listing](https://maps.google.com/?cid=2788836890915853466): "Aquarium Island Cafe - Bhimtal", 2721 reviews; hours: Daily 9:30 am to 7 pm; fee (draft): No readable page states the entry fee.; **draft:** No readable page states the entry fee. |
| bhimtal/naukuchiatal | Naukuchiatal lake | nature, 90 (120) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=477819136653418663): "Naukuchia Taal", 2344 reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Lake. |
| bhimtal/sattal | Sattal lakes | nature, 120 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=6659300001641477232): "Sattal Lake", 2095 reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Lakes in forest. |
| bhimtal/bhimeshwar-temple | Bhimeshwar Mahadev Temple | temple, 30 (60) | 06:00 to 19:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=17225957474037331272): "Bhimeshwar Hindu Temple", 586 reviews; hours: Daily 6 am to 7 pm |
| bhimtal/butterfly-research-centre | Butterfly Research Centre (Jones Estate) | museum, 60 (90) | 10:00 to 17:00 | 0 | draft | [Google listing](https://maps.google.com/?cid=13998100013609517401): "Butterfly Research Centre, Bhimtal", 130 reviews; hours: Daily 10 am to 5 pm; fee (draft): No readable page states the entry fee.; **draft:** No readable page states the entry fee. |
| chakrata/tiger-falls | Tiger Falls | nature, 120 | 08:00 to 19:00 | 0 | draft | [Google listing](https://maps.google.com/?cid=16968410822697930487): "Tiger Fall", 6455 reviews; hours: Daily 8 am to 7 pm; fee (draft): No readable page states the entry fee.; **draft:** No readable page states the entry fee. |
| chakrata/chilmiri-neck | Chirmiri sunrise and sunset point | viewpoint, 45 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=5519223422190067551): "Chirmiri Sunrise And Sunset Point", 126 reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Viewpoint. |
| chakrata/deoban | Deoban forest and viewpoint | nature, 120 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=13634485678597647695): "Deoban, Uttarakhand 248123 (area)", no reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Forest area. |
| chakrata/moila-top | Moila Top meadow | nature, 180 (120) | 07:00 to 15:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=5212079823262203183): "Moila Top", 787 reviews; hours: Daily 7 am to 3 pm |
| chakrata/lakhamandal-temple | Lakhamandal Temple | temple, 60 | 06:00 to 21:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=3135343924124044215): "Shiv Temple Lakhamandal", 1308 reviews; hours: Daily 6 am to 9 pm |
| chakrata/ramtal-garden | Ramtal Garden and sunrise point | nature, 60 (120) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=12756409311778457475): "Ramtal Garden and sunrise point", 410 reviews; hours: Open 24 hours (all days) |
| dehradun/robbers-cave | Robber's Cave (Guchhupani) | nature, 90 (120) | 07:00 to 18:00 | 35 | draft | [Google listing](https://maps.google.com/?cid=14005078082255494676): "Gucchupani Robbers' Cave", 16469 reviews; hours: Daily 7 am to 6 pm; fee (draft): Pages give only an approximate fee ("Rs 30-40, subject to revision").; **draft:** Pages give only an approximate fee ("Rs 30-40, subject to revision"). |
| dehradun/forest-research-institute | Forest Research Institute museums | museum, 120 (90) | 09:30 to 17:30 (break) | 25 | verified | [Google listing](https://maps.google.com/?cid=3592344337992258317): "FRI Museum Dehradun", 6799 reviews; hours: Monday, 9:30 am to 1 pm, 1:30 to 5:30 pm; Tuesday, 9:30 am to 1 pm, 1:30 to 5:30 pm; Wednesday, 9:30 am to 1 pm, 1:30 to 5:30 pm; Thursday, 9:30 am to 1 pm, 1:30 to 5:30 pm; Friday, 9:30 am to 1 pm, 1:30 to 5:30 pm; Saturday, 9:30 am to 1 pm, 1:30 to 5:30 pm; Sunday, 9:30 am to 1 pm, 1:30 to 5:30 pm; fee (secondary): trawell.in: "Museum Entry Fee: Rs.25 per person." and "Museum Timings: 9.30 AM - 5 PM." |
| dehradun/tapkeshwar-temple | Tapkeshwar Mahadev Temple | temple, 45 (60) | 04:00 to 22:30 | 0 | verified | [Google listing](https://maps.google.com/?cid=1705455928709100770): "Tapkeshwar Mahadev Mandir", 27177 reviews; hours: Daily 4 am to 10:30 pm |
| dehradun/sahastradhara | Sahastradhara | nature, 90 (120) | 08:00 to 18:30 | 0 | verified | [Google listing](https://maps.google.com/?cid=9344887839665687870): "Sahastradhara Natural Spring", 21621 reviews; hours: Monday, 8 am to 6:30 pm; Tuesday, 8 am to 6:30 pm; Wednesday, 8 am to 6:30 pm; Thursday, 8 am to 6:30 pm; Friday, 8 am to 6:30 pm; Saturday, 8 am to 6:30 pm; Sunday, 8 am to 6:30 pm |
| dehradun/mindrolling-monastery | Mindrolling Monastery | temple, 60 | 07:00 to 18:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=7803052765774994758): "Mindrolling Monastery", 5222 reviews; hours: Daily 7 am to 6 pm |
| dehradun/paltan-bazaar | Paltan Bazaar | market, 90 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=11840989061082986058): "Paltan Bazaar, Dehradun, Uttarakhand 248001", no reviews; hours: no hours listed; open-air place (README: both empty means open at all hours); Street market. |
| dhanaulti/surkanda-devi-temple | Surkanda Devi Temple | temple, 120 (60) | 07:00 to 18:00 | 0 | verified | [Google listing](https://maps.google.com/?cid=14359958401935762891): "Surkanda Devi Mandir", 13494 reviews; hours: [www.trawell.in](https://www.trawell.in/uttarakhand/dhanaulti/surkanda-devi-temple) "Timings: 7 AM to 6 PM"; fee (secondary): trawell.in: "Entry: Free"; the ropeway is paid and optional.; Includes the 2 km walk (or ropeway) from Kaddukhal. |
| dhanaulti/dhanaulti-eco-park | Dhanaulti Eco Park | nature, 60 (120) | 09:00 to 17:00 | 20 | verified | [Google listing](https://maps.google.com/?cid=16260602188941693144): "Eco Park", 3943 reviews; hours: Daily 9 am to 5 pm; fee (secondary): trawell.in (eco parks): "Entry: Rs. 20 for Adults" and "Timings: 9 AM - 5 PM". |
| dhanaulti/amber-eco-park | Amber Eco Park | nature, 60 (120) | 08:00 to 18:00 | 20 | verified | [Google listing](https://maps.google.com/?cid=4816334233569628404): "Dhanolti Eco Park Amber", 363 reviews; hours: Daily 8 am to 6 pm; fee (secondary): trawell.in (eco parks): "Entry: Rs. 20 for Adults". |
| dhanaulti/snow-adventure-zone | Snow Adventure Zone, Buranskhanda | adventure, 120 (180) | 09:30 to 19:30 | 0 | draft | [Google listing](https://maps.google.com/?cid=15939281941520425954): "Snow Adventure Zone , Mussoorie , near Dhanaulti", 297 reviews; hours: Daily 9:30 am to 7:30 pm; fee (draft): Activities are priced one by one; no readable page states an entry fee.; **draft:** Activities are priced one by one; no readable page states an entry fee. |
| dhanaulti/kaddukhal-viewpoint | Kaddukhal viewpoint | viewpoint, 30 (45) | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=18004945955065470015): "View Points", 58 reviews; hours: Open 24 hours (all days) |
| dhanaulti/kaudia-forest | Kaudia forest trail | nature, 120 | all hours | 0 | verified | [Google listing](https://maps.google.com/?cid=4129426004150421003): "Kaudia Forest", 261 reviews; hours: Open 24 hours (all days); About 10 km from Dhanaulti, near Kanatal. |

## Maulik to check

1. **rishikesh/ganga-rafting** (Ganga rafting, Shivpuri to NIM Beach): no source gives operating hours for the rafting runs. [listing](https://maps.google.com/?cid=6321688372866159924)
2. **rishikesh/parmarth-ganga-aarti** (Parmarth Niketan Ganga aarti): the aarti is at sunset; no readable page states its time. [listing](https://maps.google.com/?cid=6358407534919545907)
3. **mussoorie/george-everest** (Sir George Everest House and Park Estate): the estate charges entry; no readable page states the current fee. [listing](https://maps.google.com/?cid=10712705421260023541)
4. **jaipur/amber-fort** (Amber Fort): official booking site (obms-tourist.rajasthan.gov.in) unreachable on 26 Oct; secondary pages disagree (Rs 100 and Rs 200 for Indians). [listing](https://maps.google.com/?cid=7071178524615540267)
5. **jaipur/hawa-mahal** (Hawa Mahal): official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100). [listing](https://maps.google.com/?cid=9659760862336692748)
6. **jaipur/jantar-mantar** (Jantar Mantar): official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100). [listing](https://maps.google.com/?cid=16810253135964384190)
7. **jaipur/nahargarh-fort** (Nahargarh Fort): official booking site unreachable; secondary pages disagree (Rs 50 and Rs 100). [listing](https://maps.google.com/?cid=768610193590099595)
8. **almora/chitai-golu-devta** (Chitai Golu Devta Temple): no readable page states the temple hours. [listing](https://maps.google.com/?cid=15998439399403208348)
9. **auli/auli-chairlift** (Auli chair lift): no source gives operating hours; euttaranchal.com says Rs 500 return but the page is undated; no GMVN page states the fare or hours. [listing](https://maps.google.com/?cid=1839336499259601377)
10. **auli/shankaracharya-math** (Jyotirmath (Shankaracharya Math), Joshimath): no readable page states the hours. [listing](https://maps.google.com/?cid=11707304052662848246)
11. **bhimtal/bhimtal-island-aquarium** (Bhimtal island aquarium): no readable page states the entry fee. [listing](https://maps.google.com/?cid=2788836890915853466)
12. **bhimtal/butterfly-research-centre** (Butterfly Research Centre (Jones Estate)): no readable page states the entry fee. [listing](https://maps.google.com/?cid=13998100013609517401)
13. **chakrata/tiger-falls** (Tiger Falls): no readable page states the entry fee. [listing](https://maps.google.com/?cid=16968410822697930487)
14. **dehradun/robbers-cave** (Robber's Cave (Guchhupani)): pages give only an approximate fee ("Rs 30-40, subject to revision"). [listing](https://maps.google.com/?cid=14005078082255494676)
15. **dhanaulti/snow-adventure-zone** (Snow Adventure Zone, Buranskhanda): activities are priced one by one; no readable page states an entry fee. [listing](https://maps.google.com/?cid=15939281941520425954)
16. **Stale rows after import:** `rishikesh/beatles-ashram` and `mussoorie/company-garden` leave `pois.csv`, but `catalogue:import` never deletes, so databases imported before this batch keep them as old draft rows. Delete them from the preview and production databases by hand, or leave them for the Sprint 4 itinerary work to filter.
17. **Draft share above 25%:** 15 of 57 rows (26%) are draft, just over the stage C prompt's 25% line. Most of it is the four Jaipur state monuments, whose fees wait on the official Rajasthan booking site. Re-run those four when the site is reachable, or accept the drafts for now.
18. **The hours convention:** first opening to last closing, midday breaks not stored. The itinerary check (rule d) can then place a visit inside a temple's lunch break.

## Spot check

To be recorded before merge (decision 0002). Open the row's Google listing and compare hours and coordinates; for fee rows, open the named fee page. Five verified rows, from five destinations and five categories; Maulik opens each link himself and fills in the last two columns.

| Row | Field | Value in file | What the source says | Holds |
| --- | --- | --- | --- | --- |
| jaipur/city-palace (fort_palace): [fee and hours page](https://citypalace.org/visit) | fee, hours | ₹400 (Indian adult); 09:30 to 18:30, no closed days | pending (Maulik) | pending (Maulik) |
| dehradun/forest-research-institute (museum): [listing](https://maps.google.com/?cid=3592344337992258317), fee on trawell.in's FRI page | fee | ₹25 | pending (Maulik) | pending (Maulik) |
| almora/jageshwar-dham (temple): [hours page](https://www.trawell.in/uttarakhand/almora/jageshwar-dham), [listing](https://maps.google.com/?cid=15164700073469314578) | hours | 04:00 to 18:00, no closed days | pending (Maulik) | pending (Maulik) |
| mussoorie/gun-hill (viewpoint): [listing](https://maps.google.com/?cid=2638080859765499824) | hours, location | 10:00 to 18:00, no closed days; 30.4593, 78.0743 | pending (Maulik) | pending (Maulik) |
| rishikesh/laxman-jhula (sight): [listing](https://maps.google.com/?cid=11760206936042890982) | name, location | Bajrang Setu (Laxman Jhula glass bridge); 30.1264, 78.3295 | pending (Maulik) | pending (Maulik) |

## Checks

- `pnpm catalogue:check`: see the PR body.
