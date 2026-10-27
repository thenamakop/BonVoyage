# S3-8: Demo data, full-journey test, prune and the Monday demo script

Makes Monday's demo repeatable: preview can be reset to fresh demo trips, one automated test walks the whole journey from sign-up to a finalised trip, the catalogue import can remove places that left the CSV, and a ten-minute script tells anyone exactly what to click and say.

**Branch:** `feat/s3-8-demo` · **Time box:** 2 hours · **Depends on:** S3-7 merged · **Issue:** S3-8 · **After merge (Maulik):** `pnpm db:seed --target preview --fresh-demos`, and `pnpm catalogue:import --target preview --prune` then `--target production --prune` (typed confirmation)

```text
S3-8  DEMO DATA, FULL-JOURNEY TEST, PRUNE AND THE MONDAY DEMO SCRIPT
Branch: feat/s3-8-demo   Time box: 2 hours   Issue: S3-8 (Sprint 3 milestone)

CONTEXT
Read AGENTS.md, docs/prompts/sprint-3/README.md (P1 to P12), docs/demo/sprint-2-demo.md,
apps/api/src/seed (run-seed.ts, demo-trips.ts, run-seed.test.ts) and the seed CLI behind pnpm
db:seed, apps/api/src/e2e/group-flow.test.ts, packages/db/scripts/catalogue-import.ts and its tests,
docs/sprints/catalogue-c1-pois-2026-10-26.md (item 16: two stale POI rows), and the screens from
S3-4 and S3-7.
Preview cannot be reset today: the seed only adds missing trips, and each demo trip works once.

GOAL
pnpm db:seed --fresh-demos recreates every demo trip on local or preview (never production); a
full-journey test passes from sign-up to finalised; pnpm catalogue:import --prune removes places of
interest that are no longer in pois.csv; docs/demo/sprint-3-demo.md is the Monday script.

STEPS
1. Seed --fresh-demos: deletes every trip whose organiser is a demo user (email ending
   @demo.bonvoyage.test) and recreates the demo trips; demo users keep their accounts and password;
   refuses --target production exactly as the seed does today; prints what it deleted and created.
   Without the flag the seed behaves as now.
2. "Long weekend in the hills" (seeded at Collecting preferences, Meera pending) is the
   full-journey trip: check that once Meera submits, recommendations give a shortlist whose first
   place has at least 3 packages and a day plan with at least one activity on every full day. Extend
   run-seed.test.ts to assert this through the service layer (Meera submits, recommend, choose the
   first place, choose the Saver package, plan, accept: finalised). If the first place cannot meet
   it, change only that trip's seeded preferences or dates (never the catalogue) and say what
   changed.
3. apps/api/src/e2e/full-journey.test.ts: over HTTP, three new users: sign up, create a trip, invite
   by link, join, submit preferences, recommend, choose, opinions, choose a package, plan, accept;
   asserts every transition T1 to T14 on the way and the dashboard step at each stage; logs the time
   of each slow step (recommend, choose, plan).
4. catalogue:import --prune: after the upsert, delete places of interest whose (destination,
   poi_key) is not in pois.csv, listing them first; itinerary items that pointed at them keep their
   text (the foreign key sets null). Only places of interest; nothing else is pruned. Production
   still needs the typed confirmation. Tests in the import test file.
5. docs/demo/sprint-3-demo.md, ten minutes, two windows (Asha the organiser, Meera a member), every
   click and on-screen line written exactly as the app shows it:
   0) (1 min) sign up a new account and create a trip to show the start, then switch to Asha;
   1) (1 min) Long weekend in the hills: Meera submits her preferences; the trip becomes ready;
   2) (2 min) Get recommendations: the group profile, the shortlist, each person's own "For you"
      line; Asha chooses the first place;
   3) (2 min) Packages: compare, provenance badges, Meera says one works, Asha changes one and
      chooses one;
   4) (2.5 min) Plan the days: verified and unverified items, the source line; Asha swaps a place
      and accepts; the trip is finalised and appears under "Past and finalised trips";
   5) (1 min, optional) Tight budget demo and Date clash demo from the Sprint 2 script, if time;
   6) (30 s) Account deletion on the throwaway account from step 0.
   Plus "Before you start" (reset with --fresh-demos, the two windows, the password is
   SEED_DEMO_PASSWORD and never written down), "Reset" and "If something looks different".
6. README: link the new demo script. Traceability R2, R8, R12, R13, R15. PR "feat: fresh demos,
   full-journey test, prune and the Monday demo script", body starts "Closes #<S3-8>", with Maulik's
   post-merge commands.

VERIFICATION
Paste the real output of: pnpm vitest run --project integration apps/api/src/seed apps/api/src/e2e
packages/db/test ; pnpm verify ; pnpm db:reset && pnpm db:seed && pnpm db:seed --fresh-demos (local;
the printed summary) ; pnpm catalogue:import --target local --prune (the list it prints). Stop every
dev server you start. Never run anything against Neon in this task.

IF BLOCKED
Deleting demo trips would touch a trip a non-demo user belongs to: stop and report it. The
full-journey trip cannot reach a day plan with real data without changing the catalogue: stop and
report which rule fails.
```
