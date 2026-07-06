// Métricas de relatórios — FUNÇÕES PURAS, sem I/O (testáveis com vitest, padrão parcelas.ts).
// Dicionário oficial de fórmulas: docs/superpowers/plans/2026-07-06-relatorios-bi.md §3.
// Regra travada (2026-07-06): lucro = saldo_caixa = recebido − despesas (nunca "a receber").

export type PeriodoPreset = "este_mes" | "3_meses" | "este_ano" | "tudo";

export const PERIODOS: { id: PeriodoPreset; label: string }[] = [
  { id: "este_mes", label: "Este mês" },
  { id: "3_meses", label: "Últimos 3 meses" },
  { id: "este_ano", label: "Este ano" },
  { id: "tudo", label: "Tudo" },
];

// Intervalo inclusivo de datas ISO (yyyy-mm-dd); null = sem limite.
export interface Range {
  de: string | null;
  ate: string | null;
}

// atual + período anterior de mesmo tamanho (base dos Δ%); anterior null em "tudo".
export interface Ranges {
  atual: Range;
  anterior: Range | null;
}

export interface Movimento {
  valor: number;
  data: string | null;
}

// ---- Aritmética de datas (sobre strings ISO, sem fuso) ----

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function diasNoMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // dia 0 do mês seguinte (m é 1-based)
}

// ISO em (ano, mês, dia) normalizando mês fora de 1..12 e clampando o dia.
function isoEm(y: number, m: number, d: number): string {
  const total = y * 12 + (m - 1);
  const ny = Math.floor(total / 12);
  const nm = (total - ny * 12) + 1;
  const nd = Math.min(d, diasNoMes(ny, nm));
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function somarDias(iso: string, n: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Range do preset + período anterior de mesmo tamanho.
// "este_mes"/"este_ano" comparam até o MESMO dia do período anterior (mês/ano parcial
// contra parcial — comparar parcial com inteiro inflaria o Δ%).
export function rangesDoPreset(preset: PeriodoPreset, hoje: string): Ranges {
  const [y, m, d] = partes(hoje);
  switch (preset) {
    case "este_mes":
      return {
        atual: { de: isoEm(y, m, 1), ate: hoje },
        anterior: { de: isoEm(y, m - 1, 1), ate: isoEm(y, m - 1, d) },
      };
    case "3_meses":
      // 3 meses correntes (mês atual + 2 anteriores) × os 3 meses fechados antes deles.
      return {
        atual: { de: isoEm(y, m - 2, 1), ate: hoje },
        anterior: { de: isoEm(y, m - 5, 1), ate: isoEm(y, m - 3, 31) },
      };
    case "este_ano":
      return {
        atual: { de: `${y}-01-01`, ate: hoje },
        anterior: { de: `${y - 1}-01-01`, ate: isoEm(y - 1, m, d) },
      };
    case "tudo":
      return { atual: { de: null, ate: null }, anterior: null };
  }
}

// Item SEM data conta em qualquer período — dinheiro nunca some em silêncio.
// (Despesa tem data opcional; muitas ficam em branco. Excluí-las zeraria o
//  relatório, então entram sempre — só as datadas respeitam o corte.)
export function noRange(data: string | null, r: Range): boolean {
  if (data == null) return true;
  if (r.de != null && data < r.de) return false;
  if (r.ate != null && data > r.ate) return false;
  return true;
}

export function somaNoRange(items: Movimento[], r: Range): number {
  let s = 0;
  for (const it of items) if (noRange(it.data, r)) s += it.valor;
  return s;
}

// Variação relativa (−0.4 = caiu 40%). null quando não há base de comparação.
// Denominador em módulo p/ líquidos negativos manterem o sinal intuitivo.
export function deltaPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}

// ---- Séries mensais ----

export function chaveMes(iso: string): string {
  return iso.slice(0, 7); // "2026-07"
}

// Últimos n meses (inclui o corrente), chaves ascendentes.
export function ultimasChavesMes(hoje: string, n: number): string[] {
  const [y, m] = partes(hoje);
  return Array.from({ length: n }, (_, i) => chaveMes(isoEm(y, m - (n - 1 - i), 1)));
}

// Próximos n meses (inclui o corrente), chaves ascendentes — base do forecast.
export function proximasChavesMes(hoje: string, n: number): string[] {
  const [y, m] = partes(hoje);
  return Array.from({ length: n }, (_, i) => chaveMes(isoEm(y, m + i, 1)));
}

// Dias inteiros de `de` até `ate` (positivo se ate > de).
export function diasEntre(de: string, ate: string): number {
  const a = new Date(de + "T00:00:00Z").getTime();
  const b = new Date(ate + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

// Bucket de atraso (aging) a partir dos dias vencidos. Ordem = severidade.
export type AgingBucket = "1-7" | "8-30" | "30+";
export function agingBucket(diasVencido: number): AgingBucket {
  if (diasVencido <= 7) return "1-7";
  if (diasVencido <= 30) return "8-30";
  return "30+";
}

// Classifica um vencimento em relação a hoje (agenda de cobrança).
export type FaixaVencimento = "atrasada" | "semana" | "mes" | "depois";
export function faixaVencimento(vencimento: string, hoje: string): FaixaVencimento {
  if (vencimento < hoje) return "atrasada";
  const d = diasEntre(hoje, vencimento);
  if (d <= 7) return "semana";
  if (d <= 30) return "mes";
  return "depois";
}

export function somaPorMes(items: Movimento[], chaves: string[]): number[] {
  const idx = new Map(chaves.map((c, i) => [c, i]));
  const out = chaves.map(() => 0);
  for (const it of items) {
    if (!it.data) continue;
    const i = idx.get(chaveMes(it.data));
    if (i != null) out[i] += it.valor;
  }
  return out;
}

export function acumular(valores: number[]): number[] {
  let s = 0;
  return valores.map((v) => (s += v));
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function labelMes(chave: string): string {
  return MESES[Number(chave.slice(5)) - 1] ?? chave;
}
