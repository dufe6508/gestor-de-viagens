import { supabase } from "./supabase";
import type { Excursao, ResumoExcursao, PassageiroRow } from "./types";

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

export interface ResumoGeral {
  total_a_receber: number;
  total_recebido: number;
  total_despesas: number;
  saldo_caixa: number;
}

// Soma o resumo de todas as excursões (dashboard da home).
export async function getResumoGeral(): Promise<ResumoGeral> {
  const { data, error } = await supabase
    .from("v_resumo_excursao")
    .select("total_a_receber, total_recebido, total_despesas, despesas_pagas");
  if (error) throw error;
  const acc = { total_a_receber: 0, total_recebido: 0, total_despesas: 0, saldo_caixa: 0 };
  for (const r of data ?? []) {
    acc.total_a_receber += Number(r.total_a_receber);
    acc.total_recebido += Number(r.total_recebido);
    acc.total_despesas += Number(r.total_despesas);
    acc.saldo_caixa += Number(r.total_recebido) - Number(r.despesas_pagas);
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

export async function listPassageiros(excursaoId: string): Promise<PassageiroRow[]> {
  const [{ data: pax, error: e1 }, { data: saldos, error: e2 }] = await Promise.all([
    supabase
      .from("passageiro")
      .select("id, valor_total, cliente:cliente_id(nome)")
      .eq("excursao_id", excursaoId)
      .order("created_at"),
    supabase
      .from("v_passageiro_saldo")
      .select("passageiro_id, valor_pago, saldo, status_pagamento")
      .eq("excursao_id", excursaoId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const saldoById = new Map(
    (saldos ?? []).map((s) => [s.passageiro_id as string, s]),
  );

  return (pax ?? []).map((p) => {
    // cliente vem como objeto (ou array) do join — normaliza.
    const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente;
    const s = saldoById.get(p.id as string);
    return {
      id: p.id as string,
      nome: (cli?.nome as string) ?? "—",
      valor_total: Number(p.valor_total),
      valor_pago: Number(s?.valor_pago ?? 0),
      saldo: Number(s?.saldo ?? p.valor_total),
      status_pagamento: (s?.status_pagamento ?? "em_dia") as PassageiroRow["status_pagamento"],
    };
  });
}

export async function addPassageiro(
  excursaoId: string,
  nome: string,
  valorTotal: number,
): Promise<void> {
  const empresa_id = await getEmpresaId();
  // Cria o cliente e o vincula à excursão numa inscrição.
  const { data: cli, error: e1 } = await supabase
    .from("cliente")
    .insert({ empresa_id, nome })
    .select("id")
    .single();
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("passageiro").insert({
    excursao_id: excursaoId,
    cliente_id: cli.id,
    valor_total: valorTotal,
  });
  if (e2) throw e2;
}

export async function registrarPagamento(passageiroId: string, valor: number): Promise<void> {
  const { error } = await supabase
    .from("pagamento")
    .insert({ passageiro_id: passageiroId, valor });
  if (error) throw error;
}
