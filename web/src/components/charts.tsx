"use client";

import { useEffect, useState } from "react";
import { brl } from "@/lib/format";

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
        <defs>
          <linearGradient id="progress-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f9df5" />
            <stop offset="100%" stopColor="#46c98a" />
          </linearGradient>
        </defs>
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
          stroke="url(#progress-arc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-600 ease-(--ease-swift) motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
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

export interface OverviewBar {
  label: string;
  value: number;
  cor: string;
}

/** Arredonda p/ um teto "bonito" (1/2/5 × 10ⁿ) — dá folga acima da maior barra. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * pow;
}

/** Rótulo de eixo compacto: 12000 → "12k", 3500 → "3.5k". */
function shortNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) {
    const k = v / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(Math.round(v));
}

/**
 * Visão geral — gráfico de barras premium: eixo Y com grade tracejada, barras
 * com gradiente + glow na própria cor, valor rotulado no topo, hover destaca.
 * Alinhado num grid (ticks 0→teto em 4 divisões) p/ proporções consistentes.
 */
export function OverviewBars({ bars, height = 190 }: { bars: OverviewBar[]; height?: number }) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const rawMax = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  const top = niceCeil(rawMax);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top * i) / 4); // ascendente

  return (
    <div>
      <div className="flex gap-2.5">
        {/* Eixo Y — rótulos alinhados às linhas de grade */}
        <div
          className="flex w-7 shrink-0 flex-col-reverse justify-between text-right"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span key={t} className="text-[10px] leading-none tabular-nums text-faint">
              {shortNum(t)}
            </span>
          ))}
        </div>

        {/* Área do plot */}
        <div className="relative flex-1" style={{ height }}>
          {/* Grade tracejada */}
          {ticks.map((t, i) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-dashed"
              style={{
                bottom: `${(t / top) * 100}%`,
                borderColor: i === 0 ? "rgb(255 255 255 / 0.14)" : "rgb(255 255 255 / 0.06)",
              }}
            />
          ))}

          {/* Barras */}
          <div className="absolute inset-0 flex items-end justify-between gap-3">
            {bars.map((b, i) => {
              const pct = (Math.abs(b.value) / top) * 100;
              const dim = hover != null && hover !== b.label;
              return (
                <div
                  key={b.label}
                  className="relative flex h-full flex-1 items-end justify-center"
                  onPointerEnter={() => setHover(b.label)}
                  onPointerLeave={() => setHover(null)}
                >
                  <div
                    className="relative w-[62%] max-w-11 transition-[height,opacity,filter] duration-700 ease-(--ease-swift) motion-reduce:transition-none"
                    style={{
                      height: mounted ? `${Math.max(pct, 1.5)}%` : "0%",
                      minHeight: 6,
                      borderRadius: "16px 16px 4px 4px",
                      backgroundImage: `linear-gradient(180deg, ${b.cor}, ${b.cor}c0)`,
                      boxShadow: `0 0 10px -6px ${b.cor}55, inset 0 1px 0 rgb(255 255 255 / 0.16)`,
                      opacity: dim ? 0.4 : 1,
                      filter: hover === b.label ? "brightness(1.12)" : "none",
                      transitionDelay: mounted ? "0ms" : `${i * 80}ms`,
                    }}
                  >
                    <span
                      className="money absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap tabular-nums"
                      style={{ color: b.cor }}
                    >
                      {brl(b.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rótulos X — alinhados sob as barras (offset do eixo Y) */}
      <div className="mt-2.5 flex gap-2.5">
        <div className="w-7 shrink-0" />
        <div className="flex flex-1 justify-between gap-3">
          {bars.map((b) => (
            <span
              key={b.label}
              className="flex-1 truncate text-center text-[11px] text-faint"
              style={{ color: hover === b.label ? b.cor : undefined }}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
