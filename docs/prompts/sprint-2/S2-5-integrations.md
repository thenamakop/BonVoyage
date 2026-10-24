# S2-5: Integrations module: routing, cache and quota (R16)

One place through which every outside fact enters the app. In Sprint 2 that is only road distances, from the catalogue or a straight-line estimate, but the cache and the daily quota guard are built for real now, because Sprint 4's Gemini calls (20 a day on the free tier) will go through the same guard.

**Branch:** `feat/s2-5-integrations` · **Time box:** 2 hours · **Depends on:** S2-2 merged (it can run alongside S2-3 and S2-4) · **Issue:** S2-5

```text
S2-5  INTEGRATIONS MODULE: ROUTING PROVIDERS, DISTANCE CACHE AND QUOTA CONTROL (R16)
Branch: feat/s2-5-integrations   Time box: 2 hours   Issue: S2-5 (gh issue list --milestone "Sprint 2 (24-27 Oct)")

CONTEXT
Read AGENTS.md (design rule 4: every outbound call goes through the External Data Integration
module, is cached, and falls back to curated data with a provenance label), docs/prompts/sprint-2/
README.md (rules S6, S8), docs/decisions/ADR-006, ADR-007 and 0004 (f, l), packages/integrations as
it stands, the db schema for fare_fallback, distance_cache and provider_usage (S2-2), estimateRoadKm in
the engine, and indiaDate in packages/shared.
No live routing key exists (ADR-007), so Sprint 2 has two providers: curated (catalogue car rows)
and estimate (straight line times the road factor). The cache and quota code must still be real and
tested with a fake limited provider.

GOAL
packages/integrations exports createRouting(deps) whose getDistances(origin, destinations) returns
one DistanceResult per destination, tries providers in order, reads and writes distance_cache, counts
calls in provider_usage against daily limits and falls back cleanly. A generic withQuota helper is
ready for Sprint 4.

STEPS
1. src/types.ts: Provenance = "live" | "cached" | "curated" | "estimated" (reuse the shared enum if
   one exists); DistanceResult { destinationId, km (integer, rounded up), durationMin: number | null,
   provenance, provider, fromCache }; RoutingProvider { name; dailyLimit: number | null;
   getDistances(origin: { key, lat, lng }, dests: { id, lat, lng }[]) } returning a Map of results
   for the destinations it can answer (it may answer fewer than asked).
2. src/routing/curated.ts: curatedProvider(db) reads the fare_fallback car rows for the origin hub
   (origin key = hub slug) in ONE query; provenance "curated" when review_status is verified, else
   "estimated" (0004 f); durationMin from the row.
3. src/routing/estimate.ts: estimateProvider() uses estimateRoadKm; durationMin null; provenance
   "estimated"; answers every destination.
4. src/cache/distance-cache.ts: one query reads fresh rows (expires_at > now) for an origin key, a
   provider and a list of destinations; one statement upserts results with expires_at = now +
   ttlDays. A cached answer comes back with fromCache true and the provenance it was stored with.
5. src/quota/quota.ts: withQuota(db, { provider, limit, calls, day }, fn). limit null: run fn.
   Otherwise add calls to provider_usage for (provider, day) atomically (INSERT ... ON CONFLICT DO
   UPDATE ... RETURNING calls); if the new total exceeds the limit, subtract it back and throw
   QuotaExceededError without calling fn. day is the India date (indiaDate of the injected clock).
6. src/routing/create-routing.ts: createRouting({ db, providers, clock, ttlDays, logger }) returns
   { getDistances }. For each provider in order: answer what the cache has, call the provider for the
   rest inside withQuota, store new answers in the cache, and move on with whatever is still
   unanswered. A provider error or QuotaExceededError is logged once (provider, reason; no
   coordinates) and the next provider takes over; nothing is thrown to the caller. Require the last
   provider to answer everything (the estimate provider), so every destination gets a result.
7. Export from the package index. apps/api builds one routing instance from createApp deps
   (providers [curated, estimate], ttlDays 30) so tests can inject fakes. No route uses it yet
   (S2-6 does).
8. Integration tests (add packages/integrations to the integration project's include if needed):
   - a draft car row gives provenance estimated; a verified one gives curated; no row falls back to
     the estimate provider;
   - a second call is served from the cache (fromCache true, same km) and calls no provider;
   - expired cache rows are ignored and replaced;
   - a fake "live" provider with dailyLimit 2: the first two calls use it, the third falls back,
     provider_usage shows 2, and the next India day (injected clock) resets the count;
   - two parallel withQuota calls with limit 1: exactly one runs;
   - a provider that throws falls back without failing the request;
   - one getDistances call for 44 destinations makes at most one query per provider plus the cache
     reads and writes (count queries with a wrapper or a spy).
9. packages/integrations/README.md: what must go through the module, the providers, the cache, the
   quota table, and how Sprint 4 adds Gemini with withQuota. Traceability on R16. PR "feat:
   integrations module with distance cache and quota control", body starts "Closes #<S2-5>".

VERIFICATION
Paste the real output of: pnpm vitest run --project integration packages/integrations ;
pnpm verify ; pnpm vercel-build && pnpm smoke:function.

IF BLOCKED
distance_cache's columns differ from this prompt: use what 0000_init created; if a needed column is
missing, stop and ask (no migration here). Never call a real external API. Never edit .env or print
env values.
```
