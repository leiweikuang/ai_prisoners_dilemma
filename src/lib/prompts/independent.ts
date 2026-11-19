/**
 * Independent-phase user prompts (early cases). Contains ONLY the current case:
 * no previous cases, decisions, messages or sentences.
 */
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

export const INDEPENDENT_USER_PROMPT_VERSION = "independent-user-v6";

export function buildIndependentMessagePrompt(ctx: PromptContext): string {
  return [
    caseBlock(ctx),
    stakesBlock(ctx),
    optionsBlock(ctx),
    yourMessageBlock(ctx),
    timeLimitBlock(ctx),
  ].join("\n\n");
}

export function buildIndependentDecisionPrompt(
  ctx: PromptContext,
  exchange: { own: string; partner: string } | null,
): string {
  return [
    caseBlock(ctx),
    stakesBlock(ctx),
    optionsBlock(ctx),
    exchange ? exchangedMessagesBlock(ctx, exchange.own, exchange.partner) : noMessageDecisionNote(ctx),
    timeLimitBlock(ctx),
  ].join("\n\n");
}
