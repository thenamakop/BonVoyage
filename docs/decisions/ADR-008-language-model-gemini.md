# ADR-008: Language model through Gemini

Status: Accepted · Date: 2026-10-10 · Supersedes: none

## Context

The itinerary text is written by a language model from verified facts; the model never supplies the facts. The project has no paid budget, so the free tier of the Gemini API is used. Free-tier prompts may be used to improve Google products, so prompts must not contain personal data.

## Decision

Call Gemini only through an `LlmClient` interface, reading the model id from `GEMINI_MODEL` (currently gemini-3.8-flash). Do not set temperature, topP or topK, set the thinking level to low, and put destination facts only in prompts, never personal data.

## Consequences

- Easier: swapping the model is a configuration change, and tests use a fake client.
- Easier: defaults are what Google recommends for Gemini 3.x, so there is less tuning.
- Harder: free-tier rate limits and model availability can change, so output must pass `validateItinerary` and a fallback is needed.
- Harder: prompts cannot include member names, emails or personal budgets, which limits personalisation.

## Links

- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/pricing
- `AGENTS.md`, section 11
