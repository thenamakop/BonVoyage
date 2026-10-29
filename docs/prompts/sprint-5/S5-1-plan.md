# S5-1: Sprint 5 plan, decisions and issues

Sprint 5 builds four deferred Could-have items before the feature freeze: R17 fairness across rounds (#27), in-app reminders, R18 voting on the shortlist (#28) and an evaluation harness. This prompt reads the code, proposes a design and decisions E1 to E7 for each, and stops for Maulik. It builds nothing.

**Branch:** `docs/s5-1-plan` · **Time box:** 1.5 hours · **Depends on:** nothing (master at `af71a5d` or later) · **Issue:** created by this prompt

```text
S5-1  SPRINT 5 PLAN: R17 FAIRNESS, IN-APP REMINDERS, R18 VOTING, EVALUATION HARNESS
Branch: docs/s5-1-plan (from fresh master)   Time box: 1.5 hours   Issue: create "S5-plan: Sprint 5 plan"
Follow the Sprint 4 conventions (Q1 to Q10 in docs/prompts/sprint-4/README.md); they apply to Sprint 5 too.
This prompt writes a plan and proposes decisions. It builds nothing.

CONTEXT
Maulik moved four deferred Could-have items into a new Sprint 5 on 29 October 2026, because Sprint 4
items 2, 3, 4, 5, 6, 10 and 11 shipped early (#128 to #135). Sprint 4's remaining items (1 demo
fixes, 7 live preview check, 8 catalogue, 9 close issues, 12 review) carry on in parallel.
Calendar: the demo is Monday 2 November; feature freeze is Sunday 8 November; submission is
Tuesday 10 November. Merge policy (Maulik): merge each PR when CI is green; any PR that changes a
line the demo shows updates docs/demo/sprint-3-demo.md and run-seed.test.ts in the same PR (Q5).

Read first:
- AGENTS.md (all, especially the privacy rules in section 12 and rule 4 on outbound calls)
- docs/baseline/BonVoyage_MoSCoW_Prioritization.md (R17, R18 wording), BonVoyage_Project_Synopsis.md
  (the scoring section near "A fairness adjustment is also applied across successive recommendation
  rounds", objective 8 "Empirical evaluation", and the expected results list), BonVoyage_SRS_v1.1.md
- docs/specs/scoring.md, docs/decisions/0001, 0004, 0005, ADR-010
- docs/sprints/replan-2026-10-27.md, sprint-4-plan.md (layout to follow), docs/RUNBOOK.md (line ~434
  "Out of scope for 10 November", the sprint map, Appendix B rows R17 and R18), docs/traceability.md
- packages/engine/src/trip-state.ts (every transition, including T16 to T18 and I1 to I5),
  packages/engine/src/scoring/* (member-score, group-fit, rank, explain, golden.fixture.ts)
- packages/db/src/schema/recommendations.ts (recommendation_run.round; items store mean, min, sd but
  not per-member scores), notifications.ts (the notification table exists; check what writes or
  reads it today: rg -n "notification" apps packages), trips.ts, preferences.ts
- apps/api/src/recommendations/service.ts, apps/api/src/trips (the closeSubmissions and invite
  paths: actions sendInvitations and notifyMembers), apps/web/src/routes.tsx, AppShell.tsx,
  ShortlistPage, TripPage
- gh issue view 27 and 28

GOAL
docs/sprints/sprint-5-plan.md: findings grounded in file and line, the proposed design for each
feature, decisions E1 to E7 for Maulik with a recommended option each, a plan table with sizes and
acceptance checks, a day-by-day order that fits next to Sprint 4's remaining items, and a cut order.
Then STOP for Maulik's decisions. Only after he approves: create the milestone and issues, record
the re-plan, and push.

STEPS
1. Findings (cite file:line for each):
   a. Rounds. Which paths produce a second recommendation run in one trip (T4, T5, T6>T8, T10,
      T16 to T18, revisions)? Is recommendation_run.round incremented today, and where? Which runs
      are diagnostics (feasibleCount < 3) and which are shortlists?
   b. What per-member data a fairness adjustment needs that is not stored today (per-member s_i on
      shortlisted destinations), and whether storing it inside recommendation_run or a new table
      can leak through any existing response (list the endpoints that serialise runs and items).
   c. The notification table: who writes it, who reads it, whether any endpoint or screen exists.
      What sendInvitations and notifyMembers actually do today.
   d. Shortlist screen and API: where a vote would sit, what the organiser's choose action
      (destinationSelected, T9) checks, and what happens to the shortlist on T10.
   e. What the engine can already compute offline for an evaluation (feasibility, ranking,
      generatePackages, planDays, validateItinerary) without a database or network.
   f. Demo impact: which demo steps (docs/demo/sprint-3-demo.md) each feature would change.

2. Proposed designs, one section each, concrete enough to write build prompts from:

   R17 FAIRNESS (#27). Constraints Maulik set:
   - Round 1 of every trip ranks exactly as today: the golden test values in scoring.md section 7
     stay to 1e-6, and a trip with no earlier shortlisted run is unchanged (so the demo's first
     shortlist is unchanged).
   - From the second shortlisted run, members who were least served in earlier shortlisted runs get
     more weight. Propose the formula (for example a per-member deficit from earlier runs' top 3
     destinations, weights w_i = 1 + lambda x deficit_i normalised to mean 1, applied to the mean
     and sd terms), with lambda in apps/api/config/scoring.json, validated at start-up and stored on
     every run like alpha, beta and gamma. Add a worked example with numbers to scoring.md.
   - Privacy: weights and deficits are never returned to any member, including the organiser. A
     member's "why" may say "This round gives more weight to members whose wishes were met less
     last time" without names or numbers. no-leak.test.ts must assert it.
   - Engine stays pure (P2, full branch coverage). Migration only if per-member scores must be
     stored; say which.

   IN-APP REMINDERS (no email, ever):
   - A notification bell in the app shell with an unread count; a list page or panel; mark as read.
   - Events that write a notification: trip opened for preferences (T2) for each invited member,
     submissions closed (T3b, notifyMembers) for excluded and remaining members, shortlist ready
     (T6>T7), package chosen (T11), day plan ready (T12), trip finalised (T14), trip cancelled (T15).
   - Organiser "Remind" button next to each member who has not submitted; at most one reminder per
     member per 24 hours (enforced server side, 429 with a clear message otherwise).
   - Payloads hold no other member's preferences or budget. Notifications are deleted with the
     account (the cascade exists; confirm it).
   - Polling, not websockets (Vercel functions): refetch on focus and every 60 s while visible.

   R18 VOTING (#28):
   - In state shortlisted, each active member casts one vote for one shortlisted destination and
     may change it until the organiser selects (T9). The organiser still decides (decision 0005 h);
     the vote never gates or auto-selects.
   - Everyone sees counts per destination and their own vote; never who voted for what.
   - Votes belong to a recommendation run; a new run starts a fresh vote. On T10 (back to
     shortlisted) the votes of that run remain.
   - Model it as an internal event (I6, no state change) in trip-state.ts and decision 0001's table.
   - Privacy edge: in a 2-member trip a member can deduce the other's vote from the counts. Propose
     whether to accept and document it in privacy.md (as with D1's bracket) or hide counts until
     both have voted.
   - New table (vote: run_id, member_id, destination_id, unique on run and member) and migration.

   EVALUATION HARNESS:
   - pnpm eval: a deterministic script (seeded random) that builds synthetic groups of 2 to 8 members
     from the real catalogue files (no database, no network, no model; templates only) across origins
     gurugram and delhi, and reports:
     * hard-constraint satisfaction: share of shortlisted destinations, generated packages and
       planned days that satisfy F1 to F5 and validateItinerary (expected 100 %; any miss is a bug);
     * group fit: for GFS versus average-only (alpha 1, beta 0, gamma 0) and least-misery-only
       (0, 1, 0): mean member score, minimum member score, standard deviation and the share of groups
       where some member scores 0 on the top choice;
     * fairness across 3 simulated rounds with and without R17: the spread of each member's
       cumulative score, and how often the same member is least served twice.
   - Output docs/evaluation/results-<date>.md (tables) and a CSV, with the seed, scenario count and
     commit hash. The synopsis's "perceived satisfaction" questionnaire stays out (no user study).
   - Runs in CI as a smoke test with a small scenario count; the full run is manual.

3. Decisions for Maulik, each with options and your recommendation:
   E1 fairness formula and lambda default; E2 where per-member scores are stored; E3 which events
   notify and the 24-hour reminder limit; E4 voting visibility in 2-member trips; E5 evaluation
   scenario count, metrics and baselines; E6 the order and the cut order (suggested: R17 and the
   harness are never cut because together they are the report's research result; cut voting first,
   then reminders); E7 how the Sprint 4 review and a Sprint 5 review combine (one review on 7
   November, or two).

4. Plan table (in the sprint-4-plan layout): items S5-2 R17 engine and API, S5-3 reminders,
   S5-4 voting, S5-5 evaluation harness, S5-6 evidence and traceability, S5-7 review; size, issue
   placeholder, acceptance check, dependencies. Order by day from Thursday 29 October to Saturday 7
   November next to Sprint 4's items 1, 7, 8, 9 and 12, with Sunday 1 November reserved for a
   preview re-run of the demo script by Claude in Cowork.

5. Re-plan text to apply after approval: a new docs/sprints/replan-2026-10-29.md (what moved in and
   why); RUNBOOK line ~434 and the sprint map; traceability rows R17 and R18 (sprint S5, issues);
   README roadmap if it lists sprints. Do not apply these before approval.

6. STOP. Open a draft PR "docs: Sprint 5 plan" containing only sprint-5-plan.md, and report.

AFTER MAULIK APPROVES (same branch)
7. Record his decisions in the plan's Decisions section with the date. Create the milestone
   "Sprint 5 (29 Oct-7 Nov): Could-haves" and one issue per item (link #27 and #28 rather than
   duplicating them; take numbers from gh issue list, never from traceability, per Q3). Apply the
   re-plan text from step 5. Mark the PR ready. Do not merge.

VERIFICATION
Paste: the findings list with file:line; the decisions table; the plan table; gh output for the
milestone and issues (after approval); pnpm format:check; the CI result.

IF BLOCKED
A design conflicts with decision 0005, the privacy rules or the state machine table in decision
0001: stop, name the conflict and propose two ways round it. Never weaken a privacy rule to fit a
feature.
```
