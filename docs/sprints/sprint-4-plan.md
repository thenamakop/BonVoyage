# Sprint 4 plan: hardening (3 to 7 November 2026)

**Status: proposed. Maulik approves it before any Sprint 4 build prompt is written.**

Sprint 4 has no new requirements ([re-plan](replan-2026-10-27.md), RUNBOOK sprint map): it hardens what Sprint 3 shipped, closes the requirement issues with evidence, and carries the [Sprint 3 review](sprint-3-review.md)'s "To finish" list. Every item below cites a command output or a file and line, gathered on 28 October 2026 from `master` at `64bd978` (after #115). The raw outputs are in the pull request that adds this file.

## Findings that shape the plan

1. **No deployment can call Gemini today.**
   - `apps/api/src/server.ts:19-26` creates the model client when `LIVE_APIS=on`, but `apps/api/src/vercel-entry.ts` never passes `llm` to `createApp`. Preview and production always use the catalogue templates, whatever the Vercel settings.
   - The Sprint 3 README's optional step ("set `LIVE_APIS=on` … on the preview environment in Vercel and redeploy") would have had no effect. **The two disagree; this plan does not choose (decision D4).**
   - The model call is also not quota-guarded (`withQuota` is used only in `packages/integrations/src/routing*`) and not cached. AGENTS.md rule 4 requires both for every outbound call. `packages/integrations/README.md:38` already says to wrap it in Sprint 4.
2. **The pg warning comes from the catalogue import.** "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0" appears twice in `pnpm verify`. Run file by file, only `apps/api/src/admin/admin.test.ts` and `apps/api/src/security/access-matrix.test.ts` raise it, and both run a catalogue import. The path:
   - `importCatalogue` opens `db.transaction`;
   - it calls `stagesOf(tx)` at `apps/api/src/admin/service.ts:92`;
   - that calls `stageCounts(tx)` at `apps/api/src/admin/repository.ts:31`, which runs five SELECTs in one `Promise.all` on the single transaction client.

   `catalogueStatus` (`service.ts:111`) runs the same kind of `Promise.all` on the pool, which is allowed. Node prints a deprecation once per process, so a second site in the same files could be hidden until this one is fixed.
3. **Package cards show no travel time.** #18's first criterion is "Supported transport modes show estimated group cost and travel time". `PackageCard.tsx` and the shortlist show cost and distance but no duration; only the day plan's leg times imply it.
4. **At 360 px the Sprint 3 screens fit.** Headless Chrome at 360 × 780, locally:
   - packages, with the cost lines and a Change form open: `scrollWidth 360`, no element past the edge;
   - day plan, with the Swap list open: the same, and no tap target under 44 px.

   One gap: the four "What it costs" `<summary>` toggles are **268 × 20 px**, under the 44 px target the `Button` component meets (`min-h-11`). Keyboard use was not tested.
5. **Catalogue: no rows were verified during Sprint 3.** `pnpm catalogue:check`: A 50/50, B1 136/137, B2 85/116, C 202/276; 0 errors, 3 warnings. The draft rows:
   - **B1 (1):** Sariska destination costs.
   - **B2 (31):** Gurugram train fares to Agra, Amritsar, Bharatpur, Bundi, Gwalior, Jim Corbett, Kurukshetra, **Mathura**, Orchha, Ranthambore and **Vrindavan**; Delhi train to Jim Corbett; bus fares (Gurugram, Delhi or both) to Auli, Chail, Dalhousie, Dehradun, Jaipur, Jim Corbett, Kasauli, Kasol, Orchha, Ranthambore, Rishikesh and Sariska.
   - **C (74 POIs over 37 destinations):** for example Chakrata's **Tiger Falls**, Bikaner's Camel Research Centre and Lalgarh Palace, Mathura's Government Museum, Bundi 5, Udaipur 5.
   - `--require b1` gives 1 error, `--require b` 32 and `--require c` 106.
6. **Draft rows that touch the demo trips.**
   - **Tiger Falls** is the demo's deliberate "Not verified" item (script step 4.4), and `run-seed.test.ts` asserts it. Verifying it changes the script and that test in the same PR.
   - The **Gurugram train fares to Mathura and Vrindavan** feed the Tight budget diagnostic (step 5.2: "about ₹6,600 / ₹6,730 over") and Round 2's figures. A verified value that differs changes those lines and the seed test's guard.
   - Bikaner's two draft POIs matter only if Bikaner is planned, and the demo stops before that.
