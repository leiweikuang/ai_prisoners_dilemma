import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import { advance, control, createGame, toPublic, nextStage } from "@/lib/game/engine";
import { getStore } from "@/lib/store";
import { MockPlayer } from "@/lib/ai/mock";
import { computeSentences } from "@/lib/game/payoff";

const mk = () => createGame({ playerA: { provider: "mock", model: "mock-a" }, playerB: { provider: "mock", model: "mock-b" }, totalRounds: 20, memoryStartRound: 11 });

afterAll(() => fs.rm(".data/test-games", { recursive: true, force: true }));
beforeEach(() => vi.restoreAllMocks());

describe("engine", () => {
  it("runs a complete 20-round experiment with correct sentences and history", async () => {
    const g = await mk();
    for (let r = 1; r <= 20; r++) {
      let s = await advance(g.gameId, { roundNumber: r, stage: "COMMUNICATION" });
      expect(s.inProgress?.communication).not.toBeNull();
      s = await advance(g.gameId, { roundNumber: r, stage: "DECISION" });
      expect(s.rounds).toHaveLength(r);
    }
    const s = (await getStore().get(g.gameId))!;
    expect(s.status).toBe("COMPLETED");
    let ca = 0, cb = 0;
    for (const r of s.rounds) {
      const y = computeSentences(r.decisions.playerA.action, r.decisions.playerB.action);
      expect(r.decisions.playerA.prisonYears).toBe(y.playerA);
      expect(r.decisions.playerB.prisonYears).toBe(y.playerB);
      ca += y.playerA; cb += y.playerB;
      expect(r.cumulativeAfter).toEqual({ playerA: ca, playerB: cb });
      expect(r.phase).toBe(r.roundNumber >= 11 ? "HISTORY_AWARE" : "INDEPENDENT");
    }
    expect(s.players[0].cumulativePrisonYears).toBe(ca);
    expect(s.players[1].cumulativePrisonYears).toBe(cb);
    // 80 successful calls, each logged with model + prompt versions.
    expect(s.callLog.filter((c) => c.ok)).toHaveLength(80);
    const histPrompts = s.callLog.filter((c) => c.roundNumber >= 12);
    expect(histPrompts.every((c) => c.userPrompt.includes("PREVIOUS CASES"))).toBe(true);
    expect(s.callLog.filter((c) => c.roundNumber <= 10).every((c) => !c.userPrompt.includes("PREVIOUS CASES"))).toBe(true);
    // Round 11 = first history-aware round includes rounds 1..10.
    const r11 = s.callLog.find((c) => c.roundNumber === 11 && c.stage === "DECISION" && c.slot === "A")!;
    expect(r11.userPrompt).toContain("Case 10:");
    expect(r11.userPrompt).not.toContain("Case 11:");
  });

  it("records reasoning summaries for spectators but never puts them in any prompt", async () => {
    const g = await mk();
    const orig = MockPlayer.prototype.complete;
    let n = 0;
    vi.spyOn(MockPlayer.prototype, "complete").mockImplementation(async function (this: MockPlayer, p) {
      const r = await orig.call(this, p);
      return { ...r, reasoning: `SECRET-THOUGHT-${++n}` };
    });
    for (let r = 1; r <= 12; r++) {
      await advance(g.gameId, { roundNumber: r, stage: "COMMUNICATION" });
      await advance(g.gameId, { roundNumber: r, stage: "DECISION" });
    }
    const s = (await getStore().get(g.gameId))!;
    const r1 = s.rounds[0];
    expect(r1.communication!.playerA.thoughts).toMatch(/^SECRET-THOUGHT-/);
    expect(r1.decisions.playerB.thoughts).toMatch(/^SECRET-THOUGHT-/);
    expect(s.callLog.every((c) => !c.userPrompt.includes("SECRET-THOUGHT") && !c.systemPrompt.includes("SECRET-THOUGHT"))).toBe(true);
  });

  it("rejects stale or duplicate stage requests", async () => {
    const g = await mk();
    await expect(advance(g.gameId, { roundNumber: 1, stage: "DECISION" })).rejects.toMatchObject({ code: "stale" });
    await advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" });
    await expect(advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" })).rejects.toMatchObject({ code: "stale" });
    // concurrent duplicate decision requests: only one executes
    const results = await Promise.allSettled([
      advance(g.gameId, { roundNumber: 1, stage: "DECISION" }),
      advance(g.gameId, { roundNumber: 1, stage: "DECISION" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const s = (await getStore().get(g.gameId))!;
    expect(s.rounds).toHaveLength(1);
    expect(s.callLog.filter((c) => c.stage === "DECISION")).toHaveLength(2);
  });

  it("seals one suspect's output when the other fails, and does not regenerate it on retry", async () => {
    const g = await mk();
    const orig = MockPlayer.prototype.complete;
    let calls = 0;
    const spy = vi.spyOn(MockPlayer.prototype, "complete").mockImplementation(async function (this: MockPlayer, p) {
      calls++;
      if (this.model === "mock-b") throw Object.assign(new Error("boom"), { status: 500 });
      return orig.call(this, p);
    });
    await expect(advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" })).rejects.toMatchObject({ code: "stage_incomplete" });
    let s = (await getStore().get(g.gameId))!;
    const pub = toPublic(s);
    expect(pub.inProgress?.communication).toBeNull();
    expect(pub.inProgress?.submitted.communication).toEqual({ A: true, B: false });
    expect(JSON.stringify(pub)).not.toContain(s.inProgress!.sealedCommunication.A!.message);
    expect(s.lock).toBeNull();
    const sealedA = s.inProgress!.sealedCommunication.A!.message;
    spy.mockRestore();
    calls = 0;
    const spy2 = vi.spyOn(MockPlayer.prototype, "complete");
    s = await advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" });
    expect(spy2).toHaveBeenCalledTimes(1); // only B
    expect(s.inProgress!.communication!.playerA.message).toBe(sealedA);
    expect(nextStage(s)).toBe("DECISION");
    // failed attempts are logged
    expect(s.callLog.filter((c) => !c.ok).length).toBeGreaterThanOrEqual(2);
    void calls;
  });

  it("retries invalid JSON / invalid actions and never invents a decision", async () => {
    const g = await mk();
    await advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" });
    vi.spyOn(MockPlayer.prototype, "complete").mockResolvedValue({ rawText: '{"action":"MAYBE","explanation":"x"}', reasoning: null, servedModel: "m", usage: null });
    await expect(advance(g.gameId, { roundNumber: 1, stage: "DECISION" })).rejects.toMatchObject({ code: "stage_incomplete" });
    const s = (await getStore().get(g.gameId))!;
    expect(s.rounds).toHaveLength(0);
    expect(s.callLog.filter((c) => c.stage === "DECISION" && !c.ok)).toHaveLength(4); // 2 attempts × 2 suspects
  });

  it("pauses only between rounds", async () => {
    const g = await mk();
    await control(g.gameId, { action: "resume" });
    await advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" });
    let s = await control(g.gameId, { action: "pause" });
    expect(s.status).toBe("RUNNING");
    expect(s.pauseRequested).toBe(true);
    s = await advance(g.gameId, { roundNumber: 1, stage: "DECISION" });
    expect(s.status).toBe("PAUSED");
    s = await control(g.gameId, { action: "resume" });
    expect(s.status).toBe("RUNNING");
  });
});

describe("response rules", () => {
  it("aborts a response that exceeds the time limit and never reveals or invents one", async () => {
    const g = await mk();
    const s0 = (await getStore().get(g.gameId))!;
    s0.config.responseTimeLimitSeconds = 0.2;
    s0.players[1].params = { ...s0.players[1].params, delayMs: 1000 }; // B is too slow
    await getStore().save(s0, s0.version);
    const t = Date.now();
    await expect(advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" })).rejects.toMatchObject({ code: "stage_incomplete" });
    expect(Date.now() - t).toBeLessThan(5000);
    const s = (await getStore().get(g.gameId))!;
    const bFails = s.callLog.filter((c) => c.slot === "B" && !c.ok);
    expect(bFails).toHaveLength(2);
    expect(bFails[0].error).toMatch(/time limit/);
    expect(toPublic(s).inProgress?.communication).toBeNull();
  });

  it("trims thoughts to the word limit for display, keeping the full text in the audit log", async () => {
    const g = await mk();
    const long = Array.from({ length: 350 }, (_, i) => `w${i}`).join(" ");
    const orig = MockPlayer.prototype.complete;
    vi.spyOn(MockPlayer.prototype, "complete").mockImplementation(async function (this: MockPlayer, p, sig) {
      return { ...(await orig.call(this, p, sig)), reasoning: long };
    });
    const s = await advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" });
    const c = s.inProgress!.communication!.playerA;
    expect(c.thoughtsTrimmed).toBe(true);
    expect(c.thoughts!.replace(" …", "").split(" ")).toHaveLength(200);
    expect(s.callLog.find((x) => x.ok)!.reasoning).toBe(long);
  });

  it("rejects models with built-in web search", async () => {
    await expect(
      createGame({ playerA: { provider: "mock", model: "gpt-4o-search-preview" }, playerB: { provider: "mock", model: "m" } }),
    ).rejects.toMatchObject({ code: "bad_config" });
  });
});

describe("language", () => {
  it("defaults to 5 rounds with history from round 1", async () => {
    const g = await createGame({ playerA: { provider: "mock", model: "m" }, playerB: { provider: "mock", model: "m" } });
    expect(g.totalRounds).toBe(5);
    expect(g.memoryStartRound).toBe(1);
    expect(g.phase).toBe("HISTORY_AWARE");
  });

  it("switches language only between rounds, logs every change, and records it per round", async () => {
    const g = await mk();
    await advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" });
    await expect(control(g.gameId, { action: "language", language: "zh" })).rejects.toMatchObject({ code: "round_in_progress" });
    await advance(g.gameId, { roundNumber: 1, stage: "DECISION" });
    let s = await control(g.gameId, { action: "language", language: "zh" });
    expect(s.language).toBe("zh");
    expect(s.configChanges.at(-1)!.description).toMatch(/from en to zh before round 2/);
    await advance(g.gameId, { roundNumber: 2, stage: "COMMUNICATION" });
    s = await advance(g.gameId, { roundNumber: 2, stage: "DECISION" });
    expect(s.rounds.map((r) => r.language)).toEqual(["en", "zh"]);
    const r2 = s.callLog.filter((c) => c.roundNumber === 2);
    expect(r2.every((c) => c.systemPromptVersion.endsWith("+zh") && c.systemPrompt.includes("请用中文思考和回答"))).toBe(true);
    expect(r2.every((c) => c.userPrompt.includes("时间限制") && c.userPrompt.includes("后果有多严重"))).toBe(true);
  });
});
