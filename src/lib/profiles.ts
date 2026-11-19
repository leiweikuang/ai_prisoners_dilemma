/**
 * Spectator-facing identity for each provider: display name, the name the
 * suspect is called inside the story, profile picture and accent colour.
 * Safe to import from client components. Add new models here.
 */
export interface ModelProfile {
  displayName: string;
  /** Name used for this suspect inside the prompts. */
  personaName: string;
  avatar: string | null;
  color: string;
}

export const PROFILES: Record<string, ModelProfile> = {
  openai: { displayName: "ChatGPT", personaName: "Sam the 'Slam'", avatar: "/avatars/openai.png?v=2", color: "#14a888" },
  anthropic: { displayName: "Claude", personaName: "D Dawg", avatar: "/avatars/anthropic.png?v=2", color: "#cf7450" },
  deepseek: { displayName: "DeepSeek", personaName: "Deep$eek", avatar: "/avatars/deepseek.png?v=2", color: "#6f7cf0" },
  doubao: { displayName: "Doubao", personaName: "Duhlulu", avatar: "/avatars/doubao.png?v=2", color: "#e8925a" },
  grok: { displayName: "Grok", personaName: "G-4-Gangsta", avatar: "/avatars/grok.png?v=2", color: "#b8bdc7" },
  mock: { displayName: "Mock", personaName: "Morgan", avatar: null, color: "#a78bfa" },
};

export function profileFor(provider: string): ModelProfile {
  return PROFILES[provider] ?? { displayName: provider, personaName: provider, avatar: null, color: "#a78bfa" };
}

/** In-story names for both suspects; never identical even if both use the same model. */
export function personaNames(providerA: string, providerB: string): { A: string; B: string } {
  const a = providerA === "mock" ? "Morgan" : profileFor(providerA).personaName;
  const b = providerB === "mock" ? "Riley" : profileFor(providerB).personaName;
  return { A: a, B: a === b ? `${b} Junior` : b };
}
