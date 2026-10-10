# S0-7: Grounded itinerary spike with Gemini (spike S2)

Answers the riskiest open question before Sprint 4 depends on it: can the free-tier model return a valid day-wise itinerary built only from a fact sheet, and does the validator catch it when it does not? The Gemini client and the validator are kept as real code; only the run script is throwaway. This is the one prompt that spends API quota, about 25 calls.

**Branch:** `feat/s0-itinerary-spike` · **Time box:** 3 hours · **Depends on:** S0-4 merged (Rishikesh rows); independent of S0-3, S0-5 and S0-6 · **Before running:** `GEMINI_API_KEY` and `GEMINI_MODEL` are in your `.env` and the key has been rotated

```text
S0-7  GROUNDED ITINERARY SPIKE WITH GEMINI (SPIKE S2)
Branch: feat/s0-itinerary-spike   Time box: 3 hours

CONTEXT
Read AGENTS.md (design rules 2 and 4, section 11), docs/decisions/ADR-008, docs/RUNBOOK.md Phase 7 (spike S2 and its four validator rules) and prompt A6, and packages/db/catalogue/README.md. SRS Table 9: the itinerary is built from verified places, distances and costs, never from the model's memory; anything unverifiable is omitted or marked unverified; no day runs beyond a reasonable length.

Corrections to RUNBOOK prompt A6 (decided; this prompt wins):
- Do NOT set temperature, topP or topK. Google recommends the defaults for Gemini 3.x models.
- Use thinking level "low" (thinkingConfig.thinkingLevel) and never combine it with a thinking budget.
- The model id always comes from GEMINI_MODEL (currently gemini-3.8-flash; fallback gemini-3.5-flash-lite). Never hard-code it.
- Structured output: the field names changed between @google/genai versions (responseMimeType with responseJsonSchema in some, a responseFormat object in others). Use whatever the INSTALLED version's TypeScript types accept, and say which in the note.
- The validator is pure logic, so it lives in packages/engine, not in integrations.
- Free-tier prompts may be used to improve Google's products: prompts carry destination facts only, never names, emails, user ids or personal budgets.

GOAL
A kept GeminiLlmClient (behind the S0-2 LlmClient interface) and a kept validateItinerary, both unit-tested without network access; a spike run of 20 generations plus one injected fake price; and docs/spikes/S2-grounded-itinerary.md with the pass rate, failure types, median and p95 latency, tokens per run, and a recommendation for Sprint 4.

STEPS
1. Shared contracts in packages/shared/src/itinerary.ts (zod 4, exported from the index):
   - FactSheet: { trip: { nights, startDate, endDate, groupSize, interests: activity values }, destination: { slug, name, state }, legs: [{ id: "onward" | "return", mode, from, to, depart "HH:MM", arrive "HH:MM", durationMinutes, farePerPersonInr }], stay: { tier, perRoomPerNightInr, rooms }, pois: [{ id, name, category, typicalMinutes, openTime "HH:MM" | null, closeTime "HH:MM" | null, closedDays: number[], entryFeeInr }], costs: { totalInr, perPersonInr, items: [{ category, amountInr }] }, limits: { maxDayHours } }.
   - ItineraryOutput: { days: [{ day (integer from 1), date "YYYY-MM-DD", items: [{ start "HH:MM", end "HH:MM", kind: travel | stay | activity | meal | free, poiId?, legId?: "onward" | "return", note (at most 200 characters) }] }], summary (at most 600), reasons (1 to 5 strings, each at most 200) }.

2. packages/engine/src/itinerary/validate.ts: validateItinerary(output, facts) is pure and returns { ok, errors, items, verifiedRatio }, where errors are structural problems ({ code, message, day? }) and items has one entry per item { day, index, verified, reasons }. An unverified item is marked, not dropped (SRS Table 9). Rules:
   a) Places: an item's poiId must exist in facts.pois; an activity item without a poiId is unverified.
   b) Numbers: extract every number from note, summary and reasons (digits with optional commas, decimals, and a ₹ or Rs prefix; read HH:MM as a time, not two numbers). A number is allowed if it appears anywhere in the fact sheet, is a day number from 1 to the day count, or is the night count or group size. A time is allowed if it is the item's own start or end or appears in the fact sheet. An unknown number or time in a note makes that item unverified; in the summary or reasons it is an error UNVERIFIED_NUMBER.
   c) Days: the day count equals nights + 1; dates run consecutively from trip.startDate; day 1 contains a travel item with legId onward, and the last day one with legId return. Otherwise an error.
   d) Hours: an activity with a poiId must start at or after openTime and end at or before closeTime (when the POI has hours), and must not fall on one of its closedDays (0 = Sunday, from the item's date). A violation makes the item unverified.
   e) Day length: from the first start to the last end of a day, ignoring stay items, at most limits.maxDayHours x 60 minutes. Otherwise an error DAY_TOO_LONG.
   f) Times: valid HH:MM, end after start, items in order without overlap. Otherwise an error.
   ok is true when there are no errors. verifiedRatio = verified items / all items.
   Unit tests with a hand-written valid fixture (it passes with verifiedRatio 1) and one test per rule that breaks it: an unknown poiId, "₹9,999" in a note, an unknown time, an unknown number in the summary, a wrong day count, a missing return leg, an activity before opening, an activity on a closed day, a 12-hour day, overlapping items.

3. packages/integrations/src/llm/gemini.ts: class GeminiLlmClient implements LlmClient.
   - Add @google/genai (Google's official SDK; latest stable). Constructor { apiKey, model, sdk? }, where sdk is an injectable object with models.generateContent, defaulting to new GoogleGenAI({ apiKey }).
   - generateStructured({ system, prompt, schema, schemaName }): convert the zod schema with z.toJSONSchema, strip keywords Gemini rejects (start with "$schema"; remove others only if the API rejects them, and list them in the note), and call generateContent with the model, the prompt as contents, and config holding the system instruction, JSON output with that schema, and thinking level low. Time it with performance.now(). Parse the text as JSON and validate it with the zod schema.
   - Errors become IntegrationError (provider "gemini"): 429 and 5xx are retryable; invalid JSON, schema mismatch and other 4xx are not. Keep the raw text on the error for the spike, but never log it above debug, and never log the key.
   - Map usage metadata to LlmUsage (input, output and thinking tokens).
   - src/llm/fixture.ts: FixtureLlmClient returns recorded outputs keyed by schemaName. src/llm/index.ts: createLlmClient({ liveApis, apiKey, model }) gives Gemini when liveApis is "on" and a key is set, a fixture client when "off", and throws when "on" without a key.
   - Unit tests with a fake sdk (no network): the success path maps usage and returns parsed data; invalid JSON and a schema mismatch throw non-retryable errors; a 429 throws a retryable one; the config sent to the SDK has no temperature, topP or topK and does have thinking level low; createLlmClient picks the fixture client when LIVE_APIS is off.

4. packages/integrations/src/itinerary/prompt.ts: buildItineraryPrompt(facts) returns { system, prompt }. The system text says: use only places and numbers from the fact sheet; refer to places by their id in poiId; keep activities inside opening hours and off closed days; put the onward journey on day 1 and the return on the last day; keep each day within limits.maxDayHours; write British English in short notes; output JSON matching the schema. The prompt holds the fact sheet as JSON. assertNoPersonalData(text) throws if the text contains an email address, a phone number or a key-like string (AIza... or AQ....); the prompt builder calls it. Tests for both.

5. The spike (throwaway code) in packages/integrations/spikes/itinerary/:
   - fact-sheet.json, written by hand from the rishikesh rows in packages/db/catalogue (gurugram as origin, bus legs, budget stay, 6 to 8 POIs, 2 nights, a Friday start in November 2026, group of 4, interests from the vocabulary), plus a top-level "note": "draft catalogue values; this spike measures grounding, not prices". It must pass FactSheet.parse.
   - run.ts (tsx), refusing to run without --live. It calls loadRootEnv, reads GEMINI_API_KEY and GEMINI_MODEL (never printing the key), builds the prompt once, and makes 20 sequential calls spaced by --gap seconds (default 7) to stay under the free-tier rate limit. On a 429 it waits for the retry delay the error gives (or 60 s), retries once, and records it. Each run is saved to out/run-NN.json: model, latencyMs, usage, the validation result and the raw output.
   - Injection: take the first run with ok true, insert "₹9,999" into one activity note, re-validate, and assert that item becomes unverified. Save as out/injected.json.
   - Write out/summary.json: runs, ok count, runs with verifiedRatio 1 (the pass rate), error codes by frequency, unverified reasons by frequency, median and p95 latency, mean input, output and thinking tokens, the 429 count, and whether the injection was caught.
   - If the pass rate is below 80 per cent, do one more batch of 5 runs with GEMINI_MODEL overridden to gemini-3.5-flash-lite (--model flag) for comparison.
   - Root script "spike:itinerary": "tsx packages/integrations/spikes/itinerary/run.ts". out/ is already gitignored.

6. docs/spikes/S2-grounded-itinerary.md (one page): question; method (model id, @google/genai version, structured-output fields used, thinking level low, no sampling parameters, 20 runs at the chosen gap); numbers (the summary table); whether the injected price was caught; rate limits met; decision and recommendation for Sprint 4 (keep the model or switch to the fallback; prompt changes; whether 30 s fits SRS 3.3 given the latency; what the validator must add). Link the run files only by name; they are not committed.

7. docs/traceability.md: R12 gets the validator and client test files (spike evidence only; R12 itself is Sprint 4).

VERIFICATION
Paste the real output of:
  pnpm test:unit
  pnpm verify
  pnpm spike:itinerary --live          (about 3 minutes; paste the final summary, not every run)
  git status --short                   (no file from out/ is staged)
  git grep -nE "(temperature|topP|topK)[[:space:]]*:" -- packages ':!*.test.ts'     (must print nothing; only tests may name them)
Then print the S2 note in full.
Report: the pass rate, median and p95 latency, the injected-price result, the structured-output fields you used, the SDK version, and anything that surprised you.

IF BLOCKED
- Rate limited (429) more than twice in a row: raise --gap to 15, record the limit you hit in the note, and finish with fewer runs if you must (at least 10).
- The API rejects the JSON schema: remove only the keywords it names (for example additionalProperties or pattern), keep the zod validation after the call, and list the removed keywords in the note.
- Structured output fails on most runs: record it, run 5 more with the schema also embedded in the prompt as text, and say so in the note. Do not lower the validator's bar.
- The model id is rejected: stop and tell me the exact error. Do not guess another id; I check the model list.
- The key is missing or invalid: stop. Never ask for the key in chat and never print it.
```
