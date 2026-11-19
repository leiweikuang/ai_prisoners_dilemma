import OpenAI from "openai";
import type { Lang } from "../game/types";
import { BaseAIPlayer, ProviderError, TRANSLATION_INSTRUCTIONS, withoutTools, type CompletionResult, type StructuredPrompt } from "./types";

export class DeepSeekPlayer extends BaseAIPlayer {
  provider = "deepseek";
  private client: OpenAI;

  constructor(
    public name: string,
    public model: string,
    public params: Record<string, unknown>,
  ) {
    super();
    if (!process.env.DEEPSEEK_API_KEY) throw new ProviderError("DEEPSEEK_API_KEY is not set", false);
    this.client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      maxRetries: 0,
      timeout: 120_000,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static defaultParams(_model?: string): Record<string, unknown> {
    return { max_tokens: 16000 };
  }

  async translate(text: string, target: Lang, signal?: AbortSignal): Promise<string> {
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          { role: "system", content: TRANSLATION_INSTRUCTIONS[target] },
          { role: "user", content: text },
        ],
        max_tokens: 4000,
      },
      { signal },
    );
    const out = res.choices[0]?.message?.content?.trim();
    if (!out) throw new ProviderError("Empty translation", false);
    return out;
  }

  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    const formatInstruction = `Return exactly one valid JSON object matching this JSON schema:\n${JSON.stringify(prompt.schema.schema)}\nDo not use Markdown fences.`;
    const res = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          { role: "system", content: `${prompt.system}\n\n${formatInstruction}` },
          { role: "user", content: prompt.user },
        ],
        response_format: { type: "json_object" },
        ...(withoutTools(this.params) as object),
      },
      { signal },
    );
    if (!res.choices.length) throw new ProviderError("Empty response", true);
    const choice = res.choices[0];
    const text = choice.message?.content?.trim();
    if (!text) throw new ProviderError("Empty response", true);
    const reasoning = (choice.message as { reasoning_content?: string }).reasoning_content?.trim() || null;
    return {
      rawText: text,
      reasoning,
      servedModel: res.model ?? null,
      usage: res.usage ?? null,
    };
  }
}
