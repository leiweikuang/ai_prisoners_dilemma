import { describe, expect, it } from "vitest";
import { computeSentences, payoffFromPerspective, phaseForRound } from "@/lib/game/payoff";

describe("payoff matrix", () => {
  it("supports distinct values for both suspects", () => {
    const payoff = {
      bothConfessA: 7, bothConfessB: 6,
      AConfessBDenyA: 1, AConfessBDenyB: 12,
      ADenyBConfessA: 11, ADenyBConfessB: 2,
      bothDenyA: 3, bothDenyB: 4,
    };
    expect(computeSentences("CONFESS", "CONFESS", payoff)).toEqual({ playerA: 7, playerB: 6 });
    expect(computeSentences("CONFESS", "DENY", payoff)).toEqual({ playerA: 1, playerB: 12 });
    expect(computeSentences("DENY", "CONFESS", payoff)).toEqual({ playerA: 11, playerB: 2 });
    expect(computeSentences("DENY", "DENY", payoff)).toEqual({ playerA: 3, playerB: 4 });
  });
  it("both deny → 1/1", () => expect(computeSentences("DENY", "DENY")).toEqual({ playerA: 1, playerB: 1 }));
  it("A confesses, B denies → 0/10", () => expect(computeSentences("CONFESS", "DENY")).toEqual({ playerA: 0, playerB: 10 }));
  it("A denies, B confesses → 10/0", () => expect(computeSentences("DENY", "CONFESS")).toEqual({ playerA: 10, playerB: 0 }));
  it("phase boundary", () => {
    expect(phaseForRound(10, 11)).toBe("INDEPENDENT");
    expect(phaseForRound(11, 11)).toBe("HISTORY_AWARE");
  });
});

describe("payoff from each suspect's perspective", () => {
  const m = {
    bothConfessA: 7, bothConfessB: 6,
    AConfessBDenyA: 1, AConfessBDenyB: 12,
    ADenyBConfessA: 11, ADenyBConfessB: 2,
    bothDenyA: 3, bothDenyB: 4,
  };
  it("A sees its own column as 'you'", () => {
    expect(payoffFromPerspective(m, "A")).toEqual({
      bothTestify: { you: 7, them: 6 },
      youTestifyTheySilent: { you: 1, them: 12 },
      youSilentTheyTestify: { you: 11, them: 2 },
      bothSilent: { you: 3, them: 4 },
    });
  });
  it("B sees its own column as 'you'", () => {
    expect(payoffFromPerspective(m, "B")).toEqual({
      bothTestify: { you: 6, them: 7 },
      youTestifyTheySilent: { you: 2, them: 11 },
      youSilentTheyTestify: { you: 12, them: 1 },
      bothSilent: { you: 4, them: 3 },
    });
  });
  it("agrees with computeSentences for every outcome", () => {
    for (const [a, b] of [["CONFESS", "CONFESS"], ["CONFESS", "DENY"], ["DENY", "CONFESS"], ["DENY", "DENY"]] as const) {
      const s = computeSentences(a, b, m);
      const key = (me: string, other: string) =>
        me === "CONFESS" ? (other === "CONFESS" ? "bothTestify" : "youTestifyTheySilent") : other === "CONFESS" ? "youSilentTheyTestify" : "bothSilent";
      expect(payoffFromPerspective(m, "A")[key(a, b)].you).toBe(s.playerA);
      expect(payoffFromPerspective(m, "B")[key(b, a)].you).toBe(s.playerB);
    }
  });
});
