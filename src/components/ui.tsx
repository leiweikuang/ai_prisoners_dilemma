import type { Action } from "@/lib/game/types";

export function providerColor(provider: string) {
  if (provider === "openai") return "var(--color-gpt)";
  if (provider === "anthropic") return "var(--color-claude)";
  return "#a78bfa";
}

export function ActionBadge({ action, big = false, animate = false }: { action: Action; big?: boolean; animate?: boolean }) {
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
      {action}
    </span>
  );
}

export function Years({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={className}>
      {n} <span className="text-dim text-[0.6em] uppercase tracking-widest">{n === 1 ? "year" : "years"}</span>
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
export function Thoughts({ text, label, color, trimmed = false, animate = false, delay = 0 }: { text: string | null | undefined; label: string; color: string; trimmed?: boolean; animate?: boolean; delay?: number }) {
  return (
    <div className={animate ? "rise" : ""} style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
        {label}
        {trimmed && <span className="normal-case tracking-normal text-zinc-600">(trimmed to word limit · full text in audit log)</span>}
      </div>
      {text ? (
        <p className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap border-l border-dashed border-zinc-700 pl-3 text-[13px] italic leading-relaxed text-zinc-400">
          {text}
        </p>
      ) : (
        <p className="mt-1.5 border-l border-dashed border-zinc-800 pl-3 text-xs italic text-zinc-600">No reasoning summary returned for this response.</p>
      )}
    </div>
  );
}
