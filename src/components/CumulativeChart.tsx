"use client";

import { useState } from "react";
import type { PlayerState, RoundResult } from "@/lib/game/types";
import { useT } from "@/lib/i18n";
import { providerColor } from "./ui";

/** Cumulative prison years per round; dashed rule marks where history is introduced. */
export function CumulativeChart({ rounds, players, memoryStartRound }: { rounds: RoundResult[]; players: PlayerState[]; memoryStartRound: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const t = useT();
  const W = 720, H = 300, L = 44, R = 96, T = 16, B = 34;
  const n = rounds.length;
  if (n === 0) return <p className="font-mono text-xs text-dim">No data yet.</p>;
  const maxY = Math.max(10, ...rounds.map((r) => Math.max(r.cumulativeAfter.playerA, r.cumulativeAfter.playerB)));
  const niceMax = Math.ceil(maxY / 10) * 10;
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / niceMax) * (H - T - B);
  const sameColor = providerColor(players[0].provider) === providerColor(players[1].provider);
  const series = (["playerA", "playerB"] as const).map((k, idx) => ({
    k,
    p: players[idx],
    color: sameColor ? (idx === 0 ? "var(--color-gpt)" : "var(--color-claude)") : providerColor(players[idx].provider),
    pts: rounds.map((r, i) => [x(i), y(r.cumulativeAfter[k])] as const),
  }));
  const ticks = Array.from({ length: 5 }, (_, i) => (niceMax / 4) * i);
  const memIdx = rounds.findIndex((r) => r.roundNumber === memoryStartRound);
  const last = rounds[n - 1];
  // Keep end labels from colliding.
  let ya = y(last.cumulativeAfter.playerA), yb = y(last.cumulativeAfter.playerB);
  if (Math.abs(ya - yb) < 16) {
    const mid = (ya + yb) / 2;
    if (ya <= yb) { ya = mid - 8; yb = mid + 8; } else { ya = mid + 8; yb = mid - 8; }
  }
  const labelY = [ya, yb];

  return (
    <div className="relative">
      <div className="mb-2 flex gap-4 font-mono text-[11px] text-zinc-300">
        {series.map((s) => (
          <span key={s.k} className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.p.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t.chartLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#1c2029" strokeWidth={1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#7b8494" fontFamily="var(--font-plex-mono)">{t}</text>
          </g>
        ))}
        {rounds.map((r, i) => (n <= 20 || i % 2 === 0) && (
          <text key={r.roundNumber} x={x(i)} y={H - B + 18} textAnchor="middle" fontSize={11} fill="#7b8494" fontFamily="var(--font-plex-mono)">{r.roundNumber}</text>
        ))}
        {memIdx > 0 && (
          <g>
            <line x1={(x(memIdx) + x(memIdx - 1)) / 2} x2={(x(memIdx) + x(memIdx - 1)) / 2} y1={T} y2={H - B} stroke="#f2b84b" strokeOpacity={0.6} strokeDasharray="4 4" />
            <text x={(x(memIdx) + x(memIdx - 1)) / 2 + 6} y={T + 10} fontSize={10} fill="#f2b84b" fontFamily="var(--font-plex-mono)">{t.historyArrow}</text>
          </g>
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#7b8494" strokeOpacity={0.5} />}
        {series.map((s, si) => (
          <g key={s.k}>
            <polyline points={s.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            {hover !== null && <circle cx={s.pts[hover][0]} cy={s.pts[hover][1]} r={4.5} fill={s.color} stroke="#0d0f14" strokeWidth={2} />}
            <text x={W - R + 8} y={labelY[si] + 4} fontSize={11} fill="#e8eaef" fontFamily="var(--font-plex-mono)">
              {s.p.name} {last.cumulativeAfter[s.k]}
            </text>
          </g>
        ))}
        {rounds.map((r, i) => (
          <rect key={r.roundNumber} x={x(i) - (W - L - R) / Math.max(n - 1, 1) / 2} y={T} width={(W - L - R) / Math.max(n - 1, 1)} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-8 border border-edge bg-ink/95 px-3 py-2 font-mono text-[11px]" style={{ left: `${Math.min((x(hover) / W) * 100, 70)}%` }}>
          <div className="text-dim">{t.roundN(rounds[hover].roundNumber)}</div>
          {series.map((s) => (
            <div key={s.k} className="flex items-center gap-2 text-zinc-200">
              <span className="inline-block h-2 w-2" style={{ background: s.color }} />
              {s.p.name}: {rounds[hover].cumulativeAfter[s.k]} {t.yrs} ({rounds[hover].decisions[s.k].action === "CONFESS" ? t.confessShort : t.denyShort})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
