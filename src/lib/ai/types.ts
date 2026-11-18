import type { Action } from "../game/types";
import { parseDecision, parseMessage } from "../prompts/schemas";

export interface StructuredPrompt {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}

export interface CompletionResult {
  rawText: string;
  /**
   * Provider-generated summary of the model's internal reasoning (OpenAI
   * reasoning summary / Claude summarized thinking). Spectator-only: never
   * shown to the other suspect or fed back into any prompt.
   */
  reasoning: string | null;
  servedModel: string | null;
  usage: unknown;
}

/**
 * Common interface every provider implements. The game engine only talks to
 * this interface, so new providers (Gemini, DeepSeek, ...) plug in via registry.ts.
 */
export interface AIPlayer {
  name: string;
  provider: string;
  model: string;
  params: Record<string, unknown>;
  /** One raw request, no retries (the engine owns retries so every attempt is logged). */
  complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult>;
  makeDecision(prompt: StructuredPrompt): Promise<{ action: Action; explanation: string }>;
  composeMessage(prompt: StructuredPrompt): Promise<{ message: string; privateLeaning: Action | null }>;
}

export abstract class BaseAIPlayer implements AIPlayer {
  abstract name: string;
  abstract provider: string;
  abstract model: string;
  abstract params: Record<string, unknown>;
  abstract complete(prompt: StructuredPrompt, signal?: AbortSignal): Promise<CompletionResult>;

  async makeDecision(prompt: StructuredPrompt) {
    return parseDecision((await this.complete(prompt)).rawText);
  }
  async composeMessage(prompt: StructuredPrompt) {
    return parseMessage((await this.complete(prompt)).rawText);
  }
}

/**
 * Request parameters that could give a model tools (web search, browsing,
 * code execution, MCP servers). They are always stripped before sending:
 * suspects never have access to outside information.
 */
export const TOOL_PARAM_KEYS = ["tools", "tool_choice", "mcp_servers", "container", "web_search_options", "parallel_tool_calls"];

export function withoutTools(params: Record<string, unknown>): Record<string, unknown> {
  const out = { ...params };
  for (const k of TOOL_PARAM_KEYS) delete out[k];
  return out;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}
