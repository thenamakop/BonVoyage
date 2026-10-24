# Catalogue stage A verification (24 October 2026)

Stage A covers the 6 hubs in `hubs.csv` and the identity columns of the 44 destinations in `destinations.csv` (name, state, lat, lng, types, activities, climate, best_months, min_nights). Cost columns are stage B1 and stay `draft`.

**Result:** 50 of 50 rows checked and set to `verified`, `collected_on` 2026-10-24. `pnpm catalogue:check --require a` passes with 0 errors.

**Who checked:** Claude (AI assistant) read each cited source page on 24 October 2026 and applied the corrections below; Maulik reviewed this report, and a second, independent agent session spot-checked five rows before merging (see the end). Decision 0002 is amended to record this.

## Method

- **Name, state, coordinates:** read from the Wikipedia article cited in `source_url`. Coordinates within 0.02 degrees (about 2 km) of the source were kept; rows further off were set to the source value. Chakrata's article shows no coordinates, so they were confirmed against [ifoundbutterflies.org](https://www.ifoundbutterflies.org/chakrata-dehradun-district-uttarakhand-india) (30.70, 77.87).
- **Source links:** seven links pointed at disambiguation or redirect pages and now point at the place's own article.
- **Types and activities:** each value must be something the cited article (or the place's well-known attractions) supports; unsupported values were replaced and clearly supported ones added. Values come only from `packages/shared/src/vocab.ts`.
- **Climate:** applied the app's own definitions shown on the preference form (cold: days mostly below 15 C; mild: 15 to 25 C; warm: above 25 C) to typical daytime highs across each destination's best months. This moved 11 hill stations from cold to mild; cold now means the snow destinations (Auli, Kanatal, Narkanda).
- **Best months and minimum nights:** checked against the source's seasons (monsoon, peak heat, snow, park or activity seasons) and travel time from Delhi.

## Changes (49)

| Row | Field | Was | Now | Why |
| --- | --- | --- | --- | --- |
| delhi (hub) | lat,lng | `28.6139,77.2090` | `28.61,77.23` | more than 0.02 deg from the source |
| noida (hub) | lat,lng | `28.5355,77.3910` | `28.57,77.32` | more than 0.02 deg from the source |
| jaipur (hub) | lat,lng | `26.9124,75.7873` | `26.915,75.82` | more than 0.02 deg from the source |
| ajmer | activities | `temples\|museums` | `temples\|museums\|forts_palaces` | Taragarh and Akbari forts |
| amritsar | types | `spiritual\|city` | `spiritual\|heritage\|city` | Golden Temple, Jallianwala Bagh, Gobindgarh Fort |
| amritsar | activities | `temples\|food_trails\|shopping` | `temples\|museums\|food_trails\|shopping` | Partition Museum |
| amritsar | climate | `warm` | `mild` | Oct-Mar daytime highs average about 22 C |
| auli | source_url | `https://en.wikipedia.org/wiki/Auli` | `https://en.wikipedia.org/wiki/Auli,_India` | old link is a disambiguation or redirect page |
| auli | min_nights | `2` | `3` | Delhi to Auli is about 500 km and 17+ hours by road via Haridwar and Joshimath ([Wikivoyage](https://en.wikivoyage.org/wiki/Auli)) |
| bharatpur | source_url | `https://en.wikipedia.org/wiki/Bharatpur` | `https://en.wikipedia.org/wiki/Bharatpur,_Rajasthan` | old link is a disambiguation or redirect page |
| bharatpur | activities | `wildlife_safari\|museums` | `wildlife_safari\|museums\|forts_palaces` | Lohagarh Fort |
| bhimtal | activities | `boating\|trekking\|yoga_wellness` | `boating\|trekking\|paragliding` | source lists boating, kayaking and paragliding; no yoga |
| bikaner | activities | `forts_palaces\|museums\|food_trails` | `forts_palaces\|museums\|food_trails\|temples` | Karni Mata and Bhandasar temples |
| bir | source_url | `https://en.wikipedia.org/wiki/Bir_Billing` | `https://en.wikipedia.org/wiki/Bir,_Himachal_Pradesh` | old link is a disambiguation or redirect page |
| bir | climate | `cold` | `mild` | about 1,500 m; season highs 15-25 C |
| bir | best_months | `3\|4\|5\|6\|10\|11` | `3\|4\|5\|9\|10\|11` | paragliding seasons; flying stops before the June monsoon |
| chail | source_url | `https://en.wikipedia.org/wiki/Chail` | `https://en.wikipedia.org/wiki/Chail,_Himachal_Pradesh` | old link is a disambiguation or redirect page |
| chail | climate | `cold` | `mild` | source: pleasant summers; season highs 15-25 C |
| chakrata | activities | `trekking\|camping` | `trekking\|camping\|temples` | Lakhamandal temple |
| chakrata | climate | `cold` | `mild` | season highs 15-25 C |
| dalhousie | source_url | `https://en.wikipedia.org/wiki/Dalhousie` | `https://en.wikipedia.org/wiki/Dalhousie,_India` | old link is a disambiguation or redirect page |
| dalhousie | activities | `trekking\|boating\|shopping` | `trekking\|temples\|shopping` | no lake boating; Chamunda Devi temple |
| dalhousie | climate | `cold` | `mild` | season highs 15-25 C |
| dehradun | lat,lng | `30.32,78.03` | `30.345,78.029` | more than 0.02 deg from the source |
| dehradun | best_months | `1\|2\|3\|4\|5\|6\|9\|10\|11\|12` | `10\|11\|12\|1\|2\|3\|4` | drops hot May-June (source: temperatures peak May-June) |
| dhanaulti | lat,lng | `30.42,78.25` | `30.45,78.25` | more than 0.02 deg from the source |
| dhanaulti | activities | `camping\|trekking` | `camping\|trekking\|temples` | Surkanda Devi temple |
| dhanaulti | climate | `cold` | `mild` | source: summers 20-25 C |
| dharamshala | climate | `cold` | `mild` | about 1,450 m; source: summer up to 36 C |
| jaipur (destination) | lat,lng | `26.91,75.79` | `26.915,75.82` | more than 0.02 deg from the source |
| jim-corbett | lat,lng | `29.53,78.77` | `29.5486,78.9353` | more than 0.02 deg from the source |
| jim-corbett | climate | `mild` | `warm` | nearest IMD station [Pantnagar](https://en.wikipedia.org/wiki/Pantnagar) (Wikipedia climate table, 1991-2020): Nov-Jun mean daily max 28.8 C; Wikipedia: summers up to 40 C |
| jodhpur | lat,lng | `26.24,73.02` | `26.28,73.02` | more than 0.02 deg from the source |
| kanatal | activities | `camping\|trekking` | `camping\|trekking\|temples` | Surkanda Devi temple |
| kasauli | climate | `cold` | `mild` | source: summers rarely above 32 C |
| kasol | climate | `cold` | `mild` | about 1,580 m; season highs 15-25 C |
| kurukshetra | lat,lng | `29.97,76.88` | `29.9657,76.837` | more than 0.02 deg from the source |
| lansdowne | source_url | `https://en.wikipedia.org/wiki/Lansdowne` | `https://en.wikipedia.org/wiki/Lansdowne,_India` | old link is a disambiguation or redirect page |
| lansdowne | activities | `trekking\|boating\|camping` | `trekking\|boating\|camping\|museums` | Garhwal Rifles regimental museum |
| manali | source_url | `https://en.wikipedia.org/wiki/Manali` | `https://en.wikipedia.org/wiki/Manali,_Himachal_Pradesh` | old link is a disambiguation or redirect page |
| manali | climate | `cold` | `mild` | season highs average about 18 C |
| mathura | activities | `temples\|museums` | `temples\|museums\|food_trails` | Mathura peda and Braj food (source) |
| mukteshwar | climate | `cold` | `mild` | season highs 15-25 C |
| rishikesh | lat,lng | `30.09,78.27` | `30.1083,78.2972` | more than 0.02 deg from the source |
| rishikesh | climate | `mild` | `warm` | Wikipedia climate table: hottest May-June (daily highs May 39 C, Jun 38 C); Feb-Dec season highs average about 29 C |
| sariska | lat,lng | `27.34,76.44` | `27.3175,76.4369` | more than 0.02 deg from the source |
| shimla | climate | `cold` | `mild` | source: summers 16-25 C; season highs average about 19 C |
| udaipur | lat,lng | `24.58,73.71` | `24.58,73.68` | more than 0.02 deg from the source |
| udaipur | best_months | `9\|10\|11\|12\|1\|2` | `9\|10\|11\|12\|1\|2\|3` | source: peak season mid-September to late March |

## Every row

| File         | Row         | lat, lng         | Source                                                                               | Result                                         |
| ------------ | ----------- | ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| hubs         | delhi       | 28.61, 77.23     | [Delhi](https://en.wikipedia.org/wiki/Delhi)                                         | corrected: lat,lng                             |
| hubs         | gurugram    | 28.4595, 77.0266 | [Gurgaon](https://en.wikipedia.org/wiki/Gurgaon)                                     | checked, unchanged                             |
| hubs         | noida       | 28.57, 77.32     | [Noida](https://en.wikipedia.org/wiki/Noida)                                         | corrected: lat,lng                             |
| hubs         | faridabad   | 28.4089, 77.3178 | [Faridabad](https://en.wikipedia.org/wiki/Faridabad)                                 | checked, unchanged                             |
| hubs         | chandigarh  | 30.7333, 76.7794 | [Chandigarh](https://en.wikipedia.org/wiki/Chandigarh)                               | checked, unchanged                             |
| hubs         | jaipur      | 26.915, 75.82    | [Jaipur](https://en.wikipedia.org/wiki/Jaipur)                                       | corrected: lat,lng                             |
| destinations | agra        | 27.18, 78.01     | [Agra](https://en.wikipedia.org/wiki/Agra)                                           | checked, unchanged                             |
| destinations | ajmer       | 26.45, 74.64     | [Ajmer](https://en.wikipedia.org/wiki/Ajmer)                                         | corrected: activities                          |
| destinations | almora      | 29.6, 79.66      | [Almora](https://en.wikipedia.org/wiki/Almora)                                       | checked, unchanged                             |
| destinations | alwar       | 27.56, 76.63     | [Alwar](https://en.wikipedia.org/wiki/Alwar)                                         | checked, unchanged                             |
| destinations | amritsar    | 31.63, 74.87     | [Amritsar](https://en.wikipedia.org/wiki/Amritsar)                                   | corrected: types, activities, climate          |
| destinations | auli        | 30.53, 79.57     | [Auli,\_India](https://en.wikipedia.org/wiki/Auli,_India)                            | corrected: source_url, min_nights |
| destinations | bharatpur   | 27.22, 77.49     | [Bharatpur,\_Rajasthan](https://en.wikipedia.org/wiki/Bharatpur,_Rajasthan)          | corrected: source_url, activities              |
| destinations | bhimtal     | 29.35, 79.56     | [Bhimtal](https://en.wikipedia.org/wiki/Bhimtal)                                     | corrected: activities                          |
| destinations | bikaner     | 28.02, 73.31     | [Bikaner](https://en.wikipedia.org/wiki/Bikaner)                                     | corrected: activities                          |
| destinations | bir         | 32.04, 76.72     | [Bir,\_Himachal_Pradesh](https://en.wikipedia.org/wiki/Bir,_Himachal_Pradesh)        | corrected: source_url, climate, best_months    |
| destinations | bundi       | 25.44, 75.64     | [Bundi](https://en.wikipedia.org/wiki/Bundi)                                         | checked, unchanged                             |
| destinations | chail       | 30.97, 77.2      | [Chail,\_Himachal_Pradesh](https://en.wikipedia.org/wiki/Chail,_Himachal_Pradesh)    | corrected: source_url, climate                 |
| destinations | chakrata    | 30.7, 77.87      | [Chakrata](https://en.wikipedia.org/wiki/Chakrata)                                   | corrected: activities, climate                 |
| destinations | dalhousie   | 32.53, 75.97     | [Dalhousie,\_India](https://en.wikipedia.org/wiki/Dalhousie,_India)                  | corrected: source_url, activities, climate     |
| destinations | dehradun    | 30.345, 78.029   | [Dehradun](https://en.wikipedia.org/wiki/Dehradun)                                   | corrected: lat,lng, best_months                |
| destinations | dhanaulti   | 30.45, 78.25     | [Dhanaulti](https://en.wikipedia.org/wiki/Dhanaulti)                                 | corrected: lat,lng, activities, climate        |
| destinations | dharamshala | 32.22, 76.32     | [Dharamshala](https://en.wikipedia.org/wiki/Dharamshala)                             | corrected: climate                             |
| destinations | gwalior     | 26.22, 78.18     | [Gwalior](https://en.wikipedia.org/wiki/Gwalior)                                     | checked, unchanged                             |
| destinations | haridwar    | 29.95, 78.16     | [Haridwar](https://en.wikipedia.org/wiki/Haridwar)                                   | checked, unchanged                             |
| destinations | jaipur      | 26.915, 75.82    | [Jaipur](https://en.wikipedia.org/wiki/Jaipur)                                       | corrected: lat,lng                             |
| destinations | jim-corbett | 29.5486, 78.9353 | [Jim_Corbett_National_Park](https://en.wikipedia.org/wiki/Jim_Corbett_National_Park) | corrected: lat,lng, climate                    |
| destinations | jodhpur     | 26.28, 73.02     | [Jodhpur](https://en.wikipedia.org/wiki/Jodhpur)                                     | corrected: lat,lng                             |
| destinations | kanatal     | 30.41, 78.33     | [Kanatal](https://en.wikipedia.org/wiki/Kanatal)                                     | corrected: activities                          |
| destinations | kasauli     | 30.9, 76.96      | [Kasauli](https://en.wikipedia.org/wiki/Kasauli)                                     | corrected: climate                             |
| destinations | kasol       | 32.01, 77.31     | [Kasol](https://en.wikipedia.org/wiki/Kasol)                                         | corrected: climate                             |
| destinations | kurukshetra | 29.9657, 76.837  | [Kurukshetra](https://en.wikipedia.org/wiki/Kurukshetra)                             | corrected: lat,lng                             |
| destinations | lansdowne   | 29.84, 78.68     | [Lansdowne,\_India](https://en.wikipedia.org/wiki/Lansdowne,_India)                  | corrected: source_url, activities              |
| destinations | lucknow     | 26.85, 80.95     | [Lucknow](https://en.wikipedia.org/wiki/Lucknow)                                     | checked, unchanged                             |
| destinations | manali      | 32.24, 77.19     | [Manali,\_Himachal_Pradesh](https://en.wikipedia.org/wiki/Manali,_Himachal_Pradesh)  | corrected: source_url, climate                 |
| destinations | mathura     | 27.49, 77.67     | [Mathura](https://en.wikipedia.org/wiki/Mathura)                                     | corrected: activities                          |
| destinations | mukteshwar  | 29.47, 79.65     | [Mukteshwar](https://en.wikipedia.org/wiki/Mukteshwar)                               | corrected: climate                             |
| destinations | mussoorie   | 30.46, 78.06     | [Mussoorie](https://en.wikipedia.org/wiki/Mussoorie)                                 | checked, unchanged                             |
| destinations | nainital    | 29.38, 79.46     | [Nainital](https://en.wikipedia.org/wiki/Nainital)                                   | checked, unchanged                             |
| destinations | narkanda    | 31.27, 77.46     | [Narkanda](https://en.wikipedia.org/wiki/Narkanda)                                   | checked, unchanged                             |
| destinations | neemrana    | 27.98, 76.38     | [Neemrana](https://en.wikipedia.org/wiki/Neemrana)                                   | checked, unchanged                             |
| destinations | orchha      | 25.35, 78.64     | [Orchha](https://en.wikipedia.org/wiki/Orchha)                                       | checked, unchanged                             |
| destinations | pushkar     | 26.49, 74.55     | [Pushkar](https://en.wikipedia.org/wiki/Pushkar)                                     | checked, unchanged                             |
| destinations | ranikhet    | 29.64, 79.43     | [Ranikhet](https://en.wikipedia.org/wiki/Ranikhet)                                   | checked, unchanged                             |
| destinations | ranthambore | 26.02, 76.5      | [Ranthambore_National_Park](https://en.wikipedia.org/wiki/Ranthambore_National_Park) | checked, unchanged                             |
| destinations | rishikesh   | 30.1083, 78.2972 | [Rishikesh](https://en.wikipedia.org/wiki/Rishikesh)                                 | corrected: lat,lng, climate                    |
| destinations | sariska     | 27.3175, 76.4369 | [Sariska_Tiger_Reserve](https://en.wikipedia.org/wiki/Sariska_Tiger_Reserve)         | corrected: lat,lng                             |
| destinations | shimla      | 31.1, 77.17      | [Shimla](https://en.wikipedia.org/wiki/Shimla)                                       | corrected: climate                             |
| destinations | udaipur     | 24.58, 73.68     | [Udaipur](https://en.wikipedia.org/wiki/Udaipur)                                     | corrected: lat,lng, best_months                |
| destinations | vrindavan   | 27.58, 77.7      | [Vrindavan](https://en.wikipedia.org/wiki/Vrindavan)                                 | checked, unchanged                             |

## Spot check before merging

Spot check (24 October 2026), by a second, independent agent session: delhi, shimla and rishikesh hold against Wikipedia; jim-corbett holds with the Pantnagar IMD table; auli's link, climate and minimum nights hold (Wikivoyage), and its best_months change was not supported by a readable source and was reverted. Maulik reviewed the report.
