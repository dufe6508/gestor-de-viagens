// Lógica pura de parcelas/pagamentos. Sem I/O — testável e reusável.
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ParcelaGerada {
  numero: number;
  valor: number;
  vencimento: string;
}

export function gerarParcelas(total: number, n: number, primeiroVenc: string): ParcelaGerada[] {
  const [y, m, d] = primeiroVenc.split("-").map(Number);
  const base = Math.floor((total / n) * 100) / 100;
  const out: ParcelaGerada[] = [];
  for (let i = 0; i < n; i++) {
    const ultimoDia = new Date(y, m - 1 + i + 1, 0).getDate(); // último dia do mês alvo
    const dia = Math.min(d, ultimoDia); // clamp: 31 → 28/29/30
    const data = new Date(y, m - 1 + i, dia);
    const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    out.push({ numero: i + 1, valor: base, vencimento: iso });
  }
  out[n - 1].valor = round2(total - base * (n - 1)); // última absorve centavos
  return out;
}

export interface ParcelaAberta {
  id: string;
  numero: number;
  saldo: number;
}

export function alocarPagamento(
  valor: number,
  abertas: ParcelaAberta[],
): { parcela_id: string | null; valor: number }[] {
  const out: { parcela_id: string | null; valor: number }[] = [];
  let resto = round2(valor);
  for (const p of [...abertas].sort((a, b) => a.numero - b.numero)) {
    if (resto <= 0) break;
    if (p.saldo <= 0) continue;
    const usa = Math.min(resto, round2(p.saldo));
    out.push({ parcela_id: p.id, valor: usa });
    resto = round2(resto - usa);
  }
  if (resto > 0) out.push({ parcela_id: null, valor: resto }); // avulso
  return out;
}

export function redistribuirParcelas(
  novoSaldo: number,
  abertas: ParcelaAberta[],
): { id: string; valor: number }[] {
  if (abertas.length === 0) return [];
  const ord = [...abertas].sort((a, b) => a.numero - b.numero);
  const cota = Math.floor((novoSaldo / ord.length) * 100) / 100;
  const out = ord.map((p) => ({ id: p.id, valor: cota }));
  out[out.length - 1].valor = round2(novoSaldo - cota * (ord.length - 1));
  return out;
}
