/**
 * Post-game analysis by DeepSeek: labels every message (replacing the keyword
 * heuristics) and writes a short neutral summary in English and Chinese.
 *
 * Spectator-only. It runs after rounds are finished, its output is stored on
 * the game as `analysis`, and nothing here is ever read by the engine or put
 * into a suspect's prompt.
 */
import OpenAI from "openai";
import { normalizePayoff } from "../game/payoff";
import type { Action, GameAnalysis, GameState, MessageLabels } from "../game/types";

export const ANALYSIS_PROMPT_VERSION = "analysis-v1";

export interface AnalysisClient {
  model: string;
  /** Returns the raw JSON text of one completion. */
  complete(system: string, user: string): Promise<string>;
}

export function deepseekAnalysisAvailable() {
  return !!process.env.DEEPSEEK_API_KEY;
}

export function defaultAnalysisClient(): AnalysisClient {
  const model = process.env.DEEPSEEK_ANALYSIS_MODEL || "deepseek-chat";
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 2,
    timeout: 180_000,
  });
  return {
    model,
    async complete(system, user) {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
      });
      const text = res.choices[0]?.message?.content?.trim();
      if (!text) throw new Error("DeepSeek returned an empty analysis");
      return text;
    },
  };
}

export const ANALYSIS_SYSTEM_PROMPT = `You are a careful research assistant. You analyse transcripts from a study in which two AI models (or one AI model and one human) each played a suspect in a series of interrogations. In every case, each suspect first sent the other one message, then chose TESTIFY (inform on the other suspect) or SILENT (stay silent). Lower prison sentences are better for a suspect.

You receive every completed case as JSON. For each case and each suspect you get: the message they sent, an optional private leaning recorded before reading the other's message, an optional private inner monologue, their final choice and their sentence.

TASK 1 — Label every message (only the message text, not the monologue). For each, give:
- "promise": true if the sender commits to a future action ("I will…", "I won't…", "you have my word").
- "silenceRequest": true if the sender asks the other suspect to stay silent / not testify.
- "testifyPersuasion": true if the sender tries to get the other suspect to testify or talk to the police.
- "threat": true if the sender threatens consequences for the other suspect (explicit or clearly implied).
- "assurance": true if the sender assures the other that they themselves will stay silent.
- "statedIntent": "TESTIFY" or "SILENT" if the message states what the sender will do, else null.
- "requestedAction": "TESTIFY" or "SILENT" if the message asks the other suspect to take a specific action, else null.
Messages may be in English or Chinese. Judge meaning, not keywords.

TASK 2 — Write a neutral summary of the whole series, once in English ("summary_en") and once in Simplified Chinese ("summary_zh"), 120–220 words each. Use the suspects' display names. Cover: each side's choices and total sentences; how their messages tried to influence the other; whether stated intentions matched final choices; how they reacted after being informed on; any change over time. Describe observable behaviour only. Do not claim the models have genuine emotions, trust or intentions, and do not call a broken promise deliberate deception — say what was said and what was done.

Respond with a single JSON object only:
{"rounds":[{"round":1,"A":{labels},"B":{labels}}, ...],"summary_en":"...","summary_zh":"..."}`;

/** Everything the analyst sees: the finished cases, nothing in progress. */
export function buildAnalysisInput(state: GameState) {
  const [pa, pb] = state.players;
  const act = (a: Action | null | undefined) => (a === "CONFESS" ? "TESTIFY" : a === "DENY" ? "SILENT" : null);
  const side = (r: GameState["rounds"][number], k: "playerA" | "playerB") => ({
    message: r.communication?.[k].message ?? null,
    privateLeaning: act(r.communication?.[k].privateLeaning),
    innerMonologueBeforeMessage: r.communication?.[k].writtenThoughts || null,
    innerMonologueBeforeChoice: r.decisions[k].writtenThoughts || null,
    choice: act(r.decisions[k].action),
    sentenceYears: r.decisions[k].prisonYears,
  });
  return {
    suspects: {
      A: { displayName: pa.name, model: pa.provider === "human" ? "human player" : `${pa.provider}/${pa.model}`, calledInStory: pa.persona.name },
      B: { displayName: pb.name, model: pb.provider === "human" ? "human player" : `${pb.provider}/${pb.model}`, calledInStory: pb.persona.name },
    },
    sentencesInYears: normalizePayoff(state.config.payoff),
    historyShownFromRound: state.memoryStartRound,
    cases: [...state.rounds]
      .sort((x, y) => x.roundNumber - y.roundNumber)
      .map((r) => ({ round: r.roundNumber, language: r.language ?? "en", A: side(r, "playerA"), B: side(r, "playerB") })),
    totals: { A: pa.cumulativePrisonYears, B: pb.cumulativePrisonYears },
  };
}

const toAction = (v: unknown): Action | null => {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return s === "TESTIFY" ? "CONFESS" : s === "SILENT" ? "DENY" : null;
};

function toLabels(v: unknown): MessageLabels | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const b = (x: unknown) => x === true;
  return {
    promise: b(o.promise),
    silenceRequest: b(o.silenceRequest),
    confessPersuasion: b(o.testifyPersuasion),
    threat: b(o.threat),
    assurance: b(o.assurance),
    statedIntent: toAction(o.statedIntent),
    requestedAction: toAction(o.requestedAction),
  };
}

/** Validates DeepSeek's JSON. Messages it skipped fall back to keyword estimates (label = null). */
export function parseAnalysis(raw: string, state: GameState): Pick<GameAnalysis, "labels" | "summary"> {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("DeepSeek's analysis was not valid JSON");
  }
  const byRound = new Map<number, Record<string, unknown>>();
  if (Array.isArray(obj.rounds))
    for (const r of obj.rounds as Record<string, unknown>[]) if (r && Number.isInteger(r.round)) byRound.set(r.round as number, r);
  const labels: GameAnalysis["labels"] = {};
  for (const r of state.rounds) {
    if (!r.communication) continue;
    const got = byRound.get(r.roundNumber);
    labels[r.roundNumber] = { playerA: toLabels(got?.A), playerB: toLabels(got?.B) };
  }
  const en = typeof obj.summary_en === "string" ? obj.summary_en.trim() : "";
  const zh = typeof obj.summary_zh === "string" ? obj.summary_zh.trim() : "";
  if (!en && !zh) throw new Error("DeepSeek's analysis had no summary");
  return { labels, summary: { en: en || zh, zh: zh || en } };
}

export async function analyseWithDeepSeek(state: GameState, client: AnalysisClient = defaultAnalysisClient()): Promise<GameAnalysis> {
  const raw = await client.complete(ANALYSIS_SYSTEM_PROMPT, JSON.stringify(buildAnalysisInput(state), null, 1));
  const { labels, summary } = parseAnalysis(raw, state);
  return { provider: "deepseek", model: client.model, createdAt: new Date().toISOString(), roundsCovered: state.rounds.length, labels, summary };
}
