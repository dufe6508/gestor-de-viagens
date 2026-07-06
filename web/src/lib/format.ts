export function brl(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Moeda sem centavos — para números grandes de destaque (KPIs), onde os
// centavos só ocupam espaço. Ex.: 10690.5 → "R$ 10.691".
export function brl0(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
