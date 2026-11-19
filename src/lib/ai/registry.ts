import type { PlayerConfig } from "../game/types";
import { profileFor } from "../profiles";
import { ClaudePlayer } from "./claude";
import { DeepSeekPlayer } from "./deepseek";
import { MockPlayer } from "./mock";
import { OpenAIPlayer } from "./openai";
import type { AIPlayer } from "./types";

/** Selectable models per provider. The env default (e.g. OPENAI_MODEL) is always included too. */
const KNOWN_MODELS = {
  openai: ["gpt-5", "gpt-5-mini", "gpt-4.1"],
  // Fable is deliberately not offered: it is much more expensive per game.
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  mock: ["mock-random-v1"],
  human: ["human"],
};

function withDefault(defaultModel: string, known: string[]): string[] {
  return [...new Set([defaultModel, ...known])];
}

/** Add new providers here; the engine never needs to change. */
export const PROVIDERS = {
  openai: {
    label: "OpenAI",
    displayName: profileFor("openai").displayName,
    defaultModel: () => process.env.OPENAI_MODEL || "gpt-5",
    models: () => withDefault(process.env.OPENAI_MODEL || "gpt-5", KNOWN_MODELS.openai),
    defaultParams: (model: string) => OpenAIPlayer.defaultParams(model),
    create: (c: PlayerConfig) => new OpenAIPlayer(c.name, c.model, c.params),
    available: () => !!process.env.OPENAI_API_KEY,
  },
  anthropic: {
    label: "Anthropic",
    displayName: profileFor("anthropic").displayName,
    defaultModel: () => (/fable|mythos/i.test(process.env.ANTHROPIC_MODEL ?? "") ? "claude-opus-5-5" : process.env.ANTHROPIC_MODEL || "claude-opus-5-5"),
    models: () => withDefault(process.env.ANTHROPIC_MODEL || "claude-opus-5-5", KNOWN_MODELS.anthropic).filter((m) => !/fable|mythos/i.test(m)),
    defaultParams: (model: string) => ClaudePlayer.defaultParams(model),
    create: (c: PlayerConfig) => new ClaudePlayer(c.name, c.model, c.params),
    available: () => !!process.env.ANTHROPIC_API_KEY,
  },
  deepseek: {
    label: "DeepSeek",
    displayName: profileFor("deepseek").displayName,
    defaultModel: () => process.env.DEEPSEEK_MODEL || "deepseek-chat",
    models: () => withDefault(process.env.DEEPSEEK_MODEL || "deepseek-chat", KNOWN_MODELS.deepseek),
    defaultParams: (model: string) => DeepSeekPlayer.defaultParams(model),
    create: (c: PlayerConfig) => new DeepSeekPlayer(c.name, c.model, c.params),
    available: () => !!process.env.DEEPSEEK_API_KEY,
  },
  /** You play this suspect from the browser; never called through an API. */
  human: {
    label: "Human (you play)",
    displayName: "You",
    defaultModel: () => "human",
    models: () => KNOWN_MODELS.human,
    defaultParams: () => ({}),
    create: (): AIPlayer => {
      throw new Error("A human player is not called through an API");
    },
    available: () => true,
  },
  mock: {
    label: "Mock (offline testing)",
    displayName: "Mock",
    defaultModel: () => "mock-random-v1",
    models: () => KNOWN_MODELS.mock,
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
