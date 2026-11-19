/**
 * Game-engine types. These carry experimental terminology and are NEVER
 * serialised into prompts sent to the AI participants.
 */

export type Action = "CONFESS" | "DENY";
/** Language a round is run in (prompts and replies) and the page is shown in. */
export type Lang = "en" | "zh";
export type PlayerSlot = "A" | "B";
export type Phase = "INDEPENDENT" | "HISTORY_AWARE";
export type Stage = "COMMUNICATION" | "DECISION";
export type GameStatus = "READY" | "RUNNING" | "PAUSED" | "COMPLETED";

/** Years in prison for [self, other] given [selfAction, otherAction]. */
export interface PayoffMatrix {
  bothConfessA: number;
  bothConfessB: number;
  AConfessBDenyA: number;
  AConfessBDenyB: number;
  ADenyBConfessA: number;
  ADenyBConfessB: number;
  bothDenyA: number;
  bothDenyB: number;
}

export interface PlayerConfig {
  slot: PlayerSlot;
  /** Display name for spectators, e.g. "ChatGPT". */
  name: string;
  provider: string; // "openai" | "anthropic" | "mock" | future providers
  model: string;
  /** Exact API parameters sent with every request (recorded for integrity). */
  params: Record<string, unknown>;
  /** Fictional identity used inside prompts. */
  persona: { name: string };
}

export interface PlayerState extends PlayerConfig {
  id: PlayerSlot;
  cumulativePrisonYears: number;
}

export interface PromptVersions {
  decisionSystem: string;
  communicationSystem: string;
  independentUser: string;
  historyUser: string;
  communicationUser: string;
  responseSchemas: string;
  scenarios: string;
}

export interface ExperimentConfig {
  totalRounds: number;
  memoryStartRound: number;
  communicationEnabled: boolean;
  /** Hard per-response limit (each API attempt is aborted after this). Stated to the suspects. */
  responseTimeLimitSeconds: number;
  /** Models get no tools: no web search, browsing or code execution. */
  toolsEnabled: false;
  /** Thoughts are limited to this many words: stated to the suspects, and trimmed for display. */
  thoughtWordLimit: number;
  payoff: PayoffMatrix;
  promptVersions: PromptVersions;
}

/** What a human player submits from the browser for one stage. */
export interface HumanInput {
  message?: string;
  thoughts?: string;
  leaning?: Action | null;
  action?: Action;
  secondsTaken?: number;
}

export interface CommunicationEntry {
  message: string;
  /** Submitted by the human player rather than a model. */
  byHuman?: boolean;
  /** The model declined to write a monologue; the text shown comes from its reasoning summary. */
  monologueFallback?: boolean;
  secondsTaken?: number;
  /** Set in public views while a human is playing: the opponent's thoughts are withheld until the game ends. */
  thoughtsHidden?: boolean;
  /** The suspect's own private thoughts, written before the message (required field). Spectators only. */
  writtenThoughts?: string;
  /** Provider reasoning summary written before the message. Spectators only. */
  thoughts?: string | null;
  /** True when the provider's summary exceeded the word limit and was trimmed for display. */
  thoughtsTrimmed?: boolean;
  /** Language the summary was translated from for display (original kept in the audit log). */
  thoughtsTranslatedFrom?: Lang;
  /** Private, never shown to the other suspect. Used to measure communication impact. */
  privateLeaning: Action | null;
  timestamp: string;
}

export interface DecisionEntry {
  action: Action;
  byHuman?: boolean;
  monologueFallback?: boolean;
  secondsTaken?: number;
  thoughtsHidden?: boolean;
  /** Older rounds only; no longer requested. */
  explanation: string;
  /** The suspect's own private thoughts, written before choosing (required field). Spectators only. */
  writtenThoughts?: string;
  /** Provider reasoning summary after reading the other suspect's message. Spectators only. */
  thoughts?: string | null;
  thoughtsTrimmed?: boolean;
  thoughtsTranslatedFrom?: Lang;
  prisonYears: number;
  timestamp: string;
}

