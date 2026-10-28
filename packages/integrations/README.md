# External data integrations

R16: all third-party calls belong here, never in the engine or API services. Adapters validate external responses, return provenance and fall back rather than making the application depend on a live service. Sprint 2 makes no external routing requests. The existing Gemini client is spike infrastructure; Sprint 4 connects its production calls to the generic quota guard.

## Routing

`createRouting({ db, providers, clock, ttlDays, logger }).getDistances(origin, destinations)` returns a `Map<destinationId, DistanceResult>`. Origins contain `{ key, lat, lng }` (key is the hub slug); destinations contain `{ id, lat, lng }`.

There is one `DistanceResult` type in `src/types.ts`: `{ destinationId, km, durationMin, provenance, provider, fromCache }`. Provenance reuses `@bonvoyage/shared`. Distances round up to whole kilometres; unknown driving time is null. Providers can return partial answers, but routing finishes every valid destination using the estimate provider.

Default provider order:

1. **curated**: one joined query reads car rows for the origin hub and all requested destination IDs. Verified rows are `curated`; draft rows are `estimated`. Non-car fares are not road-distance evidence.
2. **estimate**: `estimateRoadKm` from the pure engine, haversine times the road factor, rounded upward. Always `estimated`, with null duration.

Both have unlimited daily calls and `cacheable: false`. The provider list must end with an unlimited, uncached provider named `estimate`; a built-in estimate also completes any answers missing from an injected/faulty terminal provider. Inputs must already have valid coordinates. Configuration errors are rejected at construction.

### Approved cache policy deviation

**only external providers are cached; curated and estimate answers are always fresh so provenance changes as soon as a row is verified**.

Maulik approved this departure from decision 0004(f) / S2-5 step 6 during implementation. Caching local database facts or arithmetic saves little and would preserve an obsolete estimated label for up to 30 days after verification. Strict provider order is retained: a later provider's cached answer never bypasses an earlier provider.

A future external provider sets `cacheable: true`. For that provider, routing reads fresh cache entries first, calls it only for unanswered destinations inside `withQuota`, and batch-upserts its new answers. Cache hits consume no provider quota. Different origin/provider keys cannot share entries.

`distance_cache` uses its existing `(origin_key, destination_id, provider)` unique index. Each read is one query; each write is one multi-row upsert. `expires_at > clock()` is fresh; equality is expired. The application uses a 30-day TTL. `fromCache: true` preserves the stored provenance (for example `live`), rather than replacing it with `cached`.

Provider/cache failures produce one warning containing only provider name and a fixed reason code, never coordinates, raw messages or request payloads. Routing continues with the next provider. A successful answer survives a cache-write failure.

## Daily quota guard

`withQuota(db, { provider, limit, calls, day }, fn)` returns `fn`'s result. `day` is `indiaDate(clock())` from shared code; callers inject their clock. Limits are nonnegative integers, calls are positive integers. Null limits run directly without SQL.

Limited providers reserve calls using `provider_usage(provider, day, calls)` and atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. An over-limit reservation is subtracted back within the same short transaction, then raises `QuotaExceededError` without invoking the provider. The transaction commits before `fn` starts: no database lock is held during external work. Accepted attempts count even when the provider subsequently fails. Requests for the next India date use a new row, not a destructive reset.

Each routing batch reserves one call per provider invocation, not one per destination. An adapter that makes multiple outbound requests must reserve the corresponding number of calls through the generic helper.

## The model client: quota guard and cache (#121)

Gemini is wired through `createGuardedLlmClient(inner, { db, provider: 'gemini', dailyLimit, clock, ttlDays: 30, logger })` in `src/llm/guarded.ts`, which returns an `LlmClient`. The API builds it once, in `apps/api/src/llm.ts` (`createLlmFromEnv`), for both `server.ts` and the Vercel function. With `LIVE_APIS=off`, or `on` without `GEMINI_API_KEY` or `GEMINI_MODEL` (one warning naming the missing variable), there is no client and the day plan uses the catalogue templates.

Each `generateStructured` request:

1. builds `cache_key`, the sha256 hex of provider, the inner model id, the schema name, the system text and the prompt, joined by NUL. The prompt is never stored, only this hash, so `llm_cache` holds no member data;
2. reads `llm_cache` (migration 0003). A fresh row (`expires_at` after now) whose response passes the request's schema is returned with `fromCache: true`: no model call and no quota. A row that fails the schema is a miss, logged as `cache_corrupt`;
3. on a miss, reserves one call with `withQuota(db, { provider, limit: GEMINI_DAILY_LIMIT, calls: 1, day: indiaDate(now) })` and calls the model. The default limit is 0, so every call is refused until `GEMINI_DAILY_LIMIT` is set; `QuotaExceededError` propagates;
4. writes the reply with `expires_at = now + 30 days`. A failed read or write logs `cache_read_failed` or `cache_write_failed` (provider and code only) and never fails the call.

`composeItineraryWording` catches every failure and returns a fixed code (`quota`, `timeout`, `invalid` or `error`), never a raw message. The itinerary service logs it as `wordingFallback`, with `wordingCache: 'hit' | 'miss' | null`, on its "itinerary planned" line. Prompts stay limited to verified destination facts (`assertNoPersonalData` runs before the client is called), and no trip-state lock is held while awaiting the model.

## API wiring and package exports

`createApp` builds one routing instance per application, using curated then estimate, the injected clock/logger/database and a 30-day TTL. Tests can supply `AppDeps.routing`. The instance is passed into API dependencies; no endpoint consumes it until S2-6.

The package root exports Gemini, the guarded client and the routing API; `@bonvoyage/integrations/routing` is a subpath with no Gemini import. Since #121 the Vercel function imports the root to build the model client: `.vercel/output/functions/api.func/index.mjs` went from 5,678,281 to 6,317,009 bytes (+638,728, about 0.6 MB), 16.8 MB with its source map, far under Vercel's 250 MB function limit.

## Verification

Pure estimate/type tests live under `src/` and run in Vitest's unit project. Database tests live under `test/` and are included only in the integration project. They exercise real local PostgreSQL with fake providers, never a live routing API.

```text
fnm exec --using=24.21.0 pnpm vitest run --project integration packages/integrations
fnm exec --using=24.21.0 pnpm verify
fnm exec --using=24.21.0 pnpm vercel-build
fnm exec --using=24.21.0 pnpm smoke:function
```

Integration setup resets only a local `*_test` database on port 5433. No migration or development/remote reset is part of this task.

`estimateRoadKm` callers were checked before changing its rounding: the existing production caller is `packages/db/src/catalogue/checks.ts`; it is re-exported by the engine index and covered by `geo.test.ts`. The new estimate provider also calls it. Catalogue checker and geo tests must pass alongside routing tests.
