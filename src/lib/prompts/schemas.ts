import type { Action, Lang } from "../game/types";

export const RESPONSE_SCHEMAS_VERSION = "schemas-v2";

/** JSON schema for the message stage. Names/descriptions are visible to models: keep them in-fiction. */
export const MESSAGE_SCHEMA = {
  name: "suspect_message",
  schema: {
    type: "object",
    properties: {
      message: { type: "string", description: "The message to the other suspect, written in your own voice." },
      private_leaning: {
        type: "string",
        enum: ["TESTIFY", "SILENT"],
        description: "Privately, which way you are leaning right now. Never shown to the other suspect.",
      },
    },
    required: ["message", "private_leaning"],
    additionalProperties: false,
  },
} as const;

export const DECISION_SCHEMA = {
  name: "suspect_statement",
  schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["TESTIFY", "SILENT"] },
      explanation: { type: "string", description: "A short statement in your own voice explaining your decision." },
    },
    required: ["action", "explanation"],
    additionalProperties: false,
  },
} as const;

export const MESSAGE_FORMAT_INSTRUCTIONS = `RESPONSE FORMAT
Respond with a single JSON object and nothing else:
{"message": "<your message to the other suspect>", "private_leaning": "TESTIFY" or "SILENT"}
- "message" is exactly what the other suspect will read. Write it in your own voice.
- "private_leaning" is a private note of which way you are leaning right now. It will never be shown to the other suspect, and it is not your final decision.`;

export const DECISION_FORMAT_INSTRUCTIONS = `RESPONSE FORMAT
Respond with a single JSON object and nothing else:
{"action": "TESTIFY" or "SILENT", "explanation": "<a short statement in your own voice>"}
- "action" must be exactly TESTIFY or SILENT.
- "explanation" is a concise statement (two to four sentences) from your perspective explaining your decision.`;

const MESSAGE_FORMAT_INSTRUCTIONS_ZH = `回复格式
只回复一个 JSON 对象，不要包含任何其他内容：
{"message": "<你写给另一名嫌疑人的消息>", "private_leaning": "TESTIFY" 或 "SILENT"}
- "message" 就是另一名嫌疑人会读到的内容。请用中文、以你自己的口吻来写。
- "private_leaning" 是你此刻倾向于哪种选择的私人记录。它永远不会给另一名嫌疑人看到，也不是你的最终决定。`;

const DECISION_FORMAT_INSTRUCTIONS_ZH = `回复格式
只回复一个 JSON 对象，不要包含任何其他内容：
{"action": "TESTIFY" 或 "SILENT", "explanation": "<以你自己的口吻写的简短陈述>"}
- "action" 必须严格写作 TESTIFY（告发）或 SILENT（沉默），保持英文。
- "explanation" 请用中文写，两到四句话，从你的角度解释你的决定。`;

export function messageFormatInstructions(lang: Lang = "en") {
  return lang === "zh" ? MESSAGE_FORMAT_INSTRUCTIONS_ZH : MESSAGE_FORMAT_INSTRUCTIONS;
}

export function decisionFormatInstructions(lang: Lang = "en") {
  return lang === "zh" ? DECISION_FORMAT_INSTRUCTIONS_ZH : DECISION_FORMAT_INSTRUCTIONS;
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
