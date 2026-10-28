# S4-6: Model wording on deployments: quota guard and cache

No deployment can use the language model today: `apps/api/src/server.ts` creates the client when `LIVE_APIS=on`, but `apps/api/src/vercel-entry.ts` never does, so preview and production always use the catalogue templates. The model call also has neither the daily quota guard nor a cache, which AGENTS.md rule 4 requires for every outbound call. Decision D4 approves building both, with one new env var (`GEMINI_DAILY_LIMIT`) and one new table (migration 0003).

**Branch:** `feat/121-model-on-deployments` · **Time box:** 4 hours (L; two commits) · **Depends on:** S4-2 merged · **Issue:** #121 · **After merge (Maulik):** `pnpm db:migrate:remote --target preview`, then `--target production` · **Cut:** with S4-7, after S4-10 and S4-11

```text
S4-6  MODEL WORDING ON DEPLOYMENTS: CLIENT IN VERCEL-ENTRY, QUOTA GUARD, CACHE (MIGRATION 0003)
Branch: feat/121-model-on-deployments (from fresh master)   Time box: 4 hours
Issue: the "Model wording on Vercel" issue in docs/sprints/sprint-4-plan.md.
Follow the Sprint 4 conventions (Q1 to Q10) and the Sprint 3 rules P6 and P7.

CONTEXT
Read AGENTS.md (rules 2 and 4, sections 10 and 11), docs/decisions/0005 (e, f),
docs/sprints/sprint-4-plan.md (finding 1, D4), packages/integrations/README.md (the "Daily quota
guard" section and its Sprint 4 snippet; line 55 on the Gemini SDK's bundle size),
packages/integrations/src/llm (factory.ts, gemini.ts, fixture.ts, types.ts),
packages/integrations/src/quota/quota.ts (withQuota, QuotaExceededError),
packages/integrations/src/cache/distance-cache.ts (the pattern to mirror),
packages/integrations/src/itinerary/wording.ts (composeItineraryWording, 20 s timeout, never
throws), apps/api/src/itinerary/service.ts (planItinerary: the model path and the template
fallback), apps/api/src/server.ts, apps/api/src/vercel-entry.ts, apps/api/src/env.ts,
.env.example, scripts/vercel-build.ts (maxDuration 60) and packages/db/src/schema/catalogue.ts
(distance_cache and provider_usage).
Approved by Maulik under D4: env var GEMINI_DAILY_LIMIT (non-negative integer, default 0 meaning
"no model calls"), and a table llm_cache in a new migration 0003. Nothing else new: no new
dependency, no change to the prompt's content, the validator or the fallback rules.

GOAL
With LIVE_APIS=on and a key set, a deployment words the day plan with the model, at most
GEMINI_DAILY_LIMIT calls per India day, re-using a cached answer for an identical request
without spending quota; over the limit, without a key, on any model failure or with
LIVE_APIS=off, the plan uses the catalogue templates exactly as today.

STEPS
Commit 1: wiring and quota
1. One factory used by both entry points: apps/api/src/llm.ts exports createLlmFromEnv(env)
   returning an LlmClient or undefined (undefined when LIVE_APIS is off; when on, the existing
   createLlmClient, which throws if the key or model is missing). server.ts and vercel-entry.ts
   both call it and pass llm to createApp. Decide what a missing key on a deployment does: it must
   not crash the function at cold start for every route; log one warning without the key's value
   and fall back to templates. Unit-test the factory for off, on with key and model, and on
   without key.
2. env.ts: GEMINI_DAILY_LIMIT as z.coerce.number().int().min(0).default(0). .env.example: the name
   with a comment, no value beyond 0 (Q7).
3. Quota at the application boundary (integrations README snippet): in the itinerary service,
   wrap the single model call in withQuota(db, { provider: 'gemini', limit: env limit, calls: 1,
   day: indiaDate(clock()) }, ...). QuotaExceededError means the template path with
   reason 'quota'; the existing info log line gains wordingFallback: 'quota' | 'timeout' |
   'invalid' | 'error' | null (no prompt text, no member data). Keep the model call outside
   transitionTrip's lock (P7).
4. Tests (integration, FixtureLlmClient that counts calls): limit 0 gives the catalogue plan and
   zero model calls; limit 1 gives one model-worded plan then, for a second different trip the same
   India day, the catalogue plan with zero further calls; the next India day (inject the clock)
   allows a call again; a model failure still counts against the quota (README rule) and falls
   back.
Commit 2: cache (migration 0003)
5. Schema: llm_cache (id uuid pk, cache_key text unique not null, provider text not null, model
   text not null, response jsonb not null, created_at timestamptz default now, expires_at
   timestamptz not null) with an index on expires_at. cache_key = sha256 hex of
   provider + model + schemaName + system + prompt (the exact strings sent). Generate 0003 with
   drizzle-kit, read the SQL in full and paste it in the PR. Never edit 0000 to 0002.
6. integrations/src/cache/llm-cache.ts: readLlmCache(db, key, now) and writeLlmCache(db, entry)
   mirroring distance-cache (fresh means expires_at > now; a write failure is logged once with a
   fixed reason code and never fails the plan). TTL 30 days, injected.
7. Order in the service: build the prompt; read the cache; on a hit use it (no quota, no model
   call); on a miss go through withQuota and the model; store only a reply that passed the
   ItineraryWording schema. The validator still checks every note after merging, exactly as today,
   and the per-item and whole-plan fallbacks are unchanged. The stored itinerary's model column
   records the model id for a cached reply too. The info log line gains wordingCache:
   'hit' | 'miss' | null (null on the template path), so S4-7 can read it from Vercel's logs.
8. Tests: a repeated identical fact sheet is served from the cache with zero model calls and zero
   quota used; a different fact sheet misses; an expired entry misses; a cache read failure falls
   through to the model path; assertNoPersonalData still runs before the cache is read (the
   cache never stores member data: assert a stored row's prompt-derived key and response contain
   no member name, email or id).
9. Bundle and runtime: run pnpm vercel-build and report the function bundle size before and after
   (the SDK is about 1 MB); confirm maxDuration 60 covers the 20 s timeout plus planning.
10. Docs: integrations README (quota and cache now wired for Gemini), docs/prompts/sprint-3/
    README.md (replace the optional preview step with "see docs/prompts/sprint-4/S4-7"),
    traceability R12, R14, R16. PR "feat: model wording on deployments with quota guard and
    cache", body "Closes #121" and "After merge (Maulik): pnpm db:migrate:remote --target
    preview; then --target production". Do not set any Vercel variable (Q6).

VERIFICATION
Paste: the migration SQL; pnpm vitest run --project integration apps/api/src/itinerary
packages/integrations ; pnpm vitest run --project unit apps/api/src/llm* packages/integrations ;
the bundle sizes; pnpm format:check; pnpm lint; pnpm typecheck; pnpm test summary;
pnpm vercel-build && pnpm smoke:function; the CI result.

IF BLOCKED
The SDK pushes the function over a Vercel limit, or cold start fails without a key: stop and
report the numbers. Caching would need the prompt to change: stop (the prompt is fixed by S3-6).
A test needs a real key: it must not; use the fixture client (LIVE_APIS=off in tests).
```
