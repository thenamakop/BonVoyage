# recommendation

- SRS module: Recommendation Engine
- Academic owner: Maulik (Kushagra owns the web screens for every module)
- Requirements served (from docs/traceability.md): R4, R6, R7, R11, R17 (deferred)
- Layering: router, then service, then repository. Routers validate input and call services; services hold the use-case logic; repositories hold the Drizzle queries.

Implemented by Maulik with coding agents.
