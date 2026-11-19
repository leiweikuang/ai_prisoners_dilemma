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
  // A thin identity ring and a real (offset, blurred) shadow; no coloured halo.
  const style = { width: size, height: size, boxShadow: `0 0 0 ${size >= 96 ? 3 : 2}px ${p.color}, 0 ${size / 12}px ${size / 5}px rgba(0,0,0,.55)` };
  if (!p.avatar)
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-room font-display font-bold text-fog ${className}`}
        style={{ ...style, fontSize: size / 2.4 }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.avatar} alt={name} width={size} height={size} className={`shrink-0 rounded-full bg-room object-cover ${className}`} style={style} />;
}

/**
 * The decision. Large: a rubber stamp struck onto the glass (oxblood for
 * TESTIFY, glass-white for SILENT). Small: a filed tag in a table or log.
 */
export function ActionBadge({ action, big = false, animate = false }: { action: Action; big?: boolean; animate?: boolean }) {
  const t = useT();
  const confess = action === "CONFESS";
  const color = confess ? "var(--color-confess)" : "var(--color-deny)";
  if (big)
    return (
      <span
        className={`inline-block -rotate-[5deg] border-[3px] px-5 py-1 font-plate text-5xl font-extrabold uppercase leading-none tracking-[0.12em] md:text-6xl ${animate ? "stamp" : ""}`}
        style={{ color, borderColor: color, outline: `1px solid ${color}`, outlineOffset: "3px", mixBlendMode: "screen" }}
      >
        {confess ? t.confess : t.deny}
      </span>
    );
  return (
    <span className="inline-block border px-1.5 py-px font-plate text-[11px] font-semibold uppercase leading-tight tracking-[0.14em]" style={{ color, borderColor: color }}>
      {confess ? t.confess : t.deny}
    </span>
  );
}

export function Years({ n, className = "" }: { n: number; className?: string }) {
  const t = useT();
  return (
    <span className={className}>
      {n}
      <span className="ml-1 text-[0.45em] font-semibold uppercase tracking-[0.12em] text-dim">{t.yearUnit(n)}</span>
    </span>
  );
}

/** Someone is working: an amber signal and the label. */
export function Thinking({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-sm text-lamp">
      <span className="pulse-ring relative inline-block h-2 w-2 rounded-full bg-lamp text-lamp" />
      {label}
      <span aria-hidden>
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

/** Words on the glass: the reflection only the viewer can see. */
export function Thoughts({ text, label, color, trimmed = false, translatedFrom, animate = false, delay = 0 }: { text: string | null | undefined; label: string; color: string; trimmed?: boolean; translatedFrom?: Lang; animate?: boolean; delay?: number }) {
  const t = useT();
  return (
    <div className={animate ? "condense" : ""} style={{ animationDelay: `${delay}s` }}>
      {label && (
        <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
          <span className="inline-block h-px w-4 self-center" style={{ background: color }} />
          {label}
          {translatedFrom && <span className="font-normal normal-case tracking-normal text-dim/70">{t.translatedFrom(translatedFrom)}</span>}
          {trimmed && <span className="font-normal normal-case tracking-normal text-dim/70">{t.trimmed}</span>}
        </div>
      )}
      {text ? (
        <p className="reflection mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-[15px] font-light italic leading-relaxed">{text}</p>
      ) : (
        <p className="mt-2 text-sm italic text-dim/70">{t.noSummary}</p>
      )}
    </div>
  );
}

/** EN / 中文 as two console keys. */
export function LanguageToggle({ value, onChange, disabled = false, title }: { value: Lang; onChange: (l: Lang) => void; disabled?: boolean; title?: string }) {
  return (
    <div className="inline-flex gap-1" title={title} role="group" aria-label="Language">
      {(["en", "zh"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={disabled}
          aria-pressed={value === l}
          data-primary={value === l}
          onClick={() => value !== l && onChange(l)}
          className="console-key h-9 min-w-12 px-3 font-display text-sm font-bold tracking-[0.1em]"
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
  entry: { writtenThoughts?: string; thoughts?: string | null; thoughtsTrimmed?: boolean; thoughtsTranslatedFrom?: Lang; thoughtsHidden?: boolean; monologueFallback?: boolean };
  label: string;
  color: string;
  animate?: boolean;
}) {
  const t = useT();
  if (entry.thoughtsHidden)
    return (
      <div className={animate ? "rise" : ""}>
        <div className="flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
          <span className="inline-block h-px w-4 self-center" style={{ background: color }} />
          {label}
        </div>
        <p className="mt-2 text-sm italic text-dim/80">{t.hiddenUntilEnd}</p>
      </div>
    );
  if (!entry.writtenThoughts)
    return <Thoughts text={entry.thoughts} label={label} color={color} trimmed={entry.thoughtsTrimmed} translatedFrom={entry.thoughtsTranslatedFrom} animate={animate} />;
  return (
    <div className={animate ? "rise" : ""}>
      <Thoughts text={entry.writtenThoughts} label={label} color={color} />
      {entry.monologueFallback && <p className="mt-1.5 text-xs text-dim/80">{t.fromSummary}</p>}
      {entry.thoughts && (
        <details className="mt-3">
          <summary className="group/s inline-flex cursor-pointer items-center gap-1.5 text-xs text-dim hover:text-fog">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="transition-transform [details[open]>summary>&]:rotate-90">
              <path d="M9 5l7 7-7 7" />
            </svg>
            {t.providerSummary}
          </summary>
          <div className="mt-1.5">
            <Thoughts text={entry.thoughts} label="" color={color} trimmed={entry.thoughtsTrimmed} translatedFrom={entry.thoughtsTranslatedFrom} />
          </div>
        </details>
      )}
    </div>
  );
}
