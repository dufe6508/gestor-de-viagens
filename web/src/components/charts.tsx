"use client";

import { useEffect, useRef, useState } from "react";
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
                      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.14)",
                      opacity: dim ? 0.4 : 1,
                      filter: hover === b.label ? "brightness(1.08)" : "none",
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

export interface SparkPoint {
  label: string;
  value: number;
}

/**
 * Sparkline de tendência — 1 série, sem legenda (o título do card a nomeia).
 * Linha 2px arredondada + área sutil; linha do zero tracejada quando a série
 * cruza o negativo. Hover/touch: ponto + tooltip (mês + valor). DESIGN.md §6.
 */
export function Sparkline({
  points,
  height = 72,
  cor = "var(--progress, #46c98a)",
}: {
  points: SparkPoint[];
  height?: number;
  cor?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (points.length < 2) return null;

  const vals = points.map((p) => p.value);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  // Coordenadas em % (viewBox 0..100 nos 2 eixos, preserveAspectRatio none;
  // vector-effect mantém o traço em 2px reais).
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const y = (v: number) => ((max - v) / span) * 100;
  const linha = vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const area = `${linha} L 100 100 L 0 100 Z`;
  const cruzaZero = min < 0 && max > 0;

  const onMove = (e: React.PointerEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const frac = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
    setHover(Math.round(frac * (points.length - 1)));
  };

  const h = hover != null ? points[hover] : null;

  return (
    <div>
      <div
        ref={boxRef}
        className="relative touch-none"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          className="absolute inset-0 size-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {cruzaZero && (
            <line
              x1="0"
              x2="100"
              y1={y(0)}
              y2={y(0)}
              stroke="rgb(255 255 255 / 0.14)"
              strokeWidth={1}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path d={area} fill={cor} opacity={mounted ? 0.1 : 0} className="transition-opacity duration-700" />
          <path
            d={linha}
            fill="none"
            stroke={cor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={mounted ? 0 : 1}
            className="transition-[stroke-dashoffset] duration-700 ease-(--ease-swift) motion-reduce:transition-none"
          />
        </svg>

        {/* ponto + tooltip do hover (HTML — não distorce com o preserveAspectRatio) */}
        {h != null && hover != null && (
          <>
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
              style={{ left: `${x(hover)}%`, top: `${y(h.value)}%`, backgroundColor: cor }}
            />
            <span
              className="glass-float pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
              style={{
                left: `${x(hover)}%`,
                transform: `translateX(${hover === 0 ? "0" : hover === points.length - 1 ? "-100%" : "-50%"}) translateY(-100%)`,
              }}
            >
              <span className="capitalize text-faint">{h.label}</span>{" "}
              <span className="money text-foreground">{brl(h.value)}</span>
            </span>
          </>
        )}
      </div>
      <div className="mt-1.5 flex justify-between">
        {points.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            className={`text-[11px] capitalize ${hover === i ? "text-foreground" : "text-faint"}`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface RankRow {
  id: string;
  label: string;
  value: number;
}

/**
 * Ranking — barras horizontais com rótulo em texto e valor direto (nunca só cor).
 * Positivo = verde de progresso; negativo = destructive. Mesma linguagem: pista
 * `--secondary`, preenchimento arredondado, entrada única escalonada.
 */
export function RankBars({ rows }: { rows: RankRow[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => {
        const negativo = r.value < 0;
        const cor = negativo ? "var(--destructive)" : "var(--progress, #46c98a)";
        return (
          <li key={r.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] text-muted-foreground">{r.label}</span>
              <span
                className="money shrink-0 text-[13px] font-semibold"
                style={{ color: negativo ? "var(--destructive)" : undefined }}
              >
                {brl(r.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-(--ease-swift) motion-reduce:transition-none"
                style={{
                  width: mounted ? `${Math.max((Math.abs(r.value) / max) * 100, 2)}%` : "0%",
                  backgroundColor: cor,
                  transitionDelay: mounted ? "0ms" : `${i * 60}ms`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface FlowMonth {
  label: string;
  entrada: number;
  saida: number;
}

/**
 * Fluxo de caixa — barras pareadas entrada (verde) × saída (vermelho) por mês,
 * numa grade única. Hover/touch destaca o mês e mostra os dois valores. Barras
 * projetadas (forecast) usam `ghost` = mesma cor esmaecida + tracejado.
 */
export function FlowBars({
  months,
  height = 150,
  ghostFrom,
}: {
  months: FlowMonth[];
  height?: number;
  ghostFrom?: number; // índice a partir do qual as barras são projeção
}) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const max = Math.max(...months.flatMap((m) => [m.entrada, m.saida]), 1);
  const h = hover != null ? months[hover] : null;

  return (
    <div>
      <div className="relative flex items-end justify-between gap-2" style={{ height }}>
        {months.map((m, i) => {
          const ghost = ghostFrom != null && i >= ghostFrom;
          const dim = hover != null && hover !== i;
          return (
            <div
              key={`${m.label}-${i}`}
              className="flex h-full flex-1 items-end justify-center gap-[3px]"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <Col value={m.entrada} max={max} height={height} cor="var(--progress, #46c98a)" mounted={mounted} ghost={ghost} dim={dim} delay={i * 40} />
              <Col value={m.saida} max={max} height={height} cor="var(--destructive)" mounted={mounted} ghost={ghost} dim={dim} delay={i * 40 + 20} />
            </div>
          );
        })}

        {h != null && hover != null && (
          <div
            className="glass-float pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md px-2.5 py-1.5 text-[11px] whitespace-nowrap"
            style={{
              left: `${((hover + 0.5) / months.length) * 100}%`,
              transform: `translateX(-50%) translateY(-100%)`,
            }}
          >
            <p className="mb-0.5 capitalize text-faint">{h.label}</p>
            <p className="money text-[var(--progress,#46c98a)]">↑ {brl(h.entrada)}</p>
            <p className="money text-destructive">↓ {brl(h.saida)}</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {months.map((m, i) => (
          <span key={`${m.label}-${i}`} className={`flex-1 text-center text-[11px] capitalize ${hover === i ? "text-foreground" : "text-faint"}`}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Col({
  value,
  max,
  height,
  cor,
  mounted,
  ghost,
  dim,
  delay,
}: {
  value: number;
  max: number;
  height: number;
  cor: string;
  mounted: boolean;
  ghost: boolean;
  dim: boolean;
  delay: number;
}) {
  const pct = (value / max) * 100;
  return (
    <div
      className="w-full max-w-4 rounded-t-[4px] transition-[height,opacity] duration-600 ease-(--ease-swift) motion-reduce:transition-none"
      style={{
        height: mounted ? `${Math.max((pct / 100) * height, value > 0 ? 3 : 0)}px` : 0,
        backgroundColor: ghost ? "transparent" : cor,
        border: ghost ? `1.5px dashed ${cor}` : undefined,
        opacity: dim ? 0.4 : ghost ? 0.7 : 1,
        transitionDelay: mounted ? "0ms" : `${delay}ms`,
      }}
    />
  );
}

export interface LegendSegment {
  id: string;
  label: string;
  cor: string;
  valor: number;
  pct: number; // 0..1
}

/**
 * Barra de proporção com legenda tocável abaixo — cor nunca é o único sinal
 * (cada segmento tem rótulo + valor na legenda). Para status de parcelas,
 * formas de pagamento, origem do recurso.
 */
export function LegendBar({ segments }: { segments: LegendSegment[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const visiveis = segments.filter((s) => s.pct > 0);

  return (
    <div>
      <div className="flex h-3.5 w-full items-stretch gap-[3px]">
        {visiveis.map((s, i) => (
          <div
            key={s.id}
            className="h-full min-w-[6px] rounded-full transition-[width] duration-700 ease-(--ease-move) motion-reduce:transition-none"
            style={{
              width: mounted ? `${Math.max(s.pct * 100, 2)}%` : "0%",
              backgroundColor: s.cor,
              transitionDelay: mounted ? "0ms" : `${i * 70}ms`,
            }}
          />
        ))}
      </div>
      <ul className="mt-3.5 space-y-2">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.cor }} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{s.label}</span>
            <span className="money shrink-0 text-[13px] font-semibold text-foreground">{brl(s.valor)}</span>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-faint">
              {Math.round(s.pct * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ForecastPoint {
  label: string;
  value: number;
}

/**
 * Previsão de recebimento — barras "projetadas" (fill translúcido + topo
 * tracejado) com o valor rotulado acima de cada mês. Destaca o maior mês e
 * mostra rótulo de eixo. Altura fixa: não quebra o layout. DESIGN.md §6.
 */
export function ForecastChart({
  points,
  height = 150,
  cor = "#8b93f8",
}: {
  points: ForecastPoint[];
  height?: number;
  cor?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const max = Math.max(...points.map((p) => p.value), 1);
  const maiorIdx = points.reduce((mi, p, i, arr) => (p.value > arr[mi].value ? i : mi), 0);

  const compact = (v: number) => {
    if (v <= 0) return "";
    if (v >= 1000) {
      const k = v / 1000;
      return `${Number.isInteger(k) ? k : k.toFixed(1).replace(".", ",")}k`;
    }
    return String(Math.round(v));
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-2.5" style={{ height }}>
        {points.map((p, i) => {
          const pct = (p.value / max) * 100;
          const destaque = i === maiorIdx && p.value > 0;
          const zero = p.value <= 0;
          return (
            <div key={`${p.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              {/* valor acima da barra */}
              <span
                className={`money text-[11px] font-semibold tabular-nums transition-opacity duration-500 ${
                  zero ? "text-transparent" : destaque ? "text-foreground" : "text-faint"
                }`}
                style={{ opacity: mounted ? 1 : 0 }}
              >
                {compact(p.value)}
              </span>
              <div
                className="w-full max-w-9 rounded-t-[5px] transition-[height] duration-700 ease-(--ease-swift) motion-reduce:transition-none"
                style={{
                  height: mounted ? `${Math.max(pct, zero ? 0 : 3)}%` : 0,
                  minHeight: zero ? 2 : undefined,
                  backgroundColor: zero ? "rgb(255 255 255 / 0.05)" : `${cor}${destaque ? "" : "88"}`,
                  border: zero ? undefined : `1.5px dashed ${cor}`,
                  transitionDelay: mounted ? "0ms" : `${i * 70}ms`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2.5">
        {points.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            className={`flex-1 text-center text-[11px] capitalize ${i === maiorIdx && p.value > 0 ? "text-muted-foreground" : "text-faint"}`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
