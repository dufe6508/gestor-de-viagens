"use client";

import { useEffect, useState } from "react";
import { brl } from "@/lib/format";

export interface DonutSegment {
  id: string;
  label: string;
  cor: string;
  valor: number;
  pct: number; // 0..1
}

/**
 * Donut compacto de segmentos contíguos — DESIGN.md §6 (revisado).
 * Sem gaps: as fatias se encostam formando um anel contínuo (butt caps).
 * Sweep de entrada; a fatia selecionada mantém cor cheia e as outras recuam.
 * Centro compacto (total ou categoria selecionada).
 */
export function DespesasDonut({
  segments,
  total,
  quantidade,
  selectedId,
  onSelect,
  size = 168,
  stroke = 26,
}: {
  segments: DonutSegment[];
  total: number;
  quantidade: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  size?: number;
  stroke?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const activeId = hoverId ?? selectedId;
  const focus = segments.find((s) => s.id === activeId) ?? null;

  const startAngles = segments.reduce<number[]>((acc, _s, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + segments[i - 1].pct);
    return acc;
  }, []);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(255 255 255 / 0.05)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const arc = s.pct * c;
          const dim = activeId != null && activeId !== s.id;
          return (
            <circle
              key={s.id}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.cor}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${mounted ? arc : 0} ${c}`}
              transform={`rotate(${startAngles[i] * 360} ${cx} ${cy})`}
              onClick={() => onSelect(selectedId === s.id ? null : s.id)}
              onPointerEnter={() => setHoverId(s.id)}
              onPointerLeave={() => setHoverId(null)}
              className="cursor-pointer transition-[stroke-dasharray,opacity] duration-600 ease-(--ease-move) motion-reduce:transition-none"
              style={{ opacity: dim ? 0.25 : 1, transitionDelay: mounted ? "0ms" : `${i * 55}ms` }}
            />
          );
        })}
      </svg>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className="absolute flex flex-col items-center px-6 text-center"
        aria-label="Ver total"
      >
        {focus ? (
          <>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: focus.cor }} />
              <span className="max-w-[6rem] truncate">{focus.label}</span>
            </span>
            <span className="money mt-1 text-base font-semibold tracking-tight">{brl(focus.valor)}</span>
            <span className="text-[11px] text-faint">{Math.round(focus.pct * 100)}%</span>
          </>
        ) : (
          <>
            <span className="text-[11px] tracking-wide text-faint">Total</span>
            <span className="money mt-1 text-lg font-semibold tracking-tight">{brl(total)}</span>
            <span className="text-[11px] text-faint">
              {quantidade} {quantidade === 1 ? "despesa" : "despesas"}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
