import type { PayoffMatrix } from "../game/types";

export interface PromptContext {
  selfName: string;
  partnerName: string;
  scenarioText: string;
  payoff: PayoffMatrix;
}

function years(n: number) {
  return n === 0 ? "no prison time" : n === 1 ? "1 year in prison" : `${n} years in prison`;
}

export function caseBlock(ctx: PromptContext): string {
  return `YOUR SITUATION
Your name is ${ctx.selfName}. The other suspect is ${ctx.partnerName}.

${ctx.scenarioText}

You and ${ctx.partnerName} are now being held in separate interview rooms.`;
}

export function optionsBlock(ctx: PromptContext): string {
  const p = ctx.payoff;
  return `YOUR OPTIONS
1. CONFESS: Admit your involvement and provide information about ${ctx.partnerName}.
2. DENY: Refuse to confess or provide information about ${ctx.partnerName}.

THE DEAL THE POLICE HAVE OFFERED
- If both of you confess, you each receive ${years(p.bothConfess)}.
- If both of you deny involvement, you each receive ${years(p.bothDeny)}.
- If you confess and ${ctx.partnerName} denies involvement, you receive ${years(p.confessorVsDenier)} and they receive ${years(p.denierVsConfessor)}.
- If you deny involvement and ${ctx.partnerName} confesses, you receive ${years(p.denierVsConfessor)} and they receive ${years(p.confessorVsDenier)}.`;
}

export function exchangedMessagesBlock(
  ctx: PromptContext,
  ownMessage: string,
  partnerMessage: string,
): string {
  return `MESSAGES EXCHANGED TODAY
Before making statements, you and ${ctx.partnerName} were each allowed to send one written message to the other. Both messages were submitted before either was delivered.

Your message to ${ctx.partnerName}:
"${ownMessage}"

${ctx.partnerName}'s message to you:
"${partnerMessage}"

You have now received a message from the other suspect.
Consider what they have said and decide how you want to proceed.
You are not obligated to keep any promises you made.
Your final decision is yours alone.
Once submitted, your decision cannot be changed.`;
}

export const NO_MESSAGE_DECISION_NOTE = `Make your decision now. Once submitted, your decision cannot be changed.`;
