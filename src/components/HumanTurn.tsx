"use client";

import { useEffect, useState } from "react";
import type { Action, HumanInput } from "@/lib/game/types";
import { useT } from "@/lib/i18n";

/** Visible countdown matching the limit the AI is told about. A guide only: the answer is never cut off. */
function useCountdown(seconds: number) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.floor((now - start) / 1000);
  return { left: Math.max(0, seconds - elapsed), elapsed };
}

export function HumanTurn({
  mode,
  otherName,
  limitSeconds,
  onSubmit,
}: {
  mode: "message" | "decision";
  otherName: string;
  limitSeconds: number;
  onSubmit: (input: HumanInput) => void;
}) {
  const t = useT();
  const { left, elapsed } = useCountdown(limitSeconds);
  const [message, setMessage] = useState("");
  const [thoughts, setThoughts] = useState("");
  const [leaning, setLeaning] = useState<Action | null>(null);
  const [sent, setSent] = useState(false);

  const submit = (extra: Partial<HumanInput>) => {
    if (sent) return;
    setSent(true);
    onSubmit({ thoughts: thoughts.trim() || undefined, secondsTaken: elapsed, ...extra });
  };

  const choice = (a: Action) => (
    <button
      key={a}
      type="button"
      disabled={sent}
      onClick={() => submit({ action: a })}
      className={`flex-1 border-2 px-6 py-4 font-display text-2xl uppercase tracking-[0.2em] transition disabled:opacity-40 ${
        a === "CONFESS" ? "border-confess text-confess hover:bg-confess hover:text-ink" : "border-deny text-deny hover:bg-deny hover:text-ink"
      }`}
    >
      {a === "CONFESS" ? t.confess : t.deny}
    </button>
  );

  return (
    <section className="rise mt-4 border border-lamp/60 bg-lamp/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-xl uppercase tracking-[0.15em] text-lamp">
          {mode === "message" ? t.yourTurnMessage(otherName) : t.yourTurnDecide}
        </div>
        <div className={`font-mono text-xs uppercase tracking-[0.2em] ${left === 0 ? "text-confess" : "text-dim"}`}>
          {left === 0 ? t.timeUp : t.timeLeft(left)}
        </div>
      </div>
      <p className="mt-1 text-xs text-dim">{mode === "message" ? t.messageSealedNote(otherName) : t.decideNote(otherName)}</p>

      <label className="mt-4 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">{t.yourThoughts}</label>
      <textarea
        value={thoughts}
        onChange={(e) => setThoughts(e.target.value)}
        rows={2}
        maxLength={2000}
        disabled={sent}
        placeholder={t.yourThoughtsPlaceholder}
        className="mt-1 w-full resize-y border border-edge bg-ink px-3 py-2 text-sm italic text-zinc-300 outline-none focus:border-lamp"
      />

      {mode === "message" ? (
        <>
          <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">{t.messageTo(otherName)}</label>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={sent}
            placeholder={t.messagePlaceholder}
            className="mt-1 w-full resize-y border border-edge bg-ink px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-lamp"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
            <span>{t.leaningOptional}</span>
            {(["CONFESS", "DENY"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={sent}
                aria-pressed={leaning === a}
                onClick={() => setLeaning(leaning === a ? null : a)}
                className={`border px-2 py-1 ${leaning === a ? "border-zinc-200 bg-zinc-200 text-ink" : "border-edge hover:text-zinc-200"}`}
              >
                {a === "CONFESS" ? t.confess : t.deny}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={sent || !message.trim()}
            onClick={() => submit({ message: message.trim(), leaning })}
            className="mt-4 border border-lamp bg-lamp px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-ink hover:brightness-110 disabled:opacity-40"
          >
            {t.sendMessage}
          </button>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">{(["CONFESS", "DENY"] as const).map(choice)}</div>
      )}
    </section>
  );
}
