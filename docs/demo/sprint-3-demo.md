# Sprint 3 demo: ten minutes, the whole journey

This script shows the full journey on Monday 2 November: a new account, a group's preferences, the shortlist, costed packages, a day plan built from catalogue facts, and a finalised trip. It ends with the transport comparison on the Tight budget demo and an account deletion. Anyone on the team can follow it. Every click and every line on screen is written exactly as the app shows it.

Every price in the app is an estimate, and the screens say "estimate" next to each one.

**Dates.** The dates quoted below come from a reset on 28 October. The seed sets everyone's dates relative to the day it runs, so after a reset on another day every date moves by the same number of days. Nothing else changes.

## Before you start (2 minutes, before the audience arrives)

1. Maulik resets preview: `pnpm db:seed --target preview --fresh-demos`. It prints the demo trips it deleted and the four it created again. After the reset:

   | Trip | Members | State after the reset | Used in |
   | --- | --- | --- | --- |
   | Long weekend in the hills | Asha, Rohan, Meera (Meera has not submitted) | Collecting preferences | Steps 1 to 4 |
   | Hills shortlist demo | Asha, Rohan, Meera | Ready for recommendations | Spare copy of the shortlist |
   | Tight budget demo | Asha, Rohan, Meera | Ready for recommendations | Step 5 |
   | Date clash demo | Asha, Rohan | Ready for recommendations | Not used (see the Sprint 2 script) |

2. Open three browser windows:
   - **Asha:** a normal window signed in as **asha@demo.bonvoyage.test** (the organiser).
   - **Meera:** a private window signed in as **meera@demo.bonvoyage.test** (a member).
   - **New account:** a guest window on the start page, signed out. It is used in steps 0 and 6.

   The password for both demo users is the demo password Maulik set (`SEED_DEMO_PASSWORD`). It is never written in this repository.
3. Asha and Meera: open **Trips**.

Each demo trip works once per reset, because every step moves the trip on.

## 0. A new account and a new trip (1 minute)

1. **New account window:** the start page reads **"Group trips, decided together."** Click **Create an account**.
2. Fill in **Name** `Priya`, **Email** any unused address, and a **Password** of at least 12 characters ("At least 12 characters"). Click **Create an account**.
3. The page reads **"Your trips"** and **"No trips yet"**. Click **New trip**.
4. Fill in **Trip title** `Diwali weekend`, **Starting city** `Gurugram, Haryana`, **Nights** `2`, **Group budget (₹)** `30000` ("Total for the whole group, for the whole trip"), **Search radius (km)** `300`. Click **Create trip**.
5. The dashboard reads **"Step 1 of 7: Draft"** and **"Create the invite link to open the trip."**
   > "Anyone can start a trip. The organiser sets the hard limits: where from, how many nights, the group budget and how far to travel. The next step is the invite link, but let's switch to a group that is already further along."

Leave this window open for step 6.

## 1. Meera submits her preferences (1 minute)

1. **Meera:** open **Long weekend in the hills**. The dashboard reads **"Step 2 of 7: Collecting preferences"** and **"Fill in your preferences."** Click **Fill in your preferences**.
2. Point at the line under the title: **"Only you can see your answers; the group sees totals."**
3. Fill in:
   - **Destination types:** Heritage, Hill station
   - **Activities:** Museums, Trekking, Food trails
   - **Climate:** Any ("Weather does not matter")
   - **Travel style:** Comfort ("Trains or cabs, mid-range hotels")
   - **Budget min (₹ per person)** `11000`, **Budget max (₹ per person)** `17000`
   - **Available from:** the day before the first date under "Dates everyone can make" on the dashboard; **Available to:** the day after the last date. After a 28 October reset the dashboard shows "28 to 30 Nov, 3 days", so enter 27 Nov 2026 and 1 Dec 2026.
4. Click **Submit preferences**. The page reads **"Saved. Everyone has submitted, so the trip is ready for recommendations."**
5. **Asha:** open **Long weekend in the hills**. Within 8 seconds the dashboard reads **"Step 3 of 7: Ready for recommendations"** and **"Get recommendations when you are ready."**
   > "The last submission moved the trip on by itself. Nobody had to press anything."

## 2. Recommendations (2 minutes)

1. **Asha:** point at the **Group profile** card: **"Dates everyone can make: 28 to 30 Nov, 3 days"**, **"₹12,000 to ₹16,000 per person"**, **"Rounded to ₹500 so nobody’s exact limit shows."**, **"Mountain: 2 of 3"**, **"Trekking: 3 of 3"**, **"and 13 more interests"**.
   > "This is the group's combined answer. Interests are counts, and a value only shows when at least two people chose it. No names, no exact budgets."
2. Under **Organiser actions**, click **Get recommendations**. The shortlist opens in (timed in the dry run).
3. Point at the first card:
   - **"1. Chakrata"**, **"Uttarakhand"**
   - **"338 km, curated road distance"**
   - **"₹29,565 for the group, about ₹9,855 each, estimate, cheapest by car"**
   - **"Opinions differ: from 2.9 to 4.3 out of 10"**, **"Climate suits 2 of 3"**, **"Shared: trekking (3)"**
   > "Every place here passed the hard limits first: radius, nights, season and budget. Then they are ranked by group fit, which rewards a place everyone can live with, not one that only some people love."

   Read Asha's line: **"For you: 2.9 out of 10. Matches adventure, trekking, camping. Misses mountain, rafting."**
