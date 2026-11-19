"use client";

import type { CommunicationEntry, DecisionEntry, Lang, PlayerState, RoundResult } from "@/lib/game/types";
import { useLang, useT } from "@/lib/i18n";
import { scenarioById, scenarioTitle } from "@/lib/prompts/scenarios";
import { ActionBadge, Avatar, providerColor, ThoughtBlock, Thinking } from "./ui";

/** Case title in the page language (falls back to the stored English title). */
export function caseTitle(r: { scenarioId: string; scenarioTitle: string }, lang: Lang): string {
  const sc = scenarioById(r.scenarioId);
  return sc ? scenarioTitle(sc, lang) : r.scenarioTitle;
}

/** One suspect's side of a round: thoughts → message → thoughts after reading → statement. */
export function SuspectColumn({
  p,
  other,
  message,
  after,
  statement,
  pending = null,
  animate = { message: false, after: false, statement: false },
  showLeaning = false,
}: {
  p: PlayerState;
  other: PlayerState;
  message?: CommunicationEntry | null;
  after?: DecisionEntry | null;
  statement?: DecisionEntry | null;
  pending?: "writing" | "deciding" | "sealed" | null;
  animate?: { message: boolean; after: boolean; statement: boolean };
  /** Also show the private leaning recorded with the message (review views). */
  showLeaning?: boolean;
}) {
  const t = useT();
  const color = providerColor(p.provider);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-3 font-display text-sm uppercase tracking-[0.2em]" style={{ color }}>
        <Avatar provider={p.provider} name={p.name} size={32} />
        {p.name}
        <span className="font-mono text-[10px] normal-case tracking-normal text-dim">{t.as(p.persona.name)}</span>
      </div>
      {message ? (
        <>
          <ThoughtBlock entry={message} label={t.thoughtsBefore} color={color} animate={animate.message} />
          <div className={animate.message ? "rise" : ""} style={{ animationDelay: "0.6s" }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">{t.messageTo(other.name)}</div>
            <p
              className="mt-1.5 whitespace-pre-wrap border border-edge bg-ink/70 p-4 font-mono text-sm leading-relaxed text-zinc-200"
              style={{ borderLeftColor: color, borderLeftWidth: 2 }}
            >
              “{message.message}”
            </p>
            {showLeaning && message.privateLeaning && (
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{t.leaning(message.privateLeaning === "CONFESS" ? t.confess : t.deny)}</div>
            )}
          </div>
        </>
      ) : pending === "writing" ? (
        <Thinking label={t.writing} />
      ) : pending === "sealed" ? (
        <p className="font-mono text-xs text-dim">{t.sealedWaiting}</p>
      ) : (
        <p className="font-mono text-xs text-dim">{t.noMessage}</p>
      )}
      {after ? (
        <ThoughtBlock entry={after} label={t.thoughtsAfter(other.name)} color={color} animate={animate.after} />
      ) : pending === "deciding" ? (
        <Thinking label={t.deciding} />
      ) : null}
      {statement && (
        <div className={`flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-dim ${animate.statement ? "rise" : ""}`}>
          {t.statementToPolice} <ActionBadge action={statement.action} />
          <span>· {statement.prisonYears} {t.yrs}</span>
        </div>
      )}
    </div>
  );
}

/** Full transcripts of completed rounds, newest first. Nothing is ever cleared. */
export function EarlierRounds({ rounds, players, memoryStartRound }: { rounds: RoundResult[]; players: PlayerState[]; memoryStartRound: number }) {
  const t = useT();
  const lang = useLang();
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
                {t.roundN(r.roundNumber)} · {caseTitle(r, lang)}
                <span className={`ml-2 ${r.phase === "HISTORY_AWARE" ? "text-lamp" : "text-dim"}`}>
                  · {r.phase === "HISTORY_AWARE" ? t.historyAwareShort : t.independentShort}
                </span>
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px] text-dim">
                <Avatar provider={pa.provider} name={pa.name} size={20} />
                <span style={{ color: providerColor(pa.provider) }}>{pa.name}</span>
                <ActionBadge action={r.decisions.playerA.action} />
                <Avatar provider={pb.provider} name={pb.name} size={20} />
                <span style={{ color: providerColor(pb.provider) }}>{pb.name}</span>
                <ActionBadge action={r.decisions.playerB.action} />
                <span>
                  {r.decisions.playerA.prisonYears} / {r.decisions.playerB.prisonYears} {t.yrs}
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
              {t.historyIntroducedFrom}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
