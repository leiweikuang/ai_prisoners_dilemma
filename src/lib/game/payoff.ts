import type { Action, PayoffMatrix } from "./types";

export const DEFAULT_PAYOFF: PayoffMatrix = {
  bothConfessA: 5,
  bothConfessB: 5,
  AConfessBDenyA: 0,
  AConfessBDenyB: 10,
  ADenyBConfessA: 10,
  ADenyBConfessB: 0,
  bothDenyA: 1,
  bothDenyB: 1,
};

type LegacyPayoff = Partial<PayoffMatrix> & {
  bothConfess?: number;
  bothDeny?: number;
  confessorVsDenier?: number;
  denierVsConfessor?: number;
};

export function normalizePayoff(payoff?: LegacyPayoff): PayoffMatrix {
  if (!payoff) return DEFAULT_PAYOFF;
  return {
    bothConfessA: payoff.bothConfessA ?? payoff.bothConfess ?? DEFAULT_PAYOFF.bothConfessA,
    bothConfessB: payoff.bothConfessB ?? payoff.bothConfess ?? DEFAULT_PAYOFF.bothConfessB,
    AConfessBDenyA: payoff.AConfessBDenyA ?? payoff.confessorVsDenier ?? DEFAULT_PAYOFF.AConfessBDenyA,
    AConfessBDenyB: payoff.AConfessBDenyB ?? payoff.denierVsConfessor ?? DEFAULT_PAYOFF.AConfessBDenyB,
    ADenyBConfessA: payoff.ADenyBConfessA ?? payoff.denierVsConfessor ?? DEFAULT_PAYOFF.ADenyBConfessA,
    ADenyBConfessB: payoff.ADenyBConfessB ?? payoff.confessorVsDenier ?? DEFAULT_PAYOFF.ADenyBConfessB,
    bothDenyA: payoff.bothDenyA ?? payoff.bothDeny ?? DEFAULT_PAYOFF.bothDenyA,
    bothDenyB: payoff.bothDenyB ?? payoff.bothDeny ?? DEFAULT_PAYOFF.bothDenyB,
  };
}

/** One outcome as seen by one suspect: years for "you" and for the other suspect. */
export interface PerspectiveOutcome {
  you: number;
  them: number;
}

/**
 * The matrix from one suspect's point of view, so each prompt's "you" always
 * gets that suspect's own sentence (the matrix itself is stored as A / B).
 */
export function payoffFromPerspective(
  m: PayoffMatrix,
  slot: "A" | "B",
): { bothTestify: PerspectiveOutcome; youTestifyTheySilent: PerspectiveOutcome; youSilentTheyTestify: PerspectiveOutcome; bothSilent: PerspectiveOutcome } {
  const p = normalizePayoff(m);
  if (slot === "A")
    return {
      bothTestify: { you: p.bothConfessA, them: p.bothConfessB },
      youTestifyTheySilent: { you: p.AConfessBDenyA, them: p.AConfessBDenyB },
      youSilentTheyTestify: { you: p.ADenyBConfessA, them: p.ADenyBConfessB },
      bothSilent: { you: p.bothDenyA, them: p.bothDenyB },
    };
  return {
    bothTestify: { you: p.bothConfessB, them: p.bothConfessA },
    youTestifyTheySilent: { you: p.ADenyBConfessB, them: p.ADenyBConfessA },
    youSilentTheyTestify: { you: p.AConfessBDenyB, them: p.AConfessBDenyA },
    bothSilent: { you: p.bothDenyB, them: p.bothDenyA },
  };
}

/** Returns prison years for A and B. The engine is the only place outcomes are computed. */
export function computeSentences(
  a: Action,
  b: Action,
  m: PayoffMatrix = DEFAULT_PAYOFF,
): { playerA: number; playerB: number } {
  const p = normalizePayoff(m);
  if (a === "CONFESS" && b === "CONFESS") return { playerA: p.bothConfessA, playerB: p.bothConfessB };
  if (a === "DENY" && b === "DENY") return { playerA: p.bothDenyA, playerB: p.bothDenyB };
  if (a === "CONFESS" && b === "DENY") return { playerA: p.AConfessBDenyA, playerB: p.AConfessBDenyB };
  return { playerA: p.ADenyBConfessA, playerB: p.ADenyBConfessB };
}

export function phaseForRound(round: number, memoryStartRound: number) {
  return round >= memoryStartRound ? ("HISTORY_AWARE" as const) : ("INDEPENDENT" as const);
}
