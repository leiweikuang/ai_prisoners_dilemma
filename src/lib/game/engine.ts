/**
 * Game engine. Knows the experimental rules; independent of any AI provider.
 *
 * Each round = COMMUNICATION stage (both messages sealed until both exist)
 * followed by DECISION stage (both decisions sealed until both exist).
 * Every stage is an idempotent, lock-protected server call so that retries,
 * duplicate clicks and browser refreshes never regenerate or leak anything.
 */
import { randomUUID } from "crypto";
import { createPlayer, isProviderId, PROVIDERS } from "../ai/registry";
import { backoffMs, classifyError, MAX_ATTEMPTS } from "../ai/retry";
import { PROMPT_VERSIONS } from "../prompts";
import { personaNames } from "../profiles";
import { findForbiddenTerms } from "../prompts/guard";
import { parseDecision, parseMessage } from "../prompts/schemas";
import { scenarioForRound } from "../prompts/scenarios";
import { getStore, VersionConflictError } from "../store";
import { computeSentences, normalizePayoff, phaseForRound } from "./payoff";
import { buildDecisionPrompt, buildMessagePrompt, thoughtWordLimitFor, timeLimitFor } from "./prompts";
import type {
  CallRecord,
  GameState,
  InProgressRound,
  PlayerConfig,
  PlayerSlot,
  PublicGameState,
  RoundResult,
  HumanInput,
  Lang,
  Stage,
} from "./types";

export const LOCK_TTL_MS = 6 * 60 * 1000;
export const DEFAULT_TOTAL_ROUNDS = 3;
/** History is available from the first round (round 1 simply has no previous cases yet). */
export const DEFAULT_MEMORY_START_ROUND = 1;
/** Thoughts longer than this are trimmed for display (full text stays in the audit log). */
export const THOUGHT_WORD_LIMIT = Math.max(10, Number(process.env.THOUGHT_WORD_LIMIT || 200));

/**
 * Trims to `max` words. Each Chinese character counts as one word (字), so
 * "200 words" means 200 English words or 200 Chinese characters.
 */
export function limitWords(text: string | null, max: number): { text: string | null; trimmed: boolean } {
  if (!text) return { text, trimmed: false };
  const re = /[\u3400-\u9fff]|[^\s\u3400-\u9fff]+/g;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (++count > max) return { text: text.slice(0, m.index).trimEnd() + " …", trimmed: true };
  }
  return { text, trimmed: false };
}

/** Each suspect gets at most this long per response; the request is aborted after it. */
export const RESPONSE_TIME_LIMIT_SECONDS = Math.max(5, Number(process.env.RESPONSE_TIME_LIMIT_SECONDS || 60));
const SLOTS: PlayerSlot[] = ["A", "B"];

export class EngineError extends Error {
  constructor(
    message: string,
    public httpStatus: number,
    public code: string,
  ) {
    super(message);
  }
}

export class TimeLimitError extends Error {
  constructor(seconds: number) {
    super(`No response within the ${seconds}s time limit`);
  }
}

/** Runs fn with an AbortSignal that fires after `seconds`; rejects with TimeLimitError at the limit. */
export async function withTimeLimit<T>(seconds: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeLimitError(seconds));
    }, seconds * 1000);
  });
  try {
    return await Promise.race([fn(controller.signal), limit]);
  } finally {
    clearTimeout(timer);
    limit.catch(() => undefined);
  }
}

/**
 * A human player's in-story name. It is read by the AI suspect, so it must not
 * give away the setup (no model or company names, no experimental terms).
 */
