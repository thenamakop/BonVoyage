# integration

- SRS module: External Data Integration
- Academic owner: Manan (Kushagra owns the web screens for every module)
- Requirements served (from docs/traceability.md): R14, R16
- Layering: router, then service, then repository. Routers validate input and call services; services hold the use-case logic; repositories hold the Drizzle queries.

Implemented by Maulik with coding agents.
