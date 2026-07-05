"use client";

import { useEffect, useState } from "react";

/*
 * Linguagem única de gráfico — DESIGN.md §6.
 * Traço arredondado, cor via token (nunca gradiente hardcoded),
 * uma animação de entrada, motion-reduce respeitado.
 */

/** Donut de progresso: quanto já foi recebido do total a receber. */
export function DonutProgress({
  recebido,
  total,
  size = 148,
  stroke = 14,
}: {
  recebido: number;
  total: number;
  size?: number;
  stroke?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const pct = total > 0 ? Math.min(recebido / total, 1) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = mounted ? c * (1 - pct) : c;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-600 ease-(--ease-swift) motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {Math.round(pct * 100)}%
        </span>
        <span className="text-xs text-faint">recebido</span>
      </div>
    </div>
  );
}

export interface ProportionSegment {
  id: string;
  label: string;
  cor: string;
  pct: number; // 0..1
}

/**
 * Barra de proporção empilhada — DESIGN.md §6 (revisado).
 * Substitui o donut genérico. Segmentos pill com gaps, crescem na entrada,
 * o selecionado destaca e os outros recuam. Editorial (estilo Stripe/Linear).
 */
export function ProportionBar({
  segments,
  selectedId,
  onSelect,
}: {
  segments: ProportionSegment[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="flex h-4 w-full items-stretch gap-[3px]">
      {segments.map((s, i) => {
        const dim = selectedId != null && selectedId !== s.id;
        const active = selectedId === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(active ? null : s.id)}
            aria-label={`${s.label} — ${Math.round(s.pct * 100)}%`}
            className="group relative h-full min-w-[6px] overflow-hidden rounded-full transition-[width,opacity,transform] duration-700 ease-(--ease-move) motion-reduce:transition-none"
            style={{
              width: mounted ? `${Math.max(s.pct * 100, 2)}%` : "0%",
              backgroundColor: s.cor,
              opacity: dim ? 0.3 : 1,
              transform: active ? "scaleY(1.35)" : "scaleY(1)",
              transitionDelay: mounted ? "0ms" : `${i * 70}ms`,
            }}
          >
            <span className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
          </button>
        );
      })}
    </div>
  );
}

export interface BarPoint {
  label: string;
  value: number;
}

/** Barras verticais — mesma linguagem em qualquer tela (evolução, comparativos). */
export function Bars({ points, height = 64 }: { points: BarPoint[]; height?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="flex items-end justify-between gap-2">
      {points.map((p, i) => (
        <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full max-w-10 items-end justify-center" style={{ height }}>
            <div
              className="w-full rounded-t-[6px] bg-primary/80 transition-[height] duration-600 ease-(--ease-swift) motion-reduce:transition-none"
              style={{
                height: mounted ? Math.max((p.value / max) * height, 4) : 0,
                transitionDelay: `${i * 40}ms`,
              }}
            />
          </div>
          <span className="truncate text-xs capitalize text-faint">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
