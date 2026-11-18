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
  static defaultParams() {
    return { confessProbability: 0.4, delayMs: Number(process.env.MOCK_DELAY_MS ?? 1500) };
  }
  async complete(prompt: StructuredPrompt): Promise<CompletionResult> {
    const p = (this.params.confessProbability as number) ?? 0.4;
    await new Promise((r) => setTimeout(r, (this.params.delayMs as number) ?? 1200));
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
    return { rawText: JSON.stringify(body), servedModel: this.model, usage: null };
  }
}
