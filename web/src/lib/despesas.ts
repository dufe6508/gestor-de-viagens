// Módulo Despesas — toda a I/O de dados de despesas/categorias passa por aqui
// (mesmo princípio de data.ts; separado p/ isolar o módulo e evitar conflitos).
import { supabase } from "./supabase";
import { getEmpresaId } from "./data";

export type StatusDespesa = "previsto" | "pago";
export type FormaPagamento = "Pix" | "Dinheiro" | "Cartão" | "Transferência" | "Boleto";

export interface Categoria {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  ativo: boolean;
}

export interface DespesaRow {
  id: string;
  excursao_id: string;
  excursao_nome: string;
  nome: string;
  valor: number;
  status: StatusDespesa;
  data: string | null;
  obs: string | null;
  forma_pagamento: string | null;
  responsavel: string | null;
  categoria_id: string | null;
  categoria_nome: string;
  categoria_cor: string;
  categoria_icone: string;
}

export interface DespesaInput {
  excursao_id: string;
  nome: string;
  categoria_id: string | null;
  valor: number;
  data: string | null;
  status: StatusDespesa;
  obs?: string | null;
  forma_pagamento?: string | null;
  responsavel?: string | null;
}

const COR_FALLBACK = "#94a3b8";
const ICONE_FALLBACK = "Package";

// ---- Categorias ----

export async function listCategorias(incluirInativas = false): Promise<Categoria[]> {
  let q = supabase
    .from("categoria_despesa")
    .select("id, nome, cor, icone, ativo")
    .order("nome");
  if (!incluirInativas) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    nome: c.nome as string,
    cor: (c.cor as string) ?? COR_FALLBACK,
    icone: (c.icone as string) ?? ICONE_FALLBACK,
    ativo: c.ativo as boolean,
  }));
}

export async function createCategoria(input: {
  nome: string;
  cor: string;
  icone: string;
}): Promise<void> {
  const empresa_id = await getEmpresaId();
  const { error } = await supabase.from("categoria_despesa").insert({
    empresa_id,
    nome: input.nome,
    cor: input.cor,
    icone: input.icone,
  });
  if (error) throw error;
}

export async function updateCategoria(
  id: string,
  patch: Partial<Pick<Categoria, "nome" | "cor" | "icone" | "ativo">>,
): Promise<void> {
  const { error } = await supabase.from("categoria_despesa").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- Despesas ----

// Busca despesas com categoria e excursão já resolvidas (join).
// Filtros finos (período/valor/responsável) ficam no cliente — volume é pequeno.
export async function listDespesas(excursaoId?: string): Promise<DespesaRow[]> {
  let q = supabase
    .from("despesa")
    .select(
      "id, excursao_id, nome, valor, status, data, obs, forma_pagamento, responsavel, categoria_id, categoria:categoria_id(nome, cor, icone), excursao:excursao_id(nome)",
    )
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (excursaoId) q = q.eq("excursao_id", excursaoId);
  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((d) => {
    const cat = Array.isArray(d.categoria) ? d.categoria[0] : d.categoria;
    const exc = Array.isArray(d.excursao) ? d.excursao[0] : d.excursao;
    return {
      id: d.id as string,
      excursao_id: d.excursao_id as string,
      excursao_nome: (exc?.nome as string) ?? "—",
      nome: d.nome as string,
      valor: Number(d.valor),
      status: (d.status as StatusDespesa) ?? "previsto",
      data: (d.data as string) ?? null,
      obs: (d.obs as string) ?? null,
      forma_pagamento: (d.forma_pagamento as string) ?? null,
      responsavel: (d.responsavel as string) ?? null,
      categoria_id: (d.categoria_id as string) ?? null,
      categoria_nome: (cat?.nome as string) ?? "Sem categoria",
      categoria_cor: (cat?.cor as string) ?? COR_FALLBACK,
      categoria_icone: (cat?.icone as string) ?? ICONE_FALLBACK,
    };
  });
}

export async function createDespesa(input: DespesaInput): Promise<void> {
  const { error } = await supabase.from("despesa").insert({
    excursao_id: input.excursao_id,
    nome: input.nome,
    categoria_id: input.categoria_id,
    valor: input.valor,
    data: input.data,
    status: input.status,
    obs: input.obs ?? null,
    forma_pagamento: input.forma_pagamento ?? null,
    responsavel: input.responsavel ?? null,
  });
  if (error) throw error;
}

export async function updateDespesa(id: string, input: DespesaInput): Promise<void> {
  const { error } = await supabase
    .from("despesa")
    .update({
      excursao_id: input.excursao_id,
      nome: input.nome,
      categoria_id: input.categoria_id,
      valor: input.valor,
      data: input.data,
      status: input.status,
      obs: input.obs ?? null,
      forma_pagamento: input.forma_pagamento ?? null,
      responsavel: input.responsavel ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDespesa(id: string): Promise<void> {
  const { error } = await supabase.from("despesa").delete().eq("id", id);
  if (error) throw error;
}

// ---- Agregação (cliente) ----

export interface CategoriaResumo {
  categoria_id: string | null;
  nome: string;
  cor: string;
  icone: string;
  total: number;
  quantidade: number;
  pct: number; // 0..1 sobre o total geral
}

export function resumirPorCategoria(despesas: DespesaRow[]): CategoriaResumo[] {
  const geral = despesas.reduce((s, d) => s + d.valor, 0);
  const map = new Map<string, CategoriaResumo>();
  for (const d of despesas) {
    const key = d.categoria_id ?? "__sem__";
    const cur = map.get(key) ?? {
      categoria_id: d.categoria_id,
      nome: d.categoria_nome,
      cor: d.categoria_cor,
      icone: d.categoria_icone,
      total: 0,
      quantidade: 0,
      pct: 0,
    };
    cur.total += d.valor;
    cur.quantidade += 1;
    map.set(key, cur);
  }
  const arr = [...map.values()].sort((a, b) => b.total - a.total);
  for (const r of arr) r.pct = geral > 0 ? r.total / geral : 0;
  return arr;
}

// Converte "1.234,56" (BR) ou "1234.56" em número; null se inválido.
export function parseValor(s: string): number | null {
  let t = s.trim();
  if (!t) return null;
  // Tem vírgula → vírgula é decimal, ponto é milhar.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
