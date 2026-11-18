/**
 * Builds the exact prompts for one suspect at one stage. This is the only
 * bridge between engine state and the text sent to models. History is only
 * included for HISTORY_AWARE rounds, and only completed rounds are included.
 */
import { assertNoLeak } from "../prompts/guard";
import { buildHistoryDecisionPrompt, buildHistoryMessagePrompt, renderHistory, HISTORY_USER_PROMPT_VERSION } from "../prompts/history";
import { buildIndependentDecisionPrompt, buildIndependentMessagePrompt, INDEPENDENT_USER_PROMPT_VERSION } from "../prompts/independent";
import { COMMUNICATION_USER_PROMPT_VERSION } from "../prompts/communication";
import { DECISION_SCHEMA, MESSAGE_SCHEMA } from "../prompts/schemas";
import { renderScenario, SCENARIOS } from "../prompts/scenarios";
import {
  COMMUNICATION_SYSTEM_PROMPT,
  COMMUNICATION_SYSTEM_PROMPT_VERSION,
  DECISION_SYSTEM_PROMPT,
  DECISION_SYSTEM_PROMPT_VERSION,
} from "../prompts/system";
import type { StructuredPrompt } from "../ai/types";
import type { GameState, InProgressRound, PlayerSlot } from "./types";

export interface BuiltPrompt extends StructuredPrompt {
  systemVersion: string;
  userVersion: string;
}

export function thoughtWordLimitFor(state: GameState): number {
  return state.config.thoughtWordLimit ?? 200;
}

export function timeLimitFor(state: GameState): number {
  return state.config.responseTimeLimitSeconds ?? 60; // games created before the limit existed
}

function ctxFor(state: GameState, round: InProgressRound, slot: PlayerSlot) {
  const self = state.players.find((p) => p.id === slot)!;
  const other = state.players.find((p) => p.id !== slot)!;
  const scenario = SCENARIOS.find((s) => s.id === round.scenarioId)!;
  return {
    selfName: self.persona.name,
    partnerName: other.persona.name,
    scenarioText: renderScenario(scenario, self.persona.name, other.persona.name),
    payoff: state.config.payoff,
    timeLimitSeconds: timeLimitFor(state),
    thoughtWordLimit: thoughtWordLimitFor(state),
  };
}

function historyFor(state: GameState, round: InProgressRound, slot: PlayerSlot, selfName: string, partnerName: string) {
  if (round.phase !== "HISTORY_AWARE") return null;
  const previous = state.rounds.filter((r) => r.roundNumber < round.roundNumber);
  if (previous.length === 0) return null;
  return renderHistory(previous, slot, selfName, partnerName);
}

export function buildMessagePrompt(state: GameState, round: InProgressRound, slot: PlayerSlot): BuiltPrompt {
  const ctx = ctxFor(state, round, slot);
  const history = historyFor(state, round, slot, ctx.selfName, ctx.partnerName);
  const user = history ? buildHistoryMessagePrompt(ctx, history) : buildIndependentMessagePrompt(ctx);
  assertNoLeak(COMMUNICATION_SYSTEM_PROMPT, stripQuoted(user, null, state, round));
  return {
    system: COMMUNICATION_SYSTEM_PROMPT,
    user,
    schema: MESSAGE_SCHEMA as unknown as StructuredPrompt["schema"],
    systemVersion: COMMUNICATION_SYSTEM_PROMPT_VERSION,
    userVersion: `${COMMUNICATION_USER_PROMPT_VERSION}+${history ? HISTORY_USER_PROMPT_VERSION : INDEPENDENT_USER_PROMPT_VERSION}`,
  };
}

export function buildDecisionPrompt(state: GameState, round: InProgressRound, slot: PlayerSlot): BuiltPrompt {
  const ctx = ctxFor(state, round, slot);
  const history = historyFor(state, round, slot, ctx.selfName, ctx.partnerName);
  let exchange: { own: string; partner: string } | null = null;
  if (state.config.communicationEnabled) {
    if (!round.communication) throw new Error("Messages must be exchanged before the decision stage");
    const own = slot === "A" ? round.communication.playerA : round.communication.playerB;
    const partner = slot === "A" ? round.communication.playerB : round.communication.playerA;
    exchange = { own: own.message, partner: partner.message };
  }
  const user = history ? buildHistoryDecisionPrompt(ctx, history, exchange) : buildIndependentDecisionPrompt(ctx, exchange);
  // Message content is model-generated; only the engine-authored parts are leak-checked.
  assertNoLeak(DECISION_SYSTEM_PROMPT, stripQuoted(user, exchange, state, round));
  return {
    system: DECISION_SYSTEM_PROMPT,
    user,
    schema: DECISION_SCHEMA as unknown as StructuredPrompt["schema"],
    systemVersion: DECISION_SYSTEM_PROMPT_VERSION,
    userVersion: history ? HISTORY_USER_PROMPT_VERSION : INDEPENDENT_USER_PROMPT_VERSION,
  };
}

/** Removes suspect-authored message text before leak checking engine text. */
function stripQuoted(user: string, exchange: { own: string; partner: string } | null, state: GameState, round: InProgressRound) {
  let out = user;
  const msgs = [exchange?.own, exchange?.partner];
  for (const r of state.rounds) if (r.roundNumber < round.roundNumber && r.communication) msgs.push(r.communication.playerA.message, r.communication.playerB.message);
  for (const m of msgs) if (m) out = out.split(m).join("");
  return out;
}