7. **No TODO or FIXME** in `apps` or `packages`. The only "Sprint 4" mentions are in `packages/integrations/README.md`: lines 3 and 38 (wrap Gemini in the quota guard) and line 55 (the Gemini SDK adds 1,021,258 bytes to the function bundle).
8. **`GET /packages` rebuilds packages for the note.** `getPackages` (`apps/api/src/packages/service.ts`) runs `generatePackages` on every read only for the "Only N packages could be costed" note (#112 kept it on purpose). The database reads are needed anyway for `choices` and the cap, so the waste is CPU only: up to four `costPackage` and `planDays` runs. The whole destination choice measures 42 ms.
9. **The web bundle is 596 kB.** Vite warns above 500 kB. This is not a correctness issue.

## Requirement issues still open

| Issue | What is left | Proposal |
| --- | --- | --- |
| #18 R8 packages | Travel time on package cards (finding 3). The other four criteria are met: dry run steps 3 and 5, `packages.test.ts`, #112. | Item 3, then close with evidence |
| #20 R10 privacy and deletion | All five criteria have evidence: `preferences.test.ts` and `no-leak.test.ts`; #94 on production; Better Auth hashes (`auth.test.ts`); `privacy.md`; deletion in #105 and #111 and dry run step 6. #116 is about what aggregates reveal in 2-member groups. | Close now, or keep open until #116 is decided (decision D2) |
| #21 R11 persistence (no milestone) | Nothing: `schema.test.ts` (cascade, constraints), the `--fresh-demos` no-orphan test, the admin import. | Close with evidence |
| #22 R12 day plan | "The model receives verified structured trip facts" is met only in tests and locally. Deployments never call the model (finding 1). Everything else is met (dry run step 4). | Depends on D4 |
| #23 R13 decisions | **Sources disagree.** #23 says "**A member** can accept … modify, **reorder** or remove … reject". Decision 0005 h says the organiser decides and members only read, and there is no reorder (I5 is remove or replace). The decisions rank above the issue text (AGENTS.md section 2), but this plan does not resolve it. | Decision D3 |
| #24 R14 provenance | Nothing: routing falls back curated then estimate; the wording falls back to templates; every line and item is labelled (dry run steps 3 and 4). | Close with evidence |
| #25 R15 (Buffer) | Not measured: "95% of interactive requests under 3 s" under load; "itinerary within 30 s for up to eight members" with the model. Not met: "repeated provider responses are cached" for the model. | Leave on Buffer; items 6 and 7 feed it |
| #38 catalogue B | B1 1 row; B2 31 rows. Its criterion `--require b` needs all of B2, while its title says B2 is best effort. | Maulik verifies; decision D5 on the criterion |
| #39 catalogue C | 74 POIs. `--require c` also requires B2 (106 errors). | Maulik verifies; D5 |
| #116 two-member bounds | Options below (D1). | Maulik decides first |

## Plan

Sizes: **S** is up to 1 hour, **M** up to 3 hours, **L** more than 3 hours. "Agent" means a build prompt; "Maulik" means work only Maulik can do (verifying rows, Vercel settings, decisions).

| # | Item | Issue | Why | Size | Acceptance check | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Fixes from the Monday demo | new, per defect | The demo is 2 November; Sprint 4 starts the next day | S to M each | Each defect has a failing-then-passing test; the demo script line matches the screen | The demo |
| 2 | Run the catalogue import's stage counts one after another inside the transaction | new | Finding 2; pg 9 removes the behaviour | S | `pnpm verify 2>&1 \| Select-String "already executing"` prints nothing; `admin.test.ts` passes | — |
| 3 | One-way travel time on each package card | #18 | Finding 3; #18's first criterion | S | `PackagesPage.test.tsx` asserts the mode and duration line (for example "Train · 3 h 30 min each way"); text, not colour | — |
| 4 | "What it costs" toggle at least 44 px tall | new | Finding 4 | S | A test asserts the summary's `min-h-11`; the 360 px audit shows no target under 44 px | — |
| 5 | Two-member bounds | #116 | Production observation; privacy rule (AGENTS.md section 12) | S (document) to M (hide) | Per D1: `privacy.md` and its tests updated, or `no-leak.test.ts` asserts the hidden bounds for 2 members | D1 |
| 6 | Model wording on deployments: create `llm` in `vercel-entry.ts`, wrap the call in `withQuota` with a daily limit, and cache it | new | Finding 1; AGENTS.md rule 4; integrations README line 38 | L | Integration test: over the limit the plan says "Planned from the BonVoyage catalogue" with no model call; a repeated identical fact sheet is served from the cache; the bundle size is reported | D4; a new env var for the limit and a cache table need Maulik's approval |
| 7 | Preview check with `LIVE_APIS=on` | new | Finding 1; the Sprint 3 review's "not exercised" | S | On preview: one plan reads "Written with … from catalogue facts" and passes `validateItinerary`; a forced failure (bad key) still gives a catalogue plan | 6; Maulik sets the key in Vercel **Preview only** |
| 8 | Verify the remaining catalogue rows | #38, #39 | Finding 5; B2 is due 5 November | Maulik, M to L | `pnpm catalogue:check --require b1` exits 0; B2 and C counts rise; `run-seed.test.ts` stays green, or the script and test are updated in the same PR | D5; Tiger Falls and the Mathura and Vrindavan train fares follow finding 6 |
| 9 | Close the requirement issues with evidence | #18, #20, #21, #22, #24 | Sprint 3 review "To finish" | S | Each issue gets a comment citing tests and dry-run lines, then closes; `docs/traceability.md` matches | 3 for #18; D2 for #20; D4 for #22 |
| 10 | Build the `GET /packages` note without rebuilding every package | new | Finding 8 | S | The note is unchanged in `packages.test.ts`; `generatePackages` is not called on a read | — |
| 11 | Split the web bundle (lazy-load the trip screens) | new | Finding 9 | S | `pnpm build` prints no chunk-size warning; web tests pass | — |
| 12 | Sprint 4 review | new | Gate before the Buffer | S | `docs/sprints/sprint-4-review.md` with outputs | All above |

### Proposed order (five working days)

| Day | Agent | Maulik |
| --- | --- | --- |
| Tue 3 Nov | 1 (demo fixes), 2 (pg warning) | Decisions D1 to D5 |
| Wed 4 Nov | 3 (travel time), 4 (toggle size), 5 (#116 per D1) | 8 (catalogue) |
| Thu 5 Nov | 6 (model wiring, quota, cache) | 8 (B2 due today) |
| Fri 6 Nov | 7 (preview check), 9 (close issues) | Vercel Preview key for 7 |
| Sat 7 Nov | 10 and 11 if time allows, 12 (review) | — |

### Cut first if time runs short

1. Item 11 (bundle split).
2. Item 10 (the packages note).
3. Items 6 and 7 (model wording on deployments). This is the last entry in decision 0005 k. Without it, deployments keep the catalogue templates, and #22's first criterion is met in tests only (D4).
4. B2 rows beyond those that touch the demo trips (item 8).

Never cut: demo fixes (1), the pg fix (2), #18's travel time (3), and the #116 decision (5).

## Decisions Maulik must make

- **D1, #116 (two-member groups).** The options:
  - (a) Hide the window and budget bounds below 3 members. R4 needs the common window (`privacy.md` line 42, decided 26 October), so this reverses that decision for 2-member groups.
  - (b) Widen the rounding, for example to ₹1,000 or ₹2,000. This blurs but does not remove the inference, and it changes `no-leak.test.ts` and `recommendations.test.ts`.
  - (c) Document only: add the budget band's 2-member inference next to the window note in `privacy.md` and keep the behaviour.

  Any option changes the privacy rules, so it is Maulik's call.
- **D2, #20.** Close it now with the evidence, or keep it open until #116 is settled.
- **D3, #23.** The issue says members can accept, modify, **reorder** and reject. Decision 0005 h says the organiser decides and members read, and reorder was not built. Either amend #23 to match 0005 h and close it, or add member decisions and reorder. The second option is a state-machine and privacy change.
- **D4, model wording on deployments.** Build items 6 and 7, accepting the Gemini SDK (about 1 MB) in the function and a new limit env var (and possibly a cache table). Or keep deployments on templates for submission, and record in #22 that the model path is tested but not deployed. **Also correct the Sprint 3 README's preview step either way.**
- **D5, catalogue criteria.** #38's check is `--require b`, which needs all 31 B2 fares, although B2 is "best effort". Either keep it, or change #38's check to `--require b1` and track B2 separately. #39 cannot pass `--require c` until B2 is complete.
- **D6, R17 (fairness across rounds) and R18 (voting).** Proposed: **out**, as the re-plan (line 24), ADR-010 and the RUNBOOK (line 433) already say. Both are Could Have. Feature freeze is 8 November, and neither has a design.

## Issues I would create (not created yet)

1. "Catalogue import: stage counts run in parallel on one transaction client (pg deprecation)": item 2.
2. "Packages: show one-way travel time on each package card (#18)": item 3.
3. "Packages: 'What it costs' toggle under the 44 px target": item 4.
4. "Model wording on Vercel: create the client, quota-guard and cache the call": item 6, after D4.
5. "Preview check with LIVE_APIS=on": item 7, after D4.
6. "GET /packages: compute the note without rebuilding packages": item 10.
7. "Web: split the 596 kB bundle": item 11.
8. "S4-review: Sprint 4 review": item 12.
9. One issue per Monday demo defect: item 1.
