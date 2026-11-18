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
