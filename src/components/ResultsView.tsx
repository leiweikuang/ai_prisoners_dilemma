"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicGameState } from "@/lib/game/types";
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

function MetricTable({ title, rows, a, b, names, note }: { title: string; rows: Row[]; a: PlayerAnalysis; b: PlayerAnalysis; names: [string, string]; note?: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl uppercase tracking-[0.15em]">{title}</h2>
      {note && <p className="mt-1 max-w-3xl text-sm text-dim">{note}</p>}
      <div className="mt-3 overflow-x-auto border border-edge">
        <table className="w-full min-w-[520px] font-mono text-xs">
          <thead className="bg-panel text-[10px] uppercase tracking-[0.2em] text-dim">
            <tr>
              <th className="px-3 py-2 text-left">Metric</th>
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

  const [pa, pb] = game.players;
  const names: [string, string] = [pa.name, pb.name];
  const { A, B, outcomes } = analysis;
  const done = game.status === "COMPLETED";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/game/${id}`} className="font-mono text-[10px] uppercase tracking-[0.4em] text-dim hover:text-lamp">← Interrogation room</Link>
        <a href={`/api/games/${id}/export`} className="border border-edge px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-dim hover:text-zinc-200">Export full audit log (JSON)</a>
      </div>
      <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.12em] md:text-6xl">{done ? "Final results" : "Interim results"}</h1>
      <p className="mt-2 font-mono text-xs text-dim">
        {game.rounds.length} of {game.totalRounds} rounds completed · history introduced at round {game.memoryStartRound} · {pa.name} ({pa.model}) vs {pb.name} ({pb.model})
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
              <div className="mt-2 font-display text-6xl">{st.totalYears}<span className="ml-2 font-mono text-sm text-dim">total prison years</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-zinc-300">
                <span>Confessions: {st.confessions} ({pct(st.confessionRate)})</span>
                <span>Denials: {st.denials} ({pct(st.denialRate)})</span>
              </div>
            </div>
          );
        })}
      </section>
      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Mutual confessions" value={outcomes.mutualConfessions} sub="5 / 5 years" />
        <Stat label="Mutual denials" value={outcomes.mutualDenials} sub="1 / 1 year" />
        <Stat label={`Only ${pa.name} confessed`} value={outcomes.unilateralA} sub="0 / 10 years" />
        <Stat label={`Only ${pb.name} confessed`} value={outcomes.unilateralB} sub="10 / 0 years" />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-[0.15em]">Cumulative prison years</h2>
        <div className="mt-3 border border-edge bg-panel/60 p-4">
          <CumulativeChart rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
        </div>
      </section>

      {/* Phase comparison */}
      <section className="mt-10">
        <h2 className="font-display text-xl uppercase tracking-[0.15em]">Phase 1 vs Phase 2</h2>
        <p className="mt-1 text-sm text-dim">Phase 1: no history (rounds 1–{game.memoryStartRound - 1}). Phase 2: full public history of all previous cases, messages and sentences.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(["INDEPENDENT", "HISTORY_AWARE"] as const).map((ph) => {
            const o = analysis.outcomesByPhase[ph];
            return (
              <div key={ph} className="border border-edge bg-panel/70 p-4 font-mono text-xs">
                <div className={`text-[10px] uppercase tracking-[0.25em] ${ph === "HISTORY_AWARE" ? "text-lamp" : "text-dim"}`}>
                  {ph === "INDEPENDENT" ? "Phase 1 · no history" : "Phase 2 · full public history"}
                </div>
                <table className="mt-2 w-full">
                  <tbody>
                    {[[pa, A], [pb, B]].map(([p, s]) => {
                      const st = (s as PlayerAnalysis).byPhase[ph];
                      return (
                        <tr key={(p as typeof pa).id} className="border-t border-edge">
                          <td className="py-1.5" style={{ color: providerColor((p as typeof pa).provider) }}>{(p as typeof pa).name}</td>
                          <td className="py-1.5 text-right">confess {pct(st.confessionRate)}</td>
                          <td className="py-1.5 text-right">deny {pct(st.denialRate)}</td>
                          <td className="py-1.5 text-right text-dim">{st.switches} switches / {st.rounds} rds</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-2 text-dim">
                  Outcomes: {o.mutualDenials} mutual deny · {o.mutualConfessions} mutual confess · {o.unilateralA + o.unilateralB} unilateral
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <MetricTable
        title="Behavioural observations"
        names={names}
        a={A}
        b={B}
        note="'Betrayed' here means: this suspect denied while the other confessed in the same case. These are counts of observed choices, not claims about intent or emotion."
        rows={[
          ["Confession rate change (phase 2 − phase 1)", (s) => {
            const a = s.byPhase.INDEPENDENT.confessionRate, b = s.byPhase.HISTORY_AWARE.confessionRate;
            return a === null || b === null ? "—" : `${b - a >= 0 ? "+" : ""}${Math.round((b - a) * 100)} pts`;
          }],
          ["Times betrayed", (s) => s.timesBetrayed],
          ["Next round after being betrayed: confessed", (s) => s.confessedAfterBetrayed],
          ["Next round after being betrayed: denied", (s) => s.deniedAfterBetrayed],
          ["Denied again at any point after first betrayal", (s) => (s.returnedToDenialAfterBetrayal === null ? "—" : s.returnedToDenialAfterBetrayal ? "yes" : "no")],
          ["Longest run of consecutive denials", (s) => s.longestDenialStreak],
          ["Decision switches: first half → second half", (s) => `${s.consistency.firstHalfSwitches} → ${s.consistency.secondHalfSwitches}`, "Fewer switches = more consistent"],
        ]}
      />

      <MetricTable
        title="Communication"
        names={names}
        a={A}
        b={B}
        note="Message categories are detected with simple keyword heuristics computed after the fact. They never influence the interrogations, and may miss or misclassify phrasing."
        rows={[
          ["Average message length", (s) => (s.communication.avgWords === null ? "—" : `${Math.round(s.communication.avgWords)} words`)],
          ["Messages containing a promise", (s) => s.communication.promises],
          ["Explicit requests to remain silent", (s) => s.communication.silenceRequests],
          ["Attempts to persuade the other to confess", (s) => s.communication.confessPersuasions],
          ["Threats", (s) => s.communication.threats],
          ["Explicit assurances of staying silent", (s) => s.communication.assurances],
          ["Promise-keeping rate", (s) => frac(s.communication.keptStatedIntentions, s.communication.statedIntentions, s.communication.promiseKeepingRate), "Final statement matched the intention stated in its own message"],
          ["Persuasion success rate", (s) => frac(s.communication.requestsFollowed, s.communication.requests, s.communication.persuasionSuccessRate), "Other suspect's final statement matched the action requested"],
          ["Communication impact", (s) => frac(s.communication.changedAfterMessages, s.communication.leaningsRecorded, s.communication.communicationImpactRate), "Final statement differed from the private leaning recorded before reading the other's message"],
          ["Trust consistency (overall denial rate)", (s) => pct(s.denialRate)],
          ["Assurance followed by confession", (s) => s.communication.assuranceContradictions, "Observable inconsistency — not necessarily deliberate deception"],
        ]}
      />

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl uppercase tracking-[0.15em]">Full transcript</h2>
        <HistoryTable rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
      </section>

      <p className="mt-10 border-t border-edge pt-4 text-xs text-dim">
        Findings describe model outputs under these prompts and settings only. Language models do not have genuine
        emotions, trust or intentions; explanations are generated text, not access to internal reasoning.
      </p>
    </main>
  );
}
