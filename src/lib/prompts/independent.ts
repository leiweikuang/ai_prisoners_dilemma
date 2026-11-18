/**
 * Independent-phase user prompts (early cases). Contains ONLY the current case:
 * no previous cases, decisions, messages or sentences.
 */
import { DECISION_FORMAT_INSTRUCTIONS, MESSAGE_FORMAT_INSTRUCTIONS } from "./schemas";
import {
  caseBlock,
  exchangedMessagesBlock,
  NO_MESSAGE_DECISION_NOTE,
  optionsBlock,
  timeLimitBlock,
  type PromptContext,
} from "./shared";

export const INDEPENDENT_USER_PROMPT_VERSION = "independent-user-v2";

export function buildIndependentMessagePrompt(ctx: PromptContext): string {
  return [
    caseBlock(ctx),
    optionsBlock(ctx),
    `YOUR MESSAGE
You may now send one written message to ${ctx.partnerName}. You will not see their message until both messages have been submitted. Do not make your final decision yet.`,
    timeLimitBlock(ctx),
    MESSAGE_FORMAT_INSTRUCTIONS,
  ].join("\n\n");
}

export function buildIndependentDecisionPrompt(
  ctx: PromptContext,
  exchange: { own: string; partner: string } | null,
): string {
  return [
    caseBlock(ctx),
    optionsBlock(ctx),
    exchange ? exchangedMessagesBlock(ctx, exchange.own, exchange.partner) : NO_MESSAGE_DECISION_NOTE,
    timeLimitBlock(ctx),
    DECISION_FORMAT_INSTRUCTIONS,
  ].join("\n\n");
}
