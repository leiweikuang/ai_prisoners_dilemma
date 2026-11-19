"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Lang, PublicGameState } from "@/lib/game/types";
import { LangContext, STRINGS } from "@/lib/i18n";
import { normalizePayoff } from "@/lib/game/payoff";
import { analyseGame, type PlayerAnalysis } from "@/lib/analysis/metrics";
import { CumulativeChart } from "@/components/CumulativeChart";
import { HistoryTable } from "@/components/HistoryTable";
import { Avatar, pct, providerColor, Thinking } from "@/components/ui";

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="border border-edge bg-panel/70 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">{label}</div>
      <div className="mt-1 font-display text-3xl">{value}</div>
      {sub && <div className="mt-1 font-mono text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

type Row = [string, (a: PlayerAnalysis) => React.ReactNode, string?];

function MetricTable({ title, rows, a, b, names, note, metricLabel }: { title: string; rows: Row[]; a: PlayerAnalysis; b: PlayerAnalysis; names: [string, string]; note?: string; metricLabel: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl uppercase tracking-[0.15em]">{title}</h2>
      {note && <p className="mt-1 max-w-3xl text-sm text-dim">{note}</p>}
      <div className="mt-3 overflow-x-auto border border-edge">
        <table className="w-full min-w-[520px] font-mono text-xs">
          <thead className="bg-panel text-[10px] uppercase tracking-[0.2em] text-dim">
            <tr>
              <th className="px-3 py-2 text-left">{metricLabel}</th>
              <th className="px-3 py-2 text-right">{names[0]}</th>
              <th className="px-3 py-2 text-right">{names[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f, hint]) => (
              <tr key={label} className="border-t border-edge">
                <td className="px-3 py-2 text-zinc-300">
                  {label}
                  {hint && <div className="text-[10px] text-dim">{hint}</div>}
                </td>
                <td className="px-3 py-2 text-right">{f(a)}</td>
                <td className="px-3 py-2 text-right">{f(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const frac = (n: number, d: number, r: number | null) => (d === 0 ? "—" : `${pct(r)} (${n}/${d})`);

export function ResultsView({ id }: { id: string }) {
  const [game, setGame] = useState<PublicGameState | null>(null);
  useEffect(() => {
    fetch(`/api/games/${id}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setGame(d.game));
  }, [id]);
  const analysis = useMemo(() => (game ? analyseGame(game.rounds) : null), [game]);
  if (!game || !analysis) return <main className="flex flex-1 items-center justify-center"><Thinking label="Compiling report" /></main>;

  const lang: Lang = game.language ?? "en";
  const t = STRINGS[lang];
  const m = t.m;
  const [pa, pb] = game.players;
  const names: [string, string] = [pa.name, pb.name];
  // The phase comparison only means something when both phases have rounds.
  const hasBothPhases = game.memoryStartRound > 1 && game.memoryStartRound <= game.totalRounds;
  const { A, B, outcomes } = analysis;
  // Sentences as configured for this game (A / B), including older games' symmetric format.
  const pay = normalizePayoff(game.config.payoff);
  const done = game.status === "COMPLETED";

  return (
    <LangContext.Provider value={lang}>
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/game/${id}`} className="font-mono text-[10px] uppercase tracking-[0.4em] text-dim hover:text-lamp">{t.back}</Link>
        <a href={`/api/games/${id}/export`} className="border border-edge px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-dim hover:text-zinc-200">{t.exportLog}</a>
      </div>
      <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.12em] md:text-6xl">{done ? t.finalResults : t.interimResults}</h1>
      <p className="mt-2 font-mono text-xs text-dim">
        {t.resultsMeta(game.rounds.length, game.totalRounds, game.memoryStartRound)} · {pa.name} ({pa.model}) vs {pb.name} ({pb.model})
      </p>

      {/* Overall */}
      <section className="mt-8 grid gap-3 md:grid-cols-2">
        {[[pa, A], [pb, B]].map(([p, s]) => {
          const pl = p as typeof pa, st = s as PlayerAnalysis;
          return (
            <div key={pl.id} className="relative border border-edge bg-panel/80 p-5">
              <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: providerColor(pl.provider) }} />
              <div className="flex items-center gap-3 font-display text-2xl uppercase tracking-wide" style={{ color: providerColor(pl.provider) }}>
                <Avatar provider={pl.provider} name={pl.name} size={52} />
                {pl.name}
              </div>
              <div className="mt-2 font-display text-6xl">{st.totalYears}<span className="ml-2 font-mono text-sm text-dim">{t.totalYears}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-zinc-300">
                <span>{t.confessions}: {st.confessions} ({pct(st.confessionRate)})</span>
                <span>{t.denials}: {st.denials} ({pct(st.denialRate)})</span>
              </div>
            </div>
          );
        })}
      </section>
      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t.mutualConfessions} value={outcomes.mutualConfessions} sub={`${pay.bothConfessA} / ${pay.bothConfessB} ${t.yrs}`} />
        <Stat label={t.mutualDenials} value={outcomes.mutualDenials} sub={`${pay.bothDenyA} / ${pay.bothDenyB} ${t.yrs}`} />
        <Stat label={t.onlyConfessed(pa.name)} value={outcomes.unilateralA} sub={`${pay.AConfessBDenyA} / ${pay.AConfessBDenyB} ${t.yrs}`} />
        <Stat label={t.onlyConfessed(pb.name)} value={outcomes.unilateralB} sub={`${pay.ADenyBConfessA} / ${pay.ADenyBConfessB} ${t.yrs}`} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-[0.15em]">{t.cumulativeYears}</h2>
        <div className="mt-3 border border-edge bg-panel/60 p-4">
          <CumulativeChart rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
        </div>
      </section>

      {/* Phase comparison */}
      {hasBothPhases && <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-[0.15em]">{t.phaseCompare}</h2>
        <p className="mt-1 text-sm text-dim">{t.phaseCompareNote(game.memoryStartRound)}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(["INDEPENDENT", "HISTORY_AWARE"] as const).map((ph) => {
            const o = analysis.outcomesByPhase[ph];
            return (
              <div key={ph} className="border border-edge bg-panel/70 p-4 font-mono text-xs">
                <div className={`text-[10px] uppercase tracking-[0.25em] ${ph === "HISTORY_AWARE" ? "text-lamp" : "text-dim"}`}>
                  {ph === "INDEPENDENT" ? t.phase1 : t.phase2}
                </div>
                <table className="mt-2 w-full">
                  <tbody>
                    {[[pa, A], [pb, B]].map(([p, s]) => {
                      const st = (s as PlayerAnalysis).byPhase[ph];
                      return (
                        <tr key={(p as typeof pa).id} className="border-t border-edge">
                          <td className="py-1.5" style={{ color: providerColor((p as typeof pa).provider) }}>{(p as typeof pa).name}</td>
                          <td className="py-1.5 text-right">{t.confessShort} {pct(st.confessionRate)}</td>
                          <td className="py-1.5 text-right">{t.denyShort} {pct(st.denialRate)}</td>
                          <td className="py-1.5 text-right text-dim">{t.switches(st.switches, st.rounds)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-2 text-dim">
                  {t.outcomesLine(o.mutualDenials, o.mutualConfessions, o.unilateralA + o.unilateralB)}
                </div>
              </div>
            );
          })}
        </div>
      </section>}

      <MetricTable
        title={t.behaviour}
        metricLabel={t.metric}
        names={names}
        a={A}
        b={B}
        note={t.behaviourNote}
        rows={[
          ...(hasBothPhases
            ? [[m.confRateChange, (s: PlayerAnalysis) => {
                const a = s.byPhase.INDEPENDENT.confessionRate, b = s.byPhase.HISTORY_AWARE.confessionRate;
                return a === null || b === null ? "—" : `${b - a >= 0 ? "+" : ""}${Math.round((b - a) * 100)} ${m.pts}`;
              }] as Row]
            : []),
          [m.timesBetrayed, (s) => s.timesBetrayed],
          [m.nextConfessed, (s) => s.confessedAfterBetrayed],
          [m.nextDenied, (s) => s.deniedAfterBetrayed],
          [m.deniedAgain, (s) => (s.returnedToDenialAfterBetrayal === null ? "—" : s.returnedToDenialAfterBetrayal ? m.yes : m.no)],
          [m.longestDeny, (s) => s.longestDenialStreak],
          [m.switchesHalves, (s) => `${s.consistency.firstHalfSwitches} → ${s.consistency.secondHalfSwitches}`, m.switchesHint],
        ]}
      />

      <MetricTable
        title={t.communication}
        metricLabel={t.metric}
        names={names}
        a={A}
        b={B}
        note={t.communicationNote}
        rows={[
          [m.avgLength, (s) => (s.communication.avgWords === null ? "—" : `${Math.round(s.communication.avgWords)} ${m.words}`)],
          [m.promises, (s) => s.communication.promises],
          [m.silence, (s) => s.communication.silenceRequests],
          [m.persuade, (s) => s.communication.confessPersuasions],
          [m.threats, (s) => s.communication.threats],
          [m.assurances, (s) => s.communication.assurances],
          [m.keeping, (s) => frac(s.communication.keptStatedIntentions, s.communication.statedIntentions, s.communication.promiseKeepingRate), m.keepingHint],
          [m.persuasion, (s) => frac(s.communication.requestsFollowed, s.communication.requests, s.communication.persuasionSuccessRate), m.persuasionHint],
          [m.impact, (s) => frac(s.communication.changedAfterMessages, s.communication.leaningsRecorded, s.communication.communicationImpactRate), m.impactHint],
          [m.trust, (s) => pct(s.denialRate)],
          [m.contradiction, (s) => s.communication.assuranceContradictions, m.contradictionHint],
        ]}
      />

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl uppercase tracking-[0.15em]">{t.fullTranscript}</h2>
        <HistoryTable rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
      </section>

      <p className="mt-10 border-t border-edge pt-4 text-xs text-dim">
        {t.disclaimer}
      </p>
    </main>
    </LangContext.Provider>
  );
}
