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
import { parseDecision, parseMessage } from "../prompts/schemas";
import { scenarioForRound } from "../prompts/scenarios";
import { getStore, VersionConflictError } from "../store";
import { computeSentences, DEFAULT_PAYOFF, phaseForRound } from "./payoff";
import { buildDecisionPrompt, buildMessagePrompt } from "./prompts";
import type {
  CallRecord,
  GameState,
  InProgressRound,
  PlayerConfig,
  PlayerSlot,
  PublicGameState,
  RoundResult,
  Stage,
} from "./types";

export const LOCK_TTL_MS = 6 * 60 * 1000;
const SLOTS: PlayerSlot[] = ["A", "B"];
const PERSONAS: Record<PlayerSlot, string> = { A: "Alex Mercer", B: "Jordan Hayes" };

export class EngineError extends Error {
  constructor(
    message: string,
    public httpStatus: number,
    public code: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------- creation

export interface CreateGameInput {
  playerA: { provider: string; model: string };
  playerB: { provider: string; model: string };
  totalRounds?: number;
  memoryStartRound?: number;
}

export function createGameState(input: CreateGameInput): GameState {
  const totalRounds = Math.trunc(input.totalRounds ?? 20);
  const memoryStartRound = Math.trunc(input.memoryStartRound ?? 11);
  if (!(totalRounds >= 1 && totalRounds <= 100)) throw new EngineError("totalRounds must be 1–100", 400, "bad_config");
  if (!(memoryStartRound >= 1 && memoryStartRound <= totalRounds + 1))
    throw new EngineError("memoryStartRound must be between 1 and totalRounds + 1", 400, "bad_config");

  const mk = (slot: PlayerSlot, cfg: { provider: string; model: string }): PlayerConfig => {
    if (!isProviderId(cfg.provider)) throw new EngineError(`Unknown provider ${cfg.provider}`, 400, "bad_config");
    const prov = PROVIDERS[cfg.provider];
    if (!prov.available()) throw new EngineError(`Provider ${cfg.provider} is not configured (missing API key?)`, 400, "provider_unavailable");
    const model = (cfg.model || prov.defaultModel()).trim();
    if (!/^[\w.:\-/@]+$/.test(model)) throw new EngineError("Invalid model identifier", 400, "bad_config");
    return { slot, name: prov.displayName, provider: cfg.provider, model, params: prov.defaultParams(model), persona: { name: PERSONAS[slot] } };
  };
  const a = mk("A", input.playerA);
  const b = mk("B", input.playerB);
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
    currentRound: 1,
    totalRounds,
    memoryStartRound,
    phase: phaseForRound(1, memoryStartRound),
    config: {
      totalRounds,
      memoryStartRound,
      communicationEnabled: true,
      payoff: DEFAULT_PAYOFF,
      promptVersions: PROMPT_VERSIONS,
    },
    configChanges: [{ at: now, description: "Experiment created; configuration locked." }],
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

export function toPublic(state: GameState): PublicGameState {
  const { callLog: _c, lock, inProgress, ...rest } = state;
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

export async function control(gameId: string, action: "pause" | "resume") {
  const store = getStore();
  for (let i = 0; i < 5; i++) {
    const s = await store.get(gameId);
    if (!s) throw new EngineError("Game not found", 404, "not_found");
    if (s.status === "COMPLETED") return s;
    const next = { ...s };
    if (action === "resume") {
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
export async function advance(gameId: string, req: AdvanceRequest): Promise<GameState> {
  const store = getStore();
  const loaded = await store.get(gameId);
  if (!loaded) throw new EngineError("Game not found", 404, "not_found");
  let state: GameState = loaded;
  if (state.status === "COMPLETED") throw new EngineError("Experiment already completed", 409, "completed");
  if (state.lock && !lockExpired(state.lock)) throw new EngineError("This stage is already being processed", 409, "busy");

  const expected = nextStage(state);
  if (req.roundNumber !== state.currentRound || req.stage !== expected)
    throw new EngineError(`Stale request: expected round ${state.currentRound} stage ${expected}`, 409, "stale");

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
    if (req.stage === "COMMUNICATION") await runCommunication(state, persist);
    else await runDecision(state, persist);
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
      const res = await player.complete(prompt);
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
      const info = classifyError(e);
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

async function runCommunication(state: GameState, persist: () => Promise<void>) {
  const round = state.inProgress!;
  const pending = SLOTS.filter((s) => !round.sealedCommunication[s]);
  // Prompts are built from the same snapshot before any call is made.
  const prompts = Object.fromEntries(pending.map((s) => [s, buildMessagePrompt(state, round, s)]));
  await collect(pending, async (slot) => {
    const { parsed: r, reasoning } = await callWithRetries(state, round, "COMMUNICATION", slot, prompts[slot], parseMessage);
    round.sealedCommunication[slot] = { thoughts: reasoning, message: r.message, privateLeaning: r.privateLeaning, timestamp: new Date().toISOString() };
    await persist(); // sealed: stored, never returned to the browser
  });
  const { A, B } = round.sealedCommunication;
  if (!A || !B) throw new EngineError("Messages incomplete", 502, "stage_incomplete");
  round.communication = { playerA: A, playerB: B };
  round.stage = "DECISION";
}

async function runDecision(state: GameState, persist: () => Promise<void>) {
  const round = state.inProgress!;
  const pending = SLOTS.filter((s) => !round.sealedDecisions[s]);
  const prompts = Object.fromEntries(pending.map((s) => [s, buildDecisionPrompt(state, round, s)]));
  await collect(pending, async (slot) => {
    const { parsed: r, reasoning } = await callWithRetries(state, round, "DECISION", slot, prompts[slot], parseDecision);
    round.sealedDecisions[slot] = { action: r.action, explanation: r.explanation, thoughts: reasoning, timestamp: new Date().toISOString() };
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