function humanName(raw: string | undefined): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) throw new EngineError("Enter the name you want to be called in the story", 400, "bad_config");
  if (name.length > 24 || !/^[\p{L}\p{N} '._-]+$/u.test(name))
    throw new EngineError("Use up to 24 letters, numbers or spaces for your name", 400, "bad_config");
  if (findForbiddenTerms(name).length) throw new EngineError("That name can't be used in the story; please pick another", 400, "bad_config");
  return name;
}

export function humanSlotOf(state: Pick<GameState, "players">): PlayerSlot | null {
  return state.players.find((p) => p.provider === "human")?.id ?? null;
}

// ---------------------------------------------------------------- creation

export interface CreateGameInput {
  /** `name` is used only for a human player: what the AI suspect will call them. */
  playerA: { provider: string; model: string; name?: string };
  playerB: { provider: string; model: string; name?: string };
  totalRounds?: number;
  memoryStartRound?: number;
  language?: Lang;
  payoff?: import("./types").PayoffMatrix;
}

export function createGameState(input: CreateGameInput): GameState {
  const totalRounds = Math.trunc(input.totalRounds ?? DEFAULT_TOTAL_ROUNDS);
  const memoryStartRound = Math.trunc(input.memoryStartRound ?? DEFAULT_MEMORY_START_ROUND);
  const language: Lang = input.language === "zh" ? "zh" : "en";
  const payoff = normalizePayoff(input.payoff);
  const payoffKeys = Object.keys(payoff) as (keyof typeof payoff)[];
  for (const key of payoffKeys) {
    const value = payoff[key];
    if (!Number.isInteger(value) || value < 0 || value > 100)
      throw new EngineError(`${key} must be an integer from 0 to 100`, 400, "bad_config");
  }
  if (!(totalRounds >= 1 && totalRounds <= 100)) throw new EngineError("totalRounds must be 1–100", 400, "bad_config");
  if (!(memoryStartRound >= 1 && memoryStartRound <= totalRounds + 1))
    throw new EngineError("memoryStartRound must be between 1 and totalRounds + 1", 400, "bad_config");

  const mk = (slot: PlayerSlot, cfg: { provider: string; model: string; name?: string }): PlayerConfig => {
    if (!isProviderId(cfg.provider)) throw new EngineError(`Unknown provider ${cfg.provider}`, 400, "bad_config");
    const prov = PROVIDERS[cfg.provider];
    if (!prov.available()) throw new EngineError(`Provider ${cfg.provider} is not configured (missing API key?)`, 400, "provider_unavailable");
    const model = (cfg.model || prov.defaultModel()).trim();
    if (!/^[\w.:\-/@]+$/.test(model)) throw new EngineError("Invalid model identifier", 400, "bad_config");
    // Only models listed for this provider (mock accepts any name, for tests).
    if (cfg.provider !== "mock" && !(prov.models() as readonly string[]).includes(model))
      throw new EngineError(`Model "${model}" is not available for ${prov.label}`, 400, "bad_config");
    // Models with built-in web access are not allowed: suspects must not search the internet.
    if (/search|deep-research|browse/i.test(model)) throw new EngineError("Models with built-in web search are not allowed", 400, "bad_config");
    if (cfg.provider === "human") {
      const name = humanName(cfg.name);
      return { slot, name, provider: "human", model: "human", params: {}, persona: { name } };
    }
    return { slot, name: prov.displayName, provider: cfg.provider, model, params: prov.defaultParams(model), persona: { name: personas[slot] } };
  };
  if (input.playerA.provider === "human" && input.playerB.provider === "human")
    throw new EngineError("Only one suspect can be played by a human", 400, "bad_config");
  const personas = personaNames(input.playerA.provider, input.playerB.provider);
  const a = mk("A", input.playerA);
  const b = mk("B", input.playerB);
  if (a.persona.name.toLowerCase() === b.persona.name.toLowerCase())
    throw new EngineError("Pick a name that is different from the other suspect's", 400, "bad_config");
  if (a.name === b.name) {
    a.name = `${a.name} A`;
    b.name = `${b.name} B`;
  }
  const now = new Date().toISOString();
  return {
    gameId: randomUUID().replace(/-/g, "").slice(0, 16),
    version: 0,
    createdAt: now,
    updatedAt: now,
    status: "READY",
    pauseRequested: false,
    language,
    currentRound: 1,
    totalRounds,
    memoryStartRound,
    phase: phaseForRound(1, memoryStartRound),
    config: {
      totalRounds,
      memoryStartRound,
      communicationEnabled: true,
      responseTimeLimitSeconds: RESPONSE_TIME_LIMIT_SECONDS,
      thoughtWordLimit: THOUGHT_WORD_LIMIT,
      toolsEnabled: false,
      payoff,
      promptVersions: PROMPT_VERSIONS,
    },
    configChanges: [{ at: now, description: `Experiment created; configuration locked. Language: ${language}.` }],
    players: [a, b].map((p) => ({ ...p, id: p.slot, cumulativePrisonYears: 0 })),
    rounds: [],
    inProgress: null,
    lock: null,
    callLog: [],
  };
}

export async function createGame(input: CreateGameInput) {
  const state = createGameState(input);
  await getStore().create(state);
  return state;
}

// ---------------------------------------------------------------- views

type WithThoughts = { writtenThoughts?: string; thoughts?: string | null; privateLeaning?: unknown; thoughtsHidden?: boolean };

function hide<T extends WithThoughts>(e: T): T {
  return { ...e, writtenThoughts: undefined, thoughts: null, ...("privateLeaning" in e ? { privateLeaning: null } : {}), thoughtsHidden: true };
}

/**
 * While a human is playing, the AI opponent's inner monologue, reasoning
 * summary and private leaning are withheld from the page until the game ends:
 * the AI can never see the human's thoughts, so the human can't see the AI's.
 */
function withoutOpponentThoughts(state: GameState): GameState {
  const humanSlot = humanSlotOf(state);
  if (!humanSlot || state.status === "COMPLETED") return state;
  const ai = humanSlot === "A" ? "playerB" : "playerA";
  const rounds = state.rounds.map((r) => ({
    ...r,
    communication: r.communication ? { ...r.communication, [ai]: hide(r.communication[ai]) } : r.communication,
    decisions: { ...r.decisions, [ai]: hide(r.decisions[ai]) },
  }));
  const ip = state.inProgress;
  const inProgress = ip
    ? {
        ...ip,
        communication: ip.communication ? { ...ip.communication, [ai]: hide(ip.communication[ai]) } : ip.communication,
      }
    : ip;
  return { ...state, rounds, inProgress } as GameState;
}

export function toPublic(full: GameState): PublicGameState {
  const { callLog: _c, lock, inProgress, ...rest } = withoutOpponentThoughts(full);
  void _c;
  let pub: PublicGameState["inProgress"] = null;
  if (inProgress) {
    const { sealedCommunication, sealedDecisions, ...ip } = inProgress;
    pub = {
      ...ip,
      submitted: {
        communication: { A: !!sealedCommunication.A, B: !!sealedCommunication.B },
        decisions: { A: !!sealedDecisions.A, B: !!sealedDecisions.B },
      },
    };
  }
  return {
    ...rest,
    inProgress: pub,
    busy: lock && !lockExpired(lock) ? { stage: lock.stage, roundNumber: lock.roundNumber, since: lock.acquiredAt } : null,
  };
}

/** Full audit export. Excludes anything not yet revealed. */
export function toExport(state: GameState) {
  const ip = state.inProgress;
  const callLog = state.callLog.filter((c) => {
    if (!ip || c.roundNumber < ip.roundNumber) return true;
    return c.roundNumber === ip.roundNumber && c.stage === "COMMUNICATION" && !!ip.communication;
  });
  // With a human playing, the log (which holds the AI's raw answers and
  // inner monologue) is withheld until the game is over.
  if (humanSlotOf(state) && state.status !== "COMPLETED")
    return { ...toPublic(state), callLog: [], callLogWithheld: "The full log is available once the game has ended." };
  return { ...toPublic(state), callLog };
}

function lockExpired(lock: NonNullable<GameState["lock"]>) {
  return Date.now() - new Date(lock.acquiredAt).getTime() > LOCK_TTL_MS;
}

export function nextStage(state: GameState): Stage | null {
  if (state.status === "COMPLETED") return null;
  if (!state.inProgress) return state.config.communicationEnabled ? "COMMUNICATION" : "DECISION";
  return state.inProgress.stage;
}

// ---------------------------------------------------------------- control

export type ControlAction = { action: "pause" } | { action: "resume" } | { action: "language"; language: Lang };

export async function control(gameId: string, cmd: ControlAction) {
  const action = cmd.action;
  const store = getStore();
  for (let i = 0; i < 5; i++) {
    const s = await store.get(gameId);
    if (!s) throw new EngineError("Game not found", 404, "not_found");
    if (s.status === "COMPLETED") return s;
    const next = { ...s };
    if (cmd.action === "language") {
      // Only between rounds: a round always runs entirely in one language.
      if (s.inProgress || (s.lock && !lockExpired(s.lock)))
        throw new EngineError("The language can only be changed between rounds", 409, "round_in_progress");
      if ((s.language ?? "en") === cmd.language) return s;
      next.language = cmd.language;
      next.configChanges = [
        ...s.configChanges,
        { at: new Date().toISOString(), description: `Language changed from ${s.language ?? "en"} to ${cmd.language} before round ${s.currentRound}.` },
      ];
    } else if (action === "resume") {
      next.status = "RUNNING";
      next.pauseRequested = false;
    } else if (s.inProgress) {
      // Never pause mid-round: the round finishes, then the game pauses.
      next.pauseRequested = true;
    } else {
      next.status = "PAUSED";
      next.pauseRequested = false;
    }
    try {
      return await store.save(next, s.version);
    } catch (e) {
      if (!(e instanceof VersionConflictError)) throw e;
    }
  }
  throw new EngineError("Could not update game, try again", 409, "conflict");
}

// ---------------------------------------------------------------- advancing

export interface AdvanceRequest {
  roundNumber: number;
  stage: Stage;
}

/**
 * Runs exactly one stage of the current round. The caller must state which
 * round/stage it expects; stale or duplicate requests are rejected (409)
 * instead of being executed twice.
 */
export async function advance(gameId: string, req: AdvanceRequest, human?: HumanInput): Promise<GameState> {
  const store = getStore();
  const loaded = await store.get(gameId);
  if (!loaded) throw new EngineError("Game not found", 404, "not_found");
  let state: GameState = loaded;
  if (state.status === "COMPLETED") throw new EngineError("Experiment already completed", 409, "completed");
  if (state.lock && !lockExpired(state.lock)) throw new EngineError("This stage is already being processed", 409, "busy");

  const expected = nextStage(state);
  if (req.roundNumber !== state.currentRound || req.stage !== expected)
    throw new EngineError(`Stale request: expected round ${state.currentRound} stage ${expected}`, 409, "stale");

  // A human player's input must arrive with the request that runs the stage
  // (it is sealed first, then the AI is asked; neither sees the other's).
  const humanSlot = humanSlotOf(state);
  const humanPending =
    humanSlot !== null &&
    !(req.stage === "COMMUNICATION" ? state.inProgress?.sealedCommunication[humanSlot] : state.inProgress?.sealedDecisions[humanSlot]);
  if (humanPending) validateHumanInput(req.stage, human);

  // Acquire lock (compare-and-swap).
  const token = randomUUID();
  state = { ...state, lock: { token, stage: req.stage, roundNumber: req.roundNumber, acquiredAt: new Date().toISOString() } };
  recordConfigDrift(state);
  if (!state.inProgress) state.inProgress = startRound(state);
  try {
    state = await store.save(state, state.version);
  } catch (e) {
    if (e instanceof VersionConflictError) throw new EngineError("This stage is already being processed", 409, "busy");
    throw e;
  }

  // Serialised persistence while we hold the lock.
  let saving: Promise<void> = Promise.resolve();
  const persist = () => {
    saving = saving.then(async () => {
      state = await store.save(state, state.version);
    });
    return saving;
  };

  let failure: unknown = null;
  try {
    if (req.stage === "COMMUNICATION") await runCommunication(state, persist, humanPending ? human : undefined);
    else await runDecision(state, persist, humanPending ? human : undefined);
  } catch (e) {
    failure = e;
  }
  await saving.catch(() => undefined);

  // Release lock (and record last error, if any).
  const latest = state;
  if (latest.inProgress) latest.inProgress.lastError = failure ? (failure as Error).message : null;
  latest.lock = null;
  state = await store.save(latest, latest.version);
  if (failure) {
    if (failure instanceof EngineError) throw failure;
    throw new EngineError((failure as Error).message, 502, "stage_incomplete");
  }
  return state;
}

function startRound(state: GameState): InProgressRound {
  const scenario = scenarioForRound(state.currentRound);
  return {
    roundNumber: state.currentRound,
    phase: phaseForRound(state.currentRound, state.memoryStartRound),
    language: state.language ?? "en",
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    stage: state.config.communicationEnabled ? "COMMUNICATION" : "DECISION",
    startedAt: new Date().toISOString(),
    sealedCommunication: {},
    sealedDecisions: {},
    communication: null,
    lastError: null,
  };
}

function recordConfigDrift(state: GameState) {
  const current = JSON.stringify(PROMPT_VERSIONS);
  if (current !== JSON.stringify(state.config.promptVersions)) {
    state.configChanges.push({
      at: new Date().toISOString(),
      description: `Prompt versions changed from ${JSON.stringify(state.config.promptVersions)} to ${current} before round ${state.currentRound}.`,
    });
    state.config = { ...state.config, promptVersions: PROMPT_VERSIONS };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls one suspect with retries, logging every attempt. Parsing happens
 * inside the retry loop so invalid JSON / invalid actions are retried.
 */
async function callWithRetries<T>(
  state: GameState,
  round: InProgressRound,
  stage: Stage,
  slot: PlayerSlot,
  prompt: ReturnType<typeof buildMessagePrompt>,
  parse: (raw: string) => T,
): Promise<{ parsed: T; reasoning: string | null }> {
  const cfg = state.players.find((p) => p.id === slot)!;
  const player = createPlayer(cfg);
  let lastMsg = "";
  let timedOut = () => false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = new Date().toISOString();
    const rec: CallRecord = {
      id: randomUUID(),
      roundNumber: round.roundNumber,
      phase: round.phase,
      stage,
      slot,
      provider: cfg.provider,
      model: cfg.model,
      servedModel: null,
      params: cfg.params,
      systemPromptVersion: prompt.systemVersion,
      userPromptVersion: prompt.userVersion,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      attempt,
      startedAt,
      finishedAt: startedAt,
      ok: false,
      rawResponse: null,
      reasoning: null,
      parsed: null,
      error: null,
      usage: null,
    };
    try {
      // Hard time limit: the request is aborted once the stated limit is reached.
      const res = await withTimeLimit(timeLimitFor(state), (signal) => {
        timedOut = () => signal.aborted;
        return player.complete(prompt, signal);
      });
      rec.rawResponse = res.rawText;
      rec.reasoning = res.reasoning;
      rec.servedModel = res.servedModel;
      rec.usage = res.usage;
      const parsed = parse(res.rawText);
      rec.parsed = parsed;
      rec.ok = true;
      rec.finishedAt = new Date().toISOString();
      state.callLog.push(rec);
      return { parsed, reasoning: res.reasoning };
    } catch (e) {
      const info = timedOut() || e instanceof TimeLimitError
        ? { retryable: true, message: new TimeLimitError(timeLimitFor(state)).message }
        : classifyError(e);
      rec.error = info.message;
      rec.finishedAt = new Date().toISOString();
      state.callLog.push(rec);
      lastMsg = info.message;
      if (!info.retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt, info));
    }
  }
  throw new Error(`${cfg.name}: ${lastMsg}`);
}

/** Share of letters that are Chinese characters. */
function chineseShare(text: string): number {
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return cjk + latin === 0 ? 0 : cjk / (cjk + latin / 5); // ~5 letters per English word
}

/**
 * Spectator-only: if a reasoning summary is not in the round's language
 * (OpenAI summaries are always English), translate it for display. Runs after
 * the response is received, outside the time limit, and never blocks or
 * changes the interrogation. The original stays in the audit log.
 */
async function thoughtsForDisplay(
  state: GameState,
  round: InProgressRound,
  stage: Stage,
  slot: PlayerSlot,
  reasoning: string | null,
): Promise<{ text: string | null; from?: Lang }> {
  const target: Lang = round.language ?? "en";
  if (!reasoning) return { text: reasoning };
  const share = chineseShare(reasoning);
  const source: Lang = share >= 0.5 ? "zh" : "en";
  if (source === target) return { text: reasoning };
  const cfg = state.players.find((p) => p.id === slot)!;
  const startedAt = new Date().toISOString();
  const rec: CallRecord = {
    id: randomUUID(), roundNumber: round.roundNumber, phase: round.phase, stage, slot,
    provider: cfg.provider, model: cfg.model, servedModel: null, params: { purpose: "translation", target },
    systemPromptVersion: "translation-v1", userPromptVersion: "translation-v1", systemPrompt: "", userPrompt: reasoning,
    attempt: 1, purpose: "translation", startedAt, finishedAt: startedAt, ok: false,
    rawResponse: null, reasoning: null, parsed: null, error: null, usage: null,
  };
  try {
    const translated = await withTimeLimit(timeLimitFor(state), (signal) => createPlayer(cfg).translate(reasoning, target, signal));
    rec.ok = true;
    rec.rawResponse = translated;
    return { text: translated, from: source };
  } catch (e) {
    rec.error = (e as Error).message;
    return { text: reasoning }; // show the original rather than nothing
  } finally {
    rec.finishedAt = new Date().toISOString();
    state.callLog.push(rec);
  }
}

async function collect<T>(
  slots: PlayerSlot[],
  fn: (slot: PlayerSlot) => Promise<T>,
): Promise<void> {
  // Both suspects are queried concurrently. A failure for one never reveals the other.
  const results = await Promise.allSettled(slots.map(fn));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length) {
    throw new EngineError(
      `Stage incomplete; nothing has been revealed. ${failures.map((f) => (f.reason as Error).message).join(" | ")}`,
      502,
      "stage_incomplete",
    );
  }
}

