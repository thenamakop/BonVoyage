# 0001: Trip state machine clarifications

Status: Accepted · Date: 2026-10-10 · Supersedes: none

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

## Consequences

- Easier: every event has exactly one defined outcome (transition, internal action or rejection), so `nextState()` can be tested exhaustively.
- Easier: the organiser submitting first no longer needs a special case.
- Harder: known gap from b). SRS 3.2.2 allows preferences to be revised until a package is selected, but this rule locks them after `ready_for_recommendation`. The narrower rule is accepted for the 10 November scope.
- Harder: entry behaviours must be attached to external transitions only, so internal transitions need their own actions.

## Links

- `docs/baseline/BonVoyage_SRS_v1.1.md`, section 3.2.2
- `docs/RUNBOOK.md`, Appendix B (transitions)
- `docs/decisions/0000-baseline-reconciliation.md`
- `docs/design/` (state machine diagram)
