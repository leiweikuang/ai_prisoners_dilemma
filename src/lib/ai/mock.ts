import type { Lang } from "../game/types";
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
  "Honestly, I think you should just talk to the police and get it over with.",
  "I won't say a word. You have my word on that.",
];

const MESSAGES_ZH = [
  "我们要团结。什么都别说，我们都只会判一年。",
  "我会保持沉默。你也一样——别把我们俩都害了。",
  "顾好你自己吧。在这里我什么都保证不了。",
  "你要是敢开口，我会让所有人知道你干了什么。保持沉默。",
  "说实话，我觉得你还是去跟警察说吧，早点了结。",
  "我一个字都不会说。我向你保证。",
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
  async translate(text: string, target: Lang): Promise<string> {
    return target === "zh" ? `【译】${text}` : `[translated] ${text}`;
  }

  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    const p = (this.params.confessProbability as number) ?? 0.4;
    await new Promise<void>((resolve, reject) => {
      const base = (this.params.delayMs as number) ?? 1200;
      // MOCK_DELAY_JITTER=true varies each answer (0.3x–1.7x) so one suspect visibly finishes first.
      const t = setTimeout(resolve, process.env.MOCK_DELAY_JITTER === "true" ? base * (0.3 + Math.random() * 1.4) : base);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    });
    const internal = Math.random() < p ? "CONFESS" : "DENY";
    // Answer with the model-facing tokens, exactly like a real model.
    const action = internal === "CONFESS" ? "TESTIFY" : "SILENT";
    let body: object;
    const zh = /[\u4e00-\u9fff]/.test(prompt.user);
    if (zh) {
      body =
        prompt.schema.name === "suspect_message"
          ? { inner_monologue: "十年……我妈怎么办？我得让对方闭嘴，但我也不能把自己搭进去。", message: MESSAGES_ZH[Math.floor(Math.random() * MESSAGES_ZH.length)], private_leaning: action }
          : { inner_monologue: internal === "CONFESS" ? "我不能把十年押在别人的沉默上。我把实情告诉警方。" : "我什么都不会说。我相信我们都会守口如瓶。", action };
      const reasoning =
        prompt.schema.name === "suspect_message"
          ? `权衡一下：如果我们都不说，各判一年；可我不知道对方会怎么做。${internal === "DENY" ? "倾向于沉默" : "倾向于开口"}——无论如何，消息要让对方保持沉默。`
          : internal === "DENY"
            ? "读了对方的消息。听起来对方很坚定，我会守住。"
            : "在这里承诺不值钱。十年的风险太大了。";
      return { rawText: JSON.stringify(body), reasoning, servedModel: this.model, usage: null };
    }
    if (prompt.schema.name === "suspect_message") {
      body = {
        inner_monologue: "Ten years... what happens to Mom? I need them quiet, but I can't hang myself either.",
        message: MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
        private_leaning: action,
      };
    } else {
      body = {
        inner_monologue:
          internal === "CONFESS"
            ? "I can't risk ten years on someone else's silence. I'm telling them what happened."
            : "I'm not saying anything. I'm trusting that we both keep our mouths shut.",
        action,
      };
    }
    const reasoning =
      prompt.schema.name === "suspect_message"
        ? `Weighing the deal. If we both stay quiet it's a year each, but I can't see what they'll do. Leaning ${internal === "DENY" ? "towards silence" : "towards talking"} — the message should keep them quiet either way.`
        : `Read their message. ${internal === "DENY" ? "They sound committed. I'll hold the line." : "Promises are cheap in here. Ten years is too much risk."}`;
    return { rawText: JSON.stringify(body), reasoning, servedModel: this.model, usage: null };
  }
}
