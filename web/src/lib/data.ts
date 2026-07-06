import { supabase } from "./supabase";
import type { Excursao, ResumoExcursao } from "./types";

// MVP: uma empresa. Busca (e memoiza) o id da única empresa.
let empresaIdCache: string | null = null;
export async function getEmpresaId(): Promise<string> {
  if (empresaIdCache) return empresaIdCache;
  const { data, error } = await supabase.from("empresa").select("id").limit(1).single();
  if (error) throw error;
  empresaIdCache = data.id;
  return data.id;
}

export async function listExcursoes(): Promise<Excursao[]> {
  const { data, error } = await supabase
    .from("excursao")
    .select("id, nome, destino, data_inicio, data_fim, status")
    .order("data_inicio", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as Excursao[];
}

export async function createExcursao(input: {
  nome: string;
  destino?: string;
  data_inicio?: string;
  data_fim?: string;
}): Promise<Excursao> {
  const empresa_id = await getEmpresaId();
  const { data, error } = await supabase
    .from("excursao")
    .insert({
      empresa_id,
      nome: input.nome,
      destino: input.destino || null,
      data_inicio: input.data_inicio || null,
      data_fim: input.data_fim || null,
    })
    .select("id, nome, destino, data_inicio, data_fim, status")
    .single();
  if (error) throw error;
  return data as Excursao;
}

export async function updateExcursao(
  id: string,
  input: { nome: string; destino?: string; data_inicio?: string; data_fim?: string },
): Promise<void> {
  const { error } = await supabase
    .from("excursao")
    .update({
      nome: input.nome,
      destino: input.destino || null,
      data_inicio: input.data_inicio || null,
      data_fim: input.data_fim || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Regra CLAUDE.md §"histórico": nada se apaga. Só exclui excursão VAZIA
// (sem passageiros nem despesas) — o resto tem histórico e é bloqueado.
export async function deleteExcursao(id: string): Promise<void> {
  const [{ count: pax }, { count: desp }] = await Promise.all([
    supabase.from("passageiro").select("id", { count: "exact", head: true }).eq("excursao_id", id),
    supabase.from("despesa").select("id", { count: "exact", head: true }).eq("excursao_id", id),
  ]);
  if ((pax ?? 0) > 0 || (desp ?? 0) > 0)
    throw new Error("Excursão tem lançamentos — não pode ser excluída.");
  const { error } = await supabase.from("excursao").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface ResumoGeral {
  total_a_receber: number;
  total_recebido: number;
  total_despesas: number;
  saldo_caixa: number;
}

// Soma o resumo de todas as excursões (dashboard da home).
// saldo_caixa = recebido − todas as despesas (mesma base do lucro).
export async function getResumoGeral(): Promise<ResumoGeral> {
  const { data, error } = await supabase
    .from("v_resumo_excursao")
    .select("total_a_receber, total_recebido, total_despesas");
  if (error) throw error;
  const acc = { total_a_receber: 0, total_recebido: 0, total_despesas: 0, saldo_caixa: 0 };
  for (const r of data ?? []) {
    acc.total_a_receber += Number(r.total_a_receber);
    acc.total_recebido += Number(r.total_recebido);
    acc.total_despesas += Number(r.total_despesas);
    acc.saldo_caixa += Number(r.total_recebido) - Number(r.total_despesas);
  }
  return acc;
}

export async function getExcursao(id: string): Promise<Excursao> {
  const { data, error } = await supabase
    .from("excursao")
    .select("id, nome, destino, data_inicio, data_fim, status")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Excursao;
}

export async function getResumo(id: string): Promise<ResumoExcursao> {
  const { data, error } = await supabase
    .from("v_resumo_excursao")
    .select("*")
    .eq("excursao_id", id)
    .single();
  if (error) throw error;
  return data as ResumoExcursao;
}

// I/O de passageiros/parcelas/pagamentos: ver lib/passageiros.ts (módulo próprio).
