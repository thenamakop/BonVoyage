# Accounts register

Which services BonVoyage uses and who owns them. This file never contains a key, token or connection string.

| Service                                              | Purpose                                             | Owner  | Where the secret lives           | Status                                       |
| ---------------------------------------------------- | --------------------------------------------------- | ------ | -------------------------------- | -------------------------------------------- |
| GitHub repository                                    | Source code, pull requests, CI, project board       | Maulik | password manager entry BonVoyage | Active                                       |
| Vercel project                                       | Hosting for the SPA and the /api function (ADR-010) | Maulik | password manager entry BonVoyage | Account ready; project imported in S0-3      |
| Neon project (Singapore, branches default + preview) | PostgreSQL database (ADR-005, ADR-010)              | Maulik | password manager entry BonVoyage | Active                                       |
| Google AI Studio (Gemini)                            | Language model for itinerary text (ADR-008)         | Maulik | password manager entry BonVoyage | Active                                       |
| Google Cloud Routes API                              | Road distances                                      | Maulik | password manager entry BonVoyage | Not set up, billing unavailable, see ADR-007 |
