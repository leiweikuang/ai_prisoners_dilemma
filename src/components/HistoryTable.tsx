"use client";

import { Fragment, useState } from "react";
import type { PlayerState, RoundResult } from "@/lib/game/types";
import { ActionBadge, providerColor } from "./ui";

export function RoundDetail({ round, players }: { round: RoundResult; players: PlayerState[] }) {
  const [a, b] = players;
  const col = (p: PlayerState, k: "playerA" | "playerB") => (
    <div className="space-y-3">
      <div className="font-display uppercase tracking-wider" style={{ color: providerColor(p.provider) }}>
        {p.name}
      </div>
      {round.communication && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Message sent</div>
          <p className="mt-1 whitespace-pre-wrap font-mono text-sm text-zinc-200">“{round.communication[k].message}”</p>
          {round.communication[k].privateLeaning && (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
              private leaning before reading reply: {round.communication[k].privateLeaning}
            </div>
          )}
        </div>
      )}
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
          Statement <ActionBadge action={round.decisions[k].action} /> · {round.decisions[k].prisonYears} yrs
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{round.decisions[k].explanation}</p>
      </div>
    </div>
  );
  return (
    <div className="grid gap-6 bg-ink/70 p-5 md:grid-cols-2">
      {col(a, "playerA")}
      {col(b, "playerB")}
    </div>
  );
}

export function HistoryTable({ rounds, players, memoryStartRound }: { rounds: RoundResult[]; players: PlayerState[]; memoryStartRound: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [a, b] = players;
  if (rounds.length === 0) return <p className="font-mono text-xs text-dim">No completed cases yet.</p>;
  return (
    <div className="overflow-x-auto border border-edge">
      <table className="w-full min-w-[560px] text-left font-mono text-xs">
        <thead className="bg-panel text-[10px] uppercase tracking-[0.2em] text-dim">
          <tr>
            <th className="px-3 py-2">Round</th>
            <th className="px-3 py-2">Case</th>
            <th className="px-3 py-2" style={{ color: providerColor(a.provider) }}>{a.name}</th>
            <th className="px-3 py-2" style={{ color: providerColor(b.provider) }}>{b.name}</th>
            <th className="px-3 py-2 text-right">{a.name} yrs</th>
            <th className="px-3 py-2 text-right">{b.name} yrs</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <Fragment key={r.roundNumber}>
              {r.roundNumber === memoryStartRound && (
                <tr>
                  <td colSpan={6} className="border-t border-lamp/40 bg-lamp/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-lamp">
                    History introduced
                  </td>
                </tr>
              )}
              <tr
                onClick={() => setOpen(open === r.roundNumber ? null : r.roundNumber)}
                className="cursor-pointer border-t border-edge hover:bg-panel"
              >
                <td className="px-3 py-2 text-dim">{String(r.roundNumber).padStart(2, "0")}</td>
                <td className="px-3 py-2 text-zinc-400">{r.scenarioTitle}</td>
                <td className="px-3 py-2"><ActionBadge action={r.decisions.playerA.action} /></td>
                <td className="px-3 py-2"><ActionBadge action={r.decisions.playerB.action} /></td>
                <td className="px-3 py-2 text-right">{r.decisions.playerA.prisonYears}</td>
                <td className="px-3 py-2 text-right">{r.decisions.playerB.prisonYears}</td>
              </tr>
              {open === r.roundNumber && (
                <tr>
                  <td colSpan={6}>
                    <RoundDetail round={r} players={players} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
