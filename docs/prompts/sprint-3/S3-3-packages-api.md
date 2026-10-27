# S3-3: Migration 0002 and the packages API (T9 to T11, I3, I4)

The only schema change of Sprint 3, then the API that builds packages when the organiser chooses a destination, lets members say which packages work for them, and lets the organiser choose, remove or change a package.

**Branch:** `feat/s3-3-packages-api` · **Time box:** 3 hours · **Depends on:** S3-2 merged · **Issue:** S3-3 · **After merge (Maulik):** `pnpm db:migrate:remote --target preview`, then `--target production`

```text
S3-3  MIGRATION 0002 AND THE PACKAGES API (T9 TO T11, I3, I4)
Branch: feat/s3-3-packages-api   Time box: 3 hours   Issue: S3-3 (Sprint 3 milestone)

CONTEXT
Read AGENTS.md, docs/prompts/sprint-3/README.md (P1 to P12) and the Sprint 2 rules, docs/decisions
/0005 (a to d, g; the Consequences list) and 0004, the S3-2 engine exports (generatePackages,
costPackage, availableChoices), packages/db/src/schema (packages.ts, itineraries.ts, catalogue.ts,
enums.ts), apps/api/src/recommendations (how T9 chooses a destination today), apps/api/src/trips
(transition-trip.ts with beforeDecide, access.ts, actions.ts, router.ts, EVENT_SUMMARIES), and the
security tests (endpoint-inventory.ts, the access matrix, the leak test).
State-machine rows: T9 (shortlisted, destinationSelected, to packages_proposed, entry action
generateAndCostPackages), T10 (packages_proposed, packageRejected, alternativesLeft = 0, to
shortlisted), T11 (packages_proposed, packageAccepted, to package_selected, entry lockPackage), I3
(packageModified, recomputeCost), I4 (packageRejected, alternativesLeft > 0, hidePackage).

GOAL
Migration 0002 exists. Choosing a destination builds and stores the packages atomically with T9.
Any member reads the packages with counts of opinions and their own; members give an opinion; the
organiser chooses (T11), removes (I4 or T10) or changes (I3) a package. Every route is in the
inventory, the access matrix and the leak test.

STEPS
1. Migration 0002 with drizzle-kit (P5), schema first: package_decision unique (package_id,
   user_id); trip_package.label text not null default ''; itinerary.summary text null;
   itinerary.reasons jsonb not null default '[]'::jsonb; itinerary_item.unverified_reason text null.
   Read the SQL in full; no other change. Update AGENTS.md section 10's migration line.
2. Shared (packages/shared/src/api/packages.ts, exported from index.ts):
   - PackageCostLine { category, label, amountInr, provenance: 'curated' | 'estimated' }.
   - TripPackageView { id, label, transportMode, stayTier, rooms, startDate, endDate, totalInr,
     perPersonInr, overBudget, overByInr, status, lines, opinions: { works, notForMe, members },
     mine: 'accept' | 'reject' | null }.
   - PackagesResponse { destination { slug, name, state }, n, note: string | null, packages:
     TripPackageView[] (proposed and accepted only, in label order Saver, Balanced, Quickest,
     Comfort), choices: { transportMode, stayTier }[] (for Change) }.
   - PackageOpinionInput { decision: 'accept' | 'reject' }; ChangePackageInput { transportMode?,
     stayTier? } with at least one field.
   - Error codes PACKAGE_NOT_FOUND (404), PACKAGE_NOT_PROPOSED (409), PACKAGE_CHOICE_UNAVAILABLE (422).
   - TripDetail gains selectedPackage: { id, label, totalInr, perPersonInr } | null.
3. apps/api/src/packages/ (service and repository; routes in apps/api/src/trips/router.ts):
   a) Inputs loader: one query each for the fare rows (bus, train, car) for the trip's origin hub
      and the destination, the cost rules, the destination's cost columns, its active places, the
      group profile (cap, window, shared activities) and the chosen run's member count. Never one
      query per place.
   b) T9: the existing choose-destination service builds the packages with generatePackages BEFORE
      the lock and inserts trip_package and cost_item rows inside beforeDecide (P7). If the trip
      already has packages from an earlier T9, hide them. Store scheduledPlaceKeys in
      cost_item.source_ref of the activities line (0005 d).
   c) GET /api/trips/:id/packages (any member, excluded included, from packages_proposed onwards).
   d) PUT /api/trips/:id/packages/:packageId/opinion (active member, packages_proposed, package
      proposed): upsert the package_decision row; returns PackagesResponse. Not a state event.
   e) POST /api/trips/:id/packages/:packageId/select (organiser): packageAccepted (T11); in
      beforeDecide the package becomes accepted and the other proposed packages hidden; returns
      TripDetail.
   f) POST /api/trips/:id/packages/:packageId/remove (organiser): alternativesLeft = the other
      proposed packages; packageRejected gives I4 (package hidden) or T10 (back to shortlisted,
      selected_destination_id cleared); returns TripDetail.
   g) PATCH /api/trips/:id/packages/:packageId (organiser, ChangePackageInput): the new pair must be
      in availableChoices, else 422 PACKAGE_CHOICE_UNAVAILABLE; costPackage recomputes; inside
      packageModified (I3) replace the package's values and cost lines and delete its opinions;
      returns PackagesResponse.
   h) tripActions: viewPackages, givePackageOpinion, choosePackage, removePackage, changePackage
      with the roles and states above. EVENT_SUMMARIES: "Asha chose the Saver package", "Asha
      removed the Comfort package", "Asha changed the Balanced package".
4. Security: the five routes in endpoint-inventory.ts; access matrix (organiser-only writes: member
   and excluded 403, non-member 404, anonymous 401; reads: every member 200); leak test: two members
   give different opinions, then each response holds counts and only the caller's own mine.
5. Integration tests (apps/api/src/packages), small fixture catalogue unless stated: T9 stores at
   least 3 packages with 6 lines each whose amounts sum to the total; provenance follows the rows'
   review status; over budget flagged with overByInr; opinions upsert and count; select gives T11
   and hides the rest; remove gives I4 then T10 on the last one, and choosing another destination
   builds fresh packages; change recomputes, clears opinions, and an unavailable pair gives 422; a
   member gets 403 on every organiser write; wrong states give 409; speed: with the real catalogue
   imported, choosing a destination for a 3-member trip from gurugram completes under 1000 ms.
6. run-seed.test.ts stays green (P11). Traceability rows R8 and R14. PR "feat: packages API and
   migration 0002", body starts "Closes #<S3-3>", with one trimmed PackagesResponse and a note for
   Maulik to run pnpm db:migrate:remote on preview and production after merging.

VERIFICATION
Paste the real output of: pnpm db:migrate (local) ; pnpm vitest run --project integration
apps/api/src/packages apps/api/src/security apps/api/src/recommendations apps/api/src/trips
apps/api/src/seed ; pnpm verify ; pnpm vercel-build && pnpm smoke:function ; the speed-test time.
Then pnpm db:reset && pnpm db:seed and pnpm dev: on the Hills shortlist demo, asha requests
recommendations and chooses the first place; paste the trimmed packages JSON (label, mode, tier,
total, per person, provenance per line). Stop every dev server you start.

IF BLOCKED
drizzle-kit wants changes beyond the five listed: stop and paste its SQL. transitionTrip cannot carry
the inserts in beforeDecide: tell me; never write trip.status yourself. Choosing a destination is
slower than 1 s: profile it (look for per-place queries) and report.
```
