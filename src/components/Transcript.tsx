"use client";

import type { CommunicationEntry, DecisionEntry, PlayerState, RoundResult } from "@/lib/game/types";
import { ActionBadge, providerColor, Thinking, Thoughts } from "./ui";

/** One suspect's side of a round: thoughts → message → thoughts after reading → statement. */
export function SuspectColumn({
  p,
  other,
  message,
  after,
  statement,
  pending = null,
  animate = { message: false, after: false, statement: false },
}: {
  p: PlayerState;
  other: PlayerState;
  message?: CommunicationEntry | null;
  after?: DecisionEntry | null;
  statement?: DecisionEntry | null;
  pending?: "writing" | "deciding" | null;
  animate?: { message: boolean; after: boolean; statement: boolean };
}) {
  const color = providerColor(p.provider);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="font-display text-sm uppercase tracking-[0.2em]" style={{ color }}>
        {p.name}
      </div>
      {message ? (
        <>
          <Thoughts text={message.thoughts} label="Thoughts before writing" color={color} animate={animate.message} />
          <div className={animate.message ? "rise" : ""} style={{ animationDelay: "0.6s" }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Message to {other.name}</div>
            <p
              className="mt-1.5 whitespace-pre-wrap border border-edge bg-ink/70 p-4 font-mono text-sm leading-relaxed text-zinc-200"
              style={{ borderLeftColor: color, borderLeftWidth: 2 }}
            >
              “{message.message}”
            </p>
          </div>
        </>
      ) : pending === "writing" ? (
        <Thinking label="Thinking · writing message" />
      ) : (
        <p className="font-mono text-xs text-dim">No message yet for this case.</p>
      )}
      {after ? (
        <Thoughts text={after.thoughts} label={`Thoughts after reading ${other.name}'s message`} color={color} animate={animate.after} />
      ) : pending === "deciding" ? (
        <Thinking label="Reading message · deciding" />
      ) : null}
      {statement && (
        <div className={animate.statement ? "rise" : ""}>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
            Statement to police <ActionBadge action={statement.action} />
            <span>· {statement.prisonYears} {statement.prisonYears === 1 ? "yr" : "yrs"}</span>
          </div>
          <p className="mt-1.5 border-l-2 pl-3 text-sm leading-relaxed text-zinc-300" style={{ borderColor: color }}>
            {statement.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

/** Full transcripts of completed rounds, newest first. Nothing is ever cleared. */
export function EarlierRounds({ rounds, players, memoryStartRound }: { rounds: RoundResult[]; players: PlayerState[]; memoryStartRound: number }) {
  const [pa, pb] = players;
  if (rounds.length === 0) return null;
  const sorted = [...rounds].sort((x, y) => y.roundNumber - x.roundNumber);
  return (
    <div className="space-y-3">
      {sorted.map((r) => (
        <div key={r.roundNumber}>
          <details open className="group border border-edge bg-panel/50">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-panel">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-300">
                <span className="mr-2 text-dim group-open:hidden">▸</span>
                <span className="mr-2 hidden text-dim group-open:inline">▾</span>
                Round {String(r.roundNumber).padStart(2, "0")} · {r.scenarioTitle}
                <span className={`ml-2 ${r.phase === "HISTORY_AWARE" ? "text-lamp" : "text-dim"}`}>
                  · {r.phase === "HISTORY_AWARE" ? "history-aware" : "independent"}
                </span>
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px] text-dim">
                <span style={{ color: providerColor(pa.provider) }}>{pa.name}</span>
                <ActionBadge action={r.decisions.playerA.action} />
                <span style={{ color: providerColor(pb.provider) }}>{pb.name}</span>
                <ActionBadge action={r.decisions.playerB.action} />
                <span>
                  {r.decisions.playerA.prisonYears} / {r.decisions.playerB.prisonYears} yrs
                </span>
              </span>
            </summary>
            <div className="grid gap-x-8 gap-y-6 border-t border-edge p-5 md:grid-cols-2">
              <SuspectColumn p={pa} other={pb} message={r.communication?.playerA} after={r.decisions.playerA} statement={r.decisions.playerA} />
              <SuspectColumn p={pb} other={pa} message={r.communication?.playerB} after={r.decisions.playerB} statement={r.decisions.playerB} />
            </div>
          </details>
          {r.roundNumber === memoryStartRound && (
            <div className="mt-3 border-t border-lamp/40 pt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-lamp">
              ↑ History introduced from this round
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
