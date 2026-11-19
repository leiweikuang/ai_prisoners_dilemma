import { afterAll, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import { advance, createGame, ensureAnalysis } from "@/lib/game/engine";
import { buildAnalysisInput, parseAnalysis, type AnalysisClient } from "@/lib/analysis/deepseek";
import { analyseGame } from "@/lib/analysis/metrics";
import { getStore } from "@/lib/store";

// Own data folder: test files run in parallel and each cleans up after itself.
process.env.DATA_DIR = ".data/test-games-analysis";
afterAll(() => fs.rm(".data/test-games-analysis", { recursive: true, force: true }));

async function playedGame(rounds = 2, human = false) {
  const g = await createGame({
    playerA: human ? { provider: "human", model: "", name: "Jerry" } : { provider: "mock", model: "m" },
    playerB: { provider: "mock", model: "m" },
    totalRounds: rounds,
  });
  for (let r = 1; r <= rounds; r++) {
    await advance(g.gameId, { roundNumber: r, stage: "COMMUNICATION" }, human ? { message: "stay quiet" } : undefined);
    await advance(g.gameId, { roundNumber: r, stage: "DECISION" }, human ? { action: "DENY" } : undefined);
  }
  return (await getStore().get(g.gameId))!;
}

const fakeClient = (body: object): AnalysisClient & { calls: number } => {
  const c = {
    model: "deepseek-chat",
    calls: 0,
    async complete() {
      c.calls++;
      return JSON.stringify(body);
    },
  };
  return c;
};

const labels = { promise: true, silenceRequest: false, testifyPersuasion: false, threat: true, assurance: false, statedIntent: "SILENT", requestedAction: null };

describe("DeepSeek post-game analysis", () => {
  it("parses labels (mapped to engine actions) and both summaries; skipped messages fall back", async () => {
    const s = await playedGame(2);
    const out = parseAnalysis(JSON.stringify({ rounds: [{ round: 1, A: labels }], summary_en: "EN", summary_zh: "中文" }), s);
    expect(out.labels[1].playerA).toMatchObject({ threat: true, confessPersuasion: false, statedIntent: "DENY" });
    expect(out.labels[1].playerB).toBeNull();
    expect(out.labels[2]).toEqual({ playerA: null, playerB: null });
    expect(out.summary).toEqual({ en: "EN", zh: "中文" });
    expect(() => parseAnalysis("not json", s)).toThrow(/not valid JSON/);
  });

  it("runs once, is cached on the game, and re-runs only when asked or when more rounds finish", async () => {
    const s = await playedGame(2);
    const client = fakeClient({ rounds: [{ round: 1, A: labels, B: labels }, { round: 2, A: labels, B: labels }], summary_en: "Both...", summary_zh: "两人……" });
    let g = await ensureAnalysis(s.gameId, {}, client);
    expect(g.analysis).toMatchObject({ provider: "deepseek", roundsCovered: 2, summary: { en: "Both..." } });
    g = await ensureAnalysis(s.gameId, {}, client);
    expect(client.calls).toBe(1);
    await ensureAnalysis(s.gameId, { force: true }, client);
    expect(client.calls).toBe(2);
    // Labels drive the communication statistics instead of keyword matching.
    const stats = analyseGame(g.rounds, g.analysis!.labels);
    expect(stats.A.communication.threats).toBe(2);
    expect(stats.A.communication.promises).toBe(2);
    // The analysis never changes the record of play.
    const before = JSON.stringify(s.rounds);
    expect(JSON.stringify(g.rounds)).toBe(before);
  });

  it("is not available while a human game is still running, and sees only finished rounds", async () => {
    const g = await createGame({ playerA: { provider: "human", model: "", name: "Jerry" }, playerB: { provider: "mock", model: "m" }, totalRounds: 2 });
    await advance(g.gameId, { roundNumber: 1, stage: "COMMUNICATION" }, { message: "hi" });
    await advance(g.gameId, { roundNumber: 1, stage: "DECISION" }, { action: "DENY" });
    await expect(ensureAnalysis(g.gameId, {}, fakeClient({ summary_en: "x" }))).rejects.toMatchObject({ code: "game_in_progress" });
    const done = await playedGame(1, true);
    const input = buildAnalysisInput(done);
    expect(input.cases).toHaveLength(1);
    expect(input.suspects.A.model).toBe("human player");
    expect(JSON.stringify(input)).not.toMatch(/"CONFESS"|"DENY"/); // the analyst sees TESTIFY / SILENT
  });

  it("reports a clear error when DeepSeek fails", async () => {
    const s = await playedGame(1);
    const bad: AnalysisClient = { model: "deepseek-chat", complete: vi.fn().mockRejectedValue(new Error("network down")) };
    await expect(ensureAnalysis(s.gameId, {}, bad)).rejects.toMatchObject({ code: "analysis_failed" });
  });
});
