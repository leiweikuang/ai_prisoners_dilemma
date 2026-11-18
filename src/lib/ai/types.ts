import type { Action } from "../game/types";
import { parseDecision, parseMessage } from "../prompts/schemas";

export interface StructuredPrompt {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}

export interface CompletionResult {
  rawText: string;
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

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}
