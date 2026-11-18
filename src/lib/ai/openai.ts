import OpenAI from "openai";
import type { Lang } from "../game/types";
import { BaseAIPlayer, ProviderError, TRANSLATION_INSTRUCTIONS, withoutTools, type CompletionResult, type StructuredPrompt } from "./types";

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

  /** Reasoning models (gpt-5*, o-series) can return a reasoning summary. */
  static isReasoningModel(model: string) {
    return /^(gpt-5|o\d)/i.test(model);
  }

  static defaultParams(model: string): Record<string, unknown> {
    const p: Record<string, unknown> = { max_output_tokens: 16000 };
    if (OpenAIPlayer.isReasoningModel(model)) {
      p.reasoning = {
        summary: process.env.OPENAI_REASONING_SUMMARY || "auto",
        // Low effort keeps thinking short enough for the time and word limits.
        effort: process.env.OPENAI_REASONING_EFFORT || "low",
      };
    }
    return p;
  }

  async complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult> {
    try {
      return await this.request(prompt, this.params, signal);
    } catch (e) {
      // Some accounts/models cannot receive reasoning summaries. Fall back to
      // the same request without the summary rather than failing the stage.
      const reasoning = (this.params as { reasoning?: Record<string, unknown> }).reasoning;
      if ((e as { status?: number }).status === 400 && reasoning?.summary && /summar/i.test((e as Error).message)) {
        const { summary: _s, ...rest } = reasoning;
        void _s;
        const res = await this.request(prompt, { ...this.params, reasoning: rest }, signal);
        return { ...res, reasoning: null, servedModel: res.servedModel, usage: { ...(res.usage as object), reasoningSummaryUnavailable: true } };
      }
      throw e;
    }
  }

  async translate(text: string, target: Lang, signal?: AbortSignal): Promise<string> {
    const res = await this.client.responses.create(
      {
        model: this.model,
        instructions: TRANSLATION_INSTRUCTIONS[target],
        input: text,
        store: false,
        max_output_tokens: 4000,
        ...(OpenAIPlayer.isReasoningModel(this.model) ? { reasoning: { effort: "low" as const } } : {}),
      },
      { signal },
    );
    if (!res.output_text) throw new ProviderError("Empty translation", false);
    return res.output_text.trim();
  }

  private async request(prompt: StructuredPrompt, params: Record<string, unknown>, signal?: AbortSignal): Promise<CompletionResult> {
    const res = await this.client.responses.create(
      {
        model: this.model,
        instructions: prompt.system,
        input: prompt.user,
        text: {
          format: { type: "json_schema", name: prompt.schema.name, schema: prompt.schema.schema, strict: true },
        },
        store: false,
        // No tools: no web search, file search or code execution.
        ...(withoutTools(params) as object),
      },
      { signal },
    );
    if (res.status === "incomplete") {
      throw new ProviderError(`Response incomplete: ${res.incomplete_details?.reason ?? "unknown"}`, true);
    }
    const text = res.output_text;
    if (!text) throw new ProviderError("Empty response (possible refusal)", true);
    const summaries = res.output
      .filter((o) => o.type === "reasoning")
      .flatMap((o) => (o as { summary?: { text: string }[] }).summary ?? [])
      .map((s) => s.text.trim())
      .filter(Boolean);
    return {
      rawText: text,
      reasoning: summaries.length ? summaries.join("\n\n") : null,
      servedModel: res.model ?? null,
      usage: res.usage ?? null,
    };
  }
}
