# S4-5: Package cards: travel time and tap target (#18)

#18's first acceptance criterion is "Supported transport modes show estimated group cost and travel time". Package cards show cost and stay but no travel time; only the day plan's leg times imply it. The same screen's "What it costs" toggles are 268 × 20 px, under the 44 px tap target every `Button` meets (`min-h-11`).

**Branch:** `feat/119-package-travel-time` · **Time box:** 1.5 hours · **Depends on:** the 2 November demo (this changes lines the Sprint 3 script reads), S4-1 merged · **Issues:** #119 (travel time; refs #18), #120 (toggle)

```text
S4-5  PACKAGE CARDS: ONE-WAY TRAVEL TIME (#18) AND A 44 PX "WHAT IT COSTS" TOGGLE
Branch: feat/119-package-travel-time (from fresh master)   Time box: 1.5 hours
Issues: #18, and the "What it costs toggle under 44 px" issue from docs/sprints/sprint-4-plan.md.
Follow the Sprint 4 conventions (Q1 to Q10).

CONTEXT
Read AGENTS.md (6.5 prices, 8 UI at 360 px), docs/decisions/0005 (c, d), the engine's
durationMinutes(input, mode) in packages/engine/src/packages/cost.ts (fare row duration for bus
and train, the car row's duration for car), apps/api/src/packages/service.ts (toView, getPackages,
packageInput), packages/shared/src/api/packages.ts (TripPackageView),
apps/web/src/pages/Trips/packages/PackageCard.tsx and PackagesPage.test.tsx,
apps/web/src/lib/format.ts, docs/demo/sprint-3-demo.md steps 3 and 5 and
apps/api/src/seed/run-seed.test.ts.
The day plan already uses the same duration for its onward and return legs (planned times, not a
timetable), so the card and the plan must agree.

GOAL
Every package card shows its one-way travel time for its mode, from the catalogue, labelled as
planned; the "What it costs" toggle is at least 44 px tall; the demo script quotes the new lines.

STEPS
1. Tests first (Q2): an API assertion that each TripPackageView carries the one-way duration that
   durationMinutes returns for its mode (Chakrata car 425 min; Bikaner train 390, bus and car from
   fares.csv), and a web assertion for the card line. Run both on master and paste the failures.
2. Shared: TripPackageView gains oneWayMinutes: number (int, positive). API: set it in toView
   from durationMinutes(input, pkg.transportMode) for proposed and accepted packages, including
   after Change (I3). If durationMinutes can be null for a stored package, stop and report the
   case; do not show a guess.
3. Web: a format helper formatDuration(minutes) in src/lib/format.ts: "45 min", "1 h", "7 h 5 min"
   (unit tested, including 0 and 60 edge cases). The card's line under the label becomes
   "<Mode> · <Tier> stay · <rooms> rooms" as now, followed by a new line
   "About <duration> each way (planned)". Text only.
4. Toggle: the "What it costs" summary gets the same minimum height as Button (min-h-11), the
   full row clickable, and a visible focus ring; it stays a native details/summary so keyboard and
   screen readers keep working. A test asserts the class hook.
5. 360 px check: with pnpm dev, open the packages page at 360 x 780 (the Hills shortlist demo
   after choosing Chakrata, and the Bikaner packages) and report scrollWidth and any target under
   44 px.
6. Demo: update docs/demo/sprint-3-demo.md step 3's table and step 5's table with the new line,
   read off the running app (Q5), and extend run-seed.test.ts to assert Chakrata's Saver shows
   oneWayMinutes 425.
7. Traceability R8 cites the new tests. PR "feat: show one-way travel time on package cards",
   body "Closes #119", "Closes #120" and "Refs #18" (S4-9 closes #18 with the evidence).

VERIFICATION
Paste: the failing tests on master; pnpm vitest run --project integration apps/api/src/packages
apps/api/src/seed ; pnpm vitest run --project web apps/web/src/pages/Trips/packages
apps/web/src/lib ; the 360 px report; the script lines you changed; pnpm format:check; pnpm lint;
pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
A package's duration differs from the day plan's leg for the same package: stop and report both
numbers. The new line would wrap badly at 360 px: show a screenshot and propose shorter wording
rather than shrinking text.
```
