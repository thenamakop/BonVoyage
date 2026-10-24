# S2-1: Kickoff: decisions, backlog, stage B split and re-plan

Turns the draft scoring spec into accepted rules, writes down the thirteen decisions the Sprint 2 code depends on, records the 23 October re-plan, creates the Sprint 2 issues, commits these prompt files and splits catalogue stage B so it fits the calendar. Docs, backlog and two small script changes (the checker and the backlog dry run); no app code.

**Branch:** `docs/s2-kickoff` · **Time box:** 1.5 hours · **Depends on:** Sprint 1 closed (PR #57 merged, #37 on the Sprint 2 milestone) · **Issue:** none (it creates them) · **Before pasting:** unzip the Sprint 2 prompts so `docs/prompts/sprint-2/` holds `README.md` and the nine `S2-*.md` files

```text
S2-1  SPRINT 2 KICKOFF: DECISIONS, BACKLOG, STAGE B SPLIT AND RE-PLAN
Branch: docs/s2-kickoff   Time box: 1.5 hours

CONTEXT
Read AGENTS.md, docs/prompts/sprint-2/README.md (Sprint 2 conventions), docs/specs/scoring.md (Status:
Draft), docs/decisions (0000 to 0003, ADR-001 to ADR-010), docs/sprints/sprint-1-review.md,
docs/traceability.md, docs/RUNBOOK.md (Phase 1 owners, Appendix B1, the sprint map), README.md (the
roadmap), packages/db/catalogue/README.md, decision 0002 and scripts/backlog (create-backlog.ts,
requirements.csv, issues.csv).
Sprint 2 builds R4 (group profile, common window, conflict report), R5 (hard constraints), R6
(group-fit ranking), R7 (meets and misses) and R16 (one mediating module with caching and quota
control), with the R15 shortlist speed target. The scoring spec is a draft and leaves questions open;
this task answers them in writing so the code prompts follow fixed rules. Sprint 1 closed on 23 Oct
with catalogue stage A still at 0/50 (#37 moved to the Sprint 2 milestone), so this task also records
the re-plan: Sprint 2 runs Sat 24 to Tue 27 Oct and every later date moves with it.

GOAL
docs/decisions/0004-recommendation-rules.md (Accepted) and an amended docs/specs/scoring.md (Status:
Accepted) say exactly how Sprint 2 recommends. Issues S2-2 to S2-8 exist on the board under their
epics. Catalogue stage B is split into B1 (due 1 Nov) and B2 (best effort). The re-plan is recorded:
the milestones, the CAT issues, README and the RUNBOOK carry the new dates, and the backlog script's
dry run works on the existing board. docs/prompts/sprint-2/ is committed unchanged.

STEPS
1. Commit docs/prompts/sprint-2/ first ("docs: add Sprint 2 build prompts"); whitespace-only prettier
   changes are fine, word changes are not.
2. docs/decisions/0004-recommendation-rules.md (template, Status: Accepted), each decision with a
   one-line reason:
   a) Who counts: n = active trip members with a submitted preference; excluded members never count.
   b) Group profile (R4) is computed on read, never stored: common window = intersection of member
      date ranges (days count both ends); budget band = [highest member minimum, lowest member
      maximum] per person; per-person cap = lowest member maximum; group cap = min(trip budget,
      n x per-person cap); vote counts per destination type, activity and climate. The
      computeGroupProfile action handler stays a no-op with a comment pointing here.
   c) Conflicts: no common window, or one shorter than duration_nights + 1 days (F3), is a group
      conflict. Requesting recommendations then fires conflictDetected (T4, back to
      collecting_preferences) and stores a diagnostic run with bindingConstraint F3 and no
      alternatives. Budget bands that do not overlap are a warning only. Amends scoring.md 6.2 and 6.6.
   d) F5 cost: estimatedGroupCost = n x 2 x cheapestOneWayPerPerson + ceil(n / 2) x nights x
      stay_budget_inr + n x (nights + 1) x (food_per_day_inr + local_per_day_inr), compared with the
      group cap. cheapestOneWayPerPerson = the lowest of the bus fare, the train fare (from the trip's
      origin hub) and the car share; car share = ceil(n / persons_per_car) x (km x
      (fuel_price_inr_per_litre / car_km_per_litre + toll_inr_per_km) + car_rental_inr_per_day x
      (nights + 1) / 2) / n. Rounded up to whole rupees at the end. Sprint 3 reuses the car formula.
   e) Candidates: active destinations with stay_budget_inr, food_per_day_inr and local_per_day_inr
      all set. The rest are listed in the run's diagnostic as incomplete, never silently dropped.
   f) Distance and provenance: the integrations module tries the curated car distance from
      fare_fallback, then estimateRoadKm. A verified catalogue row is "curated"; a draft row or a
      computed value is "estimated". Every Sprint 2 cost carries the word "estimate".
   g) Types are preferences, not constraints: a group whose types match nothing still gets a
      shortlist from F1 to F5, and the page says so when the best mean score is below 0.25. This
      supersedes RUNBOOK Phase 6's "a beach-only group gets the diagnostic".
   h) Weights live in apps/api/config/scoring.json (alpha 0.5, beta 0.3, gamma 0.2), are validated at
      start-up and stored on every run.
   i) Explanations (R7) are private: each member sees their own meets and misses; group views show
      counts and list a value only when 2 or more members share it.
   j) Trip parameters (title, origin, nights, budget, radius) are editable by the organiser in draft,
      collecting_preferences and ready_for_recommendation, and lock at shortlisted (replaces the S1-2
      draft-only rule). After a T4 or T6>T8 return, the organiser edits parameters or members revise,
      then Close submissions (T3b) marks the trip ready again.
   k) The chosen destination is stored in a new nullable column trip.selected_destination_id
      (migration 0001, S2-2), written by T9.
   l) Quota control (R16): table provider_usage(provider, day, calls) counts calls per provider per
      India day; a provider with a daily limit falls back to the next provider when it is reached.
      Curated and estimate providers have no limit; Gemini gets one in Sprint 4.
   m) Ranking: GFS desc, then mean desc, then slug asc. Every feasible destination is stored ranked;
      the page shows the first 5 with "Show all". A shortlist needs 3 (T6 guard).
3. docs/specs/scoring.md: Status: Accepted, link 0004, and amend: 6.2 (F5 group cap and cost formula;
   F3 handled by T4); 6.3 (weighted Jaccard written out: member type weight 1 for stated types, 0.5
   for types that appear only through past trips rated 4 or 5; destination weights 1; WJ = sum of
   minima / sum of maxima over the union); 6.5 (privacy rule i); 6.6 (F4 relaxation = the smallest
   circular month distance between a window month and a best month, relative = shift / 12; other
   relative relaxations = relaxation / current limit; suggestions = per constraint among near misses,
   the smallest new limit that unlocks at least one destination, F1 rounded up to 10 km, F5 to 500
   rupees, and the slugs it unlocks). Do not touch 6.7.
4. Re-plan. Do all of this before the backlog run in step 5:
   a) docs/sprints/replan-2026-10-23.md: why, in two lines (Sprint 1's production checks finished on
      23 Oct and stage A was 0/50, so Sprint 2 starts on Sat 24); the new calendar; what stays fixed.
        Sprint 2   Sat 24 to Tue 27 Oct     gate G1: the group flow works
        Sprint 3   Wed 28 Oct to Mon 2 Nov  gate G2: the MVP (R1 to R11) is accepted
        Sprint 4   Tue 3 to Sat 7 Nov
        Buffer     Sun 8 to Tue 10 Nov      unchanged: feature freeze on 8 Nov, submission on 10 Nov
        Catalogue  stage A Mon 26 Oct; B1 and C Sun 1 Nov; B2 best effort by Thu 5 Nov
      Keep the RUNBOOK cut order: if Sprint 3 or 4 slips, cut R13's modify step first, then R12;
      never a Must have. #54 (account deletion) moves to Sprint 3.
   b) Milestones. The script matches them by exact title, so rename each on GitHub with
      gh api -X PATCH repos/{owner}/{repo}/milestones/<number> -f title=<title> -f due_on=<due>
      and put the same titles and dates in milestoneSpecs in scripts/backlog/create-backlog.ts:
        Sprint 2 (24-27 Oct)      2026-10-27T18:29:59Z
        Sprint 3 (28 Oct-2 Nov)   2026-11-02T18:29:59Z
        Sprint 4 (3-7 Nov)        2026-11-07T18:29:59Z
      Sprint 1 (closed) and Buffer (8-10 Nov) stay as they are.
   c) Catalogue issues. The script also matches issues by exact title, so change each on GitHub
      (gh issue edit <n> --title ... --milestone ...) and in scripts/backlog/issues.csv (title and
      milestone columns) to the same words:
        #37 CAT-A, Sprint 2: "Catalogue stage A: verify hubs and destination identity (due 26 Oct)"
        #38 CAT-B, Sprint 3: "Catalogue stage B: verify costs and fares (B1 due 1 Nov, B2 best effort)"
      #39 (stage C, due 1 Nov, Sprint 3) is unchanged. Move #54 to the Sprint 3 milestone. Epic R10
      is already on Sprint 3 (its last criterion is #54): set R10's sprint to S3 in requirements.csv.
   d) README.md roadmap and the RUNBOOK sprint map get the new dates; README's status column: S0 Done,
      S1 Done (catalogue stage A moved to S2), S2 In progress, the rest Planned; the RUNBOOK's S1 row
      drops "catalogue complete". Both link the re-plan note. docs/decisions/0002 gets one line under
      its status, "Dates amended by 0004 and docs/sprints/replan-2026-10-23.md", and nothing else.
      docs/security/privacy.md: "#54 for Sprint 2" becomes "#54 for Sprint 3".
   e) Fix the backlog script's dry run. It has only ever run against a missing project and breaks on
      the existing one: createIssue throws "Could not read issue number" at the first new issue, and
      gh project item-add runs for real even with --dry-run. In a dry run, createIssue prints the
      issue and returns 0, a row with number 0 skips sub-issue linking and project items, and
      item-add is printed, not run (skip that item's fields). Nothing else in the script changes.
5. Backlog: add S2-2 to S2-8 to scripts/backlog/issues.csv with milestone "Sprint 2" (the script maps
   it to "Sprint 2 (24-27 Oct)"), module and academic owner from the RUNBOOK Phase 1 table, estimate
   in points, 3 to 6 acceptance criteria each taken from the matching file in docs/prompts/sprint-2/:
     S2-2  Migration: selected destination, nullable past-trip place name, provider usage        R11,R16
     S2-3  Member score, group-fit ranking, explanations and group profile                        R4,R6,R7
     S2-4  Hard constraints F1 to F5, cost estimate and empty-shortlist diagnostic                R5
     S2-5  Integrations module: routing providers, distance cache and quota control               R16
     S2-6  Recommendation runs, conflict report and destination choice (T4, T6, T9)               R4,R5,R6,R7
     S2-7  Group profile, shortlist and diagnostic screens                                         R4,R6,R7
     S2-8  Demo scenarios, end-to-end flow and shortlist speed check                              R6,R15
   Run the script with --dry-run first: it must list exactly 7 new issues (S2-2 to S2-8) and no new
   milestone or CAT issue. If it lists anything else, stop and fix the titles. Then run it for real,
   then once more (0 created).
6. Stage B split, as a section of 0004 and in packages/db/catalogue/README.md:
     B1, due Sun 1 Nov: cost-rules.json (5), destination cost columns (44 rows), car rows' distance
     and duration in fares.csv (88).
     B2, best effort by Thu 5 Nov: bus and train fares (116), labelled estimated while draft.
   Change catalogue:check so the verification table shows A, B1, B2 and C, and --require accepts
   a, b1, b2, b (= b1 and b2) and c, each including the earlier stages as before. Update its tests.
   Change nothing else in the checker.
7. docs/traceability.md: the new issue numbers on R4, R5, R6, R7, R15 and R16.
8. PR "docs: Sprint 2 decisions, backlog, stage B split and re-plan", body "Refs #37, #38" and the new
   issue numbers.

VERIFICATION
Paste the real output of: ls docs/prompts/sprint-2 ; git grep -n "^Status:" docs/specs/scoring.md
docs/decisions/0004-recommendation-rules.md ; gh api "repos/{owner}/{repo}/milestones?state=all"
--jq '.[] | [.title, .state, .due_on] | @tsv' ; the backlog script's dry run (7 to create) and third
run (0 created) ; gh issue list --milestone "Sprint 2 (24-27 Oct)" (#37 and S2-2 to S2-8) ;
gh issue view 38 --json title,milestone and the same for 54 ; the README roadmap rows ;
pnpm catalogue:check (the table shows A, B1, B2 and C) ; pnpm catalogue:check --require b1 (fails
until B1 is verified: correct) ; pnpm verify.

IF BLOCKED
The 6.7 golden numbers disagree with the weighted Jaccard wording: stop and tell me; never change
6.7. The backlog script cannot match an epic: report the title. A milestone or issue rename fails:
stop before the backlog run and report it, because a half-renamed board makes the script create
duplicates. Never edit docs/baseline or docs/design. Never edit .env or print env values.
```
