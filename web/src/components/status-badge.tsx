// Badge de status financeiro do passageiro — identidade única, bem centrada.
// Deriva um estado fino a partir do saldo + vencimento (o view só dá 3 estados).

export type StatusKind =
  | "quitado"
  | "atrasado"
  | "vence_hoje"
  | "vence_breve"
  | "parcial"
  | "em_dia";

export function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const alvo = new Date(iso.slice(0, 10) + "T00:00:00").getTime();
  const hoje = new Date().setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / 86_400_000);
}

export function derivarStatus(p: {
  saldo: number;
  status_pagamento: string;
  proximo_vencimento: string | null;
  valor_pago: number;
}): StatusKind {
  if (p.saldo <= 0) return "quitado";
  if (p.status_pagamento === "atrasado") return "atrasado";
  const d = diasAte(p.proximo_vencimento);
  if (d === 0) return "vence_hoje";
  if (d !== null && d > 0 && d <= 5) return "vence_breve";
  if (p.valor_pago > 0) return "parcial";
  return "em_dia";
}

const STYLE: Record<StatusKind, { label: string; cls: string }> = {
  quitado: { label: "Quitado", cls: "text-success bg-success/12" },
  atrasado: { label: "Atrasado", cls: "text-destructive bg-destructive/12" },
  vence_hoje: { label: "Vence hoje", cls: "text-warning bg-warning/14" },
  vence_breve: { label: "Vence em breve", cls: "text-warning bg-warning/8" },
  parcial: { label: "Parcial", cls: "text-foreground/75 bg-white/8" },
  em_dia: { label: "Em dia", cls: "text-muted-foreground bg-white/6" },
};

export function StatusBadge({ kind, className = "" }: { kind: StatusKind; className?: string }) {
  const s = STYLE[kind];
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium leading-none whitespace-nowrap ${s.cls} ${className}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-90" aria-hidden />
      {s.label}
    </span>
  );
}
