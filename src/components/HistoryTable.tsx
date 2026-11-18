"use client";

import { Fragment, useState } from "react";
import type { PlayerState, RoundResult } from "@/lib/game/types";
import { useLang, useT } from "@/lib/i18n";
import { caseTitle, SuspectColumn } from "./Transcript";
import { ActionBadge, providerColor } from "./ui";

export function RoundDetail({ round, players }: { round: RoundResult; players: PlayerState[] }) {
  const [a, b] = players;
  return (
    <div className="grid gap-x-8 gap-y-6 bg-ink/70 p-5 md:grid-cols-2">
      <SuspectColumn p={a} other={b} message={round.communication?.playerA} after={round.decisions.playerA} statement={round.decisions.playerA} showLeaning />
      <SuspectColumn p={b} other={a} message={round.communication?.playerB} after={round.decisions.playerB} statement={round.decisions.playerB} showLeaning />
    </div>
  );
}

export function HistoryTable({ rounds, players, memoryStartRound }: { rounds: RoundResult[]; players: PlayerState[]; memoryStartRound: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const t = useT();
  const lang = useLang();
  const [a, b] = players;
  if (rounds.length === 0) return <p className="font-mono text-xs text-dim">{t.noCompleted}</p>;
  return (
    <div className="overflow-x-auto border border-edge">
      <table className="w-full min-w-[560px] text-left font-mono text-xs">
        <thead className="bg-panel text-[10px] uppercase tracking-[0.2em] text-dim">
          <tr>
            <th className="px-3 py-2">{t.round}</th>
            <th className="px-3 py-2">{t.caseLabel}</th>
            <th className="px-3 py-2" style={{ color: providerColor(a.provider) }}>{a.name}</th>
            <th className="px-3 py-2" style={{ color: providerColor(b.provider) }}>{b.name}</th>
            <th className="px-3 py-2 text-right">{a.name} {t.yrs}</th>
            <th className="px-3 py-2 text-right">{b.name} {t.yrs}</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <Fragment key={r.roundNumber}>
              {r.roundNumber === memoryStartRound && (
                <tr>
                  <td colSpan={6} className="border-t border-lamp/40 bg-lamp/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-lamp">
                    {t.historyIntroduced}
                  </td>
                </tr>
              )}
              <tr
                onClick={() => setOpen(open === r.roundNumber ? null : r.roundNumber)}
                className="cursor-pointer border-t border-edge hover:bg-panel"
              >
                <td className="px-3 py-2 text-dim">{String(r.roundNumber).padStart(2, "0")}</td>
                <td className="px-3 py-2 text-zinc-400">{caseTitle(r, lang)}</td>
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
