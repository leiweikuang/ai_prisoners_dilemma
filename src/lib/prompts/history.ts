/**
 * History-aware user prompts (later cases). Presents the factual record of
 * previous cases neutrally: no interpretation, summary or suggested approach.
 */
import type { Lang, PlayerSlot, RoundResult } from "../game/types";
import { scenarioById, scenarioTitle } from "./scenarios";
import {
  caseBlock,
  stakesBlock,
  exchangedMessagesBlock,
  noMessageDecisionNote,
  yourMessageBlock,
  optionsBlock,
  timeLimitBlock,
  type PromptContext,
} from "./shared";

export const HISTORY_USER_PROMPT_VERSION = "history-user-v5";

function yearsShort(n: number) {
  return n === 1 ? "1 year" : `${n} years`;
}

function statement(a: "CONFESS" | "DENY") {
  return a === "CONFESS" ? "TESTIFIED (informed on the other)" : "STAYED SILENT";
}

/** Chronological record of all previous cases, from one suspect's perspective. */
export function renderHistory(
  rounds: RoundResult[],
  slot: PlayerSlot,
  selfName: string,
  partnerName: string,
  lang: Lang = "en",
): string {
  const own = slot === "A" ? "playerA" : "playerB";
  const other = slot === "A" ? "playerB" : "playerA";
  const sorted = [...rounds].sort((x, y) => x.roundNumber - y.roundNumber);
  const zh = lang === "zh";
  const title = (r: RoundResult) => {
    const sc = scenarioById(r.scenarioId);
    return sc ? scenarioTitle(sc, lang) : r.scenarioTitle;
  };
  const lines: string[] = zh
    ? [`你与${partnerName}以往案件的记录`, `你和${partnerName}以前曾一起被捕。以下是按时间顺序排列的以往每一起案件的完整记录。${partnerName}手上的记录与此相同。`]
    : [
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
    if (zh) {
      lines.push(`案件${i + 1}：${title(r)}`);
      if (r.communication) {
        lines.push(`- 你写给${partnerName}的消息：“${r.communication[own].message}”`);
        lines.push(`- ${partnerName}写给你的消息：“${r.communication[other].message}”`);
      }
      lines.push(`- 你的选择：${statementZh(d[own].action)}`);
      lines.push(`- ${partnerName}的选择：${statementZh(d[other].action)}`);
      lines.push(`- 判决：你被判${d[own].prisonYears}年；${partnerName}被判${d[other].prisonYears}年。`);
    } else {
      lines.push(`Case ${i + 1}: ${title(r)}`);
      if (r.communication) {
        lines.push(`- Your message to ${partnerName}: "${r.communication[own].message}"`);
        lines.push(`- ${partnerName}'s message to you: "${r.communication[other].message}"`);
      }
      lines.push(`- Your choice: ${statement(d[own].action)}`);
      lines.push(`- ${partnerName}'s choice: ${statement(d[other].action)}`);
      lines.push(`- Sentence: you received ${yearsShort(d[own].prisonYears)}; ${partnerName} received ${yearsShort(d[other].prisonYears)}.`);
    }
  });
  lines.push("");
  lines.push(zh ? `目前为止的总刑期：你${ownTotal}年；${partnerName}${otherTotal}年。` : `Total prison time so far: you ${yearsShort(ownTotal)}; ${partnerName} ${yearsShort(otherTotal)}.`);
  lines.push("");
  lines.push(zh ? "当前案件是一起新的、独立的案件。" : `The current case is a new, separate case.`);
  return lines.join("\n");
}

function statementZh(a: "CONFESS" | "DENY") {
  return a === "CONFESS" ? "告发（TESTIFY）" : "沉默（SILENT）";
}

export function buildHistoryMessagePrompt(ctx: PromptContext, history: string): string {
  return [
    history,
    caseBlock(ctx),
    stakesBlock(ctx),
    optionsBlock(ctx),
    yourMessageBlock(ctx),
    timeLimitBlock(ctx),
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
    stakesBlock(ctx),
    optionsBlock(ctx),
    exchange ? exchangedMessagesBlock(ctx, exchange.own, exchange.partner) : noMessageDecisionNote(ctx),
    timeLimitBlock(ctx),
  ].join("\n\n");
}
