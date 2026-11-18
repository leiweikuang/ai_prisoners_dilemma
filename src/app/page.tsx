"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { providerColor } from "@/components/ui";

interface ProviderInfo {
  id: string;
  label: string;
  displayName: string;
  defaultModel: string;
  available: boolean;
}
interface GameSummary {
  gameId: string;
  createdAt: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  players: { name: string; model: string }[];
}

const OPENAI_SUGGESTIONS = ["gpt-5", "gpt-5-mini", "gpt-4.1"];
const CLAUDE_SUGGESTIONS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"];

export default function SetupPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [store, setStore] = useState<{ kind: string; onVercel: boolean } | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [aProvider, setAProvider] = useState("openai");
  const [bProvider, setBProvider] = useState("anthropic");
  const [aModel, setAModel] = useState("");
  const [bModel, setBModel] = useState("");
  const [rounds, setRounds] = useState(20);
  const [memory, setMemory] = useState(11);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        setProviders(c.providers);
        setStore({ kind: c.store, onVercel: c.onVercel });
        const find = (id: string) => c.providers.find((p: ProviderInfo) => p.id === id);
        setAModel(find("openai")?.defaultModel ?? "");
        setBModel(find("anthropic")?.defaultModel ?? "");
      });
    fetch("/api/games")
      .then((r) => r.json())
      .then((d) => setGames(d.games ?? []))
      .catch(() => undefined);
  }, []);

  const prov = (id: string) => providers.find((p) => p.id === id);
  const choices = (slot: "A" | "B") => providers.filter((p) => p.id === (slot === "A" ? "openai" : "anthropic") || p.id === "mock");

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerA: { provider: aProvider, model: aModel },
          playerB: { provider: bProvider, model: bModel },
          totalRounds: rounds,
          memoryStartRound: memory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      try {
        localStorage.setItem("lastGameId", data.game.gameId);
      } catch {}
      router.push(`/game/${data.game.gameId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const slotPanel = (slot: "A" | "B") => {
    const provider = slot === "A" ? aProvider : bProvider;
    const setProvider = slot === "A" ? setAProvider : setBProvider;
    const model = slot === "A" ? aModel : bModel;
    const setModel = slot === "A" ? setAModel : setBModel;
    const p = prov(provider);
    const color = providerColor(provider);
    const suggestions = provider === "openai" ? OPENAI_SUGGESTIONS : provider === "anthropic" ? CLAUDE_SUGGESTIONS : [];
    return (
      <div className="relative border border-edge bg-panel/80 p-6" style={{ boxShadow: `inset 0 1px 0 ${color}33` }}>
        <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: color }} />
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">Suspect {slot}</div>
        <div className="mt-1 font-display text-3xl uppercase tracking-wide" style={{ color }}>
          {p?.displayName ?? "…"}
        </div>
        <label className="mt-5 block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Provider</label>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setModel(prov(e.target.value)?.defaultModel ?? "");
          }}
          className="mt-1 w-full border border-edge bg-ink px-3 py-2 font-mono text-sm outline-none focus:border-lamp"
        >
          {choices(slot).map((c) => (
            <option key={c.id} value={c.id} disabled={!c.available}>
              {c.label}
              {c.available ? "" : " — not configured"}
            </option>
          ))}
        </select>
        <label className="mt-4 block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Model identifier</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          list={`models-${slot}`}
          className="mt-1 w-full border border-edge bg-ink px-3 py-2 font-mono text-sm outline-none focus:border-lamp"
        />
        <datalist id={`models-${slot}`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {p && !p.available && (
          <p className="mt-3 text-xs text-confess">API key missing on the server. Set it in your environment.</p>
        )}
      </div>
    );
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:py-20">
      <header className="text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.5em] text-lamp flicker">Case file · Interview room 3</div>
        <h1 className="mt-4 font-display text-5xl uppercase tracking-[0.12em] md:text-7xl">AI Interrogation</h1>
        <p className="mx-auto mt-5 max-w-2xl text-dim">
          Two AI models play suspects arrested for the same crime. They may each send the other one message — then
          they are questioned separately and must choose: <span className="text-confess">confess</span> or{" "}
          <span className="text-deny">deny</span>. They are never told it is a game.
        </p>
      </header>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {slotPanel("A")}
        {slotPanel("B")}
      </section>

      <section className="mt-4 grid gap-4 border border-edge bg-panel/80 p-6 md:grid-cols-3">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Number of cases (rounds)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            className="mt-1 w-full border border-edge bg-ink px-3 py-2 font-mono outline-none focus:border-lamp"
          />
        </div>
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">History introduced at round</label>
          <input
            type="number"
            min={1}
            max={rounds + 1}
            value={memory}
            onChange={(e) => setMemory(Number(e.target.value))}
            className="mt-1 w-full border border-edge bg-ink px-3 py-2 font-mono outline-none focus:border-lamp"
          />
        </div>
        <div className="font-mono text-xs leading-relaxed text-dim">
          <div className="uppercase tracking-[0.2em]">Sentencing (fixed)</div>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
            <span>both confess</span><span className="text-zinc-300">5 / 5 yrs</span>
            <span>both deny</span><span className="text-zinc-300">1 / 1 yr</span>
            <span>one confesses</span><span className="text-zinc-300">0 / 10 yrs</span>
          </div>
        </div>
      </section>

      {store?.onVercel && store.kind === "file" && (
        <p className="mt-4 border border-confess/50 bg-confess/10 p-3 text-sm text-confess">
          Running on Vercel without Supabase: game state will not persist reliably. Set SUPABASE_URL and
          SUPABASE_SERVICE_ROLE_KEY.
        </p>
      )}
      {error && <p className="mt-4 border border-confess/50 bg-confess/10 p-3 text-sm text-confess">{error}</p>}

      <div className="mt-8 flex justify-center">
        <button
          onClick={start}
          disabled={busy || !aModel || !bModel}
          className="group relative overflow-hidden border border-lamp px-10 py-4 font-display text-xl uppercase tracking-[0.3em] text-lamp transition hover:bg-lamp hover:text-ink disabled:opacity-40"
        >
          {busy ? "Opening case…" : "Begin interrogation"}
        </button>
      </div>

      {games.length > 0 && (
        <section className="mt-16">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">Previous case files</h2>
          <ul className="mt-3 divide-y divide-edge border border-edge">
            {games.map((g) => (
              <li key={g.gameId}>
                <Link href={`/game/${g.gameId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 font-mono text-xs hover:bg-panel">
                  <span className="text-zinc-300">
                    {g.players.map((p) => `${p.name} (${p.model})`).join(" vs ")}
                  </span>
                  <span className="text-dim">
                    {g.status === "COMPLETED" ? "completed" : `round ${Math.min(g.currentRound, g.totalRounds)}/${g.totalRounds}`} ·{" "}
                    {new Date(g.createdAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