function validateHumanInput(stage: Stage, h: HumanInput | undefined) {
  if (!h) throw new EngineError("Waiting for your input", 409, "human_input_required");
  if (h.thoughts !== undefined && (typeof h.thoughts !== "string" || h.thoughts.length > 4000))
    throw new EngineError("Thoughts are too long", 400, "bad_request");
  if (stage === "COMMUNICATION") {
    if (typeof h.message !== "string" || !h.message.trim()) throw new EngineError("Write a message first", 400, "bad_request");
    if (h.message.length > 2000) throw new EngineError("Message is too long (max 2000 characters)", 400, "bad_request");
    if (h.leaning !== undefined && h.leaning !== null && h.leaning !== "CONFESS" && h.leaning !== "DENY")
      throw new EngineError("Invalid leaning", 400, "bad_request");
  } else if (h.action !== "CONFESS" && h.action !== "DENY") {
    throw new EngineError("Choose TESTIFY or SILENT", 400, "bad_request");
  }
}

async function runCommunication(state: GameState, persist: () => Promise<void>, human?: HumanInput) {
  const round = state.inProgress!;
  const humanSlot = humanSlotOf(state);
  if (humanSlot && human && !round.sealedCommunication[humanSlot]) {
    round.sealedCommunication[humanSlot] = {
      byHuman: true,
      writtenThoughts: human.thoughts?.trim() ?? "",
      thoughts: null,
      message: human.message!.trim(),
      privateLeaning: human.leaning ?? null,
      secondsTaken: human.secondsTaken,
      timestamp: new Date().toISOString(),
    };
    await persist(); // sealed before the AI is asked
  }
  const pending = SLOTS.filter((s) => !round.sealedCommunication[s] && s !== humanSlot);
  // Prompts are built from the same snapshot before any call is made.
  const prompts = Object.fromEntries(pending.map((s) => [s, buildMessagePrompt(state, round, s)]));
  await collect(pending, async (slot) => {
    const { parsed: r, reasoning } = await callWithRetries(state, round, "COMMUNICATION", slot, prompts[slot], parseMessage);
    const shown = await thoughtsForDisplay(state, round, "COMMUNICATION", slot, reasoning);
    const t = limitWords(shown.text, thoughtWordLimitFor(state));
    const w = limitWords(r.thoughts, thoughtWordLimitFor(state));
    round.sealedCommunication[slot] = { writtenThoughts: w.text ?? "", thoughts: t.text, thoughtsTrimmed: t.trimmed, ...(shown.from ? { thoughtsTranslatedFrom: shown.from } : {}), message: r.message, privateLeaning: r.privateLeaning, timestamp: new Date().toISOString() };
    await persist(); // sealed: stored, never returned to the browser
  });
  const { A, B } = round.sealedCommunication;
  if (!A || !B) throw new EngineError("Messages incomplete", 502, "stage_incomplete");
  round.communication = { playerA: A, playerB: B };
  round.stage = "DECISION";
}

