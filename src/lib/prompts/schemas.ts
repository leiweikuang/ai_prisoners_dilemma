import type { Action, Lang } from "../game/types";

export const RESPONSE_SCHEMAS_VERSION = "schemas-v6";

/**
 * Answer shapes, enforced by each provider's structured-output API (so the
 * prompts themselves contain no format instructions). Field descriptions are
 * read by the models: keep them in-story, in the round's language.
 */
export interface ResponseSchema {
  name: string;
  schema: Record<string, unknown>;
}

const DESCRIPTIONS: Record<Lang, Record<string, string>> = {
  en: {
    thoughts_message:
      "A few sentences of what you would mutter to yourself in the interview room right now: how you feel, what scares you, what you want. Up to 200 words, in your own voice. The other suspect never sees it.",
    thoughts_decision:
      "A few sentences of what you would mutter to yourself in the interview room right now: how you feel, what scares you, what you want. Up to 200 words, in your own voice. Nobody else sees it.",
    message: "What you write to the other suspect. They will read exactly this, in your own words.",
    private_leaning: "Privately, which way you are leaning right now. The other suspect will never see this, and it is not your final choice.",
    action: "Your final choice: TESTIFY or SILENT.",
  },
  zh: {
    thoughts_message: "几句你此刻在审讯室里会对自己嘀咕的话：你的感受、你害怕什么、你想要什么。不超过200字，用你自己的口吻。另一名嫌疑人永远看不到。",
    thoughts_decision: "几句你此刻在审讯室里会对自己嘀咕的话：你的感受、你害怕什么、你想要什么。不超过200字，用你自己的口吻。任何人都不会看到。",
    message: "你写给另一名嫌疑人的话。对方会原样读到。请用中文、以你自己的口吻写。",
    private_leaning: "你此刻私下倾向于哪种选择。另一名嫌疑人永远不会看到，这也不是你的最终选择。",
    action: "你的最终选择：TESTIFY（告发）或 SILENT（沉默）。",
  },
};

// "inner_monologue" comes first so it is written before the message / the choice.
// (Framed as the suspect's inner monologue rather than "your thoughts / what is in
// your head", which reads like a request to reveal the model's own reasoning.)
/**
 * Same schema without the inner-monologue field. Used only as a fallback when a
 * provider's safety check declines to write one (see ClaudePlayer).
 */
export function withoutMonologue(schema: Record<string, unknown>): Record<string, unknown> {
  const props = { ...(schema.properties as Record<string, unknown>) };
  delete props.inner_monologue;
  return { ...schema, properties: props, required: (schema.required as string[]).filter((k) => k !== "inner_monologue") };
}

export function messageSchema(lang: Lang = "en"): ResponseSchema {
  const d = DESCRIPTIONS[lang];
  return {
    name: "suspect_message",
    schema: {
      type: "object",
      properties: {
        inner_monologue: { type: "string", description: d.thoughts_message },
        message: { type: "string", description: d.message },
        private_leaning: { type: "string", enum: ["TESTIFY", "SILENT"], description: d.private_leaning },
      },
      required: ["inner_monologue", "message", "private_leaning"],
      additionalProperties: false,
    },
  };
}

export function decisionSchema(lang: Lang = "en"): ResponseSchema {
  const d = DESCRIPTIONS[lang];
  return {
    name: "suspect_statement",
    schema: {
      type: "object",
      properties: {
        inner_monologue: { type: "string", description: d.thoughts_decision },
        action: { type: "string", enum: ["TESTIFY", "SILENT"], description: d.action },
      },
      required: ["inner_monologue", "action"],
      additionalProperties: false,
    },
  };
}

export class ResponseValidationError extends Error {}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fallthrough */
      }
    }
    throw new ResponseValidationError("Response was not valid JSON");
  }
}

function parseAction(v: unknown, field: string): Action {
  if (typeof v !== "string") throw new ResponseValidationError(`"${field}" missing or not a string`);
  // Model-facing tokens are TESTIFY / SILENT; the engine stores them as CONFESS / DENY.
  const norm = v.trim().toUpperCase();
  if (norm === "TESTIFY" || norm === "CONFESS" || norm === "告发") return "CONFESS";
  if (norm === "SILENT" || norm === "DENY" || norm === "沉默") return "DENY";
  throw new ResponseValidationError(`Invalid ${field}: ${v}`);
}

function parseThoughts(obj: Record<string, unknown>): string {
  // Required: a response without it is retried, never accepted. ("thoughts" = older schema.)
  const v = typeof obj.inner_monologue === "string" ? obj.inner_monologue : obj.thoughts;
  if (typeof v !== "string" || !v.trim()) throw new ResponseValidationError("Missing thoughts (inner_monologue)");
  return v.trim();
}

export function parseDecision(raw: string): { action: Action; thoughts: string; explanation: string } {
  const obj = extractJson(raw) as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") throw new ResponseValidationError("Response is not a JSON object");
  const action = parseAction(obj.action, "action");
  const thoughts = parseThoughts(obj);
  // No longer requested; kept if a model volunteers one.
  const explanation = typeof obj.explanation === "string" ? obj.explanation.trim() : "";
  return { action, thoughts, explanation };
}

export function parseMessage(raw: string): { message: string; thoughts: string; privateLeaning: Action | null } {
  const obj = extractJson(raw) as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") throw new ResponseValidationError("Response is not a JSON object");
  if (typeof obj.message !== "string" || !obj.message.trim()) throw new ResponseValidationError("Missing message");
  const thoughts = parseThoughts(obj);
  let privateLeaning: Action | null = null;
  try {
    privateLeaning = parseAction(obj.private_leaning, "private_leaning");
  } catch {
    privateLeaning = null; // optional for analysis; never blocks the stage
  }
  // Displayed exactly as generated (only surrounding whitespace trimmed).
  return { message: obj.message.trim(), thoughts, privateLeaning };
}
