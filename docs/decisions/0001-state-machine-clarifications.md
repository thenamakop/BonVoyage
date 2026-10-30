# 0001: Trip state machine clarifications

Status: Accepted · Date: 2026-10-10, amended 2026-10-29 (g) and 2026-10-30 (h) · Supersedes: none

## Context

The Trip state diagram (`docs/design/`, Design Lab page 4.4) and RUNBOOK Appendix B leave a few cases open, and `docs/decisions/0000-baseline-reconciliation.md` adds T3b. Without a written ruling, the engine, the API and the tests could each read these cases differently.

## Decision

The trip state machine follows the diagram and Appendix B with these clarifications:

- a) Internal transition I1: `preferenceSubmitted` in `collecting_preferences` is internal whenever T3's guard (pendingCount = 0 AND submittedCount >= 2) is false, not only when pendingCount > 0. Reason: the organiser can submit before anyone else has joined (pending 0, submitted 1).
- b) Internal transition I2: `preferenceRevised` in `collecting_preferences` is internal (action `updateProgress`). In `ready_for_recommendation` it is T5 (self-transition). In every later state it is rejected with 409 `PREFERENCES_LOCKED`.
- c) T6 merges with its choice outcomes into two rows: T6>T7 (feasibleCount >= 3, to `shortlisted`) and T6>T8 (feasibleCount < 3, to `collecting_preferences`).
- d) T19 and T20 are modelled as "completed and cancelled are terminal; every event is rejected".
- e) Entry behaviours run on every external transition into a state, including the T5 self-transition, and never on internal transitions.
- f) Members excluded by T3b get `trip_member.status = excluded`.
- g) T21, added under decision E1, 29 October 2026 (`docs/sprints/sprint-5-plan.md`). A new external row:

  | # | From | Event \[guard\] / action | To |
  | --- | --- | --- | --- |
  | T21 | `shortlisted` | `shortlistReopened` ("Ask again", organiser only, no guard, no action) | `ready_for_recommendation` |

  The entry behaviour of `ready_for_recommendation` (`computeGroupProfile`) runs, as e) requires. From there members may revise (T5), the organiser may edit the trip (0004 j), and the next `recommendationRequested` stores a new run (round + 1). `shortlistReopened` from any other state is rejected like every other illegal event. The external rows are now 19 (T1 to T18 with T3b, T6 split, plus T21). No status is added. The diagram in `docs/design/` predates T21 and is not edited.
- h) I6, approved under decision E4, 29 October 2026 (`docs/sprints/sprint-5-plan.md`), added 30 October 2026. A new internal row:

  | # | State | Event \[guard\] / action |
  | --- | --- | --- |
  | I6 | `shortlisted` | `voteCast` \[member is active\] / no action |

  `voteCast` covers casting, changing and withdrawing a vote (R18). It changes no state and the organiser's choice (T9) never reads it (0005 h). The guard is enforced in the API, like T21's organiser-only rule, so `GuardContext` is unchanged. `voteCast` from any other state is rejected like every other illegal event, and the API words that 409 "Voting has closed." The internal rows are now I1 to I6. Each vote writes a `trip_transition` row, as every transition does, but the activity list and `lastActivityAt` leave I6 out: a name beside a count that just moved would say who voted for what. The diagram in `docs/design/` predates I6 and is not edited.

## Consequences

- Easier: every event has exactly one defined outcome (transition, internal action or rejection), so `nextState()` can be tested exhaustively.
- Easier: the organiser submitting first no longer needs a special case.
- Harder: known gap from b). SRS 3.2.2 allows preferences to be revised until a package is selected, but this rule locks them after `ready_for_recommendation`. The narrower rule is accepted for the 10 November scope.
- Harder: entry behaviours must be attached to external transitions only, so internal transitions need their own actions.
- Easier (g): T21 narrows the gap from b), since members can revise again after a shortlist once the organiser asks again. It also gives R17 earlier shortlists to weigh.

## Links

- `docs/baseline/BonVoyage_SRS_v1.1.md`, section 3.2.2
- `docs/RUNBOOK.md`, Appendix B (transitions)
- `docs/decisions/0000-baseline-reconciliation.md`
- `docs/design/` (state machine diagram)
