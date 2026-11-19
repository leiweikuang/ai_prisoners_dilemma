"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang, PublicGameState } from "@/lib/game/types";
import { LangContext, STRINGS } from "@/lib/i18n";
import { normalizePayoff } from "@/lib/game/payoff";
import { analyseGame, type PlayerAnalysis } from "@/lib/analysis/metrics";
import { CumulativeChart } from "@/components/CumulativeChart";
import { HistoryTable } from "@/components/HistoryTable";
import { ActionBadge, Avatar, pct, providerColor, Thinking } from "@/components/ui";
import { IconBack, IconDownload, IconRestart } from "@/components/icons";

type Row = [string, (a: PlayerAnalysis) => React.ReactNode, string?];

function MetricTable({ title, rows, a, b, names, note, metricLabel }: { title: string; rows: Row[]; a: PlayerAnalysis; b: PlayerAnalysis; names: [string, string]; note?: string; metricLabel: string }) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-tube">{title}</h2>
      {note && <p className="mt-1 max-w-3xl text-sm text-dim">{note}</p>}
      <div className="mt-4 overflow-x-auto border-y border-edge">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
            <tr>
              <th className="px-3 py-2 text-left">{metricLabel}</th>
              <th className="px-3 py-2 text-right">{names[0]}</th>
              <th className="px-3 py-2 text-right">{names[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f, hint]) => (
              <tr key={label} className="border-t border-edge">
                <td className="px-3 py-2.5 text-fog">
                  {label}
                  {hint && <div className="text-xs text-dim">{hint}</div>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-tube">{f(a)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-tube">{f(b)}</td>
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
  /** DeepSeek post-game analysis: "running" while it reads, or an error/unavailable message. */
  const [aiStatus, setAiStatus] = useState<{ state: "idle" | "running" | "error"; message?: string }>({ state: "idle" });

  const runAnalysis = useCallback(
    async (force = false) => {
      setAiStatus({ state: "running" });
      const res = await fetch(`/api/games/${id}/analysis`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      }).catch(() => null);
      const data = await res?.json().catch(() => ({}));
      if (res?.ok && data?.game) {
        setGame(data.game);
        setAiStatus({ state: "idle" });
      } else setAiStatus({ state: "error", message: data?.error ?? "DeepSeek analysis failed" });
    },
    [id],
  );

  useEffect(() => {
    (async () => {
      const d = await fetch(`/api/games/${id}`, { cache: "no-store" }).then((r) => r.json());
      setGame(d.game);
      const g = d.game as PublicGameState | undefined;
      // Run (or refresh) DeepSeek's analysis once there are finished rounds it hasn't covered.
      if (g && g.rounds.length > 0 && g.analysis?.roundsCovered !== g.rounds.length) await runAnalysis();
    })();
  }, [id, runAnalysis]);
  const analysis = useMemo(() => (game ? analyseGame(game.rounds, game.analysis?.labels) : null), [game]);
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
  const ai = game.analysis;
  const aiCurrent = !!ai && ai.roundsCovered === game.rounds.length;

  /** One cell of the outcome matrix: how often it happened and what it cost each side. */
  const cell = (count: number, ya: number, yb: number, tone: "both-testify" | "both-silent" | "a" | "b") => (
    <td className={`border border-edge p-5 align-top ${tone === "both-silent" ? "bg-deny/[0.04]" : tone === "both-testify" ? "bg-oxblood/25" : "bg-panel"}`}>
      <div className="font-display text-6xl font-extrabold leading-none text-tube">{count}</div>
      <div className="mt-2 text-sm text-dim">
        {pa.name} {ya} · {pb.name} {yb} {t.yrs}
      </div>
    </td>
  );

  return (
    <LangContext.Provider value={lang}>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/game/${id}`} className="inline-flex items-center gap-2 text-sm text-dim hover:text-fog">
          <IconBack />
          {t.back}
        </Link>
        <a href={`/api/games/${id}/export`} className="console-key inline-flex h-9 items-center gap-2 px-3 text-sm">
          <IconDownload size={15} />
          {t.exportLog}
        </a>
      </header>

      <h1 className="mt-6 font-display text-6xl font-extrabold uppercase leading-[0.9] tracking-wide text-tube md:text-8xl">{done ? t.finalResults : t.interimResults}</h1>
      <p className="mt-3 text-fog">
        {t.resultsMeta(game.rounds.length, game.totalRounds, game.memoryStartRound)} · {pa.name} ({pa.model}) vs {pb.name} ({pb.model})
      </p>

      {/* Both rooms, final time served */}
      <div className="mt-8 grid grid-cols-1 bg-edge md:grid-cols-2 md:gap-px">
        {[[pa, A], [pb, B]].map(([p, s]) => {
          const pl = p as typeof pa, st = s as PlayerAnalysis;
          return (
            <section key={pl.id} data-lit="true" className="room room-band flex flex-wrap items-center gap-6 px-6 py-8">
              <Avatar provider={pl.provider} name={pl.name} size={112} className="relative z-10" />
              <div className="relative z-10 min-w-0 flex-1">
                <h2 className="flex flex-wrap items-baseline gap-x-3 leading-none">
                  <span className="font-plate text-lg font-semibold uppercase tracking-[0.18em] text-ink/75">{t.room(pl.id)}</span>
                  <span className="font-display text-4xl font-extrabold uppercase tracking-wide text-ink">{pl.name}</span>
                </h2>
                <p className="mt-3 font-display text-5xl font-extrabold uppercase leading-none text-ink">
                  {st.totalYears} <span className="text-2xl">{t.yearsServed(st.totalYears)}</span>
                </p>
                <p className="mt-2 text-sm text-ink/80">
                  {t.confessions} {st.confessions} ({pct(st.confessionRate)}) · {t.denials} {st.denials} ({pct(st.denialRate)})
                </p>
              </div>
            </section>
          );
        })}
      </div>

      {/* DeepSeek's post-game write-up: the observer's report */}
      <section className="console px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-plate text-sm font-semibold uppercase tracking-[0.3em] text-lamp">{t.analysisTitle}</h2>
          {ai && aiStatus.state !== "running" && (
            <button onClick={() => runAnalysis(true)} className="console-key inline-flex h-8 items-center gap-2 px-3 text-sm">
              <IconRestart size={14} />
              {t.analysisRerun}
            </button>
          )}
        </div>
        {aiStatus.state === "running" ? (
          <div className="mt-4">
            <Thinking label={t.analysisRunning} />
          </div>
        ) : ai ? (
          <>
            <p className="mt-4 max-w-[70ch] whitespace-pre-wrap text-[17px] leading-relaxed text-tube">{ai.summary[lang]}</p>
            <p className="mt-4 text-xs text-dim">
              {t.analysisNote(ai.model)}
              {!aiCurrent && ` ${t.analysisStale(ai.roundsCovered)}`}
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-dim">{aiStatus.message ? t.analysisFailed(aiStatus.message) : t.analysisNone}</p>
        )}
        {ai && aiStatus.state === "error" && <p className="mt-2 text-xs text-confess">{t.analysisFailed(aiStatus.message ?? "")}</p>}
      </section>

      {/* What happened, case by case: the outcome matrix */}
      <section className="mt-14">
        <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-tube">{t.outcomeMatrix}</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-48 p-3" />
                <th className="p-3 text-sm font-semibold" style={{ color: providerColor(pb.provider) }}>
                  {pb.name} · <ActionBadge action="CONFESS" />
                </th>
                <th className="p-3 text-sm font-semibold" style={{ color: providerColor(pb.provider) }}>
                  {pb.name} · <ActionBadge action="DENY" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="p-3 text-sm font-semibold" style={{ color: providerColor(pa.provider) }}>
                  {pa.name} · <ActionBadge action="CONFESS" />
                </th>
                {cell(outcomes.mutualConfessions, pay.bothConfessA, pay.bothConfessB, "both-testify")}
                {cell(outcomes.unilateralA, pay.AConfessBDenyA, pay.AConfessBDenyB, "a")}
              </tr>
              <tr>
                <th scope="row" className="p-3 text-sm font-semibold" style={{ color: providerColor(pa.provider) }}>
                  {pa.name} · <ActionBadge action="DENY" />
                </th>
                {cell(outcomes.unilateralB, pay.ADenyBConfessA, pay.ADenyBConfessB, "b")}
                {cell(outcomes.mutualDenials, pay.bothDenyA, pay.bothDenyB, "both-silent")}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-tube">{t.cumulativeYears}</h2>
        <div className="mt-5 border-y border-edge py-5">
          <CumulativeChart rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
        </div>
      </section>

      {/* Phase comparison */}
      {hasBothPhases && <section className="mt-14">
        <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-tube">{t.phaseCompare}</h2>
        <p className="mt-1 text-sm text-dim">{t.phaseCompareNote(game.memoryStartRound)}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(["INDEPENDENT", "HISTORY_AWARE"] as const).map((ph) => {
            const o = analysis.outcomesByPhase[ph];
            return (
              <div key={ph} className="border-y border-edge py-4 text-sm">
                <div className={`font-display text-lg font-bold uppercase ${ph === "HISTORY_AWARE" ? "text-lamp" : "text-fog"}`}>
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
        note={ai ? t.communicationNoteDeepseek(ai.model) : t.communicationNote}
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
        <h2 className="mb-4 font-display text-3xl font-bold uppercase tracking-wide text-tube">{t.fullTranscript}</h2>
        <HistoryTable rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
      </section>

      <p className="mt-10 border-t border-edge pt-4 text-xs text-dim">
        {t.disclaimer}
      </p>
    </main>
    </LangContext.Provider>
  );
}
