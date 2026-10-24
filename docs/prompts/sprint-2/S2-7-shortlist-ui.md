# S2-7: Group profile, shortlist and diagnostic screens

Puts Sprint 2 in front of people: the group profile on the dashboard, the organiser's Get recommendations button, the ranked shortlist from wireframe 07, the diagnostic from wireframe 08 with one-tap fixes, and the moment the organiser chooses. Each member sees their own "for you" line and nobody else's.

**Branch:** `feat/s2-7-shortlist-ui` · **Time box:** 3 hours · **Depends on:** S2-6 merged · **Issue:** S2-7

```text
S2-7  GROUP PROFILE, SHORTLIST AND DIAGNOSTIC SCREENS
Branch: feat/s2-7-shortlist-ui   Time box: 3 hours   Issue: S2-7 (gh issue list --milestone "Sprint 2 (24-27 Oct)")

CONTEXT
Read AGENTS.md, docs/prompts/sprint-2/README.md (rules S4, S6), docs/wireframes 06-dashboard,
07-shortlist and 08-shortlist-empty with their README notes, docs/decisions/0004 (g, i, j), the shared
contracts from S2-6 (recommendations.ts, TripDetail.latestRecommendation and selectedDestination,
availableActions) and the Sprint 1 web code: src/components/ui, src/pages/Trips/dashboard/,
src/features/trips/api.ts (useTrip with { live: true }, 8 s poll), src/lib/format.ts.
The browser never computes scores or costs; it shows what the API sends.

GOAL
The dashboard shows the group profile and the organiser's Get recommendations action;
/trips/:id/shortlist shows the ranked shortlist (wireframe 07) or the diagnostic (wireframe 08);
each member sees their own meets and misses and the group sees aggregates; the organiser chooses a
destination; every member's dashboard follows within one poll.

STEPS
1. src/features/recommendations/api.ts: useLatestRecommendation(id) on ["trip", id,
   "recommendation"], refetched when TripDetail.latestRecommendation changes (no extra poll);
   useGroupProfile(id) on ["trip", id, "group-profile"], refetched when lastActivityAt changes;
   useRequestRecommendations and useChooseDestination invalidate ["trip", id] and both keys above.
2. Dashboard (src/pages/Trips/dashboard/):
   - GroupProfileCard, once ready is true: common window ("13 to 15 Nov, 3 days") or a warning when
     there is none or it is too short ("The dates members gave overlap for 2 days; this trip needs 3.");
     budget band per person ("₹12,000 to ₹16,000 per person") or the warning "Budgets do not overlap;
     plans use the lowest maximum, ₹10,000 per person."; the group cap; shared interests with counts
     ("Mountain: 3 of 3") and "and N more interests"; climate split. No names anywhere.
   - OrganiserActions: "Get recommendations" (availableActions.requestRecommendations) with a pending
     state announced through role="status" ("Finding destinations, this takes a few seconds"); on
     success go to /trips/:id/shortlist; a 409 shows the server message. In collecting_preferences
     after a previous run, the Close submissions button reads "Mark ready again".
   - NextStep: ready_for_recommendation, organiser "Get recommendations when you are ready.", member
     "Waiting for Asha to get recommendations."; shortlisted, organiser "Choose a destination from the
     shortlist.", member "Waiting for Asha to choose a destination." (both link to the shortlist);
     packages_proposed "Rishikesh chosen. Packages arrive in the next release."; collecting_preferences
     after a diagnostic "The last round found only 1 destination. See why." with the link ("found no
     destination" for 0, "found a date clash" for F3).
   - TripParameters shows the chosen destination when set; Edit details follows availableActions.
3. /trips/:id/shortlist (src/pages/Trips/shortlist/), any member:
   - Shortlist view (kind shortlist, wireframe 07): "Round 2" when round > 1; info Alert when
     weakMatch ("These are the closest options; none match the types the group asked for well.");
     ranked cards, the first 5 then "Show all N"; each card: "1. Rishikesh", state, "250 km, estimated
     road distance" (curated when provenance is curated), "₹27,000 for the group, about ₹9,000 each,
     estimate, cheapest by train", a group sentence (lowestScore10 >= 5: "Everyone rates this at least
     {n} out of 10"; otherwise "Opinions differ: from {low} to {high} out of 10"), shared interests
     ("Shared: rafting (2), temples (2)"), and "For you: {score10} out of 10. Matches mountain,
     trekking. Misses rafting." from mine; the organiser's Choose button with an inline confirm
     ("Choose Rishikesh? The group moves on to packages.").
   - Diagnostic view (kind diagnostic, wireframe 08): "Only {k} destinations fit" or "No destination
     fits"; the binding constraint in words (F1 "Most places are just beyond your search radius.", F2
     "Most places need more nights than this trip has.", F4 "Most places are out of season on your
     dates.", F5 "Most places cost more than the group can spend.", F3 "The dates members gave
     overlap for {d} days; this trip needs {n}."); alternatives ("Mussoorie: 40 km beyond the
     radius"); suggestions as organiser buttons: F1 "Widen the radius to 600 km", F2 "Make the trip 3
     nights", F5 with capSource trip "Raise the group budget to ₹54,000" (each PATCHes the trip, then
     shows "Saved. Now mark the trip ready again and get recommendations." with the Mark ready again
     button); F5 with capSource members and F4 and F3 are text for everyone ("Members need to raise
     their maximum to ₹18,000 per person", "Shift the dates by 1 month", "Ask members to check their
     dates"); members see "Edit your preferences"; the 1 or 2 feasible destinations as cards; a
     collapsed "Not considered" list for incomplete catalogue entries.
   - No run yet: EmptyState "No recommendations yet."
4. Accessibility: each card is an article with a heading; the rank is text; 44 px targets; pending and
   result changes announced through role="status".
5. Web tests: the profile shows shared interests with counts, never a single-member value, and shows the window warning; Get
   recommendations navigates on success and shows the 409 message; the shortlist shows 5 then all,
   the weak-match alert, the For you line from mine only, Choose only for the organiser with its
   confirm; the diagnostic shows the binding sentence, alternatives, organiser-only suggestion buttons,
   and a suggestion PATCHes the right field with the right value.
6. Traceability on R4, R6 and R7. PR "feat: group profile, shortlist and diagnostic screens", body
   starts "Closes #<S2-7>", 360 px and desktop screenshots of the group profile, the shortlist as
   organiser and as member, the diagnostic with suggestions, and the chosen destination.

VERIFICATION
Paste the real output of: pnpm vitest run --project web ; pnpm verify. Then pnpm db:reset &&
pnpm db:seed and pnpm dev with two browser sessions: meera submits; asha's dashboard shows the group
profile; asha gets recommendations (time it: under 10 s, R15) and sees the shortlist; rohan's
dashboard links to it within 8 s and shows his own For you line; asha chooses; rohan sees the chosen
destination within 8 s. Then a tight-budget trip: see the diagnostic, use a suggestion, mark ready,
recommend again (round 2). Stop every dev server and browser you start.

IF BLOCKED
A screen needs data the API does not send: stop and ask; never compute scores or costs in the
browser. The wireframes and this prompt disagree on words: this prompt wins on words, the wireframes
on layout.
```