4. **Meera:** the dashboard reads **"Waiting for Asha (demo) to choose a destination."** Click **See the shortlist**. Read her line on Chakrata: **"For you: 4.3 out of 10. Matches ‘hill station’, trekking. Misses heritage, museums, ‘food trails’."**
   > "Same card, different 'For you' line. Each person only sees their own reasons, and only Asha can choose."
5. **Asha:** click **Choose** on Chakrata. The confirm reads **"Choose Chakrata? The group moves on to packages."** Click **Choose Chakrata**. The packages are built in (timed in the dry run).
6. The dashboard reads **"Step 5 of 7: Packages proposed"** and **"Compare the packages and say which work for you."**

## 3. Packages (2 minutes)

1. **Asha:** click **See the packages**. The page reads **"Packages for Chakrata"** and **"From Gurugram · 2 nights · 3 people"**, with three packages:

   | Package | Line under the name | Group total | Each |
   | --- | --- | --- | --- |
   | Saver | Car · Budget stay · 2 rooms | ₹29,566 for the group | about ₹9,856 each |
   | Balanced | Car · Mid stay · 2 rooms | ₹31,566 for the group | about ₹10,522 each |
   | Comfort | Car · Premium stay · 2 rooms | ₹39,966 for the group | about ₹13,322 each |

   > "Chakrata can only be reached by car in our catalogue, so its three packages compare stays, not transport."
2. On **Saver**, open **What it costs**. Point at the badges: **"Car, 3 people, one way ₹5,958 Curated"**, **"Budget stay, 2 rooms x 2 nights ₹10,000 Curated"**, **"Entry fees, 3 people, 6 places ₹0 Estimate"**.
   > "Every line says where its number came from: curated from a checked source, or estimated. The total is the sum of these lines, and each person's share is the total divided by three."
3. **Meera:** click **Back to the trip**, then **See the packages**. On **Saver**, click **Works for me**. Her card reads **"1 of 3 say it works"** and **"You said it works."**
4. **Asha:** the Saver card reads **"1 of 3 say it works"**, with no name.
   > "Opinions are counts. Asha sees that one person said yes, not who."
5. **Asha:** on **Comfort**, click **Change**. Set **Stay tier** to **Mid** and read **"Saving clears everyone’s opinion on this package."** Click **Save changes**. Comfort now reads **"Car · Mid stay · 2 rooms"** and **"₹31,566 for the group"**.
   > "Change re-costs the package from the catalogue straight away."
6. **Asha:** on **Saver**, click **Choose this package**. The confirm reads **"Choose the Saver package? Everyone moves on to the day plan."** Click **Choose Saver**. The card shows **"Chosen"**.

## 4. Plan the days (2.5 minutes)

1. **Asha:** click **Back to the trip**. The dashboard reads **"Step 6 of 7: Package selected"** and **"Saver package chosen: ₹29,566 for the group, about ₹9,856 each (estimate). The day plan comes next."**
2. Click **Plan the days** ("Planning the days. This can take up to 30 seconds."). The day plan opens in (timed in the dry run).
3. Point at the top: **"Chakrata: 28 Nov 2026 – 30 Nov 2026"**, **"Saver package · version 1"**, the source line **"Planned from the BonVoyage catalogue"** and **"Travel times are planned, not a timetable."**
   > "Every place, time and price on this page comes from the catalogue. If a language model writes the wording, it never supplies a fact, and the plan is checked before anyone sees it."
4. Point at Day 2, **"12:30–14:30 · Visit"**, **"Tiger Falls · Nature · Free entry"** and **"Not verified: This place's details are not verified yet."**
   > "Every other item says 'Verified'. Tiger Falls is in the catalogue but its details have not been checked yet, and the plan says so in words."
5. **Remove:** on Day 1, **"17:50–18:50 · Visit"**, **"Lakhamandal Temple · Temple · Free entry"**, click **Remove**. That slot now reads **"17:50–18:50 · Free time"** and **"Free time to explore."**
6. **Swap:** on Tiger Falls, click **Swap**. One option fits: **"Lakhamandal Temple · Temple · Entry ₹0 per person (estimate)"**. Click it. Day 2 now reads **"12:30–14:30 · Visit"**, **"Lakhamandal Temple · Temple · Free entry"** and **"Verified"**.
   > "Swap only offers places that are not already in the plan and that fit the slot's time and opening hours. We swapped an unverified visit for a verified one."
