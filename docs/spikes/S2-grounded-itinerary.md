# S2: Grounded itinerary with a free-tier Gemini

Status: complete · Date: 2026-10-12 · Prompt: S0-7 (corrects RUNBOOK prompt A6)

## Question

Can a free-tier Gemini model return a valid day-wise itinerary built only from a fact sheet, and does `validateItinerary` catch it when it does not?

## Method

- Kept code: `GeminiLlmClient` (`@google/genai` **2.28.0**), `FixtureLlmClient`, `createLlmClient`, `buildItineraryPrompt`/`assertNoPersonalData` in `packages/integrations`; `validateItinerary` in `packages/engine` (pure logic); `FactSheet` and `ItineraryOutput` contracts in `packages/shared`.
- Model id from `GEMINI_MODEL`: **gemini-3.8-flash** for the 20-run batch, **gemini-3.5-flash-lite** for the 5-run comparison (pass rate was under 80 %, as the prompt prescribes).
- Structured output via `config.responseMimeType: 'application/json'` + `config.responseJsonSchema` (this SDK version accepts `responseJsonSchema: unknown`; `z.toJSONSchema()` output passed with only `$schema` removed). Thinking `thinkingConfig.thinkingLevel: 'low'`, no thinking budget, no temperature/topP/topK.
- 20 sequential calls at a 7 s gap, then 5 calls at a 15 s gap on the fallback. Each output re-checked with the zod schema and scored by `validateItinerary` against the hand-written Rishikesh fact sheet (`fact-sheet.json`; draft catalogue values, 2 nights, Friday 6 Nov 2026, group of 4, bus legs).
- Run files live under `packages/integrations/spikes/itinerary/out/` (`run-NN.json`, `run-lite-NN.json`, `injected.json`, `summary*.json`) and are not committed.

## Numbers

gemini-3.8-flash, 20 calls:

| measure | value |
| --- | --- |
| completed calls | 7 of 20 |
| failed calls | 13 (six HTTP 503 overload, seven HTTP 429) |
| `ok` runs | **0** |
| runs with verifiedRatio 1.00 | 7 of 7 completed |
| error codes | `DAY_TOO_LONG` ×12 |
| median latency | 129.0 s |
| p95 latency | 267.9 s |
| mean tokens (completed) | 1,355 in / 919 out / 0 thinking |

gemini-3.5-flash-lite, 5 calls:

| measure | value |
| --- | --- |
| completed calls | 5 of 5 |
| `ok` runs | **0** |
| runs with verifiedRatio 1.00 | 4 of 5 |
| error codes | `DAY_TOO_LONG` ×10 |
| unverified items | 1 (`ends after beatles-ashram closes at 16:00`) |
| median latency | 3.3 s |
| p95 latency | 4.4 s |
| mean tokens | 1,355 in / 892 out / 0 thinking |

## Injected price

Caught. `₹9,999` inserted into an activity note of `run-01.json`; re-validation flags that item unverified with "unverified number ₹9,999 in note" (`out/injected.json`).

## Rate limits hit

- gemini-3.8-flash free tier is **20 requests/day/project/model** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`); the batch exhausted it and the API quoted a ~9 h 47 m reset. The 503 "model is overloaded" errors also cost attempts.
- gemini-3.5-flash-lite: zero throttles at a 15 s gap.

## What actually failed

Grounding is **not** the problem — 11 of 12 outputs cite only fact-sheet places and numbers (verifiedRatio 1.00). Every run fails `DAY_TOO_LONG`: the model plans a normal sightseeing day **and** the onward/return coach leg in the same span, so first-start to last-end exceeds `limits.maxDayHours` (e.g. a 09:00 activity plus the 16:00–22:30 return bus = 13.5 h). The validator is working as specified; the prompt/rules need a travel-day accommodation.

## Decision and recommendation for Sprint 4

- **Switch the default to gemini-3.5-flash-lite.** It is ~40× faster (3.3 s median vs 129 s), did not throttle, and grounds identically. gemini-3.8-flash's 129 s median and 20/day quota make it unusable for the 30 s itinerary target (SRS 3.3); 3.3 s fits comfortably, leaving room for retries and validation.
- **Prompt change needed, not a validator change.** Tell the model to keep travel days compact or emit travel as the only timed span that day; alternatively feed legs outside the day-span rule. Do not relax `DAY_TOO_LONG` — it is the Table 9 "no day runs beyond a reasonable length" check.
- **Keep `validateItinerary` as the gate.** It caught the only grounding slip (ashram closing time) and the injected fake price.
- **Add to the validator before S4:** none required by this spike; optionally flag activity items whose duration is far beyond `typicalMinutes` — observed but not measured here.
- **Quota planning:** itinerary generation plus any re-try must assume ~20 calls/day on flash-lite too; cache per (trip, package) pair and never re-call on page reload.
