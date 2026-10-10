# Traceability matrix

Each requirement from the MoSCoW document, with its trace and sprint. Add the issue and test IDs to the matching row when a requirement is implemented. Source: `docs/RUNBOOK.md` Appendix B1.

| Req | Requirement | Priority | Module | SRS | Use case / DFD | Sprint | Issues | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Register, authenticate, keep a secure session | Must | User & Group Management | 2.2 | Manage Trip Group, 1.0 | S1 |  |  |
| R2 | Create a trip, invite members, manage the roster | Must | User & Group Management | Table 5 | Manage Trip Group, 1.0 | S1 |  |  |
| R3 | Structured preference and availability form | Must | Preference Management | Table 6 | Submit Preference Profile, 2.0 | S1 |  |  |
| R4 | Group profile, common window, conflict report | Must | Preference Management | Table 6 | Aggregate Group Preferences, 3.0 | S2 |  |  |
| R5 | Eliminate destinations over budget, duration or radius | Must | Geospatial & Filtering | Table 7 | Filter by Hard Constraints, 4.0 | S2 |  |  |
| R6 | Group-fit score and ranked shortlist | Must | Recommendation Engine | Table 7 | Rank by Group-Fit Score, 4.0 | S2 |  |  |
| R7 | Preferences each recommendation meets and misses | Must | Recommendation Engine | Table 7, 3.5 | Recommend Destinations, 4.0 | S2 |  |  |
| R8 | Several packages with itemised group and per-person costs | Must | Transport & Cost; Accommodation & Package | Table 8 | Generate Trip Packages, 5.0 | S3 |  |  |
| R9 | Organiser sets origin, duration, budget and radius | Must | User & Group Management | Table 5 | Manage Trip Group, 1.0 | S1 |  |  |
| R10 | Preference privacy and salted credential hashes | Must | User & Group Management; Preference Management | 3.4, 3.5 | D1 and D3 | S1 |  |  |
| R11 | Relational persistence with referential integrity | Must | all modules | 3.4 | D1 to D6 | S0 onwards |  |  |
| R12 | Grounded day-wise itinerary | Should | AI Itinerary Generator | Table 9 | Generate Itinerary, 6.0 | S4 |  |  |
| R13 | Accept, modify or reject generated output | Should | Trip & Feedback | 2.2, Table 9 | Review & Decide on Itinerary, 7.0 | S4 |  |  |
| R14 | Cached or curated fallback, labelled by provenance | Should | External Data Integration | 3.5, Table 8 | 5.0 and D4 | S3 |  |  |
| R15 | Screens within 3 s, shortlist within 10 s | Should | all modules | 3.3 | none | Buffer |  |  |
| R16 | One mediating module with caching and quota control | Should | External Data Integration | 3.1.3 | 4.0, 5.0 and 6.0 | S2 |  |  |
| R17 | Fairness across recommendation rounds | Could | Recommendation Engine | none | Recommend Destinations | deferred |  |  |
| R18 | Voting on the shortlist | Could | Trip & Feedback | 2.5 | none yet | deferred |  |  |
| R19 | Online payment and booking | Won't | none | 1.2 | none | Won't |  |  |
| R20 | Nationwide real-time inventory | Won't | none | 2.4 | none | Won't |  |  |
