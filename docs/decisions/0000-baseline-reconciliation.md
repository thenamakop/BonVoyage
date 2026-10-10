# 0000: Baseline reconciliation

Status: Proposed · Date: 2026-10-08 · Agreed by: (team members reply "agreed")

Disagreements found between the baseline documents, and how they are resolved.

| # | Where the documents disagree | Resolution |
| --- | --- | --- |
| C1 | SRS 3.2.1 makes a trip ready once two members have submitted; state diagram T3 waits for `pending = 0`; SRS 3.5 says members who never submit must not block the flow | Ready when everyone has submitted and at least two have. The organiser may also close submissions once two have; non-submitters are excluded and notified (new transition T3b) |
| C2 | Synopsis Table 3 puts filtering and ranking in Python with NumPy and scikit-learn | Both are arithmetic, so they live in a TypeScript package. Python returns only if phase P3 adds a learned ranking model |
| C3 | SE description v2 allows PostgreSQL or MongoDB | PostgreSQL only: SRS 3.4 and R11 require enforced referential integrity |
| C4 | SRS 2.2 says reminders are a must, but SRS 2.5 puts notifications in optional Phase 4 and no MoSCoW requirement covers them | Reminders are Should Have, after R12 to R16: in-app first, email second |
| C5 | SRS 2.5 and the synopsis use two different four-phase schemes | Schedule by the synopsis weeks, scope by MoSCoW; the runbook's sprint map joins the two |
