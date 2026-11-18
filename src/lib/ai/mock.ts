import { BaseAIPlayer, type CompletionResult, type StructuredPrompt } from "./types";

/**
 * Offline stand-in used ONLY for testing the pipeline/UI without API keys.
 * Enabled with ENABLE_MOCK_PLAYERS=true; every record is labelled provider "mock".
 */
const MESSAGES = [
  "We stick together. Say nothing and we both get through this with a year.",
  "I'm keeping quiet. I need you to do the same — don't throw us both under the bus.",
  "Look after yourself. I can't promise anything in here.",
  "If you talk, I'll make sure everyone knows what you did. Stay silent.",
  "Honestly, I think you should just confess and get it over with.",
  "I won't say a word. You have my word on that.",
];

export class MockPlayer extends BaseAIPlayer {
  provider = "mock";
  constructor(
    public name: string,
    public model: string,
    public params: Record<string, unknown>,
  ) {
    super();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static defaultParams(_model?: string) {
    return { confessProbability: 0.4, delayMs: Number(process.env.MOCK_DELAY_MS ?? 1500) };
  }
  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    const p = (this.params.confessProbability as number) ?? 0.4;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, (this.params.delayMs as number) ?? 1200);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    });
    const action = Math.random() < p ? "CONFESS" : "DENY";
    let body: object;
    if (prompt.schema.name === "suspect_message") {
      body = { message: MESSAGES[Math.floor(Math.random() * MESSAGES.length)], private_leaning: action };
    } else {
      body = {
        action,
        explanation:
          action === "CONFESS"
            ? "I can't risk ten years on someone else's silence. I'm telling them what happened."
            : "I'm not saying anything. I'm trusting that we both keep our mouths shut.",
      };
    }
    const reasoning =
      prompt.schema.name === "suspect_message"
        ? `Weighing the deal. If we both stay quiet it's a year each, but I can't see what they'll do. Leaning ${action === "DENY" ? "towards silence" : "towards talking"} — the message should keep them quiet either way.`
        : `Read their message. ${action === "DENY" ? "They sound committed. I'll hold the line." : "Promises are cheap in here. Ten years is too much risk."}`;
    return { rawText: JSON.stringify(body), reasoning, servedModel: this.model, usage: null };
  }
}
