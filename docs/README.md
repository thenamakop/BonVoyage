# BonVoyage documentation

Start with `RUNBOOK.md`: it is the pre-development plan, and its appendices hold the agent prompts (A), the requirements, transitions and API tables (B).

| Item | Contents |
| --- | --- |
| `RUNBOOK.md` | The pre-development plan, with agent prompts (A) and reference tables (B) |
| `baseline/` | The approved documents. Each `.docx` has a `.md` copy for coding agents; the `.docx`/`.pdf` is the official version |
| `design/` | Use case diagram, Design Lab diagrams (DFD Level 0 and 1, sequence, state machine) as `.drawio`, `.pdf` and `png/` |
| `decisions/0000-baseline-reconciliation.md` | How disagreements between the baseline documents are resolved |
| `decisions/0001-state-machine-clarifications.md` | Rulings on open cases in the trip state machine |
| `decisions/ADR-001-typescript.md` | TypeScript, strict, everywhere |
| `decisions/ADR-002-pnpm-monorepo.md` | pnpm workspace layout and the pure engine package |
| `decisions/ADR-003-web-stack.md` | React, Vite, React Router, TanStack Query, Tailwind CSS v4 |
| `decisions/ADR-004-api-stack.md` | Node.js 24 LTS, Express 5, zod, one error envelope |
| `decisions/ADR-005-data-postgres-drizzle.md` | PostgreSQL, Drizzle, SQL migrations |
| `decisions/ADR-006-travel-data-catalogue.md` | Curated catalogue with provenance for travel data |
| `decisions/ADR-007-distances-routing-provider.md` | RoutingProvider for distances |
| `decisions/ADR-008-language-model-gemini.md` | Gemini behind the LlmClient interface |
| `decisions/ADR-009-auth-better-auth.md` | Better Auth with Postgres sessions |
| `decisions/ADR-010-hosting-and-workflow.md` | Vercel, Neon, solo-developer workflow, scope cut |
| `specs/` | Scoring spec and other contracts written before code |
| `spikes/` | One-page notes from spikes S1 to S4 |
| `api/` | Bruno request collections |
| `sprints/` | One review file per sprint |
| `prompts/` | Agent prompts for each sprint, run in order |
| `accounts.md` | Register of services and owners, with no secrets |
| `traceability.md` | Requirement-to-issue-to-test matrix |

The SRS v1.1 is the requirements reference. When a document and the code disagree, fix the document through a new ADR, never silently.
