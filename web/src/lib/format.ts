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

// Moeda compacta — rótulos apertados (barras de gráfico). Milhares viram "k".
// Ex.: 115450 → "R$ 115,5k" · -1100 → "-R$ 1,1k" · 850 → "R$ 850".
export function brlCompact(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  const a = Math.abs(n);
  if (a < 1000) return brl0(n);
  const sinal = n < 0 ? "-" : "";
  const k = (a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${sinal}R$ ${k}k`;
}
