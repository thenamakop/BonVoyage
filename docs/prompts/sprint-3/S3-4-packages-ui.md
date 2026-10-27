# S3-4: Packages screen

The screen the group sees after the organiser chooses a destination: three or more packages side by side, each itemised with curated or estimated labels, members saying which work for them, and the organiser choosing, removing or changing one.

**Branch:** `feat/s3-4-packages-ui` · **Time box:** 3 hours · **Depends on:** S3-3 merged · **Issue:** S3-4 · **Tests:** `pnpm test:unit` only (can run beside S3-6 in a worktree)

```text
S3-4  PACKAGES SCREEN
Branch: feat/s3-4-packages-ui   Time box: 3 hours   Issue: S3-4 (Sprint 3 milestone)

CONTEXT
Read AGENTS.md, docs/prompts/sprint-3/README.md (P1 to P12), docs/decisions/0005 (c, d, g),
packages/shared/src/api/packages.ts (S3-3), the web app's shortlist screens
(apps/web/src/pages/Trips/shortlist: ShortlistPage, DestinationCard, the confirm pattern), the
dashboard (apps/web/src/pages/Trips/dashboard and its wording.ts), src/components/ui, src/lib/format.ts
(formatInr, formatDate, perPersonShare), apps/web/src/features/recommendations/api.ts (query and
mutation pattern) and docs/wireframes.

GOAL
/trips/:id/packages shows every proposed package with its itemised costs and provenance, opinions as
counts, the member's own opinion buttons, and the organiser's Choose, Remove and Change actions; the
dashboard links to it at step 5 and shows the chosen package at step 6. Works at 360 px, keyboard
only, meaning never by colour alone.

STEPS
1. apps/web/src/features/packages/api.ts: usePackages(tripId), useGiveOpinion, useChoosePackage,
   useRemovePackage, useChangePackage (TanStack Query; invalidate the trip and packages queries on
   success; show the API's error message in an Alert).
2. apps/web/src/pages/Trips/packages/PackagesPage.tsx and PackageCard.tsx:
   - Header: "Packages for <Destination>", "From <origin> · <dates> · <n> people", the note when
     present.
   - Card: label as the title; "<Mode> · <Tier> stay · <rooms> rooms"; the total as "₹X for the
     group", "about ₹Y each", "estimate"; when over budget "₹Z over the group budget" with an
     icon and text; a collapsible "What it costs" list with one row per line: label, amount and a
     text badge "Curated" or "Estimate" (0005 d); "<works> of <members> say it works".
   - Member buttons: "Works for me" and "Not for me", pressed state shown by aria-pressed and text
     ("You said it works"), changeable.
   - Organiser: "Choose this package" with the confirm "Choose the <label> package? Everyone moves
     on to the day plan." then "Choose <label>"; "Remove" with the confirm "Remove the <label>
     package?", or for the last package "This is the last package. Removing it sends the trip back
     to the shortlist."; "Change" opening two selects (transport mode, stay tier) limited to
     choices, saving with "Save changes" and the note "Saving clears everyone's opinion on this
     package."
   - A package card never shows a member's name.
3. Dashboard and routing: register the route; at packages_proposed the dashboard card reads
   "Compare the packages and say which work for you." with "See the packages"; at package_selected
   it reads "<Label> package chosen: ₹X for the group, about ₹Y each (estimate). The day plan comes
   next." Update wording.ts and its test. TripDetail.selectedPackage drives it.
4. Tests (Vitest + Testing Library, the existing fixtures): the page renders three packages with
   their lines and badges; opinion buttons toggle and call the API; a member sees no organiser
   actions; Choose, Remove (normal and last) and Change confirm flows call the right mutations; the
   over-budget text; the 360 px layout has no horizontal scroll (the existing layout test helper if
   there is one); axe or the repo's accessibility checks if present.
5. Screenshots at 360 px and desktop for the PR (local dev with the seeded demo: choose a
   destination on Hills shortlist demo first). Traceability R8 and R14 (web tests). PR "feat:
   packages screen", body starts "Closes #<S3-4>".

VERIFICATION
Paste the real output of: pnpm vitest run --project web apps/web/src/pages/Trips
apps/web/src/features/packages ; pnpm lint ; pnpm typecheck ; pnpm test:unit. Attach the two
screenshots. Stop every dev server you start.

IF BLOCKED
The API response lacks something the screen needs: stop and say what; do not compute costs in the
browser. A wording question the prompt does not answer: use the closest existing dashboard wording
and list it in the PR.
```
