# S4-7 preview check with live model wording (#122)

**Result:** the model wording path works on a deployment, and every fallback kept the plan's facts. The first live call is slower than the app's 20 s wording timeout, so a fresh plan falls back to templates; the cached repeat is model-worded in 121 ms. Production stays on templates for submission (decision below).

**Who and where:** Claude in Cowork, 3 November 2026, about 17:05 to 17:45 UTC. Preview `bonvoyage-git-master-thenamakops-projects.vercel.app`, master at `7e28920` (#164). Asha in the Claude app's built-in browser and Meera in Chrome, both signed in by Maulik. Logs read through the Vercel connector. Maulik set the Preview variables (`LIVE_APIS=on`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_DAILY_LIMIT=20`) and redeployed; preview migrations 6 of 6 applied; demo trips reset with `--fresh-demos`.

## Steps

| Step | Result | Evidence |
| --- | --- | --- |
| 1. Plan the days with `GEMINI_MODEL=gemini-3.8-flash` | Fell back to templates, facts intact | 8.1 s on screen. Log: `"source":"catalogue","durationMs":7471,"verifiedRatio":1,"wordingFallback":"error"`. Re-planned once: same. Maulik's local spike against the same model: `HTTP 503 … "This model is currently experiencing high demand"`. |
| 1b. Local check of `gemini-3.5-flash-lite` | Call succeeds | Spike: `run 01: ok=false verified=1.00 24263ms`, 0 failed calls (ok=false is the October whole-plan prompt's `DAY_TOO_LONG`, which the words-only path does not use). |
| 2. Plan the days with `GEMINI_MODEL=gemini-3.5-flash-lite` (redeployed) | Fell back on timeout, facts intact | 20.5 s on screen. Log: `"version":3,"source":"catalogue","durationMs":20136,"wordingFallback":"timeout"`. |
| 3. Reject and plan again (cache) | Model-worded, from cache | 0.4 s on screen; source line "Written with gemini-3.5-flash-lite from catalogue facts". Log: `"version":4,"source":"model","durationMs":121,"verifiedRatio":1,"wordingFallback":null,"wordingCache":"hit"`. The timed-out call of step 2 had finished in the background and filled the cache. |
| 4. Facts in the model-worded plan | Unchanged | Times (06:00–13:05 onward, 14:55–22:00 return), the six Chakrata places, "Free entry" and Tiger Falls "Not verified" all match the template plan. |
| 5. Logs | No prompt text or member data | The "itinerary planned" and fallback lines carry trip id, version, source, timings, codes and an opaque user id only. |
| 6. Quota fallback (`GEMINI_DAILY_LIMIT=0`) | Not run live | Covered by `packages/integrations/test/guarded-llm.test.ts`; the live `error` and `timeout` fallbacks above exercise the same template path. |

## Observations on the model's wording

- Summary and reasons were reworded ("A three-day trekking trip to Chakrata from Gurugram, exploring scenic viewpoints, forests, meadows, and waterfalls.").
- Most visit notes kept the template text; the model reworded four items.
- One note overstates: Moila Top (09:00–12:00) reads "Spend the day trekking to Moila Top meadow and Tiger Falls.", which names the next item's place and implies a full day. One reason adds "historic" to Deoban forest. Neither is a number, time, price or new place, so the validator accepted them.

## Demo rehearsal on the same preview

Script `docs/demo/sprint-3-demo.md` steps 1 to 5 matched line for line, with dates 21 to 23 Nov (reset on 3 November, #155's rule):

- Shortlist 633 ms, Chakrata first at ₹29,565; voting beat ("0 of 3 voted", "Your vote", "1 of 3 voted"; Asha's window "1 vote" beside Choose).
- Choose 308 ms; packages ₹29,566 / ₹31,566 / ₹39,966; "1 of 3 say it works" with no name.
- Remove and Swap as quoted; Meera read-only; Accept; "Trip finalised: Chakrata, 21 Nov 2026 – 23 Nov 2026, Saver package, ₹29,566 …".
- Tight budget: diagnostic 209 ms with Bikaner ₹6,860, Mathura ₹7,836, Vrindavan ₹8,008; "Raise the group budget to ₹15,500" ("This adds Bikaner, Mathura, Pushkar, Rishikesh and Vrindavan."); Round 2 in 309 ms: Rishikesh, Pushkar, Vrindavan, Mathura, Bikaner; Bikaner's four packages ₹13,995 / ₹19,195 / ₹25,195 / ₹36,688 with the quoted flags; Balanced by bus ₹22,570, about ₹7,524 each, ₹7,070 over.

Steps 0 and 6 (create and delete an account) are Maulik's, by hand.

## Decision (Maulik, 3 November 2026)

- Production: templates for submission. Production has no `GEMINI_DAILY_LIMIT`, so the quota guard allows no model call there (`apps/api/src/env.ts` defaults the limit to 0), whatever `LIVE_APIS` says.
- Preview: `LIVE_APIS` off again before the demo, so step 4 is instant and reads "Planned from the BonVoyage catalogue" as the script says. `GEMINI_MODEL=gemini-3.5-flash-lite` stays set for later checks.
- Follow-up after submission: the 20 s wording timeout against the model's first-call latency, and the two overstated phrases.

Done the same evening: `LIVE_APIS` off on Preview and redeployed; preview reset with `--fresh-demos`; the follow-up recorded as an issue ("Live wording: first call exceeds the 20 s timeout").
