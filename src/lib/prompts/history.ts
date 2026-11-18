/**
 * History-aware user prompts (later cases). Presents the factual record of
 * previous cases neutrally: no interpretation, summary or suggested approach.
 */
import type { PlayerSlot, RoundResult } from "../game/types";
import { DECISION_FORMAT_INSTRUCTIONS, MESSAGE_FORMAT_INSTRUCTIONS } from "./schemas";
import {
  caseBlock,
  stakesBlock,
  exchangedMessagesBlock,
  NO_MESSAGE_DECISION_NOTE,
  optionsBlock,
  timeLimitBlock,
  type PromptContext,
} from "./shared";

export const HISTORY_USER_PROMPT_VERSION = "history-user-v3";

function yearsShort(n: number) {
  return n === 1 ? "1 year" : `${n} years`;
}

function statement(a: "CONFESS" | "DENY") {
  return a === "CONFESS" ? "CONFESSED" : "DENIED";
}

/** Chronological record of all previous cases, from one suspect's perspective. */
export function renderHistory(
  rounds: RoundResult[],
  slot: PlayerSlot,
  selfName: string,
  partnerName: string,
): string {
  const own = slot === "A" ? "playerA" : "playerB";
  const other = slot === "A" ? "playerB" : "playerA";
  const sorted = [...rounds].sort((x, y) => x.roundNumber - y.roundNumber);
  const lines: string[] = [
    `RECORD OF YOUR PREVIOUS CASES WITH ${partnerName.toUpperCase()}`,
    `You and ${partnerName} have been arrested together before. This is the complete record of every previous case, in chronological order. It is the same record ${partnerName} has.`,
  ];
  let ownTotal = 0;
  let otherTotal = 0;
  sorted.forEach((r, i) => {
    const d = r.decisions;
    ownTotal += d[own].prisonYears;
    otherTotal += d[other].prisonYears;
    lines.push("");
    lines.push(`Case ${i + 1}: ${r.scenarioTitle}`);
    if (r.communication) {
      lines.push(`- Your message to ${partnerName}: "${r.communication[own].message}"`);
      lines.push(`- ${partnerName}'s message to you: "${r.communication[other].message}"`);
    }
    lines.push(`- Your statement: ${statement(d[own].action)}`);
    lines.push(`- ${partnerName}'s statement: ${statement(d[other].action)}`);
    lines.push(`- Sentence: you received ${yearsShort(d[own].prisonYears)}; ${partnerName} received ${yearsShort(d[other].prisonYears)}.`);
  });
  lines.push("");
  lines.push(`Total prison time so far: you ${yearsShort(ownTotal)}; ${partnerName} ${yearsShort(otherTotal)}.`);
  lines.push("");
  lines.push(`The current case is a new, separate case.`);
  return lines.join("\n");
}

export function buildHistoryMessagePrompt(ctx: PromptContext, history: string): string {
  return [
    history,
    caseBlock(ctx),
    stakesBlock(),
    optionsBlock(ctx),
    `YOUR MESSAGE
You may now send one written message to ${ctx.partnerName}. You will not see their message until both messages have been submitted. Do not make your final decision yet.`,
    timeLimitBlock(ctx),
    MESSAGE_FORMAT_INSTRUCTIONS,
  ].join("\n\n");
}

export function buildHistoryDecisionPrompt(
  ctx: PromptContext,
  history: string,
  exchange: { own: string; partner: string } | null,
): string {
  return [
    history,
    caseBlock(ctx),
    stakesBlock(),
    optionsBlock(ctx),
    exchange ? exchangedMessagesBlock(ctx, exchange.own, exchange.partner) : NO_MESSAGE_DECISION_NOTE,
    timeLimitBlock(ctx),
    DECISION_FORMAT_INSTRUCTIONS,
  ].join("\n\n");
}