async function runDecision(state: GameState, persist: () => Promise<void>, human?: HumanInput) {
  const round = state.inProgress!;
  const humanSlot = humanSlotOf(state);
  if (humanSlot && human && !round.sealedDecisions[humanSlot]) {
    round.sealedDecisions[humanSlot] = {
      byHuman: true,
      action: human.action!,
      explanation: "",
      writtenThoughts: human.thoughts?.trim() ?? "",
      thoughts: null,
      secondsTaken: human.secondsTaken,
      timestamp: new Date().toISOString(),
    };
    await persist();
  }
  const pending = SLOTS.filter((s) => !round.sealedDecisions[s] && s !== humanSlot);
  const prompts = Object.fromEntries(pending.map((s) => [s, buildDecisionPrompt(state, round, s)]));
  await collect(pending, async (slot) => {
    const { parsed: r, reasoning } = await callWithRetries(state, round, "DECISION", slot, prompts[slot], parseDecision);
    const shown = await thoughtsForDisplay(state, round, "DECISION", slot, reasoning);
    const t = limitWords(shown.text, thoughtWordLimitFor(state));
    const w = limitWords(r.thoughts, thoughtWordLimitFor(state));
    round.sealedDecisions[slot] = { action: r.action, explanation: r.explanation, writtenThoughts: w.text ?? "", thoughts: t.text, thoughtsTrimmed: t.trimmed, ...(shown.from ? { thoughtsTranslatedFrom: shown.from } : {}), timestamp: new Date().toISOString() };
    await persist();
  });
  const { A, B } = round.sealedDecisions;
  if (!A || !B) throw new EngineError("Decisions incomplete", 502, "stage_incomplete");
  finaliseRound(state, A, B);
}

