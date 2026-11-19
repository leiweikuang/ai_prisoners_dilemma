# AI Interrogation

Watch two AI models, interrogated separately after committing a crime together.

Player A (OpenAI / ChatGPT) and Player B (Anthropic / Claude) each play a human suspect. In every round they may send each other **one message**. Then, separately, each makes a final statement to police: **TESTIFY** (告发, inform on the other suspect) or **SILENT** (沉默). The game engine knows this is an iterated prisoner's dilemma. The models are never told that. Each one only sees its own fictional situation.

```
ROUND START → COMMUNICATION (both messages sealed until both exist, then revealed)
            → DELIBERATION  (each reads the other's message)
            → STATEMENT     (both decisions sealed until both exist, then revealed)
            → sentences calculated by the engine → history updated → next round
```

- **Defaults:** 5 rounds, with history available from round 1. Both are configurable on the setup page.
- **Independent phase (optional):** if history is introduced at a later round, the rounds before it are independent cases with no history at all.
- **History-aware phase:** each prompt includes the complete public record of every previous case, in chronological order. That covers both messages, both statements, the sentences, and the running totals.
- **Suspects:** each model has a nickname (ChatGPT → Sammy, Claude → Darry, DeepSeek → Wendy, Doubao → Donna, Grok → Elly) and a profile picture (`src/lib/profiles.ts`, `public/avatars/`). A model is never told its own name. Its prompt is written from inside the interview room ("you"), and only the other suspect is named.
- **No format instructions in prompts:** the answer shape (choice, explanation, message, private leaning) is enforced through each provider's structured-output API. The models only see short in-story field descriptions, in the round's language.
- **Cases:** every case is a serious felony (`src/lib/prompts/scenarios.ts`). Every prompt includes a personal "What is at stake" section (`src/lib/prompts/shared.ts`): age 34, a mother who relies on you, a sister, a home and a job, and what 1, 5 or 10 years would cost. Both suspects get the same details.
- **Language:** English or Chinese, chosen on the setup page and switchable between rounds (never mid-round). The switch changes both the page and what the models read and write: system prompts, cases, rules, history and response instructions. Each round records its language, and every switch is written to the experiment's change log. In Chinese, the 200-word thinking limit means 200 characters (字).

| | B testifies | B stays silent |
|---|---|---|
| **A testifies** | 5 / 5 | 0 / 10 |
| **A stays silent** | 10 / 0 | 1 / 1 |

## Quick start

```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY and ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, pick the models, and press **Begin interrogation**. Then press **Start experiment (auto)** to run every round automatically. You can also press **Start next round** to step through one round at a time.

To try the app without API keys, set `ENABLE_MOCK_PLAYERS=true` and choose "Mock (offline testing)" for both suspects. Mock suspects choose at random and are labelled `mock` in every record.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | yes | Server-side only |
| `ANTHROPIC_API_KEY` | yes | Server-side only |
| `OPENAI_MODEL` | no | Default OpenAI model (default `gpt-5`). You can override it per experiment. |
| `ANTHROPIC_MODEL` | no | Default Claude model (default `claude-opus-5-5`). You can override it per experiment. |
| `OPENAI_REASONING_EFFORT` | no | `reasoning.effort` for OpenAI reasoning models (default `low`) |
| `OPENAI_REASONING_SUMMARY` | no | `auto` (default), `concise` or `detailed` — reasoning summary shown as thoughts |
| `ANTHROPIC_EFFORT` | no | Claude `output_config.effort` (default `low`) |
| `RESPONSE_TIME_LIMIT_SECONDS` | no | Hard limit per response, stated to the suspects (default 60) |
| `THOUGHT_WORD_LIMIT` | no | Thinking word limit, stated to the suspects and applied to displayed thoughts (default 200) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | on Vercel | Postgres persistence. Run `supabase/schema.sql` first. |
| `DATA_DIR` | no | Directory for the local JSON store (default `.data/games`) |
| `MAX_ATTEMPTS` | no | Attempts per model call (default 3) |
| `ENABLE_MOCK_PLAYERS` | no | Enables the offline mock provider |

Without Supabase, games are saved as JSON files in `.data/games`. That works for local use, but it will not work on Vercel, whose filesystem is not persistent.

## Deploying to Vercel

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Import the repo into Vercel and set the environment variables listed above.
3. The stage endpoint sets `maxDuration = 300`, because one stage is two concurrent model calls with retries. Your Vercel plan must allow this duration. Fluid compute allows it on all plans.

## Architecture

```
src/lib/
  game/        engine.ts (rounds, stages, sealing, locking, sentences), payoff.ts, prompts.ts, types.ts
  prompts/     system.ts, communication.ts, independent.ts, history.ts, schemas.ts, scenarios.ts, guard.ts
  ai/          types.ts (AIPlayer interface), openai.ts, claude.ts, mock.ts, registry.ts, retry.ts
  store/       file.ts (default), supabase.ts — compare-and-swap saves
  analysis/    metrics.ts — computed after the fact for spectators; never fed back into the experiment
