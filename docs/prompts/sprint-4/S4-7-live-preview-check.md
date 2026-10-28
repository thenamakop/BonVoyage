# S4-7: Preview check with live model wording

The first time the model writes a day plan on a deployment. Maulik sets the Vercel Preview variables; Claude in Cowork drives the check in the built-in browser and reads the function logs through the Vercel connector; nothing touches production unless Maulik decides so at the end.

**Who:** Maulik (setup), then Claude in Cowork (check) · **Time box:** 1 hour · **Depends on:** S4-6 merged, migration 0003 on preview · **Issue:** #122 · **Cut:** with S4-6

## Part 1: Maulik's setup (about 10 minutes)

1. `git checkout master; git pull`; `pnpm db:migrate:remote --target preview --status` shows nothing pending (0003 applied).
2. Vercel → BonVoyage project → Settings → Environment Variables, scope **Preview only**:
   - `LIVE_APIS` = `on`
   - `GEMINI_API_KEY` = your key (type it in Vercel; never paste it into chat, a commit or a screenshot)
   - `GEMINI_MODEL` = the model id you use locally
   - `GEMINI_DAILY_LIMIT` = `20`
3. Redeploy the latest `master` preview (Deployments → the newest preview → Redeploy), then `pnpm db:seed --target preview --fresh-demos`.
4. Sign in as `asha@demo.bonvoyage.test` in the Claude app's built-in browser and as `meera@demo.bonvoyage.test` in Brave, both on the new preview URL, then tell Claude in Cowork "ready" with the URL.

## Part 2: the check (Claude in Cowork)

```text
S4-7  PREVIEW CHECK WITH LIVE MODEL WORDING
Who: Claude in Cowork; built-in browser signed in as Asha and Brave signed in as Meera, both by
Maulik; Vercel connector for logs. Never sign in, never type a password or key, never change a
Vercel setting.

STEPS
1. Long weekend in the hills: as in docs/demo/sprint-3-demo.md steps 1 to 4.2 (Meera submits in
   Brave). Time Plan the days (click to the plan on screen); the limit is 30 s (SRS 3.3, P10).
2. Read the plan: the source line must read "Written with <model> from catalogue facts"; every
   item's notes are model-worded; every time, place and amount matches the templates run of
   28 October (06:00–13:05 onward, the six Chakrata places, 14:55–22:00 return); Tiger Falls is
   "Not verified". Record any note that changed a fact (it must not exist: the validator would
   have replaced it).
3. Logs: with the Vercel connector, read the runtime logs for that request and quote the
   "itinerary planned" line (source model, wordingFallback null, verifiedRatio, durationMs). No
   prompt text or member data may appear in any log line; record if one does.
4. Cache: Reject and plan again. The new version must be worded identically and the log line must
   show wordingCache 'hit' with no model call. Time it.
5. Quota fallback: ask Maulik to set GEMINI_DAILY_LIMIT=0 for Preview and redeploy. On another
   demo trip (Hills shortlist demo), plan the days: the source line must read "Planned from the
   BonVoyage catalogue" and the log wordingFallback 'quota'. Then ask Maulik to set it back to 20.
6. Write the results block for S4-12 (times, quotes, log lines, pass or fail per step).

DECISION FOR MAULIK AT THE END
Production: keep templates (LIVE_APIS unset) for submission, or turn the model on with a small
GEMINI_DAILY_LIMIT. Claude recommends keeping production on templates unless every step above
passed and the free-tier terms are acceptable for real users' trip facts (AGENTS.md section 11:
prompts carry destination facts only).
```

## If something fails

- The source line still says "Planned from the BonVoyage catalogue" at step 2: check the redeploy picked up the variables (Vercel shows them on the deployment), then read the log's `wordingFallback`. 'error' at cold start with no key means step 2 of Part 1 did not apply to Preview.
- The plan takes over 30 s: report the log's `durationMs` and the model id; S4-6's 20 s timeout should have fallen back, so this is a defect for S4-4's template.
- Any fact differs from the templates run: stop, keep the preview as it is, and send Claude the plan text; it is a validator defect (P6).
