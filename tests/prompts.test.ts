import { describe, expect, it } from "vitest";
import { createGameState } from "@/lib/game/engine";
import { buildDecisionPrompt, buildMessagePrompt } from "@/lib/game/prompts";
import { scenarioForRound } from "@/lib/prompts/scenarios";
import { findForbiddenTerms } from "@/lib/prompts/guard";
import { parseDecision, parseMessage } from "@/lib/prompts/schemas";
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

describe("round progress prompts", () => {
  it("shows total rounds and remaining rounds to every suspect", () => {
    const state = createGameState({
      playerA: { provider: "mock", model: "m" },
      playerB: { provider: "mock", model: "m" },
      totalRounds: 8,
      memoryStartRound: 1,
    });
    const round = scenarioForRound(3);

    for (const lang of ["en", "zh"] as const) {
      const ip: InProgressRound = {
        roundNumber: 3,
        phase: "HISTORY_AWARE",
        scenarioId: round.id,
        scenarioTitle: round.title,
        language: lang,
        stage: "COMMUNICATION",
        startedAt: "",
        sealedCommunication: {},
        sealedDecisions: {},
        communication: null,
        lastError: null,
      };
      for (const slot of ["A", "B"] as const) {
        const prompt = buildMessagePrompt(state, ip, slot);
        if (lang === "en") {
          expect(prompt.user).toContain("over 8 separate crimes");
          expect(prompt.user).toContain("case 3 of 8");
          expect(prompt.user).toContain("cases remaining, including this one: 6");
        } else {
          expect(prompt.user).toContain("8起不同的案子");
          expect(prompt.user).toContain("现在是第3起");
          expect(prompt.user).toContain("还剩6起");
        }
      }
    }
  });
});

describe("payoff prompts", () => {
  it("shows all eight values to both suspect slots", () => {
    const payoff = {
      bothConfessA: 7, bothConfessB: 6,
      AConfessBDenyA: 1, AConfessBDenyB: 12,
      ADenyBConfessA: 11, ADenyBConfessB: 2,
      bothDenyA: 3, bothDenyB: 4,
    };
    const state = createGameState({
      playerA: { provider: "mock", model: "m" },
      playerB: { provider: "mock", model: "m" },
      payoff,
    });
    const round = scenarioForRound(1);
    const ip: InProgressRound = {
      roundNumber: 1,
      phase: "INDEPENDENT",
      scenarioId: round.id,
      scenarioTitle: round.title,
      language: "en",
      stage: "COMMUNICATION",
      startedAt: "",
      sealedCommunication: {},
      sealedDecisions: {},
      communication: null,
      lastError: null,
    };

    for (const slot of ["A", "B"] as const) {
      const prompt = buildMessagePrompt(state, ip, slot);
      for (const value of ["7", "6", "1", "12", "11", "2", "3", "4"])
        expect(prompt.user).toContain(value);
      expect(prompt.user).toContain("heaviest sentence in this deal is 12 years");
      expect(prompt.user).toContain("46 years old when released");
      expect(prompt.user).toContain("THE DEAL");
      expect(prompt.user).not.toMatch(/Suspect [AB]\b|matrix/i);
      // Each suspect sees their own side: "you" always gets their own sentence.
      if (slot === "A") expect(prompt.user).toContain("You testify and Riley stays silent: you get 1 year in prison; Riley gets 12 years in prison.");
      else expect(prompt.user).toContain("stays silent: you get 2 years in prison");
    }
  });
});

