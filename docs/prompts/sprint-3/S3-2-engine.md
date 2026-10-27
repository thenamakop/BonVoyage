# S3-2: Package and day-plan engine (pure)

The arithmetic of Sprint 3 in one pure module: which packages to build and what each costs, line by line, and the day planner that decides which places fit which slot. The planner lives here because a package's activity cost is the entry fees of the places it schedules, and the day plan in S3-6 must schedule the same places. No database, no API, no screens.

**Branch:** `feat/s3-2-engine` · **Time box:** 3 hours · **Depends on:** S3-1 merged · **Issue:** S3-2 · **Tests:** `pnpm test:unit` only (can run beside S3-5 in a worktree)

```text
S3-2  PACKAGE AND DAY-PLAN ENGINE (PURE)
Branch: feat/s3-2-engine   Time box: 3 hours   Issue: S3-2 (Sprint 3 milestone)

CONTEXT
Read AGENTS.md, docs/prompts/sprint-3/README.md (rules P1 to P12), docs/decisions/0005 (sections a
to f are this task's specification), 0004 d and f, packages/engine/src/costs/costs.ts,
packages/engine/src/itinerary/validate.ts and its tests, packages/shared/src/itinerary.ts
(FactSheet, ItineraryOutput), packages/shared/src/domain.ts and vocab.ts (STAY_TIERS,
COST_CATEGORIES, ITINERARY_ITEM_KINDS, ACTIVITIES, POI_CATEGORIES, TRANSPORT_MODES).
Everything here is pure: no clock, no I/O, no randomness, plain data in and out (P2).

GOAL
packages/engine exports: the activity-to-category mapping, planDays (0005 e), buildFactSheet,
costPackage and generatePackages (0005 b to d), each with 100 per cent branch coverage, and a test
proving that a planned day plan with template notes passes validateItinerary.

STEPS
1. packages/engine/src/itinerary/interests.ts: ACTIVITY_POI_CATEGORIES (the 0005 e table, typed
   Record<Activity, PoiCategory[]>) and groupInterestCategories(activities) returning the set.
2. packages/engine/src/itinerary/plan.ts:
   - Input: { startDate, nights, onward: { mode, durationMinutes }, ret: { mode, durationMinutes },
     stayTier, places: PlannerPlace[] ({ key, name, category, typicalMinutes, openTime | null,
     closeTime | null, closedDays: number[], entryFeeInr, verified }), groupInterests: Activity[] }.
   - weekdayOf(isoDate) computed with plain arithmetic on the date string (no Date.now, no time
     zone; a fixed algorithm such as Zeller's or days-since-epoch on the UTC calendar).
   - Leg times, day 1, middle days, last day, fit, choice order, free time and the meal exactly as
     0005 e. Times are HH:MM strings; minutes in between. A slot that would run past 23:59 does not
     fit.
   - Output: { legs: [{ id: 'onward' | 'return', mode, depart, arrive, durationMinutes }], days:
     [{ day, date, items: [{ start, end, kind, placeKey?, legId?, note }] }], scheduledPlaceKeys }.
     Notes come from the 0005 e templates; the only numbers in a note are entry fees.
   - unusedPlacesFitting(plan, input, day, slot) for S3-7's "replace" action: the places not yet
     used that fit that slot, in choice order.
3. packages/engine/src/itinerary/fact-sheet.ts: buildFactSheet({ plan, input, destination, groupSize,
   rooms, perRoomPerNightInr, farePerPersonInr: { onward, return }, costs: { totalInr, perPersonInr,
   items } }) returning a FactSheet (zod-parse it in the test) with limits.maxDayHours = 15 and pois
   = every place offered to the planner (ids = place keys).
4. packages/engine/src/packages/cost.ts and generate.ts:
   - Input: { n, nights, startDate, groupCapInr, originName, destinationName, modes: { bus |
     null, train | null: { farePerPersonInr, durationMinutes, verified }, car: { km,
     durationMinutes, verified } }, costRules: CostRules & { verified }, stay: { budget, mid,
     premium: number | null }, costVerified, foodPerDayInr, localPerDayInr, places, groupInterests,
     sourceRefs }.
   - costPackage(input, { label, mode, tier }) -> PackageDraft { label, transportMode, stayTier,
     rooms, startDate, endDate, lines: [{ category, label, amountInr, provenance, sourceRef }],
     totalInr, perPersonInr, overBudget, overByInr, scheduledPlaceKeys }. Lines, labels, rounding
     and provenance exactly as 0005 c and d (reuse carSharePerPersonOneWay and the 0004 tie rule;
     the activities line runs planDays for this package's legs and tier).
   - generatePackages(input) -> { packages: PackageDraft[], note: string | null } with the 0005 b
     order, the duplicate-pair skip, the Quickest-to-Comfort rule and the "Only N packages could
     be costed for <destination>" note.
   - availableChoices(input) -> the (mode, tier) pairs that can be costed, for S3-3's Change action.
5. Tests (100 per cent branches in each new file):
   - a hand-worked golden package set: 3 members, 2 nights, gurugram to a destination with bus,
     train and car, all three tiers; every line amount, total, per person and provenance written out
     by hand in the test, with the arithmetic in comments;
   - Quickest equal to Balanced becomes Comfort with premium; a missing mid rate drops Balanced and
     Quickest; no bus and no train gives car packages only; fewer than 3 gives the note;
   - over budget by exactly 0 is not over budget; 1 rupee over is;
   - provenance: one draft fare makes onward and return estimated; one unverified cost rule makes a
     car line estimated; one draft place makes activities estimated;
   - planner: a 13-hour onward leg leaves day 1 without activities; the return departure clamps to
     06:00 and 16:00; a place closed on the date's weekday is skipped; a place without hours fits
     any slot; a place that closes mid-slot does not fit; the meal and the 30-minute gaps; at most
     3 activities; free time; each place once; choice order (interest match, verified, minutes,
     key) with group interests from shared activities only;
   - validateItinerary(buildFactSheet(...), planned output) returns ok with verifiedRatio 1 for a
     verified sample and flags nothing; the same with one draft place still passes the validator
     (verification of the row is S3-6's job).
6. Export everything from packages/engine/src/index.ts. Traceability rows R8 and R12 gain the new
   test files. PR "feat: package and day-plan engine", body starts "Closes #<S3-2>", with the
   golden package set as a table.

VERIFICATION
Paste the real output of: pnpm vitest run --project unit packages/engine --coverage (the new files
at 100 per cent branches) ; pnpm lint ; pnpm typecheck ; pnpm test:unit.

IF BLOCKED
A 0005 rule is ambiguous for real data (for example a place with an open time but no close time):
stop and ask; do not invent a rule. validateItinerary rejects a correctly planned day: report the
error code and the day; do not change the validator in this task.
```
