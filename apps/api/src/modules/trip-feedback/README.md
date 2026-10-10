# trip-feedback

- SRS module: Trip & Feedback
- Academic owner: Parth (Kushagra owns the web screens for every module)
- Requirements served (from docs/traceability.md): R13, R18 (deferred)
- Layering: router, then service, then repository. Routers validate input and call services; services hold the use-case logic; repositories hold the Drizzle queries.

Implemented by Maulik with coding agents.
