# Review run on preview, 3 November 2026 (results for S4-12 and S5-7)

**Who and where:** Claude in Cowork, 3 November 2026, about 17:05 to 18:05 UTC. Preview `bonvoyage-git-master-thenamakops-projects.vercel.app` at master `7e28920` (#164), migrations 6 of 6, catalogue imported with `--prune` (192 fares), demo trips reset with `--fresh-demos`. Asha in the Claude app's built-in browser, Meera in Chrome, both signed in by Maulik; nobody typed a password for Claude. Logs read through the Vercel connector.

This file has the Sprint 5 checks (S5-7 Part 2) and the Sprint 4 on-screen checks. The full demo script run and the live model check are in [s4-7-preview-check-2026-11-03.md](s4-7-preview-check-2026-11-03.md).

## Demo script

`docs/demo/sprint-3-demo.md` steps 1 to 5 matched line for line on preview, with dates 21 to 23 Nov from #155's rule (details and timings in the S4-7 file). Steps 0 and 6 (create and delete an account) were not run: they are Maulik's, by hand, because Claude does not create accounts.

## Sprint 5 checks

A new 2-member trip, "Pair check" (Asha organiser, Meera joined by the invite link; Gurugram, 2 nights, ₹40,000, 450 km; both available 20 to 24 Nov; Asha's maximum ₹15,000, Meera's ₹16,000, so the members set the cap), and the "Hills shortlist demo" for the second round.

| Check | Result | Evidence |
| --- | --- | --- |
| Reminder | Pass | Asha's Remind on Meera (pending): "Reminder sent to Meera (demo)" and "You can remind Meera again after 4 Nov, 11:18 pm"; the Remind button is disabled. |
| Second reminder refused with the time | Pass | Direct `POST …/members/<Meera>/remind`: 429, `Retry-After: 86387`, `{"error":{"code":"TOO_MANY_REQUESTS","message":"You can remind Meera again after 4 Nov, 11:18 pm"}}`. |
| Bell rises in the other browser | Pass | Meera's bell went from "none unread" to "Notifications, 1 unread"; the panel reads "Pair check · New · Asha (demo) asked you to add your preferences · 3 Nov, 11:18 pm". After "Ask again" on the Hills shortlist demo it rose again: `shortlist_reopened: Asha (demo) asked for new recommendations`. |
| Voting, 2-member rule | Pass | Shortlist (749 ms): "0 of 2 voted", no per-destination counts. Asha voted Almora: her button "Your vote" (`aria-pressed="true"`); Meera's page "1 of 2 voted" with no counts, and her API `votes` was `{"voted":1,"eligible":2}` (no `counts`, no `mine`). After Meera voted: "2 of 2 voted", "Almora: 2 votes", "Lansdowne: No votes", "Chakrata: No votes". |
| Organiser chooses a place with fewer votes | Pass | Asha chose Lansdowne (0 votes); "Step 5 of 7: Packages proposed" in 212 ms. |
| Fairness sentence on a second round | Pass | Hills shortlist demo: round 1 (646 ms), "Ask again" ("Ask again? Members can change their answers, and you can ask for new recommendations."), round 2 (817 ms) reads "Round 2" and "This round gives more weight to members whose wishes were met less in earlier rounds."; `run.favoursLessServed` true. The top five were unchanged (Chakrata, Dhanaulti, Almora, Rishikesh, Mukteshwar). |
| No weight or number visible | Pass | Page text: the sentence only, no figures. The round 2 response's only key matching weight, deficit or lambda is `run.weights = {"alpha":0.5,"beta":0.3,"gamma":0.2}` (the stored GFS weights); no member weight, deficit or lambda anywhere. |

## Sprint 4 checks (still in place)

| Check | Result | Evidence |
| --- | --- | --- |
| Travel time on package cards (#119) | Pass | Pair check: "About 6 h 45 min each way (planned)" on all three; the demo trips as quoted in the script. |
| "What it costs" toggle at least 44 px (#120) | Pass | Measured heights 44, 44, 44 px. |
| Two-member budget hiding (#116) | Pass | Group profile: "Budgets overlap" and "Budget figures appear once 3 or more people have answered."; `group-profile` API: `budgetBand {minInr:null, maxInr:null, overlaps:true}`, `perPersonCapInr` null, `groupCapInr` null. No "Opinions differ" score range on 2-member cards. Packages: Comfort (₹32,996) reads "Over the group budget" with no amount; API `overBudget: true, overByInr: null` (member-set cap). |
| Templates on preview after S4-7 | Pass | `LIVE_APIS` off: Pair check "Plan the days" in 609 ms, "Planned from the BonVoyage catalogue". |

## Speeds on preview (one run each, browser-measured)

| Action | Time |
| --- | --- |
| Shortlist (3 members, Long weekend) | 633 ms |
| Shortlist (2 members) | 749 ms |
| Round 2 shortlist | 817 ms |
| Diagnostic (Tight budget) | 209 ms |
| Choose destination (packages built) | 212 to 539 ms |
| Plan the days, templates | 609 ms |
| Plan the days, model live | 20.5 s (timeout fallback); 0.4 s from cache |

## Production

Production deployment `dpl_H1DKdfp2HhqWQaSyEfr2rpDkM34F` is READY at `7e28920` (Vercel API). Its catalogue was imported with `--prune` on 3 November (192 fares, 0 left to prune). `LIVE_APIS` is unset there. Production has no demo accounts and the deployment URL is behind Vercel's login, so no end-to-end run was made on production.

## Clean-up

Pair check and the used demo trips are on preview. Maulik resets preview (`pnpm db:seed --target preview --fresh-demos`) before the demo; that deletes every trip a demo user organises, Pair check included.
