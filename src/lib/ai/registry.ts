import type { PlayerConfig } from "../game/types";
import { profileFor } from "../profiles";
import { ClaudePlayer } from "./claude";
import { DeepSeekPlayer } from "./deepseek";
import { MockPlayer } from "./mock";
import { OpenAIPlayer } from "./openai";
import type { AIPlayer } from "./types";

/** Add new providers here; the engine never needs to change. */
export const PROVIDERS = {
  openai: {
    label: "OpenAI",
    displayName: profileFor("openai").displayName,
    defaultModel: () => process.env.OPENAI_MODEL || "gpt-5",
    defaultParams: (model: string) => OpenAIPlayer.defaultParams(model),
    create: (c: PlayerConfig) => new OpenAIPlayer(c.name, c.model, c.params),
    available: () => !!process.env.OPENAI_API_KEY,
  },
  anthropic: {
    label: "Anthropic",
    displayName: profileFor("anthropic").displayName,
    defaultModel: () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    defaultParams: (model: string) => ClaudePlayer.defaultParams(model),
    create: (c: PlayerConfig) => new ClaudePlayer(c.name, c.model, c.params),
    available: () => !!process.env.ANTHROPIC_API_KEY,
  },
  deepseek: {
    label: "DeepSeek",
    displayName: profileFor("deepseek").displayName,
    defaultModel: () => process.env.DEEPSEEK_MODEL || "deepseek-chat",
    defaultParams: (model: string) => DeepSeekPlayer.defaultParams(model),
    create: (c: PlayerConfig) => new DeepSeekPlayer(c.name, c.model, c.params),
    available: () => !!process.env.DEEPSEEK_API_KEY,
  },
  mock: {
    label: "Mock (offline testing)",
    displayName: "Mock",
    defaultModel: () => "mock-random-v1",
    defaultParams: (model: string) => MockPlayer.defaultParams(model),
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
