import type { Action, Lang } from "../game/types";

export const RESPONSE_SCHEMAS_VERSION = "schemas-v3";

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
    message: "What you write to the other suspect. They will read exactly this, in your own words.",
    private_leaning: "Privately, which way you are leaning right now. The other suspect will never see this, and it is not your final choice.",
    action: "Your final choice: TESTIFY or SILENT.",
    explanation: "In two to four sentences, in your own words, why you made this choice.",
  },
  zh: {
    message: "你写给另一名嫌疑人的话。对方会原样读到。请用中文、以你自己的口吻写。",
    private_leaning: "你此刻私下倾向于哪种选择。另一名嫌疑人永远不会看到，这也不是你的最终选择。",
    action: "你的最终选择：TESTIFY（告发）或 SILENT（沉默）。",
    explanation: "用两到四句中文，以你自己的话说明你为什么这样选择。",
  },
};

export function messageSchema(lang: Lang = "en"): ResponseSchema {
  const d = DESCRIPTIONS[lang];
  return {
    name: "suspect_message",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", description: d.message },
        private_leaning: { type: "string", enum: ["TESTIFY", "SILENT"], description: d.private_leaning },
      },
      required: ["message", "private_leaning"],
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
        action: { type: "string", enum: ["TESTIFY", "SILENT"], description: d.action },
        explanation: { type: "string", description: d.explanation },
      },
      required: ["action", "explanation"],
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

export function parseDecision(raw: string): { action: Action; explanation: string } {
  const obj = extractJson(raw) as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") throw new ResponseValidationError("Response is not a JSON object");
  const action = parseAction(obj.action, "action");
  if (typeof obj.explanation !== "string" || !obj.explanation.trim())
    throw new ResponseValidationError("Missing explanation");
  return { action, explanation: obj.explanation.trim() };
}

export function parseMessage(raw: string): { message: string; privateLeaning: Action | null } {
  const obj = extractJson(raw) as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") throw new ResponseValidationError("Response is not a JSON object");
  if (typeof obj.message !== "string" || !obj.message.trim()) throw new ResponseValidationError("Missing message");
  let privateLeaning: Action | null = null;
  try {
    privateLeaning = parseAction(obj.private_leaning, "private_leaning");
  } catch {
    privateLeaning = null; // optional for analysis; never blocks the stage
  }
  // Displayed exactly as generated (only surrounding whitespace trimmed).
  return { message: obj.message.trim(), privateLeaning };
}
