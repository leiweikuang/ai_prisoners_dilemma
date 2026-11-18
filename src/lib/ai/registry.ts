import type { PlayerConfig } from "../game/types";
import { ClaudePlayer } from "./claude";
import { MockPlayer } from "./mock";
import { OpenAIPlayer } from "./openai";
import type { AIPlayer } from "./types";

/** Add new providers here; the engine never needs to change. */
export const PROVIDERS = {
  openai: {
    label: "OpenAI",
    displayName: "ChatGPT",
    defaultModel: () => process.env.OPENAI_MODEL || "gpt-5",
    defaultParams: () => OpenAIPlayer.defaultParams(),
    create: (c: PlayerConfig) => new OpenAIPlayer(c.name, c.model, c.params),
    available: () => !!process.env.OPENAI_API_KEY,
  },
  anthropic: {
    label: "Anthropic",
    displayName: "Claude",
    defaultModel: () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    defaultParams: () => ClaudePlayer.defaultParams(),
    create: (c: PlayerConfig) => new ClaudePlayer(c.name, c.model, c.params),
    available: () => !!process.env.ANTHROPIC_API_KEY,
  },
  mock: {
    label: "Mock (offline testing)",
    displayName: "Mock",
    defaultModel: () => "mock-random-v1",
    defaultParams: () => MockPlayer.defaultParams(),
    create: (c: PlayerConfig) => new MockPlayer(c.name, c.model, c.params),
    available: () => process.env.ENABLE_MOCK_PLAYERS === "true",
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

export function isProviderId(p: string): p is ProviderId {
  return p in PROVIDERS;
}

export function createPlayer(c: PlayerConfig): AIPlayer {
  if (!isProviderId(c.provider)) throw new Error(`Unknown provider: ${c.provider}`);
  return PROVIDERS[c.provider].create(c);
}
