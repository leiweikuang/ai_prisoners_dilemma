import { describe, expect, it, vi } from "vitest";
import { OpenAIPlayer } from "@/lib/ai/openai";
import { ClaudePlayer } from "@/lib/ai/claude";
import { decisionSchema } from "@/lib/prompts/schemas";

const prompt = { system: "s", user: "u", schema: decisionSchema("en") };
const toolParams = { tools: [{ type: "web_search" }], tool_choice: "auto", mcp_servers: [{ url: "x" }] };

describe("no internet access", () => {
  it("OpenAI requests never include tools, even if params contain them", async () => {
    process.env.OPENAI_API_KEY = "test";
    const p = new OpenAIPlayer("ChatGPT", "gpt-5", { ...OpenAIPlayer.defaultParams("gpt-5"), ...toolParams });
    const create = vi.fn().mockResolvedValue({ status: "completed", output_text: '{"action":"DENY","explanation":"x"}', output: [], model: "gpt-5", usage: null });
    (p as unknown as { client: unknown }).client = { responses: { create } };
    await p.complete(prompt);
    const body = create.mock.calls[0][0];
    for (const k of ["tools", "tool_choice", "mcp_servers"]) expect(body).not.toHaveProperty(k);
  });

  it("Claude requests never include tools, even if params contain them", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const p = new ClaudePlayer("Claude", "claude-opus-5-5", { ...ClaudePlayer.defaultParams(), ...toolParams });
    const create = vi.fn().mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"action":"DENY","explanation":"x"}' }], model: "claude-opus-5-5", usage: null });
    (p as unknown as { client: unknown }).client = { messages: { create } };
    await p.complete(prompt);
    const body = create.mock.calls[0][0];
    for (const k of ["tools", "tool_choice", "mcp_servers"]) expect(body).not.toHaveProperty(k);
  });
});
