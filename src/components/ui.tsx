"use client";

import type { Action, Lang } from "@/lib/game/types";
import { useT } from "@/lib/i18n";
import { profileFor } from "@/lib/profiles";

export function providerColor(provider: string) {
  return profileFor(provider).color;
}

/** Circular profile picture for a model; initials when no picture exists. */
export function Avatar({ provider, name, size = 40, className = "" }: { provider: string; name: string; size?: number; className?: string }) {
  const p = profileFor(provider);
  const style = { width: size, height: size, boxShadow: `0 0 0 2px ${p.color}, 0 0 ${size / 3}px ${p.color}55` };
  if (!p.avatar)
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-display text-zinc-300 ${className}`} style={{ ...style, fontSize: size / 2.6 }}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.avatar} alt={name} width={size} height={size} className={`shrink-0 rounded-full bg-ink object-cover ${className}`} style={style} />;
}

export function ActionBadge({ action, big = false, animate = false }: { action: Action; big?: boolean; animate?: boolean }) {
  const t = useT();
  const confess = action === "CONFESS";
  return (
    <span
      className={`inline-block font-display uppercase tracking-[0.18em] border-2 ${animate ? "stamp" : ""} ${
        big ? "text-3xl md:text-5xl px-4 py-1.5" : "text-xs px-2 py-0.5 border"
      }`}
      style={{
        color: confess ? "var(--color-confess)" : "var(--color-deny)",
        borderColor: confess ? "var(--color-confess)" : "var(--color-deny)",
        textShadow: big ? `0 0 24px ${confess ? "rgba(240,82,79,.45)" : "rgba(90,162,255,.45)"}` : undefined,
      }}
    >
      {confess ? t.confess : t.deny}
    </span>
  );
}

export function Years({ n, className = "" }: { n: number; className?: string }) {
  const t = useT();
  return (
    <span className={className}>
      {n} <span className="text-dim text-[0.6em] uppercase tracking-widest">{t.yearUnit(n)}</span>
    </span>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-lamp font-mono text-xs uppercase tracking-[0.2em]">
      <span className="relative inline-block h-2 w-2 rounded-full bg-lamp pulse-ring text-lamp" />
      {label}
      <span>
        <span className="dot">.</span>
        <span className="dot">.</span>
        <span className="dot">.</span>
      </span>
    </span>
  );
}

export function pct(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

/** Provider reasoning summary. Shown to spectators only — never to the other suspect. */
export function Thoughts({ text, label, color, trimmed = false, translatedFrom, animate = false, delay = 0 }: { text: string | null | undefined; label: string; color: string; trimmed?: boolean; translatedFrom?: Lang; animate?: boolean; delay?: number }) {
  const t = useT();
  return (
    <div className={animate ? "rise" : ""} style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
        {label}
        {translatedFrom && <span className="normal-case tracking-normal text-zinc-600">{t.translatedFrom(translatedFrom)}</span>}
        {trimmed && <span className="normal-case tracking-normal text-zinc-600">{t.trimmed}</span>}
      </div>
      {text ? (
        <p className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap border-l border-dashed border-zinc-700 pl-3 text-[13px] italic leading-relaxed text-zinc-400">
          {text}
        </p>
      ) : (
        <p className="mt-1.5 border-l border-dashed border-zinc-800 pl-3 text-xs italic text-zinc-600">{t.noSummary}</p>
      )}
    </div>
  );
}

/** EN / 中文 segmented switch. */
export function LanguageToggle({ value, onChange, disabled = false, title }: { value: Lang; onChange: (l: Lang) => void; disabled?: boolean; title?: string }) {
  return (
    <div className={`inline-flex border border-edge font-mono text-xs ${disabled ? "opacity-40" : ""}`} title={title} role="group">
      {(["en", "zh"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={disabled}
          aria-pressed={value === l}
          onClick={() => value !== l && onChange(l)}
          className={`px-3 py-2 tracking-[0.15em] ${value === l ? "bg-zinc-200 text-ink" : "text-dim hover:text-zinc-200"} disabled:cursor-not-allowed`}
        >
          {l === "en" ? "EN" : "中文"}
        </button>
      ))}
    </div>
  );
}

/**
 * A suspect's thoughts at one point in the round: its own written private
 * thoughts (always present on new rounds), plus the provider's reasoning
 * summary when one was returned (shown collapsed underneath).
 */
export function ThoughtBlock({
  entry,
  label,
  color,
  animate = false,
}: {
  entry: { writtenThoughts?: string; thoughts?: string | null; thoughtsTrimmed?: boolean; thoughtsTranslatedFrom?: Lang; thoughtsHidden?: boolean };
  label: string;
  color: string;
  animate?: boolean;
}) {
  const t = useT();
  if (entry.thoughtsHidden)
    return (
      <div className={animate ? "rise" : ""}>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
          {label}
        </div>
        <p className="mt-1.5 border-l border-dashed border-zinc-800 pl-3 text-xs italic text-zinc-600">{t.hiddenUntilEnd}</p>
      </div>
    );
  if (!entry.writtenThoughts)
    return <Thoughts text={entry.thoughts} label={label} color={color} trimmed={entry.thoughtsTrimmed} translatedFrom={entry.thoughtsTranslatedFrom} animate={animate} />;
  return (
    <div className={animate ? "rise" : ""}>
      <Thoughts text={entry.writtenThoughts} label={label} color={color} />
      {entry.thoughts && (
        <details className="mt-2 pl-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 hover:text-dim">{t.providerSummary}</summary>
          <div className="mt-1.5">
            <Thoughts text={entry.thoughts} label="" color={color} trimmed={entry.thoughtsTrimmed} translatedFrom={entry.thoughtsTranslatedFrom} />
          </div>
        </details>
      )}
    </div>
  );
}