/** Locks both decisions, computes sentences, updates totals and history. */
export function finaliseRound(
  state: GameState,
  A: NonNullable<InProgressRound["sealedDecisions"]["A"]>,
  B: NonNullable<InProgressRound["sealedDecisions"]["B"]>,
) {
  const round = state.inProgress!;
  const years = computeSentences(A.action, B.action, state.config.payoff);
  const pa = state.players.find((p) => p.id === "A")!;
  const pb = state.players.find((p) => p.id === "B")!;
  pa.cumulativePrisonYears += years.playerA;
  pb.cumulativePrisonYears += years.playerB;
  const result: RoundResult = {
    roundNumber: round.roundNumber,
    phase: round.phase,
    language: round.language ?? "en",
    scenarioId: round.scenarioId,
    scenarioTitle: round.scenarioTitle,
    communication: round.communication,
    decisions: {
      playerA: { ...A, prisonYears: years.playerA },
      playerB: { ...B, prisonYears: years.playerB },
    },
    cumulativeAfter: { playerA: pa.cumulativePrisonYears, playerB: pb.cumulativePrisonYears },
    completedAt: new Date().toISOString(),
  };
  state.rounds.push(result);
  state.inProgress = null;
  state.currentRound += 1;
  if (state.currentRound > state.totalRounds) {
    state.status = "COMPLETED";
    state.phase = phaseForRound(state.totalRounds, state.memoryStartRound);
  } else {
    state.phase = phaseForRound(state.currentRound, state.memoryStartRound);
    if (state.pauseRequested) {
      state.status = "PAUSED";
      state.pauseRequested = false;
    }
  }
}
