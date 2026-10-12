# Traceability matrix

Each requirement from the MoSCoW document, with its trace and sprint. Add the issue and test IDs to the matching row when a requirement is implemented. Source: `docs/RUNBOOK.md` Appendix B1.

| Req | Requirement | Priority | Module | SRS | Use case / DFD | Sprint | Issues | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Register, authenticate, keep a secure session | Must | User & Group Management | 2.2 | Manage Trip Group, 1.0 | S1 | #11, #29 (S1-1) | apps/api/src/auth/auth.test.ts |
| R2 | Create a trip, invite members, manage the roster | Must | User & Group Management | Table 5 | Manage Trip Group, 1.0 | S1 | #12, #30 (S1-2), #31 (S1-3) |  |
| R3 | Structured preference and availability form | Must | Preference Management | Table 6 | Submit Preference Profile, 2.0 | S1 | #13, #32 (S1-4), #33 (S1-5), #36 (S1-8) |  |
| R4 | Group profile, common window, conflict report | Must | Preference Management | Table 6 | Aggregate Group Preferences, 3.0 | S2 | #14 |  |
| R5 | Eliminate destinations over budget, duration or radius | Must | Geospatial & Filtering | Table 7 | Filter by Hard Constraints, 4.0 | S2 | #15 |  |
| R6 | Group-fit score and ranked shortlist | Must | Recommendation Engine | Table 7 | Rank by Group-Fit Score, 4.0 | S2 | #16 |  |
| R7 | Preferences each recommendation meets and misses | Must | Recommendation Engine | Table 7, 3.5 | Recommend Destinations, 4.0 | S2 | #17 |  |
| R8 | Several packages with itemised group and per-person costs | Must | Transport & Cost; Accommodation & Package | Table 8 | Generate Trip Packages, 5.0 | S3 | #18 |  |
| R9 | Organiser sets origin, duration, budget and radius | Must | User & Group Management | Table 5 | Manage Trip Group, 1.0 | S1 | #19, #30 (S1-2) |  |
| R10 | Preference privacy and salted credential hashes | Must | User & Group Management; Preference Management | 3.4, 3.5 | D1 and D3 | S1 | #20, #29 (S1-1), #34 (S1-6) | apps/api/src/auth/auth.test.ts |
| R11 | Relational persistence with referential integrity | Must | all modules | 3.4 | D1 to D6 | S0 onwards | #21, #35 (S1-7), #37 (CAT-A) | packages/db/src/catalogue/catalogue.test.ts, packages/db/test/schema.test.ts, packages/db/test/catalogue-import.test.ts, apps/api/src/seed/run-seed.test.ts |
| R12 | Grounded day-wise itinerary | Should | AI Itinerary Generator | Table 9 | Generate Itinerary, 6.0 | S4 | #22 |  |
| R13 | Accept, modify or reject generated output | Should | Trip & Feedback | 2.2, Table 9 | Review & Decide on Itinerary, 7.0 | S4 | #23 |  |
| R14 | Cached or curated fallback, labelled by provenance | Should | External Data Integration | 3.5, Table 8 | 5.0 and D4 | S3 | #24, #37 (CAT-A), #38 (CAT-B), #39 (CAT-C) | packages/db/src/catalogue/catalogue.test.ts |
| R15 | Screens within 3 s, shortlist within 10 s | Should | all modules | 3.3 | none | Buffer | #25 |  |
| R16 | One mediating module with caching and quota control | Should | External Data Integration | 3.1.3 | 4.0, 5.0 and 6.0 | S2 | #26 |  |
| R17 | Fairness across recommendation rounds | Could | Recommendation Engine | none | Recommend Destinations | deferred | #27 |  |
| R18 | Voting on the shortlist | Could | Trip & Feedback | 2.5 | none yet | deferred | #28 |  |
| R19 | Online payment and booking | Won't | none | 1.2 | none | Won't |  |  |
| R20 | Nationwide real-time inventory | Won't | none | 2.4 | none | Won't |  |  |

Board: https://github.com/users/thenamakop/projects/1
