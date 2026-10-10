# notifications

- SRS module: Notifications
- Academic owner: Parth (Kushagra owns the web screens for every module)
- Requirements served (from docs/traceability.md): none in scope (reminders and email, C4, are deferred)
- R11 and R15 apply to every module.
- Layering: router, then service, then repository. Routers validate input and call services; services hold the use-case logic; repositories hold the Drizzle queries.

Implemented by Maulik with coding agents.
