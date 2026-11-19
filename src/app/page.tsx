"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, LanguageToggle, providerColor } from "@/components/ui";
import type { Lang, PayoffMatrix } from "@/lib/game/types";
import { LangContext, STRINGS } from "@/lib/i18n";
import { profileFor } from "@/lib/profiles";

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
const DEEPSEEK_SUGGESTIONS = ["deepseek-chat", "deepseek-reasoner"];

function PayoffInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <input
      aria-label={label}
      type="number"
      min={0}
      max={100}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full border border-edge bg-ink px-2 py-1 text-center font-mono text-sm outline-none focus:border-lamp"
    />
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [store, setStore] = useState<{ kind: string; onVercel: boolean } | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [aProvider, setAProvider] = useState("deepseek");
  const [bProvider, setBProvider] = useState("anthropic");
  const [aModel, setAModel] = useState("");
  const [bModel, setBModel] = useState("");
  const [rounds, setRounds] = useState(5);
  const [memory, setMemory] = useState(1);
  const [payoff, setPayoff] = useState<PayoffMatrix>({
    bothConfessA: 5,
    bothConfessB: 5,
    AConfessBDenyA: 0,
    AConfessBDenyB: 10,
    ADenyBConfessA: 10,
    ADenyBConfessB: 0,
    bothDenyA: 1,
    bothDenyB: 1,
  });
  const [lang, setLangState] = useState<Lang>("en");
  const t = STRINGS[lang];
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-viewer preference once on mount
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {}
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        setProviders(c.providers);
        setStore({ kind: c.store, onVercel: c.onVercel });
        const find = (id: string) => c.providers.find((p: ProviderInfo) => p.id === id);
        const deepseek = find("deepseek");
        if (deepseek?.available) {
          setAProvider("deepseek");
          setAModel(deepseek.defaultModel);
        } else {
          setAProvider("openai");
          setAModel(find("openai")?.defaultModel ?? "");
        }
        setBModel(find("anthropic")?.defaultModel ?? "");
      });
    fetch("/api/games")
      .then((r) => r.json())
      .then((d) => setGames(d.games ?? []))
      .catch(() => undefined);
  }, []);

  const prov = (id: string) => providers.find((p) => p.id === id);
  const choices = (_slot: "A" | "B") => providers;

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
          language: lang,
          payoff,
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
    const suggestions = provider === "openai" ? OPENAI_SUGGESTIONS : provider === "anthropic" ? CLAUDE_SUGGESTIONS : provider === "deepseek" ? DEEPSEEK_SUGGESTIONS : [];
    return (
      <div className="relative border border-edge bg-panel/80 p-6" style={{ boxShadow: `inset 0 1px 0 ${color}33` }}>
        <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: color }} />
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">{t.suspect(slot)}</div>
        <div className="mt-2 flex items-center gap-4 font-display text-3xl uppercase tracking-wide" style={{ color }}>
          <Avatar provider={provider} name={p?.displayName ?? "?"} size={64} />
          <span>
            {p?.displayName ?? "…"}
            <span className="block font-mono text-[11px] normal-case tracking-normal text-dim">{t.inCustodyAs(provider === "mock" ? (slot === "A" ? "Morgan" : "Riley") : profileFor(provider).personaName)}</span>
          </span>
        </div>
        <label className="mt-5 block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">{t.provider}</label>
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
              {c.available ? "" : ` — ${t.notConfigured}`}
            </option>
          ))}
        </select>
        <label className="mt-4 block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">{t.modelId}</label>
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
          <p className="mt-3 text-xs text-confess">{t.keyMissing}</p>
        )}
      </div>
    );
  };

  return (
    <LangContext.Provider value={lang}>
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:py-20">
      <div className="flex justify-end">
        <LanguageToggle value={lang} onChange={setLang} />
      </div>
      <header className="mt-4 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.5em] text-lamp flicker">{t.setupKicker}</div>
        <h1 className="mt-4 font-display text-5xl uppercase tracking-[0.12em] md:text-7xl">{t.title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-dim">{t.setupIntro}</p>
        <p className="mx-auto mt-2 max-w-2xl text-xs text-zinc-600">{t.languageNote}</p>
      </header>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {slotPanel("A")}
        {slotPanel("B")}
      </section>

      <section className="mt-4 grid gap-4 border border-edge bg-panel/80 p-6 md:grid-cols-3">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">{t.numRounds}</label>
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
          <label className="block font-mono text-[11px] uppercase tracking-[0.2em] text-dim">{t.historyFrom}</label>
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
          <div className="uppercase tracking-[0.2em]">{t.sentencing}</div>
          <div className="mt-2 grid grid-cols-[1fr_4rem_4rem] gap-2 items-center">
            <span>{lang === "zh" ? "选择组合" : "Decision pair"}</span>
            <span className="text-center">A</span>
            <span className="text-center">B</span>
            <span>{lang === "zh" ? "双方告发" : "Both testify"}</span>
            <PayoffInput label="A: both testify" value={payoff.bothConfessA} onChange={(v) => setPayoff((p) => ({ ...p, bothConfessA: v }))} />
            <PayoffInput label="B: both testify" value={payoff.bothConfessB} onChange={(v) => setPayoff((p) => ({ ...p, bothConfessB: v }))} />
            <span>{lang === "zh" ? "A告发 · B沉默" : "A testify · B silent"}</span>
            <PayoffInput label="A: testifies, B is silent" value={payoff.AConfessBDenyA} onChange={(v) => setPayoff((p) => ({ ...p, AConfessBDenyA: v }))} />
            <PayoffInput label="B: is silent, A testifies" value={payoff.AConfessBDenyB} onChange={(v) => setPayoff((p) => ({ ...p, AConfessBDenyB: v }))} />
            <span>{lang === "zh" ? "A沉默 · B告发" : "A silent · B testify"}</span>
            <PayoffInput label="A: is silent, B testifies" value={payoff.ADenyBConfessA} onChange={(v) => setPayoff((p) => ({ ...p, ADenyBConfessA: v }))} />
            <PayoffInput label="B: testifies, A is silent" value={payoff.ADenyBConfessB} onChange={(v) => setPayoff((p) => ({ ...p, ADenyBConfessB: v }))} />
            <span>{lang === "zh" ? "双方沉默" : "Both silent"}</span>
            <PayoffInput label="A: both silent" value={payoff.bothDenyA} onChange={(v) => setPayoff((p) => ({ ...p, bothDenyA: v }))} />
            <PayoffInput label="B: both silent" value={payoff.bothDenyB} onChange={(v) => setPayoff((p) => ({ ...p, bothDenyB: v }))} />
          </div>
        </div>
      </section>

      {store?.onVercel && store.kind === "file" && (
        <p className="mt-4 border border-confess/50 bg-confess/10 p-3 text-sm text-confess">
          {t.vercelWarning}
        </p>
      )}
      {error && <p className="mt-4 border border-confess/50 bg-confess/10 p-3 text-sm text-confess">{error}</p>}

      <div className="mt-8 flex justify-center">
        <button
          onClick={start}
          disabled={busy || !aModel || !bModel}
          className="group relative overflow-hidden border border-lamp px-10 py-4 font-display text-xl uppercase tracking-[0.3em] text-lamp transition hover:bg-lamp hover:text-ink disabled:opacity-40"
        >
          {busy ? t.opening : t.begin}
        </button>
      </div>

      {games.length > 0 && (
        <section className="mt-16">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">{t.previousFiles}</h2>
          <ul className="mt-3 divide-y divide-edge border border-edge">
            {games.map((g) => (
              <li key={g.gameId}>
                <Link href={`/game/${g.gameId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 font-mono text-xs hover:bg-panel">
                  <span className="text-zinc-300">
                    {g.players.map((p) => `${p.name} (${p.model})`).join(" vs ")}
                  </span>
                  <span className="text-dim">
                    {g.status === "COMPLETED" ? t.completed : t.roundOf(Math.min(g.currentRound, g.totalRounds), g.totalRounds)} ·{" "}
                    {new Date(g.createdAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
    </LangContext.Provider>
  );
}
