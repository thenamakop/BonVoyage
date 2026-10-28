# S4-10: Packages note without rebuilding packages

`getPackages` in `apps/api/src/packages/service.ts` calls `generatePackages(input)` on every read only to compute the note "Only N packages could be costed for <destination>" (kept on purpose in #112, because stored rows may have been removed or changed). That costs and plans up to four packages per GET. The note can come from a pure count instead.

**Branch:** `refactor/123-packages-note` · **Time box:** 45 minutes · **Depends on:** S4-5 merged · **Issue:** #123 · **Cut:** first after S4-11

```text
S4-10  PACKAGES NOTE WITHOUT REBUILDING EVERY PACKAGE
Branch: refactor/123-packages-note (from fresh master)   Time box: 45 minutes
Issue: the "GET /packages: compute the note without rebuilding packages" issue.
Follow the Sprint 4 conventions (Q1 to Q10) and P2 (engine purity, full branch coverage).

CONTEXT
Read packages/engine/src/packages/generate.ts (generatePackages: specs Saver, Balanced, Quickest,
Comfort; the Quickest-becomes-Comfort and "Comfort by car" rules; the note when fewer than 3
packages are built), cost.ts (costPackage returns null when the mode or the stay rate is missing:
modeAvailable, farePerPerson, the destination's stay tiers), apps/api/src/packages/service.ts
(getPackages, near "generatePackages only for the note") and packages.test.ts.

GOAL
The note is identical for every input, and a GET /packages never calls costPackage or planDays.

STEPS
1. Engine: export costablePackageCount(input): the number of packages generatePackages would
   build, decided only from mode availability and stay-rate presence, applying the same spec and
   relabel rules (no costing, no planning). Export packagesNote(input, count) producing exactly
   the current sentence, and make generatePackages use it so the wording has one source.
2. Property test: for every destination in the real catalogue from gurugram and delhi, with 2, 3
   and 8 members and 1 and 2 nights (use the catalogue fixture the engine tests already load, or a
   small integration test if only the database has it), costablePackageCount(input) equals
   generatePackages(input).packages.length. Paste the number of cases.
3. API: getPackages uses costablePackageCount and packagesNote; remove the generatePackages call
   from the read path. A test spies on generatePackages/costPackage (or counts calls through an
   injected engine) to prove a GET makes none.
4. PR "refactor: compute the packages note without rebuilding packages", body "Closes #123".

VERIFICATION
Paste: the property-test case count; pnpm vitest run --project unit packages/engine/src/packages ;
pnpm vitest run --project integration apps/api/src/packages ; pnpm format:check; pnpm lint;
pnpm typecheck; pnpm test summary; the CI result.

IF BLOCKED
The count cannot be decided without costing (a case where costPackage returns null for a reason
other than a missing mode or stay rate): stop and name the case.
```