export interface RoundResult {
  roundNumber: number;
  phase: Phase;
  /** Language the round was run in (absent on rounds from before the switch existed = English). */
  language?: Lang;
  scenarioId: string;
  scenarioTitle: string;
  communication: { playerA: CommunicationEntry; playerB: CommunicationEntry } | null;
  decisions: { playerA: DecisionEntry; playerB: DecisionEntry };
  cumulativeAfter: { playerA: number; playerB: number };
  completedAt: string;
  /** How long each suspect took to seal each stage, in ms (absent on older rounds). */
  sealedAfterMs?: SealTimings;
}

export interface SealTimings {
  communication: { A: number | null; B: number | null };
  decisions: { A: number | null; B: number | null };
}

/** A submission that is held by the engine and NOT revealed until both are in. */
export interface SealedSubmissions<T> {
  A?: T;
  B?: T;
}

export interface InProgressRound {
  roundNumber: number;
  phase: Phase;
  language?: Lang;
  scenarioId: string;
  scenarioTitle: string;
  stage: Stage;
  startedAt: string;
  /** When each stage's interrogation began (the clock both suspects race against). */
  stageStartedAt?: Partial<Record<Stage, string>>;
  sealedCommunication: SealedSubmissions<CommunicationEntry>;
  sealedDecisions: SealedSubmissions<Omit<DecisionEntry, "prisonYears">>;
  /** Populated only after BOTH messages were submitted. */
  communication: { playerA: CommunicationEntry; playerB: CommunicationEntry } | null;
  lastError: string | null;
}

export interface CallRecord {
  id: string;
  roundNumber: number;
  phase: Phase;
  stage: Stage;
  slot: PlayerSlot;
  provider: string;
  model: string;
  servedModel: string | null;
  params: Record<string, unknown>;
  systemPromptVersion: string;
  userPromptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  attempt: number;
  /** Set when the answer was re-requested without the inner-monologue field after a refusal. */
  monologueFallback?: boolean;
  /** "translation" = spectator-only translation of a reasoning summary; absent = interrogation call. */
  purpose?: "translation";
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  rawResponse: string | null;
  reasoning: string | null;
  parsed: unknown;
  error: string | null;
  usage: unknown;
}

export interface ConfigChange {
  at: string;
  description: string;
}

export interface GameLock {
  token: string;
  stage: Stage;
  roundNumber: number;
  acquiredAt: string;
}

/** Labels for one message, from the post-game analysis (Action uses the engine's codes). */
export interface MessageLabels {
  promise: boolean;
  silenceRequest: boolean;
  confessPersuasion: boolean;
  threat: boolean;
  assurance: boolean;
  statedIntent: Action | null;
  requestedAction: Action | null;
}

/** Post-game analysis by DeepSeek. Spectator-only; never read by the engine or any prompt. */
export interface GameAnalysis {
  provider: "deepseek";
  model: string;
  createdAt: string;
  /** Number of completed rounds the analysis covers (re-run when more rounds finish). */
  roundsCovered: number;
  labels: Record<number, { playerA: MessageLabels | null; playerB: MessageLabels | null }>;
  summary: { en: string; zh: string };
}

export interface GameState {
  gameId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  status: GameStatus;
  pauseRequested: boolean;
  /** Language for the next round and for the page. Changeable only between rounds; every change is logged. */
  language?: Lang;
  currentRound: number;
  totalRounds: number;
  memoryStartRound: number;
  phase: Phase;
  config: ExperimentConfig;
  configChanges: ConfigChange[];
  players: PlayerState[];
  rounds: RoundResult[];
  inProgress: InProgressRound | null;
  lock: GameLock | null;
  callLog: CallRecord[];
  analysis?: GameAnalysis;
}

/** What spectators (the browser) are allowed to see. */
export type PublicInProgress = Omit<InProgressRound, "sealedCommunication" | "sealedDecisions"> & {
  submitted: {
    communication: { A: boolean; B: boolean };
    decisions: { A: boolean; B: boolean };
  };
  /** How long each suspect took to seal, in ms from the start of the stage. Contents stay sealed. */
  sealedAfterMs: SealTimings;
};

export type PublicGameState = Omit<GameState, "inProgress" | "callLog" | "lock"> & {
  inProgress: PublicInProgress | null;
  busy: { stage: Stage; roundNumber: number; since: string } | null;
};
