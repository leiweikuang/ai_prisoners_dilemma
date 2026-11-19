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
      className={`console-key flex-1 border-2 px-6 py-5 font-plate text-3xl font-extrabold uppercase tracking-[0.16em] ${
        a === "CONFESS" ? "!border-confess !text-confess hover:!bg-oxblood/40" : "!border-deny !text-deny hover:!bg-deny/10"
      }`}
    >
      {a === "CONFESS" ? t.confess : t.deny}
    </button>
  );

  return (
    <section className="console rise border-t border-lamp/60 px-6 py-6" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-lamp">
          {mode === "message" ? t.yourTurnMessage(otherName) : t.yourTurnDecide}
        </h2>
        <div className={`text-sm tabular-nums ${left === 0 ? "text-confess" : "text-fog"}`}>
          {left === 0 ? t.timeUp : t.timeLeft(left)}
        </div>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-dim">{mode === "message" ? t.messageSealedNote(otherName) : t.decideNote(otherName)}</p>

      <label className="mt-5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{t.yourThoughts}</label>
      <textarea
        value={thoughts}
        onChange={(e) => setThoughts(e.target.value)}
        rows={2}
        maxLength={2000}
        disabled={sent}
        placeholder={t.yourThoughtsPlaceholder}
        className="reflection mt-1.5 w-full resize-y border border-edge bg-glass px-3 py-2 text-[15px] font-light italic outline-none focus:border-lamp"
      />

      {mode === "message" ? (
        <>
          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{t.messageTo(otherName)}</label>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={sent}
            placeholder={t.messagePlaceholder}
            className="mt-1.5 w-full resize-y border border-edge bg-ink px-3 py-2 font-mono text-[16px] text-tube outline-none focus:border-lamp"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-dim">
            <span>{t.leaningOptional}</span>
            {(["CONFESS", "DENY"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={sent}
                aria-pressed={leaning === a}
                onClick={() => setLeaning(leaning === a ? null : a)}
                data-primary={leaning === a}
                className="console-key h-8 px-3 font-plate text-xs font-semibold uppercase tracking-[0.14em]"
              >
                {a === "CONFESS" ? t.confess : t.deny}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={sent || !message.trim()}
            onClick={() => submit({ message: message.trim(), leaning })}
            data-primary="true"
            className="console-key mt-5 h-11 px-6 text-sm font-semibold"
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
