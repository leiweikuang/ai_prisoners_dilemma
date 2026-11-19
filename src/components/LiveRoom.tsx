"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunicationEntry, HumanInput, Lang, PlayerState, PublicGameState, RoundResult, Stage } from "@/lib/game/types";
import { HumanTurn } from "@/components/HumanTurn";
import { HistoryTable } from "@/components/HistoryTable";
import { ActionBadge, Avatar, LanguageToggle, providerColor, ThoughtBlock, Thinking } from "@/components/ui";
import { IconBack, IconFile, IconForward, IconPause, IconPlay, IconRestart, IconSeal, IconStep } from "@/components/icons";
import { LangContext, STRINGS } from "@/lib/i18n";
import { caseTitle as localCaseTitle } from "@/components/Transcript";
import { scenarioForRound, scenarioTitle } from "@/lib/prompts/scenarios";
import { EarlierRounds, SuspectColumn } from "@/components/Transcript";

type View = "idle" | "human_message" | "human_decision" | "comm_pending" | "comm_reveal" | "deliberation" | "locked" | "reaction" | "countdown" | "reveal";

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

  // A human player's turn: the round waits here until they submit.
  const humanResolve = useRef<((h: HumanInput) => void) | null>(null);
  const askHuman = (mode: "message" | "decision") =>
    new Promise<HumanInput>((resolve) => {
      humanResolve.current = resolve;
      setView(mode === "message" ? "human_message" : "human_decision");
    });

  const runRound = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    fail(null);
    try {
      let g = gameRef.current;
      if (!g || g.status === "COMPLETED") return;
      if (g.busy) g = await waitUntilIdle();
      if (!g || g.status === "COMPLETED") return;

      const hs = g.players.find((p) => p.provider === "human")?.id ?? null;

      if (expectedStage(g) === "COMMUNICATION") {
        // You write first; your message is sealed before the AI is asked for its own.
        const human = hs && !g.inProgress?.submitted.communication[hs] ? await askHuman("message") : undefined;
        setView("comm_pending");
        const r = await call(`/api/games/${id}/advance`, { roundNumber: g.currentRound, stage: "COMMUNICATION", human });
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
      const humanDecision = hs && !g.inProgress?.submitted.decisions[hs] ? await askHuman("decision") : undefined;
      setView("deliberation");
      const r = await call(`/api/games/${id}/advance`, { roundNumber: g.currentRound, stage: "DECISION", human: humanDecision });
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
      <main className="flex flex-1 items-center justify-center gap-2 text-dim">
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
  // Before a round starts, the next case is already known (one case per round number).
  const caseTitle = titleSource
    ? localCaseTitle(titleSource, lang)
    : scenarioTitle(scenarioForRound(Math.min(game.currentRound, game.totalRounds)), lang);
  const messages: { playerA: CommunicationEntry; playerB: CommunicationEntry } | null =
    showingLast ? lastRound?.communication ?? null : ip?.communication ?? null;
  const revealRound = showingLast ? lastRound : undefined;
  // Every completed round except the one currently shown in the live transcript above.
  const earlierRounds = showingLast && lastRound ? game.rounds.slice(0, -1) : game.rounds;

  const statusFor = (slot: "A" | "B"): string => {
    if (humanSlot) {
      const mine = slot === humanSlot;
      if (view === "human_message" || view === "human_decision") return mine ? t.stYourTurn : t.stWaitingForYou;
      if (mine && (view === "comm_pending" || view === "deliberation")) return t.stSealed;
    }
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
  const humanSlot = game.players.find((p) => p.provider === "human")?.id ?? null;
  const active = view === "comm_pending" || view === "deliberation";
  const humanTurn = view === "human_message" || view === "human_decision";
  const stageIndex = view === "human_message" || view === "comm_pending" || view === "comm_reveal" ? 1 : view === "human_decision" ? 2 : view === "deliberation" || view === "locked" || view === "reaction" ? 2 : view === "countdown" || view === "reveal" ? 3 : ip?.communication ? 2 : 0;
  // Post-message thoughts: from the locked (not yet revealed) round during the reaction, else the last completed round.
  const afterRound = view === "reaction" || view === "countdown" ? pendingRound : showingLast ? lastRound : null;

  const banner = {
    idle: game.status === "COMPLETED" ? t.bannerAllClosed : ip?.communication ? t.bannerMsgsPending : lastRound ? t.bannerBetween : t.bannerInCustody,
    human_message: t.bannerCommPending,
    human_decision: t.bannerDeliberation,
    comm_pending: t.bannerCommPending,
    comm_reveal: t.bannerCommReveal,
    deliberation: t.bannerDeliberation,
    locked: t.bannerLocked,
    reaction: t.bannerReaction,
    countdown: t.bannerStatements,
    reveal: t.bannerStatements,
  }[view];

  const midRound = !!ip || !!game.busy || !["idle", "reveal"].includes(view);
  const stepBusy = active || humanTurn || ["locked", "reaction", "countdown", "comm_reveal"].includes(view);

  /** What each room's glass shows right now: the latest thoughts the viewer may see. */
  const glassFor = (k: "playerA" | "playerB") => {
    const after = afterRound?.decisions[k];
    if (after && (view === "reaction" || view === "countdown" || view === "reveal" || view === "idle")) return { entry: after, label: t.thoughtsAfterShort };
    const before = messages?.[k];
    if (before) return { entry: before, label: t.thoughtsBefore };
    return null;
  };
  /** A pane lights up only when what happens in it matters right now. */
  const litFor = (slot: "A" | "B") => {
    if (humanTurn) return slot === humanSlot;
    if ((view === "comm_pending" || view === "deliberation") && slot === humanSlot) return false;
    if (view === "idle") return !!ip?.communication || !!lastRound;
    return true;
  };

  const room = (p: PlayerState, other: PlayerState, slot: "A" | "B") => {
    const k = slot === "A" ? "playerA" : "playerB";
    const color = providerColor(p.provider);
    const decision = revealRound?.decisions[k];
    const glass = glassFor(k);
    const sealed = view === "locked" || view === "reaction" || view === "countdown";
    const working = (view === "comm_pending" && slot !== humanSlot) || (view === "deliberation" && slot !== humanSlot) || (humanTurn && slot === humanSlot);
    return (
      <section aria-label={`${t.room(slot)} · ${p.name}`} data-lit={litFor(slot)} className={`room flex min-h-[580px] flex-col ${working ? "scan" : ""}`}>
        {/* Ceiling tube */}
        <div className="flex justify-center pt-4">
          <div className="tube flicker w-2/5" />
        </div>

        {/* Door plate and time served, on the dark ceiling band */}
        <div className="ceiling relative z-10 flex flex-col gap-2 px-6 pb-6 pt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-x-3 whitespace-nowrap leading-none">
              <span className="font-plate text-base font-semibold uppercase tracking-[0.18em] text-fog sm:text-lg">{t.room(slot)}</span>
              <span className="font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl" style={{ color }}>
                {p.name}
              </span>
            </h2>
            <p className="mt-1.5 text-xs text-fog">
              {p.model} · {t.as(p.persona.name)}
            </p>
          </div>
          <p className="whitespace-nowrap font-display font-extrabold uppercase leading-none text-tube sm:text-right">
            <span className="text-4xl sm:text-5xl">{p.cumulativePrisonYears}</span>
            <span className="ml-1.5 text-lg text-fog">{t.yearsServed(p.cumulativePrisonYears)}</span>
          </p>
        </div>

        {/* The suspect, under the light; the decision is struck across the glass in front of them */}
        <div className="relative z-10 flex flex-1 items-center justify-center py-4">
          <div className="relative">
            <Avatar provider={p.provider} name={p.name} size={208} className="max-md:!h-40 max-md:!w-40" />
            {(decision || sealed) && (
              <div className="absolute inset-x-0 -bottom-5 flex justify-center">
                {decision ? (
                  <div className="stamp-plate px-3 py-2">
                    <ActionBadge action={decision.action} big animate={view === "reveal"} />
                  </div>
                ) : (
                  <div className="stamp-plate flex items-center gap-2.5 whitespace-nowrap border border-dashed border-fog/60 px-6 py-3 font-plate text-2xl font-semibold uppercase tracking-[0.22em] text-fog">
                    <IconSeal size={20} />
                    {t.sealedTag}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* A plate of smoked glass: what only the viewer can see, and what the suspect is doing */}
        <div className="glass-plate relative z-10 px-6 pb-4 pt-4">
          <div className="min-h-[96px]">
            {glass ? (
              <ThoughtBlock key={`${displayRoundNumber}-${glass.label}`} entry={glass.entry} label={glass.label} color={color} animate={view === "comm_reveal" || view === "reaction"} />
            ) : (
              <p className="max-w-sm text-sm italic text-dim">{t.glassEmpty(other.name)}</p>
            )}
          </div>
          <div className="mt-3 flex h-6 items-center gap-3 border-t border-edge pt-3">
            {working ? (
              <Thinking label={statusFor(slot)} />
            ) : decision ? (
              <span className="text-sm text-fog">
                {t.thisCase}: <span className="font-semibold text-tube">{decision.prisonYears}</span> {t.yearUnit(decision.prisonYears)}
              </span>
            ) : (
              <span className={`text-sm ${sealed ? "text-lamp" : "text-dim"}`}>{statusFor(slot)}</span>
            )}
          </div>
        </div>
      </section>
    );
  };

  const intercomLine = (from: PlayerState, to: PlayerState, slot: "A" | "B", m: CommunicationEntry | undefined) => (
    <div key={slot} className={`grid grid-cols-1 items-baseline gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-4 ${view === "comm_reveal" ? "rise" : ""}`} style={{ animationDelay: slot === "B" ? "0.25s" : "0s" }}>
      <div className="flex items-center gap-2 font-plate text-sm font-semibold uppercase tracking-[0.2em] text-dim">
        <span className="inline-block h-px w-5" style={{ background: providerColor(from.provider) }} />
        {slot} <IconForward size={12} /> {slot === "A" ? "B" : "A"}
      </div>
      <p className="font-mono text-[17px] leading-relaxed text-tube">
        {m ? (
          <>
            <span className="text-dim">{from.persona.name}:</span> “{m.message}”
          </>
        ) : (
          <span className="text-dim">—</span>
        )}
      </p>
    </div>
  );

  return (
    <LangContext.Provider value={lang}>
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 md:px-8">
        {/* The booth's header */}
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-dim hover:text-fog">
            <IconBack />
            {t.setupLink}
          </Link>
          <div className="font-plate text-sm font-semibold uppercase tracking-[0.35em] text-fog">{t.title}</div>
          <div className="text-xs text-dim">{t.rules(game.config.responseTimeLimitSeconds ?? 60, game.config.thoughtWordLimit ?? 200)}</div>
        </header>

        {/* The case and where the round stands */}
        <p className="mt-5 font-display text-2xl font-bold uppercase tracking-wide text-fog md:text-3xl" aria-live="polite">
          {banner}
        </p>

        {/* Two rooms behind the glass, the partition between them */}
        <div key={view === "reveal" ? `reveal-${displayRoundNumber}` : "rooms"} className={`mt-5 grid grid-cols-1 gap-0 bg-edge md:grid-cols-[1fr_13rem_1fr] ${view === "reveal" ? "negative-beat" : ""}`}>
          {room(pa, pb, "A")}

          <aside aria-label={t.round} className="flex flex-col items-center justify-between gap-5 bg-ink px-4 py-6 text-center">
            <p className="font-display font-extrabold leading-none text-tube">
              <span className="sr-only">{t.round} </span>
              <span className="text-7xl">{String(displayRoundNumber).padStart(2, "0")}</span>
              <span className="block text-xl text-dim">/ {String(game.totalRounds).padStart(2, "0")}</span>
            </p>
            {/* The case plate on the wall */}
            <h1 className="w-full border-y border-edge py-3 font-display text-2xl font-extrabold uppercase leading-tight tracking-wide text-tube">{caseTitle}</h1>
            {view === "countdown" ? (
              <div key={countdown} className="stamp font-display text-8xl font-extrabold leading-none text-lamp" aria-live="assertive">
                {countdown}
              </div>
            ) : (
              <ol className="flex flex-col items-start gap-3 text-left">
                {t.stages.map((s, i) => (
                  <li key={s} className={`flex items-center gap-2.5 text-sm ${stageIndex === i + 1 ? "text-lamp" : stageIndex > i + 1 ? "text-fog" : "text-dim"}`}>
                    <span className="signal" data-on={stageIndex === i + 1} data-done={stageIndex > i + 1} />
                    {s}
                  </li>
                ))}
              </ol>
            )}
            <div className={`text-xs leading-snug ${displayPhase === "HISTORY_AWARE" ? "text-lamp" : "text-dim"}`}>
              {displayPhase === "HISTORY_AWARE" ? t.phaseHistory : t.phaseIndependent}
            </div>
          </aside>

          {room(pb, pa, "B")}
        </div>

        {/* Your turn (human player) */}
        {humanTurn && humanSlot && (
          <HumanTurn
            key={`${game.currentRound}-${view}`}
            mode={view === "human_message" ? "message" : "decision"}
            otherName={(humanSlot === "A" ? pb : pa).persona.name}
            limitSeconds={game.config.responseTimeLimitSeconds ?? 60}
            onSubmit={(h) => {
              humanResolve.current?.(h);
              humanResolve.current = null;
            }}
          />
        )}

        {/* The observation console: intercom, then the controls */}
        <section className="console px-6 py-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <h2 className="font-plate text-sm font-semibold uppercase tracking-[0.3em] text-lamp">{t.intercom}</h2>
            {(view === "comm_reveal" || view === "reaction") && (
              <button onClick={() => skipRef.current?.()} className="console-key inline-flex h-8 items-center gap-2 px-3 text-sm">
                {t.continue}
                <IconForward size={14} />
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {game.status !== "COMPLETED" && game.status !== "RUNNING" && (
                <>
                  <button onClick={() => controlAction("resume")} disabled={stepBusy} data-primary="true" className="console-key inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold">
                    <IconPlay size={15} />
                    {game.status === "READY" ? t.startAuto : t.resumeAuto}
                  </button>
                  <button onClick={runRound} disabled={stepBusy} className="console-key inline-flex h-10 items-center gap-2 px-4 text-sm">
                    <IconStep size={15} />
                    {ip ? t.continueRound : t.startNext}
                  </button>
                </>
              )}
              {game.status === "RUNNING" && (
                <button onClick={() => controlAction("pause")} disabled={game.pauseRequested} className="console-key inline-flex h-10 items-center gap-2 px-4 text-sm">
                  <IconPause size={15} />
                  {game.pauseRequested ? t.pausing : t.pause}
                </button>
              )}
              <button onClick={restart} className="console-key inline-flex h-10 items-center gap-2 px-4 text-sm">
                <IconRestart size={15} />
                {t.restart}
              </button>
              <Link href={`/game/${id}/results`} data-primary={game.status === "COMPLETED"} className="console-key inline-flex h-10 items-center gap-2 px-4 text-sm">
                <IconFile size={15} />
                {game.status === "COMPLETED" ? t.viewFinal : t.viewInterim}
              </Link>
              {game.status !== "COMPLETED" && (
                <LanguageToggle value={lang} disabled={midRound} title={t.languageLocked} onChange={(l) => controlAction("language", l)} />
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {messages ? (
              <>
                {intercomLine(pa, pb, "A", messages.playerA)}
                {intercomLine(pb, pa, "B", messages.playerB)}
              </>
            ) : (
              <p className="text-[15px] text-dim">{view === "comm_pending" || view === "human_message" ? t.intercomSealed : t.intercomIdle}</p>
            )}
          </div>

          {error && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-confess/40 pt-3 text-sm">
              <span className="text-confess">
                {error} {t.nothingRevealed}
              </span>
              <button onClick={runRound} className="console-key h-9 px-4 text-sm">
                {t.retryStage}
              </button>
            </div>
          )}
        </section>

        {/* The full record of this case */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-tube">{t.caseRecord}</h2>
          <p className="mt-1 max-w-3xl text-sm text-dim">{t.thoughtsNote}</p>
          <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {([["A", pa, pb, "playerA"], ["B", pb, pa, "playerB"]] as const).map(([slot, p, other, k]) => (
              <SuspectColumn
                key={slot}
                p={p}
                other={other}
                message={messages?.[k]}
                after={afterRound?.decisions[k]}
                statement={revealRound?.decisions[k]}
                pending={
                  slot === humanSlot
                    ? view === "comm_pending"
                      ? "sealed"
                      : null
                    : view === "comm_pending"
                      ? "writing"
                      : view === "deliberation"
                        ? "deciding"
                        : null
                }
                animate={{ message: false, after: false, statement: false }}
              />
            ))}
          </div>
        </section>

        {/* Earlier rounds: full chat history, never cleared */}
        {earlierRounds.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide text-tube">{t.earlierRounds}</h2>
            <EarlierRounds rounds={earlierRounds} players={game.players} memoryStartRound={game.memoryStartRound} />
          </section>
        )}

        {/* Ledger */}
        <section className="mt-14">
          <h2 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide text-tube">{t.roundSummary}</h2>
          <HistoryTable rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
        </section>
      </main>
    </LangContext.Provider>
  );
}
