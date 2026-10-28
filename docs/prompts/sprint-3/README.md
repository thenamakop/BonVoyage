# Sprint 3 build prompts

Sprint 3 was planned for 28 October to 2 November 2026 with packages only. On 27 October the demo deadline moved: **Monday 2 November is a working end-to-end demo of the whole journey**. Sprint 3 now runs from Tuesday 27 October to Monday 2 November and pulls the core of Sprint 4 (the day plan and its decisions) forward. S3-1 records the new calendar.

**Goal:** after the group picks a destination, it gets at least three costed packages with every line labelled curated or estimated; members say which work for them; the organiser chooses one, asks for a day plan built only from catalogue facts, and accepts, rejects or adjusts it, which finalises the trip. A user can delete their account. Requirements: R8 packages, R14 provenance, R10 (account deletion, #54), R12 grounded day plan, R13 accept, modify or reject, and the R15 speed targets. The rules are in [decision 0005](../../decisions/0005-packages-and-itinerary.md).

## Run order

| Day | Prompt | Time box | Needs merged first | Runs tests against |
| --- | --- | --- | --- | --- |
| Tue 27 | [S3-1 Kickoff: decision 0005, re-plan, backlog](S3-1-kickoff.md) | 45 min | Sprint 2 closed (done) | nothing |
| Tue 27 | [S3-2 Package and day-plan engine (pure)](S3-2-engine.md) | 3 h | S3-1 | no database |
| Tue 27 | [S3-5 Account deletion and admin stage labels](S3-5-account-deletion.md) | 2 h | S3-1 | db-test |
| Wed 28 | [S3-3 Migration 0002 and the packages API](S3-3-packages-api.md) | 3 h | S3-2 | db-test |
| Thu 29 | [S3-4 Packages screen](S3-4-packages-ui.md) | 3 h | S3-3 | no database |
| Thu 29 | [S3-6 Day-plan API: plan, read, accept, reject](S3-6-itinerary-api.md) | 3 h | S3-3 | db-test |
| Fri 30 | [S3-7 Day-plan screen, adjust (I5) and trip history](S3-7-itinerary-ui.md) | 3 h | S3-4, S3-6 | db-test |
| Sat 31 | [S3-8 Demo data, full-journey test, prune, demo script](S3-8-demo.md) | 2 h | S3-7 | db-test |
| Sun 1 | [S3-9 Dry run and Sprint 3 review](S3-9-review.md) | 1.5 h | everything above | preview and production |
| Mon 2 | **Demo** | | | |

Total time boxes: about 21 hours over six days. Two pairs can run side by side (S3-2 with S3-5 on Tuesday, S3-4 with S3-6 on Thursday) because one of each pair never touches the test database.

## Routine

The same as Sprints 1 and 2:

1. Branch from an up-to-date `master` with the branch name in the prompt.
2. Open a fresh agent session and paste the short line I give you, for example: `Read docs/prompts/sprint-3/README.md, then run the prompt in docs/prompts/sprint-3/S3-2-engine.md exactly.`
3. Check the result, open the pull request with the given title and `Closes #<issue>`, wait for `ci`, and merge with `gh pr checks <n> --watch --required; if ($?) { gh pr merge <n> --squash --delete-branch }`.

**Running two prompts at once.** One agent per folder. Give the second agent its own folder with a git worktree:

```powershell
git worktree add ..\TripSync-2 -b feat/s3-5-account-deletion master
cd ..\TripSync-2; pnpm install
```

Open the second session in `TripSync-2`. Only one session at a time may run tests against `db-test` (port 5433): the engine and web prompts run `pnpm test:unit` only and leave the full suite to CI. Remove the worktree after its pull request is merged: `git worktree remove ..\TripSync-2`.

**Your steps between prompts (Maulik only):**

- After S3-3 merges: `pnpm db:migrate:remote --target preview`, then `--target production` (migration 0002).
- Model wording on preview: see docs/prompts/sprint-4/S4-7-live-preview-check.md (needs #121). Until #121, the Vercel function never built the model client, so setting these variables changed nothing; the plan used the catalogue templates, which is fine for the demo.
- After S3-8 merges: `pnpm db:seed --target preview --fresh-demos`.

## Cut order if a day slips

From decision 0005 k: cut itinerary Adjust (I5, inside S3-7) first, then package Change (I3, inside S3-3 and S3-4), then live Gemini wording. Never cut packages, choosing a package, planning, accepting or rejecting the day plan, or account deletion. If Friday slips, S3-8 shrinks to the seed option and the demo script.

## Sprint 3 conventions

Every Sprint 3 prompt says "follow the Sprint 3 conventions". The Sprint 1 and Sprint 2 conventions (`docs/prompts/sprint-1/README.md`, `docs/prompts/sprint-2/README.md`, rules S1 to S10) still apply.

```text
SPRINT 3 CONVENTIONS (apply to every Sprint 3 prompt, on top of Sprint 1 and Sprint 2)

State of the repo (end of Sprint 2, closed 27 Oct 2026)
- Sprint 2 rules S1 to S10 still apply. Endpoints: 30, listed in
  apps/api/src/test/endpoint-inventory.ts. T9 (destinationSelected) reaches packages_proposed and
  stores trip.selected_destination_id; nothing is built there yet.
- Engine: costs (carSharePerPersonOneWay, cheapestOneWay, composeEstimate), feasibility, scoring,
  group profile, trip-state, itinerary/validate.ts (validateItinerary).
- Integrations: routing, cache, quota, llm (createLlmClient, GeminiLlmClient, FixtureLlmClient),
  itinerary/prompt.ts (buildItineraryPrompt, assertNoPersonalData).
- Shared: FactSheet and ItineraryOutput (packages/shared/src/itinerary.ts), COST_CATEGORIES,
  DECISIONS, PACKAGE_STATUSES, ITINERARY_STATUSES, ITINERARY_ITEM_KINDS, Provenance.
- Tables trip_package, cost_item, package_decision, itinerary, itinerary_item exist (migration
  0000) and are empty.
- Catalogue: A 50/50, B1 136/137, B2 85/116, C 202/276 verified; every destination has places of
  interest (neemrana 3, ranthambore 5, the rest 6 or more).
- Demo: four seeded demo trips (docs/demo/sprint-2-demo.md); apps/api/src/seed/run-seed.test.ts
  guards their outcomes.

Sprint 3 rules
P1  docs/decisions/0005-packages-and-itinerary.md and 0004 are the rules. A case they do not
    cover: stop and ask; never invent a rule in code.
P2  Engine purity: packages/engine/src/packages and packages/engine/src/itinerary/plan* take plain
    data and return plain data, with 100 per cent branch coverage (S1).
P3  Money: each cost line is rounded up to whole rupees once; a total is the sum of rounded lines;
    per person = ceil(total / n). Every price on screen shows the group total, the per-person
    figure and the word "estimate".
P4  Provenance on every cost line (curated or estimated, 0005 d) and every day-plan item (verified
    or not, with the reason, 0005 f). Shown as text, never by colour alone.
P5  Only S3-3 changes the schema (migration 0002). Generated by drizzle-kit, SQL read in full.
    Remote databases change only through pnpm db:migrate:remote, run by Maulik.
P6  The language model is reached only through packages/integrations (createLlmClient). Tests run
    with LIVE_APIS=off. Prompts carry facts only (assertNoPersonalData). The model id comes from
    GEMINI_MODEL. The model never supplies a time, a place or an amount (0005 e, f).
P7  Slow work (building packages, planning, the model call) happens outside the lock; inserts happen
    inside transitionTrip's beforeDecide with a staleness check. Never write trip.status.
P8  Privacy: package opinions are shown as counts; a member sees only their own. A day plan holds
    no member data. Group interests use only activities chosen by 2 or more members.
P9  Every new endpoint goes into endpoint-inventory.ts and the access matrix in the same PR, and
    into the leak test when it returns anything member-specific.
P10 Speed (R15): choosing a destination (with its packages) under 1 s locally; a day plan under 2 s
    with templates and under 30 s with the model (20 s timeout).
P11 Demo first: every PR keeps the Sprint 2 demo trips working (run-seed.test.ts stays green) and
    leaves the dashboard wording consistent from step 1 to step 7.
P12 One agent per folder. A second agent works in a git worktree. Only one session at a time runs
    tests against db-test; engine and web prompts run pnpm test:unit and leave the rest to CI.
```

## When Sprint 3 is done

S3-9 has me (Claude in Cowork) drive the dry run on preview in two browsers, as on 27 October, and run the production checks from #94 if you have a second account. I then write the review prompt with the real results.
