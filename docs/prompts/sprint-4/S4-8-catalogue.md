# S4-8: Catalogue: settle the remaining draft rows (#38, #39)

`pnpm catalogue:check` on 28 October 2026: A 50/50, B1 136/137, B2 85/116, C 202/276 verified; 0 errors. Decision D5 makes #38's done check `--require b1` and moves the 31 draft B2 fares to their own issue. This prompt settles, in order: the one B1 row, the draft B2 fares that touch the demo trips, the rest of B2, then C places of interest as time allows.

**Who:** Claude in Cowork verifies against sources and writes per-row reports (decision 0002 as amended on 24 October 2026); Maulik reviews and records a spot check; Claude Code applies the CSV changes · **Time box:** M to L, spread over Wednesday and Thursday · **Depends on:** S4-1 merged · **Issues:** #38 (B1), #126 (B2), #39 (C) · **After merge (Maulik):** `pnpm catalogue:import --target preview`, then `--target production`

## Source rules (unchanged from Sprint 2 and 3)

- A row is `verified` only from the operator's own page, or two current independent pages that agree. trawell.in is stale for Rajasthan and Himachal fees: never a source on its own.
- Trains: erail.in's "trains between stations" page and its printed Mail/Express fare table; `fare_per_person_inr` is the adult SL fare for the route distance; `duration_minutes` is the fastest regular train (not a 0-prefixed special) with SL or 2S; Gurugram rows use Gurgaon (GGN) only, never a Delhi train.
- Buses: redbus.in or the state operator; a sale fare under ₹0.60 per km is treated as unconfirmed (stays draft).
- `collected_on` is a date the checker accepts (UTC; before 05:30 India time use the previous day).
- Never bypass a CAPTCHA, a login wall or a block; record "not reachable" and move on.

## Decision needed first (Maulik): rows with no service

Eleven Gurugram train rows (Agra, Amritsar, Bharatpur, Bundi, Gwalior, Jim Corbett, Kurukshetra, Mathura, Orchha, Ranthambore, Vrindavan) and the Delhi train row to Jim Corbett stayed draft on 27 October because erail.in lists **no train** on that pair. A draft row is still costed as "estimated", so today the app can say "cheapest by train" for Mathura and Vrindavan from Gurugram, a train that does not exist.

- **(a) Recommended, after the demo:** delete those rows from `fares.csv`. The mode then disappears for that pair (packages, Change list, "cheapest by"). The Tight budget demo's figures for Mathura and Vrindavan change, so `docs/demo/sprint-3-demo.md` step 5 and `run-seed.test.ts` change in the same PR (Q5).
- **(b)** Keep them as draft "estimated" rows, and add the reason to the catalogue report. Nothing on screen changes.

Tell Claude (a) or (b) before Part 2.

## Part 1: verification (Claude in Cowork, one batch per report)

```text
S4-8 PART 1  VERIFY DRAFT CATALOGUE ROWS
Who: Claude in Cowork, by direct page fetch or the built-in browser; never sign in; never bypass a
CAPTCHA or block. One report per batch in docs/sprints/catalogue-s4-<batch>-<date>.md, in the
layout of docs/sprints/catalogue-b2-train-2026-10-27.md (Method, Every row with Was and Now and
Evidence links, Maulik to check).

Batches, in order:
1. B1: sariska destination costs (stay tiers, food, local).
2. B2 demo-touching: gurugram/mathura and gurugram/vrindavan train (apply Maulik's decision (a)
   or (b)); then every bus row from gurugram used by a demo trip's shortlist (check
   docs/demo/sprint-3-demo.md for the places quoted).
3. B2 remaining: the other no-service train rows (per the decision), then the draft bus rows to
   Auli, Chail, Dalhousie, Dehradun, Jaipur, Jim Corbett, Kasauli, Kasol, Orchha, Ranthambore,
   Rishikesh and Sariska.
4. C as time allows: draft places of interest for destinations that appear in a demo trip's
   shortlist first (Bikaner's Camel Research Centre and Lalgarh Palace, Mathura's Government
   Museum), then by destination. Tiger Falls (Chakrata) stays draft: it is the demo's deliberate
   "Not verified" item; verifying it is Maulik's call and would change the script.

For each batch the report ends with "Maulik to check" (anything uncertain) and leaves a
"Spot check" section for Maulik: three rows he re-checks himself, with his result.
```

## Part 2: apply the changes (Claude Code, after Maulik's spot check)

```text
S4-8 PART 2  APPLY CATALOGUE BATCH <n> (<stage>)
Branch: data/<38|126|39>-catalogue-<batch> (from fresh master)   Time box: 45 minutes
Issue: #38 (B1), #126 (B2) or #39 (C). Follow the Sprint 4 conventions (Q1 to Q10).

CONTEXT
Read AGENTS.md (section 10), docs/decisions/0002 (amended: AI verification needs the per-row report
and Maulik's recorded spot check before merge), the batch report
docs/sprints/catalogue-s4-<batch>-<date>.md, packages/db/catalogue/*.csv and the checker
(pnpm catalogue:check).

STEPS
1. Refuse to start if the report's "Spot check" section is empty: stop and say so.
2. Apply exactly the report's "Now" column to the CSV rows it lists (values, review_status,
   source_url, collected_on); for rows the report deletes, delete them. Touch no other row.
3. pnpm catalogue:check (and --require b1 for batch 1): 0 errors; paste the stage counts before
   and after.
4. pnpm catalogue:import --target local, then pnpm vitest run --project integration
   apps/api/src/seed apps/api/src/e2e packages/db/test. If run-seed.test.ts fails because a demo
   figure changed, update docs/demo/sprint-3-demo.md (read the new lines off pnpm dev) and the
   test in the same PR (Q5); never change a row to keep a test green.
5. PR "data: catalogue <stage> batch <n>", body "Refs #<38|126|39>" (Closes #38 only when
   --require b1 exits 0) and "After merge (Maulik): pnpm catalogue:import --target preview; then
   --target production".

VERIFICATION
Paste: the checker output before and after; the integration test summary; the CI result.
```