7. **Meera:** click **Back to the trip**, then **See the day plan**. She sees the same plan with no Remove or Swap buttons, and **"Waiting for Asha (demo) to accept the plan."**
8. **Asha:** click **Accept this plan**. The confirm reads **"Accept this plan? The trip is finalised."** Click **Accept plan**.
9. The dashboard reads **"Step 7 of 7: Finalised"**, **"Planning is complete."** and **"Trip finalised: Chakrata, 28 Nov 2026 – 30 Nov 2026, Saver package, ₹29,566 for the group, about ₹9,856 each (estimate)."**
10. Click **Trips**. **Long weekend in the hills** now sits under **"Past and finalised trips"**, marked **Finalised**.

## 5. Transport comparison: Tight budget demo (1 minute)

1. **Asha:** on **Trips**, open **Tight budget demo** and click **Get recommendations**.
2. The page reads **"No destination fits"**, **"Most places cost more than the group can spend."** and the closest misses: **"Mathura: about ₹6,600 over the group budget"**, **"Vrindavan: about ₹6,730 over the group budget"**, **"Bikaner: about ₹6,860 over the group budget"**.
3. Click **Raise the group budget to ₹14,000** ("This adds Bikaner, Mathura and Vrindavan."). The page reads **"Saved. Now mark the trip ready again and get recommendations."**
4. Click **Mark ready again**. The confirm reads **"Everyone active has submitted."** Click **Mark ready again**, then **Get recommendations**.
5. The page reads **"Round 2"**: **"1. Vrindavan"**, **"2. Mathura"**, **"3. Bikaner"** (**"429 km, curated road distance"**, **"₹13,860 for the group, about ₹4,620 each, estimate, cheapest by train"**).
6. On **Bikaner**, click **Choose**, then **Choose Bikaner**. Click **See the packages**:

   | Package | Line under the name | Group total | Flag |
   | --- | --- | --- | --- |
   | Saver | Train · Budget stay · 2 rooms | ₹13,995 for the group | none |
   | Balanced | Train · Mid stay · 2 rooms | ₹19,195 for the group | ₹5,195 over the group budget |
   | Comfort | Train · Premium stay · 2 rooms | ₹25,195 for the group | ₹11,195 over the group budget |
   | Comfort by car | Car · Premium stay · 2 rooms | ₹36,688 for the group | ₹22,688 over the group budget |

   > "Bikaner has checked train, bus and car fares from Gurugram, so here the packages compare transport. The train is both the cheapest and the quickest, so three packages use it, and one goes by car. A package that costs more than the group can spend is flagged in words, not hidden."
7. Optional, if asked about the bus: on **Balanced**, click **Change**. The **Transport mode** list offers **Train**, **Bus** and **Car**. Click **Cancel**.

Stop here. This trip does not need a day plan.

## 6. Account deletion (30 seconds)

1. **New account window:** click **Priya ▾**, then **Your profile**. Scroll to **Delete account** and read the list, from **"Your sign-in, profile and past trips."** to **"Trips you organised that are finalised, completed or cancelled."**
2. Fill in **Password** and the email under **"Type … to confirm"**, then click **Delete my account**. The page reads **"Cancel or finish these trips first:"** and lists **Diwali weekend**.
   > "You cannot delete an account and leave a group stranded with a trip you are organising."
3. Click **Diwali weekend**. Under **Organiser actions**, click **Cancel trip**. The confirm reads **"Cancel this trip? Nobody will be able to plan it after this."** Click **Cancel trip**. The dashboard reads **"This trip was cancelled."**
4. Click **Priya ▾**, **Your profile**, fill in both fields again and click **Delete my account**.
5. The page shows **"Your trips"** with nothing under it (a known bug: the app does not sign the page out yet). Press **F5**: the **Sign in** page opens. Sign in with Priya's email and password: **"Email or password is incorrect."**
   > "The account and everything it owned are gone."

## Reset

- **Local:** `pnpm db:seed --fresh-demos` (or `pnpm db:reset && pnpm db:seed` for a clean database).
- **Preview:** `pnpm db:seed --target preview --fresh-demos` (Maulik runs it). It deletes every trip a demo user organises, with its packages and day plans, and builds the four demo trips again. Demo users keep their accounts and password. It refuses and deletes nothing if anyone outside the demo users has joined a demo trip.
- **Production:** never. The seed refuses `--target production`.

The account from step 0 is deleted in step 6, so nothing is left to clean up.

## If something looks different

- **Chakrata is not first, it has a different number of packages, or Tiger Falls is verified.** The catalogue has changed. `apps/api/src/seed/run-seed.test.ts` checks each of these and fails first. The same test checks Bikaner's Round 2 packages (at least two transport modes and an over-budget flag).
- **Swap shows "No unused places fit this slot."** The plan already uses every Chakrata place. Remove Lakhamandal Temple first (step 4.5), then Swap.
- **The source line reads "Written with … from catalogue facts".** Gemini wording is switched on for preview (`LIVE_APIS=on`). The notes under each visit are worded differently; places, times and prices stay the same.
- **The shortlist says ₹29,565 and the Saver package says ₹29,566.** The shortlist rounds its estimate once; a package rounds each cost line up to whole rupees and adds them.
- **The dates are different.** The reset ran on another day; every date moves by the same number of days.
- **There's no "Get recommendations" button, or a trip is already further along.** It was used since the last reset. Ask Maulik to run the preview reset again.
