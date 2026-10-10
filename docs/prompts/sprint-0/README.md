# Sprint 0 prompts

Prepared on 10 October 2026 for Maulik. One prompt = one branch, one fresh agent session, one pull request. Tell the agent: "Read AGENTS.md, then execute docs/prompts/sprint-0/<file>.md".

## How to use these prompts

Each prompt is one unit of work: one branch, one fresh agent session, one pull request. Run them in the order of the drawing below, and do not start the next prompt until the previous pull request is merged into `master`.

1. **Branch.** `git switch master && git pull`, then `git switch -c <branch named at the top of the prompt>`.
2. **Fresh session.** Open a new agent session at the repo root. Paste the whole prompt, or tell the agent: "Read `AGENTS.md`, then execute `docs/prompts/sprint-0/<file>.md`" if you keep the prompt files in the repo. Never run two prompts in one session.
3. **Stay in the loop.** Answer the agent's questions. If it proposes something outside the prompt (a new library, a new table, a different structure), say no unless the prompt's If-Blocked section allows it.
4. **Verify yourself.** When the agent says it is done, run the prompt's Verification commands in your own terminal. "Done" means the commands pass on your machine, not that the agent says so.
5. **Review and merge.** Read the diff (`git diff master...HEAD --stat`, then the files), commit, push, and open the pull request with `gh pr create --fill`. Paste the agent's final report into the pull request description, wait for CI to turn green, then squash-merge.
6. **When stuck.** Paste the exact error back into the same session. If the agent fails twice on the same error, stop and bring the error here.

| Part of every prompt | What it is for |
| --- | --- |
| Context | What already exists and which files the agent must read first |
| Goal | The end state in one paragraph, plus the deliverables |
| Steps | The exact work, in order, with names, paths and rules fixed so the agent does not guess |
| Verification | Commands and checks that prove it works; the agent pastes their real output in its report |
| If blocked | Pre-approved fallbacks, and the cases where the agent must stop and ask you |

Never paste a key into a prompt or an agent chat. Keys live only in `.env` (local) and in Vercel's environment variables.

## Before you start: manual setup (about 45 minutes)

Agents cannot create accounts, hold keys or click through dashboards, so these ten steps are yours. Finish them before S0-1; each has a check.