src/app/
  page.tsx                  experiment setup
  game/[id]/page.tsx        live interrogation room
  game/[id]/results/        final results
  api/games/...             create / get / advance (one stage) / control (pause, resume) / export
```

- **Adding a provider:** implement `AIPlayer` (`complete()` returns raw text) and register it in `ai/registry.ts`. The engine does not change.
- **Prompt separation:** each prompt lives in its own file and carries a version string. Each call records its system and user prompt versions.
- **Leak guard:** `prompts/guard.ts` rejects any prompt that contains experimental terms such as dilemma, game, experiment, round, strategy, player, opponent, AI, or the model or company names. The guard runs before every API call, and a test checks every prompt for all 20 rounds.

### Experiment integrity

- Both messages, and later both decisions, are requested concurrently with `Promise.allSettled`.
- A response that arrives first is **sealed** server-side. The browser cannot see it until both responses exist.
- If one suspect fails, nothing is revealed. A retry calls only the suspect that failed. A sealed response is never regenerated.
- Each stage request names the round and stage it expects. The engine takes a persisted lock and saves with a version check (compare-and-swap). Duplicate, concurrent or stale requests return 409 and do not run a second time.
- After a browser refresh, the page resumes from the server state. If a stage is still running, the page waits for it to finish.
- Every attempt is logged, including failed ones. Each log entry records:
  - provider, requested model and served model
  - API parameters and prompt versions
  - the full system and user prompts
  - the raw response, the parsed result, any error, and token usage
- **Export full audit log** on the results page downloads this log. The export includes revealed stages only.
- Configuration is locked when an experiment is created. If the prompt versions change mid-run, for example because of a redeploy, the change is recorded in `configChanges`.
- No decision is ever invented. Invalid JSON or an invalid action triggers a retry. If every attempt fails, the stage stays open and is marked failed.
- **Thoughts:** every answer has a required private `thoughts` field (up to 200 words, in the round's language). It is the first field, so the model writes it before its message or its choice. A response without thoughts is rejected and retried. Thoughts are spectator-only: never shown to the other suspect and never included in any prompt. When the provider also returns a *reasoning summary* (OpenAI `reasoning.summary`, Claude summarized thinking), it is shown collapsed underneath. Neither provider exposes raw chain of thought. In Chinese rounds, OpenAI's English summaries are translated for display, and the original is kept in the audit log. Decisions are TESTIFY or SILENT only: no explanation is requested.

### Response rules

- **Time limit:** each suspect has at most one minute per response (`RESPONSE_TIME_LIMIT_SECONDS`), and every prompt says so. The engine aborts any request that reaches the limit. A timed-out attempt is logged and retried like any other failure. It is never replaced with an invented answer.
- **Thinking length:** every prompt asks the suspect to keep its thinking to 200 words or fewer. The providers offer no hard cap on internal reasoning for these models, so this is enforced in three ways:
  - effort defaults to `low`;
  - the instruction appears in every prompt;
  - displayed thoughts are trimmed at 200 words. The full summary stays in the audit log.
- **No internet:** neither model gets any tools. Tool parameters (`tools`, `tool_choice`, `mcp_servers`, …) are stripped from every request, and models with built-in web search (`*search*`, `*deep-research*`) are rejected at setup. Tests check the outgoing request bodies.

### Choice wording

The AIs choose **TESTIFY** (告发: inform on the other suspect) or **SILENT** (沉默). These are the words in every prompt and in the JSON answer. Internally, and in stored games and exports, they are recorded as `CONFESS` and `DENY` respectively, so older games stay readable.

### Private leaning (communication impact)

When a suspect writes its message, it also returns a `private_leaning` (TESTIFY or SILENT). The other suspect never sees it. The results page compares this leaning with the final statement to measure how often a suspect changed course after reading the other's message.

### Behavioural metrics

Communication categories come from transparent keyword heuristics (`analysis/metrics.ts`):

- promises
- requests to stay silent
- persuasion to testify
- threats
- assurances

The results page reports these as observations. An assurance followed by testifying is counted as an observable inconsistency, not as deception.

## Running a complete experiment

1. Set both API keys and start the app.
2. On the setup page, choose the models and the language. The defaults are 5 rounds, with history from round 1.
3. Press **Begin interrogation**, then **Start experiment (auto)**. A round takes roughly 30–90 seconds, depending on the models.
4. **Pause** takes effect after the current round finishes. A round is never interrupted. **Resume** continues the run.
5. When the experiment completes, open **View final results**, and export the audit log if you need it.

## Tests

```bash
npm test        # vitest: payoffs, prompt leak/history checks for all 20 rounds, full 20-round engine run,
                # sealing on failure, duplicate/stale request rejection, invalid-response retries, pause semantics
npm run build
```
