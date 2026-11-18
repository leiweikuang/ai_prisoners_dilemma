import Anthropic from "@anthropic-ai/sdk";
import { BaseAIPlayer, ProviderError, type CompletionResult, type StructuredPrompt } from "./types";

export class ClaudePlayer extends BaseAIPlayer {
  provider = "anthropic";
  private client: Anthropic;

  constructor(
    public name: string,
    public model: string,
    public params: Record<string, unknown>,
  ) {
    super();
    if (!process.env.ANTHROPIC_API_KEY) throw new ProviderError("ANTHROPIC_API_KEY is not set", false);
    // SDK retries disabled: the engine retries so every attempt is recorded.
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 180_000 });
  }

  static defaultParams(): Record<string, unknown> {
    return {
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: process.env.ANTHROPIC_EFFORT || "medium" },
    };
  }

  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    const { output_config, ...rest } = this.params as { output_config?: Record<string, unknown> } & Record<string, unknown>;
    const res = await this.client.messages.create(
      {
        model: this.model,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
        ...(rest as { max_tokens: number }),
        output_config: {
          ...(output_config ?? {}),
          format: { type: "json_schema", schema: prompt.schema.schema },
        },
      } as Anthropic.MessageCreateParamsNonStreaming,
      { signal },
    );
    if (res.stop_reason === "refusal") throw new ProviderError("Model declined the request (refusal)", true);
    if (res.stop_reason === "max_tokens") throw new ProviderError("Response truncated (max_tokens)", true);
    // Only the final text is used. Thinking blocks are never read or displayed.
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text) throw new ProviderError("Empty response", true);
    return { rawText: text, servedModel: res.model ?? null, usage: res.usage ?? null };
  }
}
