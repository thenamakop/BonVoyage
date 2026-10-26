# Sprint 2 demo: five minutes

This script shows what Sprint 2 built: the group profile, private "For you" explanations, ranking by group fit, the diagnostic and its one-tap fix, and the date clash. Anyone on the team can follow it. Every click and every line on screen is written exactly as the app shows it.

All costs and distances in the demo are estimates. They stay estimates until the catalogue's stage B1 is verified (due Sunday 1 November). The app says "estimate" next to every figure.

## Before you start (2 minutes)

1. Reset the demo data (see [Reset](#reset) below). After a reset, the seed has made four trips, all organised by Asha:

   | Trip | Members | State after the seed | What it shows |
   | --- | --- | --- | --- |
   | Long weekend in the hills | Asha, Rohan, Meera (Meera has not submitted) | Collecting preferences | The Sprint 1 trip, unchanged |
   | Hills shortlist demo | Asha, Rohan, Meera | Ready for recommendations | A ranked shortlist |
   | Tight budget demo | Asha, Rohan, Meera | Ready for recommendations | The diagnostic and its fix |
   | Date clash demo | Asha, Rohan | Ready for recommendations | A date clash |

2. Open two browser windows side by side:
   - a normal window signed in as **asha@demo.bonvoyage.test** (the organiser)
   - a private window signed in as **rohan@demo.bonvoyage.test** (a member)

   The password is the demo password Maulik set (`SEED_DEMO_PASSWORD`). It is never written in this repository.
3. In both windows, open **Trips**.

Each demo trip works once per reset, because asking for recommendations moves the trip on.

## 1. Hills shortlist demo (2 minutes)

1. **Asha:** open **Hills shortlist demo**. Point at the **Group profile** card.
   > "This is the group's combined answer, not anyone's own. It shows the dates everyone can make, the budget per person and what the group can spend. Interests are counts, like 'Mountain: 3 of 3', and a value only appears when at least two people chose it. Budgets are 'Rounded to ₹500 so nobody's exact limit shows.' No names appear anywhere on this card."
2. **Asha:** under **Organiser actions**, click **Get recommendations**. The shortlist opens in well under a second (the target is 10 seconds).
3. Point at the first card:
   > "Every place here passed the hard limits first: radius, nights, season and budget. Each card gives the distance, then the cost for the group and per person, labelled 'estimate'. The order is by group fit, not by the average. Group fit rewards a place everyone can live with and penalises one that only some people love."

   Read out the card's **"For you: … out of 10. Matches … Misses …"** line.
4. **Rohan:** open **Hills shortlist demo**. Within 8 seconds the dashboard reads "Waiting for Asha (demo) to choose a destination." Click **See the shortlist**.
   > "Rohan's 'For you' line is different from Asha's. Each person only sees their own reasons. Rohan has no Choose button, because only the organiser decides."
5. **Asha:** click **Choose** on the first card. The confirm reads **"Choose X? The group moves on to packages."** Click **Choose X**.
6. Asha lands on the dashboard: **"X chosen. Packages arrive in the next release."** Trip parameters now shows a **Destination** row.
7. **Rohan:** click **Back to the trip**. Within 8 seconds his dashboard shows the same destination.

## 2. Tight budget demo (1.5 minutes)

1. **Asha:** go back to **Trips**, open **Tight budget demo** and click **Get recommendations**.
2. The page reads **"No destination fits"** and **"Most places cost more than the group can spend."**, followed by the closest misses ("…: about ₹… over the group budget").
   > "Nothing fits, and the app says exactly why. This isn't an error: it's a diagnostic."
3. Under **Try one of these changes:**, click **Raise the group budget to ₹…**. The amount is the smallest budget that unlocks a place: ₹14,000 with stage B1a's verified costs. The line under the button names the places it adds (Mathura and Vrindavan).
4. The page says **"Saved. Now mark the trip ready again and get recommendations."**. Click **Mark ready again**, then **Mark ready again** in the confirm.
5. Click **Get recommendations**. The new run shows **"Round 2"**.
   > "The organiser fixed the one limit that was binding and asked again. Rounds are kept, so each step can be audited."

## 3. Date clash demo (45 seconds)

1. **Asha:** go back to **Trips**, open **Date clash demo** and click **Get recommendations**.
2. The page reads **"No destination fits"**, **"The dates members gave do not overlap."** and **"Ask members to check their dates"**.
   > "Before looking at any place, the app checks that everyone's dates overlap. Asha and Rohan's dates are almost a week apart, so it sends the trip back for new dates rather than recommending somewhere nobody can go."
3. Click **Back to the trip**. The dashboard reads **"The last round found a date clash."**, with a **See why** link.

## Reset

- **Local:** `pnpm db:reset && pnpm db:seed`
- **Preview:** `pnpm db:seed --target preview` (Maulik runs this after the merge). On preview, a trip that has already been demoed stays where the demo left it. The seed only adds trips that are missing, so for a fresh run either delete the used demo trips or use a fresh preview branch.
- **Production:** never. The seed refuses `--target production`.

## If something looks different

- **The tight budget demo shows a different amount, or the hills shortlist has fewer places.** The catalogue's costs or distances have changed, probably through stage B1. `apps/api/src/seed/run-seed.test.ts` checks every demo outcome and its margin, and fails first.
- **There's no "Get recommendations" button.** The trip isn't in *Ready for recommendations*. Reset the data.
