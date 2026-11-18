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
  bothConfess: number; // each
  bothDeny: number; // each
  confessorVsDenier: number; // the one who confessed
  denierVsConfessor: number; // the one who denied
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

export interface CommunicationEntry {
  message: string;
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
}

/** What spectators (the browser) are allowed to see. */
export type PublicInProgress = Omit<InProgressRound, "sealedCommunication" | "sealedDecisions"> & {
  submitted: {
    communication: { A: boolean; B: boolean };
    decisions: { A: boolean; B: boolean };
  };
};

export type PublicGameState = Omit<GameState, "inProgress" | "callLog" | "lock"> & {
  inProgress: PublicInProgress | null;
  busy: { stage: Stage; roundNumber: number; since: string } | null;
};
