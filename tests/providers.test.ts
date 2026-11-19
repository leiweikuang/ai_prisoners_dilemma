import { describe, expect, it, vi } from "vitest";
import { OpenAIPlayer } from "@/lib/ai/openai";
import { ClaudePlayer } from "@/lib/ai/claude";
import { DeepSeekPlayer } from "@/lib/ai/deepseek";
import { decisionSchema } from "@/lib/prompts/schemas";
import { PROVIDERS } from "@/lib/ai/registry";

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

  it("DeepSeek requests never include tools, even if params contain them", async () => {
    process.env.DEEPSEEK_API_KEY = "test";
    const p = new DeepSeekPlayer("DeepSeek", "deepseek-chat", { ...DeepSeekPlayer.defaultParams(), ...toolParams });
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: '{"action":"DENY","explanation":"x"}' } }], model: "deepseek-chat", usage: null });
    (p as unknown as { client: unknown }).client = { chat: { completions: { create } } };
    await p.complete(prompt);
    const body = create.mock.calls[0][0];
    expect(body.response_format).toEqual({ type: "json_object" });
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

  it("reports which safety check declined a Claude request", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const p = new ClaudePlayer("Claude", "claude-opus-5-5", ClaudePlayer.defaultParams());
    const create = vi.fn().mockResolvedValue({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "reasoning_extraction", explanation: "x" },
      content: [],
      model: "claude-opus-5-5",
      usage: null,
    });
    (p as unknown as { client: unknown }).client = { messages: { create } };
    await expect(p.complete(prompt)).rejects.toThrow(/refusal; category: reasoning_extraction/);
  });

  it("uses the server-side refusal fallback only when enabled", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.ANTHROPIC_REFUSAL_FALLBACK = "true";
    const p = new ClaudePlayer("Claude", "claude-opus-5-5", ClaudePlayer.defaultParams());
    const create = vi.fn().mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], model: "claude-opus-4-8", usage: null });
    (p as unknown as { client: unknown }).client = { beta: { messages: { create } }, messages: { create: vi.fn() } };
    const r = await p.complete(prompt);
    expect(create.mock.calls[0][0]).toMatchObject({ fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    expect(r.servedModel).toBe("claude-opus-4-8");
    delete process.env.ANTHROPIC_REFUSAL_FALLBACK;
  });

  it("re-asks without the monologue if Claude declines it as reasoning extraction, and labels the result", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const p = new ClaudePlayer("Claude", "claude-opus-5-5", ClaudePlayer.defaultParams());
    const create = vi
      .fn()
      .mockResolvedValueOnce({ stop_reason: "refusal", stop_details: { type: "refusal", category: "reasoning_extraction", explanation: null }, content: [], model: "claude-opus-5-5", usage: null })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "Weighing the deal." },
          { type: "text", text: '{"action":"SILENT"}' },
        ],
        model: "claude-opus-5-5",
        usage: null,
      });
    (p as unknown as { client: unknown }).client = { messages: { create } };
    const r = await p.complete(prompt);
    const second = create.mock.calls[1][0].output_config.format.schema;
    expect(second.properties).not.toHaveProperty("inner_monologue");
    expect(second.required).not.toContain("inner_monologue");
    expect(r.monologueFallback).toBe(true);
    expect(JSON.parse(r.rawText)).toEqual({ action: "SILENT", inner_monologue: "Weighing the deal." });
  });

  it("does not offer Fable", () => {
    process.env.ANTHROPIC_MODEL = "claude-fable-5-2";
    expect(PROVIDERS.anthropic.models()).not.toContain("claude-fable-5-2");
    expect(PROVIDERS.anthropic.defaultModel()).toBe("claude-opus-5-5");
    delete process.env.ANTHROPIC_MODEL;
  });
});
