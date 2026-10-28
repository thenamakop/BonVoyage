# S4-3: Hide the budget band below three members (#116)

On production on 28 October 2026, a two-member trip's `GET /group-profile` returned `budgetBand { minInr: 20000, maxInr: 25000 }` with `perPersonCapInr` and `groupCapInr`. The band is the highest minimum and the lowest maximum across the group, so with two people each member reads the other's binding budget limit (rounded to ₹500). Decision D1 hides the band's numbers below three contributing members; the date window stays (privacy.md line 42).

**Branch:** `fix/116-two-member-budget` · **Time box:** 1.5 hours · **Depends on:** S4-1 merged · **Issues:** #116, #20 (D2) · **Safe before the demo:** yes (every demo trip has three members)

```text
S4-3  TWO-MEMBER GROUPS: HIDE THE BUDGET BAND'S NUMBERS (#116)
Branch: fix/116-two-member-budget (from fresh master)   Time box: 1.5 hours   Issues: #116, #20
Follow the Sprint 4 conventions (Q1 to Q10). This changes what members see, so it follows
decision D1 exactly; anything beyond it: stop and ask.

CONTEXT
Read AGENTS.md (6.7 privacy), docs/security/privacy.md (the window note at line 42 stays),
docs/sprints/sprint-4-plan.md (D1), packages/engine/src/group/profile.ts, the group-profile and
latest-recommendation code in apps/api/src/recommendations, packages/shared/src/api (the group
profile and recommendation schemas), apps/api/src/security/no-leak.test.ts, and the Group profile
card in apps/web/src/pages/Trips (GroupProfileCard.tsx and wording).
Production evidence (2 members, organiser min ₹20,000, member ₹15,000 to ₹25,000): the member's
GET /group-profile and GET /recommendations/latest both carried budgetBand { minInr: 20000,
maxInr: 25000, overlaps: true }, perPersonCapInr 25000 and groupCapInr 30000. The card read
"₹20,000 to ₹25,000 per person".

GOAL (D1)
When fewer than 3 members contribute to the profile (active, not excluded, submitted), no
member-visible response carries the band's minInr or maxInr, nor any field or sentence from which
a member can derive another member's budget minimum or maximum. The card shows only "Budgets
overlap" or "Budgets do not overlap". The date window is unchanged. Groups of 3 or more are
unchanged. The engine and stored recommendation runs keep the real figures.

STEPS
1. Test first (Q2): add to no-leak.test.ts a 2-member trip with distinct budgets (organiser
   18,000 to 30,000; member 12,000 to 22,000). For every endpoint either member can call on that
   trip (use the endpoint inventory), assert the response body contains neither of the OTHER
   member's two budget numbers, raw or rounded to ₹500 (the organiser's view must not contain
   12000 or 22000; the member's view must not contain 18000 or 30000). Pick budgets whose
   roundings do not collide with any other number in the responses (trip budget, fares); change
   them if they do and say so. Run it and confirm it fails on master.
2. Audit every member-visible field that comes from budgets: budgetBand.minInr and maxInr,
   perPersonCapInr, groupCapInr (min of trip budget and n x per-person cap: it reveals the cap
   whenever the cap binds), conflict and diagnostic sentences (closest misses "about ₹X over the
   group budget", "Raise the group budget to ₹Y"), and the shortlist's per-person figures. For
   each, write in the report whether it can reveal another member's bound with 2 members and why.
3. API: below 3 contributors, null minInr, maxInr, perPersonCapInr and groupCapInr in every
   member-visible response; keep overlaps. For a diagnostic or sentence that reveals a bound,
   report it and stop for a decision rather than rewording or changing the engine (the trip's own
   total budget is set by the organiser and is not private).
4. Shared schema: make those fields nullable with a comment "D1, #116: hidden below 3
   contributors". Web code that used them must handle null without computing anything.
5. Web: the Group profile card shows, when the numbers are null, "Budgets overlap" or "Budgets do
   not overlap" and the line "Budget figures appear once 3 or more people have answered."
   (wording may be adjusted; list it in the PR). Text, not colour.
6. Tests: the step 1 test passes; a 3-member trip still shows the band (existing tests stay
   green); web tests for both card states; recommendations tests updated only where they assert
   the hidden fields for 2-member trips.
7. docs/security/privacy.md: under the window note add "Budget band: hidden below 3 contributing
   members (decision D1, 28 October 2026, #116); the window is kept for every size." Traceability
   R4 and R10 cite the new tests.
8. PR "fix: hide the budget band below three members", body "Closes #116" and "Closes #20".

VERIFICATION
Paste: the failing run of the new test on master; pnpm vitest run --project integration
apps/api/src/recommendations apps/api/src/security ; pnpm vitest run --project web
apps/web/src/pages/Trips ; the step 2 audit list; pnpm format:check; pnpm lint; pnpm typecheck;
pnpm test summary; the CI result.

IF BLOCKED
A hidden field is needed by the web to compute something: stop and say which. Hiding a value
would change any 3-member screen or the demo script: stop.
```
