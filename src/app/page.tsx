"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, LanguageToggle } from "@/components/ui";
import { IconPlay } from "@/components/icons";
import type { Lang, PayoffMatrix } from "@/lib/game/types";
import { LangContext, STRINGS } from "@/lib/i18n";
import { profileFor } from "@/lib/profiles";

interface ProviderInfo {
  id: string;
  label: string;
  displayName: string;
  defaultModel: string;
  models: string[];
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
      className="w-full border border-edge bg-ink/80 px-2 py-1.5 text-center text-sm tabular-nums text-tube outline-none focus:border-lamp"
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
  /** In-story name when you play one of the suspects yourself. */
  const [humanName, setHumanName] = useState("");
  const [bModel, setBModel] = useState("");
  const [rounds, setRounds] = useState(3);
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
    /* eslint-disable react-hooks/set-state-in-effect -- runs when the page is shown again (e.g. after Back):
       clear a stale "Opening case…" state and restore the viewer's saved language */
    setBusy(false);
    setError(null);
    try {
      const saved = localStorage.getItem("lang");
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
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
  /** The selected model, but only if it belongs to the provider; otherwise that provider's default. */
  const modelFor = (provider: string, chosen: string) => {
    const p = prov(provider);
    if (!p) return "";
    return p.models.includes(chosen) ? chosen : p.defaultModel;
  };
  const modelA = modelFor(aProvider, aModel);
  const modelB = modelFor(bProvider, bModel);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerA: { provider: aProvider, model: modelA, name: aProvider === "human" ? humanName : undefined },
          playerB: { provider: bProvider, model: modelB, name: bProvider === "human" ? humanName : undefined },
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
      setBusy(false);
      router.push(`/game/${data.game.gameId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const slotPanel = (slot: "A" | "B") => {
    const provider = slot === "A" ? aProvider : bProvider;
    const setProvider = slot === "A" ? setAProvider : setBProvider;
    const model = slot === "A" ? modelA : modelB;
    const setModel = slot === "A" ? setAModel : setBModel;
    const p = prov(provider);
    const isHuman = provider === "human";
    const otherProvider = slot === "A" ? bProvider : aProvider;
    const shownName = isHuman ? humanName.trim() || "…" : p?.displayName ?? "…";
    const field = "mt-1.5 w-full border border-edge bg-ink/80 px-3 py-2.5 text-sm text-tube outline-none focus:border-lamp";
    const label = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-dim";
    return (
      <section aria-label={t.room(slot)} data-lit={!!p?.available} className="room flex min-h-[460px] flex-col">
        <div className="flex justify-center pt-4">
          <div className="tube w-2/5" />
        </div>
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
          <Avatar provider={provider} name={isHuman ? humanName.trim() || "?" : p?.displayName ?? "?"} size={128} />
          <div>
            <h2 className="flex flex-wrap items-baseline justify-center gap-x-3 leading-none">
              <span className="font-plate text-lg font-semibold uppercase tracking-[0.18em] text-ink/80">{t.room(slot)}</span>
              <span className="font-display text-4xl font-extrabold uppercase tracking-wide text-ink">{shownName}</span>
            </h2>
            <p className="mt-1.5 text-sm text-ink/75">
              {t.inCustodyAs(isHuman ? humanName.trim() || "…" : provider === "mock" ? (slot === "A" ? "Morgan" : "Riley") : profileFor(provider).personaName)}
            </p>
          </div>
        </div>
        <div className="relative z-10 grid gap-4 border-t border-edge bg-ink/60 px-6 py-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`provider-${slot}`} className={label}>
              {t.provider}
            </label>
            <select
              id={`provider-${slot}`}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(prov(e.target.value)?.defaultModel ?? "");
              }}
              className={field}
            >
              {providers.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.available || (c.id === "human" && otherProvider === "human")}>
                  {c.label}
                  {c.available ? "" : ` — ${t.notConfigured}`}
                </option>
              ))}
            </select>
          </div>
          {isHuman ? (
            <div>
              <label htmlFor={`name-${slot}`} className={label}>
                {t.yourName}
              </label>
              <input id={`name-${slot}`} value={humanName} onChange={(e) => setHumanName(e.target.value)} maxLength={24} placeholder="Jerry" className={field} />
              <p className="mt-1.5 text-xs text-dim">{t.yourNameHint}</p>
            </div>
          ) : (
            <div>
              <label htmlFor={`model-${slot}`} className={label}>
                {t.modelId}
              </label>
              <select id={`model-${slot}`} value={model} onChange={(e) => setModel(e.target.value)} disabled={!p} className={field}>
                {(p?.models ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          {p && !p.available && <p className="text-xs text-confess sm:col-span-2">{t.keyMissing}</p>}
        </div>
      </section>
    );
  };

  const numField = "mt-1.5 w-full border border-edge bg-ink/80 px-3 py-2.5 tabular-nums text-tube outline-none focus:border-lamp";
  const numLabel = "flex min-h-[2.6rem] items-end text-[11px] font-semibold uppercase tracking-[0.14em] text-dim";
  return (
    <LangContext.Provider value={lang}>
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 md:px-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="font-display text-6xl font-extrabold uppercase leading-[0.9] tracking-wide text-tube md:text-8xl">{t.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-fog">{t.setupIntro}</p>
            <p className="mt-2 text-sm text-dim">{t.languageNote}</p>
          </div>
          <LanguageToggle value={lang} onChange={setLang} />
        </header>

        {/* The two interview rooms, with the case file on the partition between them */}
        <div className="mt-10 grid grid-cols-1 bg-edge lg:grid-cols-[1fr_22rem_1fr]">
          {slotPanel("A")}

          <aside className="flex flex-col gap-6 bg-ink px-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rounds" className={numLabel}>
                  {t.numRounds}
                </label>
                <input id="rounds" type="number" min={1} max={100} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className={numField} />
              </div>
              <div>
                <label htmlFor="memory" className={numLabel}>
                  {t.historyFrom}
                </label>
                <input id="memory" type="number" min={1} max={rounds + 1} value={memory} onChange={(e) => setMemory(Number(e.target.value))} className={numField} />
              </div>
            </div>
            <div>
              <h2 className="font-plate text-sm font-semibold uppercase tracking-[0.3em] text-fog">{t.sentencing}</h2>
              <div className="mt-3 grid grid-cols-[1fr_3.75rem_3.75rem] items-center gap-x-2 gap-y-2 text-sm text-fog">
                <span className="text-xs text-dim">{t.decisionPair}</span>
                <span className="text-center font-plate text-xs font-semibold text-dim">A</span>
                <span className="text-center font-plate text-xs font-semibold text-dim">B</span>
                <span>{t.bothTestifyLabel}</span>
                <PayoffInput label="A: both testify" value={payoff.bothConfessA} onChange={(v) => setPayoff((p) => ({ ...p, bothConfessA: v }))} />
                <PayoffInput label="B: both testify" value={payoff.bothConfessB} onChange={(v) => setPayoff((p) => ({ ...p, bothConfessB: v }))} />
                <span>{t.aTestifyBSilent}</span>
                <PayoffInput label="A: testifies, B is silent" value={payoff.AConfessBDenyA} onChange={(v) => setPayoff((p) => ({ ...p, AConfessBDenyA: v }))} />
                <PayoffInput label="B: is silent, A testifies" value={payoff.AConfessBDenyB} onChange={(v) => setPayoff((p) => ({ ...p, AConfessBDenyB: v }))} />
                <span>{t.aSilentBTestify}</span>
                <PayoffInput label="A: is silent, B testifies" value={payoff.ADenyBConfessA} onChange={(v) => setPayoff((p) => ({ ...p, ADenyBConfessA: v }))} />
                <PayoffInput label="B: testifies, A is silent" value={payoff.ADenyBConfessB} onChange={(v) => setPayoff((p) => ({ ...p, ADenyBConfessB: v }))} />
                <span>{t.bothSilentLabel}</span>
                <PayoffInput label="A: both silent" value={payoff.bothDenyA} onChange={(v) => setPayoff((p) => ({ ...p, bothDenyA: v }))} />
                <PayoffInput label="B: both silent" value={payoff.bothDenyB} onChange={(v) => setPayoff((p) => ({ ...p, bothDenyB: v }))} />
              </div>
            </div>
          </aside>

          {slotPanel("B")}
        </div>

        {/* The console */}
        <section className="console flex flex-wrap items-center gap-4 px-6 py-5">
          <button
            onClick={start}
            disabled={busy || !modelA || !modelB || ((aProvider === "human" || bProvider === "human") && !humanName.trim())}
            data-primary="true"
            className="console-key inline-flex h-12 items-center gap-2.5 px-7 font-display text-xl font-bold uppercase tracking-[0.08em]"
          >
            <IconPlay size={18} />
            {busy ? t.opening : t.begin}
          </button>
          {store?.onVercel && store.kind === "file" && <p className="text-sm text-confess">{t.vercelWarning}</p>}
          {error && <p className="text-sm text-confess">{error}</p>}
        </section>

        {games.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-tube">{t.previousFiles}</h2>
            <ul className="mt-4 divide-y divide-edge border-y border-edge">
              {games.map((g) => (
                <li key={g.gameId}>
                  <Link href={`/game/${g.gameId}`} className="flex flex-wrap items-center justify-between gap-2 px-1 py-3.5 text-sm hover:bg-panel">
                    <span className="text-fog">{g.players.map((p) => `${p.name} (${p.model})`).join(" vs ")}</span>
                    <span className="text-xs tabular-nums text-dim">
                      {g.status === "COMPLETED" ? t.completed : t.roundOf(Math.min(g.currentRound, g.totalRounds), g.totalRounds)} · {new Date(g.createdAt).toLocaleString()}
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
