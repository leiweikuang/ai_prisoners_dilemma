"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunicationEntry, PlayerState, PublicGameState, RoundResult, Stage } from "@/lib/game/types";
import { HistoryTable } from "@/components/HistoryTable";
import { ActionBadge, providerColor, Thinking, Years } from "@/components/ui";

type View = "idle" | "comm_pending" | "comm_reveal" | "deliberation" | "locked" | "reveal";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const COMM_REVEAL_MS = 4000;
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
        await sleep(COMM_REVEAL_MS);
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
      setView("locked");
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await sleep(900);
      }
      setGame(r.data.game);
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

  async function controlAction(action: "pause" | "resume") {
    const r = await call(`/api/games/${id}/control`, { action });
    if (r.ok) {
      fail(null);
      setGame(r.data.game);
    }
  }

  async function restart() {
    if (!game || !confirm("Start a new experiment with the same configuration?")) return;
    const [a, b] = game.players;
    const r = await call("/api/games", {
      playerA: { provider: a.provider, model: a.model },
      playerB: { provider: b.provider, model: b.model },
      totalRounds: game.totalRounds,
      memoryStartRound: game.memoryStartRound,
    });
    if (r.ok) router.push(`/game/${r.data.game.gameId}`);
    else fail(r.data.error);
  }

  if (notFound)
    return (
      <main className="flex flex-1 items-center justify-center font-mono text-dim">
        Case file not found. <Link className="ml-2 text-lamp underline" href="/">New experiment</Link>
      </main>
    );
  if (!game) return <main className="flex flex-1 items-center justify-center"><Thinking label="Loading case file" /></main>;

  const [pa, pb] = game.players;
  const lastRound: RoundResult | undefined = game.rounds[game.rounds.length - 1];
  const ip = game.inProgress;
  const showingLast = view === "reveal" || (view === "idle" && !ip?.communication);
  const displayRoundNumber = showingLast && lastRound ? lastRound.roundNumber : Math.min(game.currentRound, game.totalRounds);
  const displayPhase = showingLast && lastRound ? lastRound.phase : ip?.phase ?? game.phase;
  const caseTitle = showingLast && lastRound ? lastRound.scenarioTitle : ip?.scenarioTitle;
  const messages: { playerA: CommunicationEntry; playerB: CommunicationEntry } | null =
    showingLast ? lastRound?.communication ?? null : ip?.communication ?? null;
  const revealRound = showingLast ? lastRound : undefined;

  const statusFor = (slot: "A" | "B"): string => {
    switch (view) {
      case "comm_pending":
        return "Preparing message";
      case "comm_reveal":
        return "Message delivered";
      case "deliberation":
        return "Under interrogation · considering response";
      case "locked":
        return "Decision locked";
      case "reveal":
        return "Statement made";
      default:
        if (error && ip) {
          const sub = ip.communication ? ip.submitted.decisions[slot] : ip.submitted.communication[slot];
          return sub ? "Submitted · sealed" : "No response · retry needed";
        }
        if (game.status === "COMPLETED") return "Case closed";
        if (ip?.communication) return "Message received · awaiting statement";
        return "Waiting";
    }
  };
  const active = view === "comm_pending" || view === "deliberation";
  const stageIndex = view === "comm_pending" || view === "comm_reveal" ? 1 : view === "deliberation" ? 2 : view === "locked" || view === "reveal" ? 3 : ip?.communication ? 2 : 0;

  const banner = {
    idle: game.status === "COMPLETED" ? "All cases closed." : ip?.communication ? "Messages exchanged. Statements pending." : lastRound ? "Between interrogations." : "Suspects in custody. Awaiting interrogation.",
    comm_pending: "Each suspect may send one message to the other.",
    comm_reveal: "Both messages submitted. Delivering simultaneously.",
    deliberation: "Both suspects have received their messages.",
    locked: "Decisions locked.",
    reveal: "Both suspects have made their statements.",
  }[view];

  const card = (p: PlayerState, slot: "A" | "B") => {
    const k = slot === "A" ? "playerA" : "playerB";
    const color = providerColor(p.provider);
    const d = revealRound?.decisions[k];
    return (
      <div className={`relative flex flex-col border bg-panel/80 p-5 transition ${active ? "border-lamp/40" : "border-edge"}`}>
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">Suspect {slot} · “{p.persona.name}”</div>
            <div className="mt-1 font-display text-3xl uppercase tracking-wide md:text-4xl" style={{ color }}>{p.name}</div>
            <div className="font-mono text-xs text-dim">{p.model}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Total sentence</div>
            <Years n={p.cumulativePrisonYears} className="font-display text-3xl md:text-4xl" />
          </div>
        </div>
        <div className="mt-4 border-t border-edge pt-3">
          {active ? <Thinking label={statusFor(slot)} /> : (
            <span className={`font-mono text-xs uppercase tracking-[0.2em] ${view === "locked" ? "text-lamp" : "text-dim"}`}>{statusFor(slot)}</span>
          )}
        </div>
        {d && (
          <div className={`mt-4 ${view === "reveal" ? "rise" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ActionBadge action={d.action} big animate={view === "reveal"} />
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">This case</div>
                <Years n={d.prisonYears} className="font-display text-2xl" />
              </div>
            </div>
            <div className="mt-4 border-l-2 pl-3" style={{ borderColor: color }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Statement to police</div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{d.explanation}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const maxYears = Math.max(10, pa.cumulativePrisonYears, pb.cumulativePrisonYears);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
        <div>
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.4em] text-dim hover:text-lamp">← Setup</Link>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.14em] md:text-5xl">AI Interrogation</h1>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl uppercase tracking-[0.12em] md:text-4xl">
            Round <span className="text-lamp">{String(displayRoundNumber).padStart(2, "0")}</span>
            <span className="text-dim"> / {String(game.totalRounds).padStart(2, "0")}</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-dim">
            Phase: <span className={displayPhase === "HISTORY_AWARE" ? "text-lamp" : "text-zinc-300"}>
              {displayPhase === "HISTORY_AWARE" ? "History-aware interrogation" : "Independent interrogation"}
            </span>
          </div>
        </div>
      </header>

      {/* Stage tracker */}
      <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.25em]">
        {["Communication", "Deliberation", "Statement"].map((s, i) => (
          <div key={s} className={`border-t-2 pt-2 ${stageIndex === i + 1 ? "border-lamp text-lamp" : stageIndex > i + 1 ? "border-zinc-600 text-zinc-400" : "border-edge text-dim"}`}>
            <span className="mr-2">0{i + 1}</span>{s}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        {caseTitle && <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">Case: {caseTitle}</div>}
        <div className="mt-1 font-display text-xl uppercase tracking-[0.2em] text-zinc-200 md:text-2xl">{banner}</div>
        {view === "locked" && <div key={countdown} className="stamp mt-2 font-display text-7xl text-lamp">{countdown}</div>}
      </div>

      {/* Suspects */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {card(pa, "A")}
        {card(pb, "B")}
      </section>

      {/* Message exchange */}
      <section className="relative mt-4 overflow-hidden border border-edge bg-panel/60 p-5">
        {view === "comm_pending" && <div className="scan absolute inset-0" />}
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">Intercepted correspondence</div>
        {messages ? (
          <div className="mt-4 space-y-4">
            {([["A", pa, messages.playerA], ["B", pb, messages.playerB]] as const).map(([slot, p, m], i) => (
              <div key={slot} className={`flex ${slot === "B" ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] md:max-w-[70%] ${view === "comm_reveal" ? "rise" : ""}`} style={{ animationDelay: `${i * 0.15}s` }}>
                  <div className={`font-display text-sm uppercase tracking-[0.2em] ${slot === "B" ? "text-right" : ""}`} style={{ color: providerColor(p.provider) }}>
                    {p.name} → {slot === "A" ? pb.name : pa.name}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap border border-edge bg-ink/70 p-4 font-mono text-sm leading-relaxed text-zinc-200" style={{ borderLeftColor: providerColor(p.provider), borderLeftWidth: 2 }}>
                    “{m.message}”
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 font-mono text-sm text-dim">
            {view === "comm_pending" ? "Messages are sealed until both suspects have written theirs." : "No messages for this case yet."}
          </p>
        )}
      </section>

      {error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-confess/50 bg-confess/10 p-4 text-sm">
          <span className="text-confess">{error} Nothing has been revealed for this stage.</span>
          <button onClick={runRound} className="border border-confess px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-confess hover:bg-confess hover:text-ink">Retry stage</button>
        </div>
      )}

      {/* Controls */}
      <section className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]">
        {game.status !== "COMPLETED" && game.status !== "RUNNING" && (
          <>
            <button onClick={() => controlAction("resume")} disabled={active || view === "locked" || view === "comm_reveal"} className="border border-lamp bg-lamp px-4 py-2 text-ink hover:brightness-110 disabled:opacity-40">
              {game.status === "READY" ? "Start experiment (auto)" : "Resume (auto)"}
            </button>
            <button onClick={runRound} disabled={active || view === "locked" || view === "comm_reveal"} className="border border-lamp px-4 py-2 text-lamp hover:bg-lamp hover:text-ink disabled:opacity-40">
              {ip ? "Continue round" : "Start next round"}
            </button>
          </>
        )}
        {game.status === "RUNNING" && (
          <button onClick={() => controlAction("pause")} disabled={game.pauseRequested} className="border border-zinc-500 px-4 py-2 text-zinc-300 hover:bg-zinc-200 hover:text-ink disabled:opacity-50">
            {game.pauseRequested ? "Pausing after this round…" : "Pause"}
          </button>
        )}
        <button onClick={restart} className="border border-edge px-4 py-2 text-dim hover:text-zinc-200">Restart</button>
        <Link href={`/game/${id}/results`} className={`border px-4 py-2 ${game.status === "COMPLETED" ? "border-lamp bg-lamp/10 text-lamp" : "border-edge text-dim hover:text-zinc-200"}`}>
          View {game.status === "COMPLETED" ? "final" : "interim"} results
        </Link>
        <span className="ml-auto text-[10px] text-dim">Status: {game.status.toLowerCase()}</span>
      </section>

      {/* Scoreboard */}
      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">Scoreboard · cumulative prison years (lower is better)</h2>
        <div className="mt-3 space-y-2">
          {[pa, pb].map((p) => (
            <div key={p.id} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 font-mono text-xs">
              <span style={{ color: providerColor(p.provider) }}>{p.name}</span>
              <div className="h-2 bg-edge">
                <div className="h-2 transition-all duration-1000" style={{ width: `${(p.cumulativePrisonYears / maxYears) * 100}%`, background: providerColor(p.provider) }} />
              </div>
              <span className="text-right">{p.cumulativePrisonYears} yrs</span>
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">Round history · click a round for the full transcript</h2>
        <HistoryTable rounds={game.rounds} players={game.players} memoryStartRound={game.memoryStartRound} />
      </section>
    </main>
  );
}
