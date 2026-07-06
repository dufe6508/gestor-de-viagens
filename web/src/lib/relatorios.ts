// Módulo Relatórios — I/O dos datasets brutos (convenção CLAUDE.md: nenhum
// supabase.from() nas telas). As fórmulas/agrupamentos moram em metricas.ts (puro).
// Volume real é pequeno (~4 excursões/ano) → busca tudo em paralelo e filtra no
// cliente, mesmo padrão de despesas.ts. Se um dia doer, cada dataset vira view SQL
// sem mudar a UI (o contrato é o shape abaixo).
import { supabase } from "./supabase";
import type { StatusExcursao } from "./types";
import type { StatusPagamento } from "./passageiros";

export interface ExcursaoRef {
  id: string;
  nome: string;
  status: StatusExcursao;
}

// Linha de v_resumo_excursao + status + lucro derivado (regra: recebido − despesas).
export interface ResumoRow {
  excursao_id: string;
  nome: string;
  status: StatusExcursao;
  total_a_receber: number;
  total_recebido: number;
  total_despesas: number;
  lucro: number;
}

// Entrada (pagamento) ou saída (despesa) com data — base das séries temporais.
export interface MovimentoExcursao {
  valor: number;
  data: string | null;
  excursao_id: string;
}

export interface PassageiroStatusRow {
  passageiro_id: string;
  excursao_id: string;
  nome: string;
  saldo: number;
  status_pagamento: StatusPagamento;
}

// Parcela não paga (pendente ou atrasada) — base de vencidas/agenda/forecast.
export interface ParcelaAbertaRow {
  passageiro_id: string;
  excursao_id: string;
  nome: string;
  vencimento: string | null;
  saldo: number;
  status: "pendente" | "atrasada";
}

export interface DatasetRelatorios {
  excursoes: ExcursaoRef[];
  resumos: ResumoRow[];
  pagamentos: MovimentoExcursao[];
  despesas: MovimentoExcursao[];
  passageiros: PassageiroStatusRow[];
  parcelasAbertas: ParcelaAbertaRow[];
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export function filtrarPorExcursao<T extends { excursao_id: string }>(
  rows: T[],
  excursaoId: string, // "todas" = sem corte
): T[] {
  return excursaoId === "todas" ? rows : rows.filter((r) => r.excursao_id === excursaoId);
}

export async function getDatasetRelatorios(): Promise<DatasetRelatorios> {
  const [
    { data: exc, error: e1 },
    { data: res, error: e2 },
    { data: pags, error: e3 },
    { data: desp, error: e4 },
    { data: pax, error: e5 },
    { data: saldos, error: e6 },
    { data: parc, error: e7 },
  ] = await Promise.all([
    supabase.from("excursao").select("id, nome, status"),
    supabase
      .from("v_resumo_excursao")
      .select("excursao_id, nome, total_a_receber, total_recebido, total_despesas"),
    supabase.from("pagamento").select("valor, data, passageiro:passageiro_id(excursao_id)"),
    supabase.from("despesa").select("valor, data, excursao_id"),
    supabase.from("passageiro").select("id, excursao_id, cliente:cliente_id(nome)"),
    supabase
      .from("v_passageiro_saldo")
      .select("passageiro_id, excursao_id, saldo, status_pagamento"),
    supabase
      .from("v_parcela_saldo")
      .select("passageiro_id, vencimento, saldo, status")
      .neq("status", "paga"),
  ]);
  for (const e of [e1, e2, e3, e4, e5, e6, e7]) if (e) throw e;

  const excursoes: ExcursaoRef[] = (exc ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    status: r.status as StatusExcursao,
  }));
  const statusByExc = new Map(excursoes.map((e) => [e.id, e.status]));

  const resumos: ResumoRow[] = (res ?? []).map((r) => {
    const recebido = Number(r.total_recebido);
    const despesasTot = Number(r.total_despesas);
    return {
      excursao_id: r.excursao_id as string,
      nome: r.nome as string,
      status: statusByExc.get(r.excursao_id as string) ?? "planejada",
      total_a_receber: Number(r.total_a_receber),
      total_recebido: recebido,
      total_despesas: despesasTot,
      lucro: recebido - despesasTot,
    };
  });

  const pagamentos: MovimentoExcursao[] = (pags ?? []).map((r) => {
    // passageiro vem como objeto (ou array) do join — normaliza.
    const p = Array.isArray(r.passageiro) ? r.passageiro[0] : r.passageiro;
    return {
      valor: Number(r.valor),
      data: (r.data as string) ?? null,
      excursao_id: (p?.excursao_id as string) ?? "",
    };
  });

  const despesas: MovimentoExcursao[] = (desp ?? []).map((r) => ({
    valor: Number(r.valor),
    data: (r.data as string) ?? null,
    excursao_id: r.excursao_id as string,
  }));

  const nomeByPax = new Map<string, string>();
  const excByPax = new Map<string, string>();
  for (const p of pax ?? []) {
    const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente;
    nomeByPax.set(p.id as string, (cli?.nome as string) ?? "—");
    excByPax.set(p.id as string, p.excursao_id as string);
  }

  const passageiros: PassageiroStatusRow[] = (saldos ?? []).map((s) => ({
    passageiro_id: s.passageiro_id as string,
    excursao_id: s.excursao_id as string,
    nome: nomeByPax.get(s.passageiro_id as string) ?? "—",
    saldo: Number(s.saldo),
    status_pagamento: s.status_pagamento as StatusPagamento,
  }));

  const parcelasAbertas: ParcelaAbertaRow[] = (parc ?? []).map((r) => ({
    passageiro_id: r.passageiro_id as string,
    excursao_id: excByPax.get(r.passageiro_id as string) ?? "",
    nome: nomeByPax.get(r.passageiro_id as string) ?? "—",
    vencimento: (r.vencimento as string) ?? null,
    saldo: Number(r.saldo),
    status: r.status as ParcelaAbertaRow["status"],
  }));

  return { excursoes, resumos, pagamentos, despesas, passageiros, parcelasAbertas };
}
