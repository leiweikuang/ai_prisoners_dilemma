import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "../game/types";
import { BaseAIPlayer, ProviderError, TRANSLATION_INSTRUCTIONS, withoutTools, type CompletionResult, type StructuredPrompt } from "./types";

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

  async translate(text: string, target: Lang, signal?: AbortSignal): Promise<string> {
    const res = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: 4000,
        system: TRANSLATION_INSTRUCTIONS[target],
        messages: [{ role: "user", content: text }],
        output_config: { effort: "low" },
      } as Anthropic.MessageCreateParamsNonStreaming,
      { signal },
    );
    const out = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!out) throw new ProviderError("Empty translation", false);
    return out;
  }

  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    // No tools: no web search, web fetch or code execution.
    const { output_config, ...rest } = withoutTools(this.params) as { output_config?: Record<string, unknown> } & Record<string, unknown>;
    const body = {
      model: this.model,
      system: prompt.system,
      messages: [{ role: "user" as const, content: prompt.user }],
      ...(rest as { max_tokens: number }),
      output_config: {
        ...(output_config ?? {}),
        format: { type: "json_schema" as const, schema: prompt.schema.schema },
      },
    };
    // Opt-in (ANTHROPIC_REFUSAL_FALLBACK=true): if the model declines, Anthropic
    // re-runs the same request on a fallback Claude model. The model that
    // actually answered is recorded as servedModel in the audit log.
    const res = (
      process.env.ANTHROPIC_REFUSAL_FALLBACK === "true"
        ? await this.client.beta.messages.create(
            { ...body, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as Anthropic.Beta.MessageCreateParamsNonStreaming,
            { signal },
          )
        : await this.client.messages.create(body as Anthropic.MessageCreateParamsNonStreaming, { signal })
    ) as Anthropic.Message;
    if (res.stop_reason === "refusal") {
      // Say which safety check declined, so it shows in the error banner and audit log.
      const d = res.stop_details;
      const why = [d?.category ? `category: ${d.category}` : null, d?.explanation].filter(Boolean).join(" — ");
      throw new ProviderError(`Claude declined the request (refusal${why ? `; ${why}` : ""})`, true);
    }
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
    if (!text) throw new ProviderError(`Empty response (stop_reason: ${res.stop_reason})`, true);
    return { rawText: text, reasoning: thinking || null, servedModel: res.model ?? null, usage: res.usage ?? null };
  }
}
