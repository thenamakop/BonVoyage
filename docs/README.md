# BonVoyage documentation

Start with `RUNBOOK.md`: it is the pre-development plan, and its appendices hold the agent prompts (A), the requirements, transitions and API tables (B).

| Folder | Contents |
| --- | --- |
| `baseline/` | The approved documents. Each `.docx` has a `.md` copy for coding agents; the `.docx`/`.pdf` is the official version |
| `design/` | Use case diagram, Design Lab diagrams (DFD Level 0 and 1, sequence, state machine) as `.drawio`, `.pdf` and `png/` |
| `decisions/` | Baseline reconciliation (0000) and ADR-001 to ADR-010 |
| `specs/` | Scoring spec and other contracts written before code |
| `spikes/` | One-page notes from spikes S1 to S4 |
| `api/` | Bruno request collections |

The SRS v1.1 is the requirements reference. When a document and the code disagree, fix the document through a new ADR, never silently.
