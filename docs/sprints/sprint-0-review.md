# Sprint 0 review (8 to 12 October 2026)

**Result: Pass.** All 13 gate items pass. Three spill issues (#43, #44, #45) were opened for items that needed Maulik's confirmation and were closed the same day once the evidence arrived.

## Gate

| Item | Check | Evidence | Result | Follow-up issue |
| --- | --- | --- | --- | --- |
| G1 | Baseline, design, all decisions Accepted | `git grep "^Status:" docs/decisions` → 14/14 `Status: Accepted`; `ls docs/baseline docs/design` → SRS, MoSCoW, design PNGs/drawio present | pass | — |
| G2 | `design-baseline-v1` tag on first baseline commit | `git log --diff-filter=A -- docs/baseline` → `2fbd3e9 chore: unpack docs layout… (#1)`; Maulik confirmed; tag pushed (`git rev-parse refs/tags/design-baseline-v1` → resolves) | pass | #43 (closed) |
| G3 | Fresh clone installs, migrates, seeds, verifies | `bv-gate` clone: `pnpm install --frozen-lockfile` ok, `db:up` healthy, `db:migrate` applied, `db:seed` → 4 users, 44 destinations, trip in collecting_preferences, `pnpm verify` exit 0 (193 tests + 2 todo) | pass | — |
| G4 | CI green on master; PR-only with required check | `gh run list --branch master` → last 5 all success; ruleset `master` (24831622): active, `pull_request`+`required_status_checks` (ci), no bypass actors | pass | — |
| G5 | Preview and production answer /api/health from Neon | production `curl -s https://bonvoyage-orpin.vercel.app/api/health` → `{"status":"ok","db":"ok"}` 200 in 0.52 s; preview `/api/health` checked by Maulik → ok | pass | #44 (closed) |
| G6 | No pending Neon migrations | `db:migrate:remote --status`: preview 1 recorded / 0 pending; production 1 recorded / 0 pending | pass | — |
| G7 | `catalogue:check` 0 errors; stage progress; CAT issues | 0 errors, 42 warnings, 1 info; stage A 0/50, B 0/253, C 0/21; issues #37 (A), #38 (B), #39 (C) open | pass | — |
| G8 | Trip state machine 100 % branch coverage | `vitest --coverage.include=trip-state.ts --thresholds.100` → 149 tests pass; statements/branches/functions/lines all 100 % | pass | — |
| G9 | Scoring spec + golden fixture committed, self-check passes | `docs/specs/scoring.md`, `packages/engine/src/scoring/golden.{fixture,test}.ts` present; golden.test.ts 4 pass + 2 todo | pass | — |
| G10 | Spike notes S2 and S4 merged; S1, S3 recorded not run | `ls docs/spikes` → `S2-grounded-itinerary.md`, `S4-deploy-and-sessions.md`; S1 skipped (no routing key, ADR-007), S3 skipped (curated data is the decision, ADR-006) | pass | — |
| G11 | No key or .env in history; Gemini key rotated | `git log -p --all \| grep -cE 'AIza…|AQ\.…'` → 0; `git log --all -- .env .env.neon` → empty; Maulik confirmed the Gemini key was rotated | pass | #45 (closed) |
| G12 | Wireframes planned as Sprint 1 issue | issue #36 "Wireframes for the five SRS 3.1.1 screens…" open, on S1 board, estimate 2 | pass | — |
| G13 | Sprint 1 issues estimated, assigned, on board | milestone "Sprint 1 (12-18 Oct)": 14 issues, all assigned thenamakop; project items: S1 tasks estimated (5/3/2 pts), Sprint field set | pass | — |

## What was built

- #1 chore: unpack docs layout from BonVoyage_docs.zip and ignore .env.* files
- #2 docs/s0 decision records
- #3 chore: remove duplicate docs and archive
- #4 chore: scaffold monorepo (S0-2)
- #5 chore: CI, Vercel build output and Neon migration script (S0-3)
- #7 docs: rewrite README and record production URL (S0-3 docs)
- #8 Update README to remove deploy date and revise text (manual edit)
- #9 feat: destination catalogue tooling and draft data (S0-4)
- #10 feat: database schema, Better Auth and demo seed (S0-5)
- #40 chore: backlog, labels and Sprint 1 issues
- #41 feat: trip state machine and transition service (S0-6)
- #42 feat: Gemini itinerary client, validator and grounding spike (S0-7)

## Deviations and decisions

- `docs/decisions/0002-catalogue-format.md`: CSV+JSON catalogue, three-stage verification, empty `source_url` allowed in drafts.
- `docs/decisions/0003-schema-deviations.md`: `trip_package` (reserved word), `user_profile` table (Better Auth owns `user`), `origin_hub_id`, link invitations, `trip_transition` audit, `cost_rule` table, `destination.active`, `fare_fallback` name.
- S0-4 ran before S0-5 on purpose: the schema imports the catalogue rows.
- S0-3 deploy proof: Build Output API, 23 s build, 2.42 MB function, first `/api/health` 143 ms cold, ~150 ms warm.
- S2 spike findings (`docs/spikes/S2-grounded-itinerary.md`): grounding holds (verifiedRatio 1.00 in 11/12 runs, injected ₹9,999 caught) but every output failed `DAY_TOO_LONG`; gemini-3.8-flash median 129 s vs gemini-3.5-flash-lite 3.3 s; recommendation is to default to flash-lite and adjust the itinerary prompt for travel days rather than relax the validator.
- `pnpm dlx auth@1.7.7` used instead of `npx`; `drizzle.config.ts` fixed for `import.meta.dirname`; `@bonvoyage/db` gained `./schema` and `./remote-target` exports.

## Top three risks for Sprint 1

1. **Catalogue verification load** — 324 draft rows across stages A/B/C due 18 Oct / 25 Oct / 1 Nov while feature work runs. Owner: Maulik. Mitigation: CAT-A issue #37 is on the S1 board with estimate 5; verify in batches per the catalogue README and never mark verified without a checked source.
2. **Gemini free-tier quota and latency** — flash has a 20 requests/day/model quota and 129 s median; itinerary generation in S4 depends on the flash-lite fallback and caching. Owner: Maulik. Mitigation: default to gemini-3.5-flash-lite per the S2 note, cache per (trip, package), fix the travel-day prompt before S4.
3. **Sessions on preview/phone (S4 spike evidence)** — Better Auth cookies must survive Vercel preview URLs on phones before auth UI ships. Owner: Maulik. Mitigation: issue #29 includes checking sessions from a phone on a preview; complete the G5 preview /api/health check.

## Time per prompt

Wall-clock is measured as first commit on the PR branch to merge time (`gh pr view <n> --json commits,mergedAt`). It includes waits and breaks, so it overstates effort where a session idled. Maulik's active-time notes follow each row. Sprint 0 slipped one day (ended 12 Oct instead of 11 Oct) because of the Sunday pause.

| Prompt | PR | Wall-clock (includes waits and breaks) | Active-time note (Maulik) |
| --- | --- | --- | --- |
| S0-1 decision records | #2 | ~0.1 h | ran overnight on 10 Oct; about 1 h active |
| S0-2 scaffold | #4 | ~0.4 h | about 45 min active |
| S0-3 CI and deploy | #5 | ~3.0 h | about 3 h, including Vercel and GitHub dashboard steps |
| S0-4 catalogue | #9 | ~2.3 h | paused over Sunday 11 Oct — wall-clock is not real effort; estimate 2.5 h |
| S0-5 schema, auth, seed | #10 | ~2.5 h | about 3 h; ran in parallel with S0-8 on 12 Oct |
| S0-6 state machine | #41 | ~0.1 h | (commit-to-merge window; work happened in the same session) |
| S0-7 itinerary spike | #42 | ~0.1 h | mostly waiting on Gemini — 129 s per call and rate limits, not work |
| S0-8 backlog | #40 | ~0.1 h | about 1.5 h active, plus waiting for answers |
| S0-9 exit gate | #46 | ~1 h (estimate) | this review |