1. **Repo state.** `git switch master && git pull`. `docs/` and `AGENTS.md` must already be committed. Check: `git ls-files AGENTS.md docs | head -5` lists files.
2. **Node 24 and pnpm 10.** Check: `node -v` starts with `v24.` and `pnpm -v` starts with `10.`. If pnpm shows 11 or newer, run `npm i -g pnpm@10`: Vercel's supported pnpm versions currently end at 10 ([Vercel](https://vercel.com/docs/package-managers)).
3. **GitHub CLI scopes.** `gh auth status`, then `gh auth refresh -s project` (S0-8 needs it for the project board). Check: `gh auth status` lists the `project` scope.
4. **Docker.** Start Docker Desktop. Check: `docker compose version` and `docker run --rm hello-world` both succeed.
5. **Neon project.** Create project `bonvoyage` in **AWS Asia Pacific (Singapore), `aws-ap-southeast-1`**. Neon has no India region, so Singapore is the closest ([Neon regions](https://neon.com/docs/introduction/regions)).
   - Note the Postgres major version Neon shows (for example 17). Prompts S0-2 and S0-3 ask for it as `<POSTGRES_MAJOR>`.
   - Create a second branch named `preview` from the default branch.
   - For each branch copy two connection strings: **pooled** (host contains `-pooler`, used by the app) and **direct** (no `-pooler`, used only for migrations). Save all four in your password manager.
6. **`.env.neon` at the repo root.** Holds only the two direct strings, for migrations from your laptop. Never commit it.
7. **Vercel account.** Sign in to Vercel with GitHub and grant access to the repo. Do not import the project yet; S0-3 gives the exact settings.
8. **Root `.env`.** Create or complete it with the block below. Generate the auth secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
9. **Ignore secrets before anything else.** Make sure `.gitignore` contains `.env`, `.env.*` and `!.env.example`. Check: `git check-ignore .env .env.neon` prints both names.
10. **Agent and key hygiene.** Confirm your coding agent reads `AGENTS.md` automatically (if not, start every session with "Read AGENTS.md first"). If you have not rotated the Gemini key you pasted in chat, do it now.

```env
# .env (local only)
DATABASE_URL=postgres://bonvoyage:bonvoyage@localhost:5432/bonvoyage
TEST_DATABASE_URL=postgres://bonvoyage:bonvoyage@localhost:5433/bonvoyage_test
BETTER_AUTH_SECRET=<32-byte secret from the command in step 8>
APP_URL=http://localhost:5173
GEMINI_API_KEY=<your new key>
GEMINI_MODEL=gemini-3.8-flash
LIVE_APIS=off
SEED_DEMO_PASSWORD=<any password of 12+ characters for demo accounts>
```

```env
# .env.neon (direct connection strings only)
NEON_PREVIEW_DIRECT_URL=postgresql://...
NEON_PRODUCTION_DIRECT_URL=postgresql://...
```

## Run order

| Day | Prompt | Time box | Needs merged first | Can move to Monday 12 Oct |
| --- | --- | --- | --- | --- |
| Sat 10 Oct | Manual setup | 45 min | nothing | no |
| Sat 10 Oct | [S0-1 Decision records](S0-1-decision-records.md) | 45 min | manual setup | no |
| Sat 10 Oct | [S0-2 Monorepo scaffold](S0-2-monorepo-scaffold.md) | 3 h | S0-1 | no |
| Sat 10 Oct | [S0-3 CI, Vercel and Neon](S0-3-ci-vercel-neon.md) | 3 h | S0-2 | no |
| Sat 10 Oct | [S0-4 Catalogue tooling and drafts](S0-4-catalogue.md) | 2.5 h | S0-2 | no |
| Sun 11 Oct | [S0-5 Schema, auth and seed](S0-5-schema-auth-seed.md) | 3.5 h | S0-3, S0-4 | no |
| Sun 11 Oct | [S0-6 Trip state machine](S0-6-trip-state-machine.md) | 2.5 h | S0-5 | no |
| Sun 11 Oct | [S0-7 Gemini itinerary spike](S0-7-itinerary-spike.md) | 3 h | S0-4 | yes |
| Sun 11 Oct | [S0-8 Backlog and Sprint 1 issues](S0-8-backlog.md) | 1.5 h | S0-1 | yes |
| Sun 11 Oct | [S0-9 Exit gate audit](S0-9-exit-gate.md) | 45 min | every other prompt | no |

Saturday builds the foundation (setup, then S0-1 to S0-4); Sunday adds the schema, the state machine and the gate. S0-7 and S0-8 depend on nothing that comes after them, so they are the ones to move to Monday morning if Sunday runs long. The time boxes add up to about 21 hours and include your review time, not only the agent's.

## When Sprint 0 is done

1. Send back the PASTE THIS BACK block from S0-9's final message, plus anything that went differently: a skipped step, a library version that forced a change, a time box you went over.
2. Ask for the Sprint 1 prompts. They will be written against your actual repo: the versions you installed, the catalogue progress and any spill issues. Sprint 1 covers the issues S0-8 creates: sign-in screens, trip creation, invitation links, the preference form, the dashboard, access rules, the administrator re-import, wireframes and catalogue stage A.

If Sunday night arrives before the gate, this is what can slip and what cannot:

| Still open | What to do |
| --- | --- |
| S0-7 Gemini spike | Run it on Monday. Only Sprint 4 depends on it. |
| S0-8 backlog | Run it on Monday morning. The Sprint 1 prompts do not need the board. |
| S0-3 deployment steps | Keep the CI part merged; the deploy fix becomes the first spill issue. |
| S0-5 or S0-6 | Finish before any Sprint 1 prompt. Every Sprint 1 feature writes to these tables through `transitionTrip`. |
| Catalogue verification | Not a Sprint 0 item. Stage A is due Sunday 18 October: about six destinations a day keeps it on time. |

One habit for every sprint: run `pnpm verify` before each pull request, and paste its output into the description.
