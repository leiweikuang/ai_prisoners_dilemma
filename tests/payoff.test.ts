import { describe, expect, it } from "vitest";
import { computeSentences, phaseForRound } from "@/lib/game/payoff";

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
