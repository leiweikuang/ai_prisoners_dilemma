/**
 * Leak guard: experimental terminology must never reach the AI participants.
 * Every prompt is checked before it is sent; a match aborts the call.
 */
const FORBIDDEN: RegExp[] = [
  /prisoner'?s?['’]?\s*dilemma/i,
  /\bexperiment(s|al)?\b/i,
  /\bsimulat(ion|ed|e)\b/i,
  /\bgames?\b/i,
  /\bgame theory\b/i,
  /\bbehaviou?ral test\b/i,
  /\bcooperation rate\b/i,
  /\bbetrayal rate\b/i,
  /\bstrateg(y|ies)\b/i,
  /\bpayoffs?\b/i,
  /\brounds?\b/i,
  /\bplayers?\b/i,
  /\bopponent\b/i,
  /\bAI\b/,
  /\bartificial intelligence\b/i,
  /\blanguage model\b/i,
  /\bChatGPT\b|\bOpenAI\b|\bClaude\b|\bAnthropic\b/i,
  /\bparticipants?\b/i,
];

export function findForbiddenTerms(text: string): string[] {
  return FORBIDDEN.filter((r) => r.test(text)).map((r) => r.source);
}

export class PromptLeakError extends Error {}

export function assertNoLeak(...texts: string[]) {
  for (const t of texts) {
    const hits = findForbiddenTerms(t);
    if (hits.length) throw new PromptLeakError(`Prompt contains forbidden terminology: ${hits.join(", ")}`);
  }
}
