"use client";

import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

/*
 * Card inteligente de indicador — número + contexto (Δ% vs período anterior),
 * nunca só o dado bruto (plano §3.4/§5). Cor jamais é o único sinal: o Δ leva
 * seta + texto; tons seguem a semântica do app (positivo/negativo/alerta).
 */
export interface KpiDelta {
  pct: number; // variação relativa (0.2 = +20%)
  melhorSubir?: boolean; // false p/ métricas onde subir é ruim (ex.: despesas)
}

export function KpiCard({
  label,
  valor,
  hint,
  delta,
  tone = "neutro",
  icon: Icon,
  dense = false,
}: {
  label: string;
  valor: string;
  hint?: string;
  delta?: KpiDelta | null;
  tone?: "neutro" | "positivo" | "negativo" | "alerta";
  icon?: LucideIcon;
  dense?: boolean; // 3-up: fonte/padding menores p/ o valor caber
}) {
  const corValor =
    tone === "negativo"
      ? "text-destructive"
      : tone === "alerta"
        ? "text-warning"
        : tone === "positivo"
          ? "text-[var(--progress,#46c98a)]"
          : "text-foreground";

  return (
    <div className={`glass-card glass-card-softer rounded-lg ${dense ? "p-3" : "p-4"}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />}
        <p className="truncate text-xs text-faint">{label}</p>
      </div>
      <p
        className={`money mt-1.5 font-semibold leading-tight ${corValor} ${
          dense ? "text-[0.9375rem] tracking-tight" : "text-xl"
        }`}
      >
        {valor}
      </p>
      {(delta != null || hint) && (
        <div className="mt-1.5 flex items-center gap-2">
          {delta != null && <DeltaBadge delta={delta} />}
          {hint && <p className="min-w-0 truncate text-[11px] text-faint">{hint}</p>}
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: KpiDelta }) {
  const subiu = delta.pct >= 0;
  const bom = subiu === (delta.melhorSubir ?? true);
  const Seta = subiu ? TrendingUp : TrendingDown;
  const cor = bom ? "text-[var(--progress,#46c98a)]" : "text-destructive";
  const pct = Math.round(Math.abs(delta.pct) * 100);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold ${cor}`}>
      <Seta className="size-3" strokeWidth={2.25} aria-hidden />
      {subiu ? "+" : "−"}
      {pct}%
    </span>
  );
}
