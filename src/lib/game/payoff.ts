import type { Action, PayoffMatrix } from "./types";

export const DEFAULT_PAYOFF: PayoffMatrix = {
  bothConfess: 5,
  bothDeny: 1,
  confessorVsDenier: 0,
  denierVsConfessor: 10,
};

/** Returns prison years for A and B. The engine is the only place outcomes are computed. */
export function computeSentences(
  a: Action,
  b: Action,
  m: PayoffMatrix = DEFAULT_PAYOFF,
): { playerA: number; playerB: number } {
  if (a === "CONFESS" && b === "CONFESS") return { playerA: m.bothConfess, playerB: m.bothConfess };
  if (a === "DENY" && b === "DENY") return { playerA: m.bothDeny, playerB: m.bothDeny };
  if (a === "CONFESS" && b === "DENY") return { playerA: m.confessorVsDenier, playerB: m.denierVsConfessor };
  return { playerA: m.denierVsConfessor, playerB: m.confessorVsDenier };
}

export function phaseForRound(round: number, memoryStartRound: number) {
  return round >= memoryStartRound ? ("HISTORY_AWARE" as const) : ("INDEPENDENT" as const);
}
