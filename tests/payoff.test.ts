import { describe, expect, it } from "vitest";
import { computeSentences, phaseForRound } from "@/lib/game/payoff";

describe("payoff matrix", () => {
  it("both confess → 5/5", () => expect(computeSentences("CONFESS", "CONFESS")).toEqual({ playerA: 5, playerB: 5 }));
  it("both deny → 1/1", () => expect(computeSentences("DENY", "DENY")).toEqual({ playerA: 1, playerB: 1 }));
  it("A confesses, B denies → 0/10", () => expect(computeSentences("CONFESS", "DENY")).toEqual({ playerA: 0, playerB: 10 }));
  it("A denies, B confesses → 10/0", () => expect(computeSentences("DENY", "CONFESS")).toEqual({ playerA: 10, playerB: 0 }));
  it("phase boundary", () => {
    expect(phaseForRound(10, 11)).toBe("INDEPENDENT");
    expect(phaseForRound(11, 11)).toBe("HISTORY_AWARE");
  });
});
