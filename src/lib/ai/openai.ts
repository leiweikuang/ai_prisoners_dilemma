import OpenAI from "openai";
import { BaseAIPlayer, ProviderError, type CompletionResult, type StructuredPrompt } from "./types";

export class OpenAIPlayer extends BaseAIPlayer {
  provider = "openai";
  private client: OpenAI;

  constructor(
    public name: string,
    public model: string,
    public params: Record<string, unknown>,
  ) {
    super();
    if (!process.env.OPENAI_API_KEY) throw new ProviderError("OPENAI_API_KEY is not set", false);
    // SDK retries disabled: the engine retries so every attempt is recorded.
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 120_000 });
  }

  static defaultParams(): Record<string, unknown> {
    const p: Record<string, unknown> = { max_output_tokens: 4000 };
    if (process.env.OPENAI_REASONING_EFFORT) p.reasoning = { effort: process.env.OPENAI_REASONING_EFFORT };
    return p;
  }

  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    const res = await this.client.responses.create(
      {
        model: this.model,
        instructions: prompt.system,
        input: prompt.user,
        text: {
          format: { type: "json_schema", name: prompt.schema.name, schema: prompt.schema.schema, strict: true },
        },
        store: false,
        ...(this.params as object),
      },
      { signal },
    );
    if (res.status === "incomplete") {
      throw new ProviderError(`Response incomplete: ${res.incomplete_details?.reason ?? "unknown"}`, true);
    }
    const text = res.output_text;
    if (!text) throw new ProviderError("Empty response (possible refusal)", true);
    return { rawText: text, servedModel: res.model ?? null, usage: res.usage ?? null };
  }
}
