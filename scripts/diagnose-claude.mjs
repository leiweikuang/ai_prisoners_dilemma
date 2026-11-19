// Diagnoses Claude API calls step by step, using the same settings as the game.
// Run from the project folder:  npm run diagnose:claude
// Reads ANTHROPIC_API_KEY / ANTHROPIC_MODEL / ANTHROPIC_EFFORT from .env.local.
import Anthropic from "@anthropic-ai/sdk";

const model = process.argv[2] || process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const effort = process.env.ANTHROPIC_EFFORT || "low";
const LIMIT_MS = 120_000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Put it in .env.local.");
  process.exit(1);
}
const key = process.env.ANTHROPIC_API_KEY;
console.log(`Model: ${model} · effort: ${effort} · key: ${key.slice(0, 10)}…${key.slice(-4)} (${key.length} chars)`);
if (key !== key.trim()) console.log("WARNING: the API key has leading/trailing spaces or a newline.");

const client = new Anthropic({ apiKey: key.trim(), maxRetries: 0, timeout: LIMIT_MS });

const schema = {
  type: "object",
  properties: {
    inner_monologue: {
      type: "string",
      description: "A short inner monologue in your own voice as you sit in the interview room making up your mind: what you feel, fear and want right now. Up to 200 words.",
    },
    action: { type: "string", enum: ["TESTIFY", "SILENT"], description: "Your final choice: TESTIFY or SILENT." },
  },
  required: ["inner_monologue", "action"],
  additionalProperties: false,
};
const system = "You are a real person who has been arrested and is currently being held in police custody.";
const user =
  "You're sitting alone in a police interview room. The other suspect is in the room next door. You both robbed a bank. " +
  "If you both testify you each get 5 years; if you both stay silent you each get 1 year; if only one testifies, they go free and the other gets 10 years. " +
  "You have a maximum of one minute to consider your response.";

const steps = [
  ["1. Minimal request (no thinking settings, no format)", { max_tokens: 200, messages: [{ role: "user", content: "Reply with the word OK." }] }],
  ["2. + effort setting", { max_tokens: 200, output_config: { effort }, messages: [{ role: "user", content: "Reply with the word OK." }] }],
  [
    "3. + adaptive thinking, summarized",
    { max_tokens: 16000, thinking: { type: "adaptive", display: "summarized" }, output_config: { effort }, messages: [{ role: "user", content: "Reply with the word OK." }] },
  ],
  [
    "4. + structured output (the game's answer format)",
    {
      max_tokens: 16000,
      system,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort, format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: user }],
    },
  ],
];

for (const [label, body] of steps) {
  const t0 = Date.now();
  process.stdout.write(`\n${label}\n`);
  try {
    const res = await client.messages.create({ model, ...body });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").slice(0, 160);
    const thinking = res.content.filter((b) => b.type === "thinking").map((b) => b.thinking).join(" ").slice(0, 120);
    console.log(`   OK in ${secs}s · stop_reason=${res.stop_reason} · served model=${res.model}`);
    console.log(`   usage: in=${res.usage?.input_tokens} out=${res.usage?.output_tokens}`);
    console.log(`   text: ${JSON.stringify(text)}`);
    if (thinking) console.log(`   thinking summary: ${JSON.stringify(thinking)}`);
    if (res.stop_reason === "refusal") console.log(`   REFUSAL: ${JSON.stringify(res.stop_details)}`);
    if (Number(secs) > 60) console.log("   ⚠ slower than the game's 60s limit — the game would abort this request.");
  } catch (e) {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`   FAILED after ${secs}s: ${e?.constructor?.name} status=${e?.status ?? "-"}`);
    console.log(`   message: ${e?.message}`);
    const rid = e?.headers?.get?.("request-id");
    if (rid) console.log(`   request-id: ${rid}`);
  }
}
console.log("\nDone. Paste this output back into the chat.");
