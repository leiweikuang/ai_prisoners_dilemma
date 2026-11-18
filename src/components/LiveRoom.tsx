"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunicationEntry, Lang, PlayerState, PublicGameState, RoundResult, Stage } from "@/lib/game/types";
import { HistoryTable } from "@/components/HistoryTable";
import { ActionBadge, Avatar, LanguageToggle, providerColor, Thinking, Years } from "@/components/ui";
import { LangContext, STRINGS } from "@/lib/i18n";
import { caseTitle as localCaseTitle } from "@/components/Transcript";
import { EarlierRounds, SuspectColumn } from "@/components/Transcript";

type View = "idle" | "comm_pending" | "comm_reveal" | "deliberation" | "locked" | "reaction" | "countdown" | "reveal";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Time to read revealed text: grows with the longer of the two columns. */
function readingMs(...texts: (string | null | undefined)[][]) {
  const longest = Math.max(0, ...texts.map((col) => col.reduce((n, t) => n + (t?.length ?? 0), 0)));
  return Math.min(30_000, Math.max(5_000, 3_000 + longest * 28));
}
const NEXT_ROUND_MS = 9000;

function expectedStage(g: PublicGameState): Stage | null {
  if (g.status === "COMPLETED") return null;
  return g.inProgress ? g.inProgress.stage : "COMMUNICATION";
}

