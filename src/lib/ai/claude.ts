import Anthropic from "@anthropic-ai/sdk";
import { BaseAIPlayer, ProviderError, withoutTools, type CompletionResult, type StructuredPrompt } from "./types";

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static defaultParams(_model?: string): Record<string, unknown> {
    return {
      max_tokens: 16000,
      // "summarized" returns a readable summary of Claude's thinking for spectators.
      // It changes visibility only, not how Claude reasons.
      thinking: { type: "adaptive", display: "summarized" },
      // Low effort keeps thinking short enough for the time and word limits.
      output_config: { effort: process.env.ANTHROPIC_EFFORT || "low" },
    };
  }

  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    // No tools: no web search, web fetch or code execution.
    const { output_config, ...rest } = withoutTools(this.params) as { output_config?: Record<string, unknown> } & Record<string, unknown>;
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
    // Final answer comes from text blocks. Summarized thinking is kept for
    // spectators only and is never passed to the other suspect.
    const thinking = res.content
      .filter((b): b is Anthropic.ThinkingBlock => b.type === "thinking")
      .map((b) => b.thinking.trim())
      .filter(Boolean)
      .join("\n\n");
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text) throw new ProviderError("Empty response", true);
    return { rawText: text, reasoning: thinking || null, servedModel: res.model ?? null, usage: res.usage ?? null };
  }
}
