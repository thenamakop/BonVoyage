# Sprint 4 plan: hardening (3 to 7 November 2026)

**Status: decisions D1 to D6 made by Maulik on 28 October 2026 (see [Decisions](#decisions-maulik-28-october-2026)). The issues are created (#118 to #126). The plan is approved once this pull request merges, and no Sprint 4 build prompt is written before that.**

Sprint 4 has no new requirements ([re-plan](replan-2026-10-27.md), RUNBOOK sprint map): it hardens what Sprint 3 shipped, closes the requirement issues with evidence, and carries the [Sprint 3 review](sprint-3-review.md)'s "To finish" list. Every item below cites a command output or a file and line, gathered on 28 October 2026 from `master` at `64bd978` (after #115). The raw outputs are in the pull request that adds this file.

## Findings that shape the plan

1. **No deployment can call Gemini today.**
   - `apps/api/src/server.ts:19-26` creates the model client when `LIVE_APIS=on`, but `apps/api/src/vercel-entry.ts` never passes `llm` to `createApp`. Preview and production always use the catalogue templates, whatever the Vercel settings.
   - The Sprint 3 README's optional step ("set `LIVE_APIS=on` … on the preview environment in Vercel and redeploy") would have had no effect. **The two disagree. Per D4, #121 makes the code match and corrects the README step.**
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
| #18 R8 packages | Travel time on package cards (finding 3). The other four criteria are met: dry run steps 3 and 5, `packages.test.ts`, #112. | #119, then close with evidence |
| #20 R10 privacy and deletion | All five criteria have evidence: `preferences.test.ts` and `no-leak.test.ts`; #94 on production; Better Auth hashes (`auth.test.ts`); `privacy.md`; deletion in #105 and #111 and dry run step 6. #116 is about what aggregates reveal in 2-member groups. | Close when #116's fix merges (D2) |
| #21 R11 persistence (no milestone) | Nothing: `schema.test.ts` (cascade, constraints), the `--fresh-demos` no-orphan test, the admin import. | Close with evidence |
| #22 R12 day plan | "The model receives verified structured trip facts" is met only in tests and locally. Deployments never call the model (finding 1). Everything else is met (dry run step 4). | Close after #121 and #122 (D4) |
| #23 R13 decisions | #23 said "a member can accept … modify, reorder or remove … reject", which conflicted with decision 0005 h. Per D3 its text now follows 0005 h: the organiser decides, members read, no reorder. Everything in the new text is built (#107, #109) and tested (`itinerary.test.ts`, the full-journey test). | Close with evidence |
| #24 R14 provenance | Nothing: routing falls back curated then estimate; the wording falls back to templates; every line and item is labelled (dry run steps 3 and 4). | Close with evidence |
| #25 R15 (Buffer) | Not measured: "95% of interactive requests under 3 s" under load; "itinerary within 30 s for up to eight members" with the model. Not met: "repeated provider responses are cached" for the model. | Leave on Buffer; items 6 and 7 feed it |
| #38 catalogue B1 | 1 row (Sariska costs). Per D5 its check is now `--require b1`, and the 31 B2 fares moved to #126. | Maulik verifies |
| #126 catalogue B2 | 31 fares, the Mathura and Vrindavan trains first (D5). | Maulik, best effort |
| #39 catalogue C | 74 POIs. `--require c` also requires B2 (106 errors), so it cannot pass before #126. | Maulik verifies |
| #116 two-member bounds | D1 decided: hide the budget band's numbers below 3 contributing members. | Item 5 |

## Plan

Sizes: **S** is up to 1 hour, **M** up to 3 hours, **L** more than 3 hours. "Agent" means a build prompt; "Maulik" means work only Maulik can do (verifying rows, Vercel settings, decisions).

| # | Item | Issue | Why | Size | Acceptance check | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Fixes from the Monday demo | new, one per defect | The demo is 2 November; Sprint 4 starts the next day | S to M each | Each defect has a failing-then-passing test; the demo script line matches the screen | The demo |
| 2 | Run the catalogue import's stage counts one after another inside the transaction | #118 | Finding 2; pg 9 removes the behaviour | S | `pnpm verify 2>&1 \| Select-String "already executing"` prints nothing; `admin.test.ts` passes | — |
| 3 | One-way travel time on each package card | #119 (for #18) | Finding 3; #18's first criterion | S | `PackagesPage.test.tsx` asserts the mode and duration line (for example "Train · 3 h 30 min each way"); text, not colour | — |
| 4 | "What it costs" toggle at least 44 px tall | #120 | Finding 4 | S | A test asserts the summary's `min-h-11`; the 360 px audit shows no target under 44 px | — |
| 5 | Two-member bounds (D1): below 3 contributing members, show only whether budgets overlap | #116 | Production observation; privacy rule (AGENTS.md section 12) | M | Below 3 contributing members, the group profile and every member-visible response (recommendation runs, the diagnostic) carry no budget band figure, only whether the budgets overlap. `no-leak.test.ts` asserts it for 2 members. The date window is unchanged for every size. `privacy.md` updated | — (D1 made) |
| 6 | Model wording on deployments: create `llm` in `vercel-entry.ts`, wrap the call in `withQuota` with a daily limit, cache it, and correct the Sprint 3 README's preview step | #121 | Finding 1; AGENTS.md rule 4; integrations README line 38 | L | Integration test: over the limit the plan says "Planned from the BonVoyage catalogue" with no model call; a repeated identical fact sheet is served from the cache; the bundle size is reported; the README step matches the code | Maulik's approval for a new env var (the limit) and any cache table |
| 7 | Preview check with `LIVE_APIS=on` | #122 | Finding 1; the Sprint 3 review's "not exercised" | S | On preview: one plan reads "Written with … from catalogue facts" and passes `validateItinerary`; a forced failure (bad key) still gives a catalogue plan | #121; Maulik sets the key in Vercel **Preview only** |
| 8 | Verify the remaining catalogue rows | #38 (B1), #126 (B2), #39 (C) | Finding 5; B2 is due 5 November | Maulik, M to L | `pnpm catalogue:check --require b1` exits 0; B2 and C counts rise; `run-seed.test.ts` stays green, or the script and test are updated in the same PR | Tiger Falls and the Mathura and Vrindavan train fares follow finding 6; #39's `--require c` needs #126 |
| 9 | Close the requirement issues with evidence | #18, #20, #21, #22, #23, #24 | Sprint 3 review "To finish" | S | Each issue gets a comment citing tests and dry-run lines, then closes; `docs/traceability.md` matches | #119 for #18; #116 for #20 (D2); #121 and #122 for #22 (D4) |
| 10 | Build the `GET /packages` note without rebuilding every package | #123 | Finding 8 | S | The note is unchanged in `packages.test.ts`; `generatePackages` is not called on a read | — |
| 11 | Split the web bundle (lazy-load the trip screens) | #124 | Finding 9 | S | `pnpm build` prints no chunk-size warning; web tests pass | — |
| 12 | Sprint 4 review | #125 | Gate before the Buffer | S | `docs/sprints/sprint-4-review.md` with outputs | All above |

### Proposed order (five working days)

| Day | Agent | Maulik |
| --- | --- | --- |
| Tue 3 Nov | 1 (demo fixes), 2 (#118) | Approve the #121 env var and cache storage |
| Wed 4 Nov | 3 (#119), 4 (#120), 5 (#116) | 8 (#38, then #126's Mathura and Vrindavan trains) |
| Thu 5 Nov | 6 (#121) | 8 (#126 B2 due today; #39) |
| Fri 6 Nov | 7 (#122), 9 (close issues) | Vercel Preview key for #122 |
| Sat 7 Nov | 10 and 11 if time allows, 12 (review) | — |

### Cut first if time runs short

1. Item 11 (#124, bundle split).
2. Item 10 (#123, the packages note).
3. Items 6 and 7 (#121 and #122, model wording on deployments; D4). Without them, deployments keep the catalogue templates, and #22's first criterion is met in tests only.
4. B2 rows beyond those that touch the demo trips (#126).

Never cut: demo fixes (1), the pg fix (2), #18's travel time (3), and the #116 decision (5).

## Decisions (Maulik, 28 October 2026)

- **D1, #116 (two-member groups).** Below 3 contributing members, the group profile and every member-visible response show only whether budgets overlap, never the band's numbers. The date window stays for every group size; the 26 October decision in `privacy.md` line 42 is unchanged. The other options (widen the rounding, or document only) were not chosen. This is item 5.
- **D2, #20.** Close #20 when #116's fix merges.
- **D3, #23.** #23 follows decision 0005 h: the organiser accepts, modifies or rejects; members read; there is no reorder. #23's text was updated on 28 October to say so and cite 0005 h.
- **D4, model wording on deployments.** Build items 6 and 7 (#121, #122): Gemini on deployments, with the quota guard and a cache. They are cut after items 10 and 11 if the week slips. #121 also corrects the Sprint 3 README's preview step.
- **D5, catalogue criteria.** #38's check becomes `--require b1`; #38 was retitled and edited on 28 October. The 31 draft B2 fares moved to #126, with the demo-touching rows (the Gurugram trains to Mathura and Vrindavan) first.
- **D6, R17 (fairness across rounds) and R18 (voting).** They stay out of Sprint 4, as the re-plan (line 24), ADR-010 and the RUNBOOK (line 433) say.

## Issues created (28 October 2026, milestone "Sprint 4 (3-7 Nov): hardening")

| Issue | Title | Item |
| --- | --- | --- |
| #118 | Catalogue import: stage counts run in parallel on one transaction client (pg deprecation) | 2 |
| #119 | Packages: show one-way travel time on each package card | 3 |
| #120 | Packages: 'What it costs' toggle under the 44 px tap target | 4 |
| #121 | Model wording on Vercel: create the client, quota-guard and cache the call | 6 |
| #122 | Preview check with LIVE_APIS=on (model wording on a deployment) | 7 |
| #123 | GET /packages: compute the note without rebuilding every package | 10 |
| #124 | Web: split the 596 kB bundle | 11 |
| #125 | S4-review: Sprint 4 review | 12 |
| #126 | Catalogue B2: verify the 31 draft bus and train fares (Mathura and Vrindavan first) | 8 |

Edited: #23 (D3) and #38 (D5). #116 already existed (item 5). The Monday demo defects (item 1) get their own issues when they are found.