describe("immersion", () => {
  it("no prompt assigns the suspect a name or contains format instructions; stakes are personal", () => {
    for (const lang of ["en", "zh"] as const) {
      for (const r of [1, 12]) {
        const { state, ip } = stateAt(r);
        ip.language = lang;
        for (const slot of ["A", "B"] as const) {
          const self = state.players.find((p) => p.id === slot)!.persona.name;
          for (const p of [buildMessagePrompt(state, ip, slot), buildDecisionPrompt(state, ip, slot)]) {
            const text = p.system + "\n" + p.user;
            expect(text).not.toMatch(/Your name is|你的名字是|RESPONSE FORMAT|回复格式|JSON/);
            // The suspect's own nickname never appears in its own engine-written prompt text.
            expect(p.user.replace(/"[^"]*"|“[^”]*”/g, "")).not.toContain(self);
            expect(p.user).toMatch(lang === "zh" ? /34岁[\s\S]*母亲/ : /You are 34[\s\S]*mother/);
            // Answer shape is enforced via the schema, with in-story descriptions.
            expect(findForbiddenTerms(JSON.stringify(p.schema))).toEqual([]);
          }
        }
      }
    }
  });
});

describe("refusal-safe wording", () => {
  it("asks for an inner monologue, not the model's thoughts, and never invites threats", () => {
    for (const lang of ["en", "zh"] as const) {
      const { state, ip } = stateAt(2);
      ip.language = lang;
      for (const p of [buildMessagePrompt(state, ip, "A"), buildDecisionPrompt(state, ip, "B")]) {
        const all = p.system + p.user + JSON.stringify(p.schema);
        expect(all).not.toMatch(/Threaten them|Mislead them|威胁对方|误导对方|going through your head|脑海里正在想/);
        expect(JSON.stringify(p.schema)).toContain("inner_monologue");
      }
    }
  });
});

describe("choice wording", () => {
  it("prompts use TESTIFY/SILENT (告发/沉默), never confess/deny wording", () => {
    for (const lang of ["en", "zh"] as const) {
      const { state, ip } = stateAt(12);
      ip.language = lang;
      for (const slot of ["A", "B"] as const) {
        for (const p of [buildMessagePrompt(state, ip, slot), buildDecisionPrompt(state, ip, slot)]) {
          const text = p.system + p.user;
          expect(text).toContain("TESTIFY");
          expect(text).toContain("SILENT");
          expect(text).not.toMatch(/\bCONFESS|\bDENY\b|\bconfess|\bdeny|认罪|否认/);
          if (lang === "zh") expect(text).toMatch(/告发[\s\S]*沉默/);
        }
      }
    }
  });
  it("maps model answers to the engine's stored actions", () => {
    expect(parseDecision('{"thoughts":"t","action":"TESTIFY"}').action).toBe("CONFESS");
    expect(parseDecision('{"thoughts":"t","action":"SILENT"}').action).toBe("DENY");
    expect(parseMessage('{"thoughts":"t","message":"m","private_leaning":"SILENT"}').privateLeaning).toBe("DENY");
    expect(() => parseDecision('{"action":"SILENT"}')).toThrow(/thoughts/);
    expect(parseDecision('{"inner_monologue":"m","action":"SILENT"}').thoughts).toBe("m");
  });
});

describe("Chinese prompts", () => {
  for (let r = 1; r <= 20; r++) {
    it(`round ${r}: Chinese prompts are leak-free, fully Chinese-framed, with rules and history`, () => {
      const { state, ip } = stateAt(r);
      ip.language = "zh";
      for (const slot of ["A", "B"] as const) {
        for (const p of [buildMessagePrompt(state, ip, slot), buildDecisionPrompt(state, ip, slot)]) {
          expect(findForbiddenTerms(p.system)).toEqual([]);
          expect(p.user).toContain("你的处境");
          expect(p.user).toContain("后果有多严重");
          expect(p.user).toContain("一分钟");
          // The 200-character limit is stated in the answer format, never as an instruction about thinking.
          expect(JSON.stringify(p.schema)).toContain("不超过200字");
          expect(p.user + p.system).not.toMatch(/思考不超过|简短思考/);
          expect(p.user).not.toContain("YOUR SITUATION");
          if (r >= 11) expect(p.user).toContain("以往案件的记录");
        }
      }
    });
  }
  it("every case has a Chinese translation without forbidden terms", () => {
    for (const s of SCENARIOS) {
      expect(s.zh, s.id).toBeDefined();
      expect(findForbiddenTerms(s.zh!.title + s.zh!.description), s.id).toEqual([]);
      expect(s.zh!.description).toContain("重罪");
    }
  });
});

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
        expect(d.user).toContain(`Your note to`);
        expect(d.user.indexOf(`${slot}-CUR-${r}`)).toBeLessThan(d.user.indexOf(`${slot === "A" ? "B" : "A"}-CUR-${r}`));
        expect(d.user).toContain("You are not obligated to keep any promises you made.");
        // Rules stated to the suspect in both stages.
        for (const x of [m, d]) {
          expect(x.user).toContain("maximum of one minute");
          expect(JSON.stringify(x.schema)).toContain("Up to 200 words");
          // Nothing in a prompt tells the model how to think (reads as reasoning extraction).
          expect(x.user + x.system).not.toMatch(/your thinking|before you respond/i);
        }
        // Message prompt must never include the current round's messages.
        expect(m.user).not.toMatch(/[AB]-CUR-/);
      }
    });
  }
});