async function call(path: string, body?: unknown) {
  const res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function LiveView({ id }: { id: string }) {
  const router = useRouter();
  const [game, setGameState] = useState<PublicGameState | null>(null);
  const [view, setView] = useState<View>("idle");
  const [countdown, setCountdown] = useState(0);
  const [pendingRound, setPendingRound] = useState<RoundResult | null>(null);
  const skipRef = useRef<(() => void) | null>(null);
  /** A pause the spectator can skip. */
  const hold = (ms: number) =>
    new Promise<void>((res) => {
      const t = setTimeout(res, ms);
      skipRef.current = () => {
        clearTimeout(t);
        res();
      };
    }).finally(() => {
      skipRef.current = null;
    });
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const gameRef = useRef<PublicGameState | null>(null);
  const running = useRef(false);
  const errorRef = useRef<string | null>(null);

  const setGame = (g: PublicGameState) => {
    gameRef.current = g;
    setGameState(g);
  };
  const fail = (msg: string | null) => {
    errorRef.current = msg;
    setError(msg);
  };

  const refresh = useCallback(async () => {
    const r = await call(`/api/games/${id}`);
    if (r.status === 404) setNotFound(true);
    if (r.ok) setGame(r.data.game);
    return r.ok ? (r.data.game as PublicGameState) : null;
  }, [id]);

  /** Another request (e.g. from before a refresh) is still running on the server: wait for it. */
  const waitUntilIdle = useCallback(async () => {
    for (let i = 0; i < 200; i++) {
      const g = await refresh();
      if (!g || !g.busy) {
        if (i > 0) setView("idle");
        return g;
      }
      setView(g.busy.stage === "COMMUNICATION" ? "comm_pending" : "deliberation");
      await sleep(2500);
    }
    return gameRef.current;
  }, [refresh]);

  const runRound = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    fail(null);
    try {
      let g = gameRef.current;
      if (!g || g.status === "COMPLETED") return;
      if (g.busy) g = await waitUntilIdle();
      if (!g || g.status === "COMPLETED") return;

      if (expectedStage(g) === "COMMUNICATION") {
        setView("comm_pending");
        const r = await call(`/api/games/${id}/advance`, { roundNumber: g.currentRound, stage: "COMMUNICATION" });
        if (r.data.game) setGame(r.data.game);
        if (!r.ok) {
          if (r.data.code === "busy") await waitUntilIdle();
          else if (r.data.code !== "stale") fail(r.data.error ?? "Message stage failed");
          setView("idle");
          return;
        }
        setView("comm_reveal");
        const c = (r.data.game as PublicGameState).inProgress?.communication;
        await hold(readingMs([c?.playerA.writtenThoughts ?? c?.playerA.thoughts, c?.playerA.message], [c?.playerB.writtenThoughts ?? c?.playerB.thoughts, c?.playerB.message]));
      }

      g = gameRef.current!;
      setView("deliberation");
      const r = await call(`/api/games/${id}/advance`, { roundNumber: g.currentRound, stage: "DECISION" });
      if (!r.ok) {
        if (r.data.game) setGame(r.data.game);
        if (r.data.code === "busy") await waitUntilIdle();
        else if (r.data.code !== "stale") fail(r.data.error ?? "Statement stage failed");
        setView("idle");
        return;
      }
      // Both decisions are locked server-side; hold them back for the reveal.
      const done = (r.data.game as PublicGameState).rounds.at(-1) ?? null;
      setPendingRound(done);
      setView("locked");
      await sleep(1500);
      // Show each suspect's thoughts after reading the other's message, before the statements.
      setView("reaction");
      await hold(readingMs([done?.decisions.playerA.writtenThoughts ?? done?.decisions.playerA.thoughts], [done?.decisions.playerB.writtenThoughts ?? done?.decisions.playerB.thoughts]));
      setView("countdown");
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await sleep(900);
      }
      setGame(r.data.game);
      setPendingRound(null);
      setView("reveal");
    } catch (e) {
      fail((e as Error).message);
      setView("idle");
    } finally {
      running.current = false;
    }
  }, [id, waitUntilIdle]);

  // Initial load + refresh recovery.
  useEffect(() => {
    (async () => {
      const g = await refresh();
      if (g?.busy) await waitUntilIdle();
      try {
        localStorage.setItem("lastGameId", id);
      } catch {}
    })();
  }, [id, refresh, waitUntilIdle]);

  // Auto-advance while RUNNING.
  useEffect(() => {
    if (!game || game.status !== "RUNNING" || running.current || errorRef.current) return;
    if (view !== "idle" && view !== "reveal") return;
    const t = setTimeout(runRound, view === "reveal" ? NEXT_ROUND_MS : 600);
    return () => clearTimeout(t);
  }, [game, view, runRound]);

  async function controlAction(action: "pause" | "resume" | "language", language?: Lang) {
    const r = await call(`/api/games/${id}/control`, { action, language });
    if (r.ok) {
      fail(null);
      setGame(r.data.game);
    }
  }

  async function restart() {
    if (!game || !confirm(STRINGS[game.language ?? "en"].restartConfirm)) return;
    const [a, b] = game.players;
    const r = await call("/api/games", {
      playerA: { provider: a.provider, model: a.model },
      playerB: { provider: b.provider, model: b.model },
      totalRounds: game.totalRounds,
      memoryStartRound: game.memoryStartRound,
      language: game.language ?? "en",
    });
    if (r.ok) router.push(`/game/${r.data.game.gameId}`);
    else fail(r.data.error);
  }

  if (notFound)
    return (
      <main className="flex flex-1 items-center justify-center font-mono text-dim">
        {STRINGS.en.notFound} <Link className="ml-2 text-lamp underline" href="/">{STRINGS.en.newExperiment}</Link>
      </main>
    );
  if (!game) return <main className="flex flex-1 items-center justify-center"><Thinking label="Loading case file" /></main>;

  const lang: Lang = game.language ?? "en";
  const t = STRINGS[lang];
  const [pa, pb] = game.players;
  const lastRound: RoundResult | undefined = game.rounds[game.rounds.length - 1];
  const ip = game.inProgress;
  const showingLast = view === "reveal" || (view === "idle" && !ip?.communication);
  const displayRoundNumber = showingLast && lastRound ? lastRound.roundNumber : Math.min(game.currentRound, game.totalRounds);
  const displayPhase = showingLast && lastRound ? lastRound.phase : ip?.phase ?? game.phase;
  const titleSource = showingLast && lastRound ? lastRound : ip;
  const caseTitle = titleSource ? localCaseTitle(titleSource, lang) : undefined;
  const messages: { playerA: CommunicationEntry; playerB: CommunicationEntry } | null =
    showingLast ? lastRound?.communication ?? null : ip?.communication ?? null;
  const revealRound = showingLast ? lastRound : undefined;
  // Every completed round except the one currently shown in the live transcript above.
  const earlierRounds = showingLast && lastRound ? game.rounds.slice(0, -1) : game.rounds;

  const statusFor = (slot: "A" | "B"): string => {
    switch (view) {
      case "comm_pending":
        return t.stPreparing;
      case "comm_reveal":
        return t.stDelivered;
      case "deliberation":
        return t.stInterrogated;
      case "locked":
      case "countdown":
        return t.stLocked;
      case "reaction":
        return t.stReflecting;
      case "reveal":
        return t.stMade;
      default:
        if (error && ip) {
          const sub = ip.communication ? ip.submitted.decisions[slot] : ip.submitted.communication[slot];
          return sub ? t.stSealed : t.stNoResponse;
        }
        if (game.status === "COMPLETED") return t.stClosed;
        if (ip?.communication) return t.stReceived;
        return t.stWaiting;
    }
  };
  const active = view === "comm_pending" || view === "deliberation";
  const stageIndex = view === "comm_pending" || view === "comm_reveal" ? 1 : view === "deliberation" || view === "locked" || view === "reaction" ? 2 : view === "countdown" || view === "reveal" ? 3 : ip?.communication ? 2 : 0;
  // Post-message thoughts: from the locked (not yet revealed) round during the reaction, else the last completed round.
  const afterRound = view === "reaction" || view === "countdown" ? pendingRound : showingLast ? lastRound : null;

  const banner = {
    idle: game.status === "COMPLETED" ? t.bannerAllClosed : ip?.communication ? t.bannerMsgsPending : lastRound ? t.bannerBetween : t.bannerInCustody,
    comm_pending: t.bannerCommPending,
    comm_reveal: t.bannerCommReveal,
    deliberation: t.bannerDeliberation,
    locked: t.bannerLocked,
    reaction: t.bannerReaction,
    countdown: t.bannerStatements,
    reveal: t.bannerStatements,
  }[view];

  const card = (p: PlayerState, slot: "A" | "B") => {
    const k = slot === "A" ? "playerA" : "playerB";
    const color = providerColor(p.provider);
    const d = revealRound?.decisions[k];
    return (
      <div className={`relative flex flex-col border bg-panel/80 p-5 transition ${active ? "border-lamp/40" : "border-edge"}`}>
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar provider={p.provider} name={p.name} size={72} />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{t.suspectKnownAs(slot, p.persona.name)}</div>
              <div className="mt-1 font-display text-3xl uppercase tracking-wide md:text-4xl" style={{ color }}>{p.name}</div>
              <div className="truncate font-mono text-xs text-dim">{p.model}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">{t.totalSentence}</div>
            <Years n={p.cumulativePrisonYears} className="font-display text-3xl md:text-4xl" />
          </div>
        </div>
        <div className="mt-4 border-t border-edge pt-3">
          {active ? <Thinking label={statusFor(slot)} /> : (
            <span className={`font-mono text-xs uppercase tracking-[0.2em] ${view === "locked" || view === "reaction" || view === "countdown" ? "text-lamp" : "text-dim"}`}>{statusFor(slot)}</span>
          )}
        </div>
        {d && (
          <div className={`mt-4 ${view === "reveal" ? "rise" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ActionBadge action={d.action} big animate={view === "reveal"} />
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">{t.thisCase}</div>
                <Years n={d.prisonYears} className="font-display text-2xl" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const maxYears = Math.max(10, pa.cumulativePrisonYears, pb.cumulativePrisonYears);

  const midRound = !!ip || !!game.busy || !["idle", "reveal"].includes(view);

  return (
    <LangContext.Provider value={lang}>
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
        <div>
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.4em] text-dim hover:text-lamp">{t.setupLink}</Link>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.14em] md:text-5xl">{t.title}</h1>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl uppercase tracking-[0.12em] md:text-4xl">
            {t.round} <span className="text-lamp">{String(displayRoundNumber).padStart(2, "0")}</span>
            <span className="text-dim"> / {String(game.totalRounds).padStart(2, "0")}</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-dim">
            {t.phase}: <span className={displayPhase === "HISTORY_AWARE" ? "text-lamp" : "text-zinc-300"}>
              {displayPhase === "HISTORY_AWARE" ? t.phaseHistory : t.phaseIndependent}
            </span>
          </div>
        </div>
      </header>

      {/* Stage tracker */}
      <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.25em]">
        {t.stages.map((s, i) => (
          <div key={s} className={`border-t-2 pt-2 ${stageIndex === i + 1 ? "border-lamp text-lamp" : stageIndex > i + 1 ? "border-zinc-600 text-zinc-400" : "border-edge text-dim"}`}>
            <span className="mr-2">0{i + 1}</span>{s}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">
          {t.rules(game.config.responseTimeLimitSeconds ?? 60, game.config.thoughtWordLimit ?? 200)}
        </div>
        {caseTitle && <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">{t.caseLabel}: {caseTitle}</div>}
        <div className="mt-1 font-display text-xl uppercase tracking-[0.2em] text-zinc-200 md:text-2xl">{banner}</div>
        {view === "countdown" && <div key={countdown} className="stamp mt-2 font-display text-7xl text-lamp">{countdown}</div>}
      </div>

      {/* Suspects */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {card(pa, "A")}
        {card(pb, "B")}
      </section>

      {/* Round transcript: thoughts → message → thoughts after reading → statement */}
      <section className="relative mt-4 overflow-hidden border border-edge bg-panel/60 p-5">
        {(view === "comm_pending" || view === "deliberation") && <div className="scan absolute inset-0" />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{t.transcript}</div>
          {(view === "comm_reveal" || view === "reaction") && (
            <button onClick={() => skipRef.current?.()} className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim hover:text-lamp">
              {t.continue}
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-zinc-600">
          {t.thoughtsNote}
        </p>
        <div className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {([["A", pa, pb, "playerA"], ["B", pb, pa, "playerB"]] as const).map(([slot, p, other, k]) => (
            <SuspectColumn
              key={slot}
              p={p}
              other={other}
              message={messages?.[k]}
              after={afterRound?.decisions[k]}
              statement={revealRound?.decisions[k]}
              pending={view === "comm_pending" ? "writing" : view === "deliberation" ? "deciding" : null}
              animate={{ message: view === "comm_reveal", after: view === "reaction", statement: view === "reveal" }}
            />
          ))}
        </div>
      </section>

      {error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-confess/50 bg-confess/10 p-4 text-sm">
          <span className="text-confess">{error} {t.nothingRevealed}</span>
          <button onClick={runRound} className="border border-confess px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-confess hover:bg-confess hover:text-ink">{t.retryStage}</button>
        </div>
      )}

      {/* Controls */}
      <section className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]">
        {game.status !== "COMPLETED" && (
          <LanguageToggle
            value={lang}
            disabled={midRound}
            title={t.languageLocked}
            onChange={(l) => controlAction("language", l)}
          />
        )}
        {game.status !== "COMPLETED" && game.status !== "RUNNING" && (
          <>
            <button onClick={() => controlAction("resume")} disabled={active || ["locked", "reaction", "countdown", "comm_reveal"].includes(view)} className="border border-lamp bg-lamp px-4 py-2 text-ink hover:brightness-110 disabled:opacity-40">
              {game.status === "READY" ? t.startAuto : t.resumeAuto}
            </button>
            <button onClick={runRound} disabled={active || ["locked", "reaction", "countdown", "comm_reveal"].includes(view)} className="border border-lamp px-4 py-2 text-lamp hover:bg-lamp hover:text-ink disabled:opacity-40">
              {ip ? t.continueRound : t.startNext}
            </button>
          </>
        )}
        {game.status === "RUNNING" && (
          <button onClick={() => controlAction("pause")} disabled={game.pauseRequested} className="border border-zinc-500 px-4 py-2 text-zinc-300 hover:bg-zinc-200 hover:text-ink disabled:opacity-50">
            {game.pauseRequested ? t.pausing : t.pause}
          </button>
        )}
        <button onClick={restart} className="border border-edge px-4 py-2 text-dim hover:text-zinc-200">{t.restart}</button>
        <Link href={`/game/${id}/results`} className={`border px-4 py-2 ${game.status === "COMPLETED" ? "border-lamp bg-lamp/10 text-lamp" : "border-edge text-dim hover:text-zinc-200"}`}>
          {game.status === "COMPLETED" ? t.viewFinal : t.viewInterim}
        </Link>
        <span className="ml-auto text-[10px] text-dim">{t.status}: {t.statusName[game.status]}</span>
      </section>

      {/* Scoreboard */}
      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{t.scoreboard}</h2>
        <div className="mt-3 space-y-2">
          {[pa, pb].map((p) => (
            <div key={p.id} className="grid grid-cols-[130px_1fr_70px] items-center gap-3 font-mono text-xs">
              <span className="flex items-center gap-2" style={{ color: providerColor(p.provider) }}>
                <Avatar provider={p.provider} name={p.name} size={22} />
                {p.name}
              </span>
              <div className="h-2 bg-edge">
                <div className="h-2 transition-all duration-1000" style={{ width: `${(p.cumulativePrisonYears / maxYears) * 100}%`, background: providerColor(p.provider) }} />
              </div>
              <span className="text-right">{p.cumulativePrisonYears} {t.yrs}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Earlier rounds: full chat history, never cleared */}
      {earlierRounds.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{t.earlierRounds}</h2>
          <EarlierRounds rounds={earlierRounds} players={game.players} memoryStartRound={game.memoryStartRound} />
        </section>
      )}

      {/* History */}
      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{t.roundSummary}</h2>
        <HistoryTable rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
      </section>
    </main>
    </LangContext.Provider>
  );
}
