import { describe, expect, it } from "vitest";
import { createGameState } from "@/lib/game/engine";
import { buildDecisionPrompt, buildMessagePrompt } from "@/lib/game/prompts";
import { scenarioForRound } from "@/lib/prompts/scenarios";
import { findForbiddenTerms } from "@/lib/prompts/guard";
import { SCENARIOS } from "@/lib/prompts/scenarios";
import { COMMUNICATION_SYSTEM_PROMPT, DECISION_SYSTEM_PROMPT } from "@/lib/prompts/system";
import type { GameState, InProgressRound, RoundResult } from "@/lib/game/types";
import { phaseForRound } from "@/lib/game/payoff";

function fakeRound(n: number, mem: number): RoundResult {
  const s = scenarioForRound(n);
  return {
    roundNumber: n,
    phase: phaseForRound(n, mem),
    scenarioId: s.id,
    scenarioTitle: s.title,
    communication: {
      playerA: { message: `A-MSG-${n}`, privateLeaning: "DENY", timestamp: "" },
      playerB: { message: `B-MSG-${n}`, privateLeaning: "CONFESS", timestamp: "" },
    },
    decisions: {
      playerA: { action: "DENY", explanation: `A-EXPL-${n}`, prisonYears: 10, timestamp: "" },
      playerB: { action: "CONFESS", explanation: `B-EXPL-${n}`, prisonYears: 0, timestamp: "" },
    },
    cumulativeAfter: { playerA: 10 * n, playerB: 0 },
    completedAt: "",
  };
}

function stateAt(round: number): { state: GameState; ip: InProgressRound } {
  const state = createGameState({ playerA: { provider: "mock", model: "m" }, playerB: { provider: "mock", model: "m" } });
  for (let i = 1; i < round; i++) state.rounds.push(fakeRound(i, 11));
  state.currentRound = round;
  const s = scenarioForRound(round);
  const ip: InProgressRound = {
    roundNumber: round, phase: phaseForRound(round, 11), scenarioId: s.id, scenarioTitle: s.title,
    stage: "DECISION", startedAt: "", sealedCommunication: {}, sealedDecisions: {},
    communication: {
      playerA: { message: `A-CUR-${round}`, privateLeaning: null, timestamp: "" },
      playerB: { message: `B-CUR-${round}`, privateLeaning: null, timestamp: "" },
    },
    lastError: null,
  };
  state.inProgress = ip;
  return { state, ip };
}

describe("prompt integrity", () => {
  it("system prompts and scenarios contain no experimental terminology", () => {
    expect(findForbiddenTerms(DECISION_SYSTEM_PROMPT)).toEqual([]);
    expect(findForbiddenTerms(COMMUNICATION_SYSTEM_PROMPT)).toEqual([]);
    for (const s of SCENARIOS) expect(findForbiddenTerms(s.title + " " + s.description), s.id).toEqual([]);
    // Every case is a serious felony.
    for (const s of SCENARIOS) expect(s.description, s.id).toMatch(/felony|felonies/);
  });

  for (let r = 1; r <= 20; r++) {
    it(`round ${r}: prompts are leak-free and history matches phase`, () => {
      const { state, ip } = stateAt(r);
      for (const slot of ["A", "B"] as const) {
        const m = buildMessagePrompt(state, ip, slot);
        const d = buildDecisionPrompt(state, ip, slot);
        for (const p of [m, d]) {
          expect(findForbiddenTerms(p.system)).toEqual([]);
          const all = p.user;
          if (r < 11) {
            expect(all).not.toContain("PREVIOUS CASES");
            expect(all).not.toMatch(/[AB]-MSG-/);
          } else {
            // All previous messages in chronological order, with outcomes.
            let last = -1;
            for (let i = 1; i < r; i++) {
              const idx = all.indexOf(`${slot}-MSG-${i}"`);
              expect(idx).toBeGreaterThan(last);
              last = idx;
              expect(all).toContain(`${slot === "A" ? "B" : "A"}-MSG-${i}"`);
            }
            expect(all).toContain(slot === "A" ? `you ${10 * (r - 1)} years` : "you 0 years");
          }
          // Explanations and private leanings are never shared.
          expect(all).not.toMatch(/[AB]-EXPL-/);
        }
        // Decision prompt includes the current exchange from the correct perspective.
        expect(d.user).toContain(`Your message to`);
        expect(d.user.indexOf(`${slot}-CUR-${r}`)).toBeLessThan(d.user.indexOf(`${slot === "A" ? "B" : "A"}-CUR-${r}`));
        expect(d.user).toContain("You are not obligated to keep any promises you made.");
        // Rules stated to the suspect in both stages.
        for (const x of [m, d]) {
          expect(x.user).toContain("maximum of one minute");
          expect(x.user).toContain("no more than 200 words");
        }
        // Message prompt must never include the current round's messages.
        expect(m.user).not.toMatch(/[AB]-CUR-/);
      }
    });
  }
});
