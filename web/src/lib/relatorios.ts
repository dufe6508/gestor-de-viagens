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

// Entrada real (pagamento) — base das séries temporais e do mix de formas.
export interface PagamentoMov {
  valor: number;
  data: string | null;
  excursao_id: string;
  forma: string | null;
}

// Saída (despesa) já com a categoria resolvida — base do donut/evolução de despesas.
export interface DespesaMov {
  valor: number;
  data: string | null;
  excursao_id: string;
  nome: string;
  categoria_id: string | null;
  categoria_nome: string;
  categoria_cor: string;
}

// Passeio pago = fluxo de caixa puro (entra do passageiro, sai no repasse à agência).
// Decisão do usuário (2026-07-06): aparece no caixa como entrada + repasse (líquido
// zero), pela data do passeio (participante não tem data própria — só o bool pago).
export interface PasseioMov {
  valor: number;
  data: string | null;
  excursao_id: string;
  passeio_nome: string;
}

export interface PassageiroStatusRow {
  passageiro_id: string;
  excursao_id: string;
  nome: string;
  valor_total: number;
  valor_pago: number;
  saldo: number;
  status_pagamento: StatusPagamento;
}

export type StatusParcela = "paga" | "pendente" | "atrasada";

export interface ParcelaRow {
  passageiro_id: string;
  excursao_id: string;
  nome: string;
  vencimento: string | null;
  valor: number;
  saldo: number;
  status: StatusParcela;
}

export interface DatasetRelatorios {
  excursoes: ExcursaoRef[];
  resumos: ResumoRow[];
  pagamentos: PagamentoMov[];
  despesas: DespesaMov[];
  passeios: PasseioMov[];
  passageiros: PassageiroStatusRow[];
  parcelas: ParcelaRow[]; // TODAS (inclui pagas) — abas derivam abertas por filtro
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);

const COR_FALLBACK = "#94a3b8";

export function filtrarPorExcursao<T extends { excursao_id: string }>(
  rows: T[],
  excursaoId: string, // "todas" = sem corte
): T[] {
  return excursaoId === "todas" ? rows : rows.filter((r) => r.excursao_id === excursaoId);
}

export function parcelasAbertas(parcelas: ParcelaRow[]): ParcelaRow[] {
  return parcelas.filter((p) => p.status !== "paga");
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
    { data: pass, error: e8 },
  ] = await Promise.all([
    supabase.from("excursao").select("id, nome, status"),
    supabase
      .from("v_resumo_excursao")
      .select("excursao_id, nome, total_a_receber, total_recebido, total_despesas"),
    supabase
      .from("pagamento")
      .select("valor, data, forma, passageiro:passageiro_id(excursao_id)"),
    supabase
      .from("despesa")
      .select("valor, data, excursao_id, nome, categoria_id, categoria:categoria_id(nome, cor)"),
    supabase.from("passageiro").select("id, excursao_id, valor_total, cliente:cliente_id(nome)"),
    supabase
      .from("v_passageiro_saldo")
      .select("passageiro_id, excursao_id, valor_pago, saldo, status_pagamento"),
    supabase.from("v_parcela_saldo").select("passageiro_id, vencimento, valor, saldo, status"),
    supabase
      .from("passeio")
      .select(
        "nome, data, excursao_id, participantes:passeio_participante(valor, pago)",
      ),
  ]);
  for (const e of [e1, e2, e3, e4, e5, e6, e7, e8]) if (e) throw e;

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

  const pagamentos: PagamentoMov[] = (pags ?? []).map((r) => {
    // passageiro vem como objeto (ou array) do join — normaliza.
    const p = Array.isArray(r.passageiro) ? r.passageiro[0] : r.passageiro;
    return {
      valor: Number(r.valor),
      data: (r.data as string) ?? null,
      excursao_id: (p?.excursao_id as string) ?? "",
      forma: (r.forma as string) ?? null,
    };
  });

  const despesas: DespesaMov[] = (desp ?? []).map((r) => {
    const cat = Array.isArray(r.categoria) ? r.categoria[0] : r.categoria;
    return {
      valor: Number(r.valor),
      data: (r.data as string) ?? null,
      excursao_id: r.excursao_id as string,
      nome: r.nome as string,
      categoria_id: (r.categoria_id as string) ?? null,
      categoria_nome: (cat?.nome as string) ?? "Sem categoria",
      categoria_cor: (cat?.cor as string) ?? COR_FALLBACK,
    };
  });

  const nomeByPax = new Map<string, string>();
  const excByPax = new Map<string, string>();
  for (const p of pax ?? []) {
    const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente;
    nomeByPax.set(p.id as string, (cli?.nome as string) ?? "—");
    excByPax.set(p.id as string, p.excursao_id as string);
  }
  const totalByPax = new Map(
    (pax ?? []).map((p) => [p.id as string, Number(p.valor_total)]),
  );

  const passageiros: PassageiroStatusRow[] = (saldos ?? []).map((s) => ({
    passageiro_id: s.passageiro_id as string,
    excursao_id: s.excursao_id as string,
    nome: nomeByPax.get(s.passageiro_id as string) ?? "—",
    valor_total: totalByPax.get(s.passageiro_id as string) ?? 0,
    valor_pago: Number(s.valor_pago),
    saldo: Number(s.saldo),
    status_pagamento: s.status_pagamento as StatusPagamento,
  }));

  const parcelas: ParcelaRow[] = (parc ?? []).map((r) => ({
    passageiro_id: r.passageiro_id as string,
    excursao_id: excByPax.get(r.passageiro_id as string) ?? "",
    nome: nomeByPax.get(r.passageiro_id as string) ?? "—",
    vencimento: (r.vencimento as string) ?? null,
    valor: Number(r.valor),
    saldo: Number(r.saldo),
    status: r.status as StatusParcela,
  }));

  // Um PasseioMov por participante PAGO (entra e depois é repassado).
  const passeios: PasseioMov[] = [];
  for (const r of pass ?? []) {
    const parts = (r.participantes ?? []) as { valor: number; pago: boolean }[];
    for (const pt of parts) {
      if (!pt.pago) continue;
      passeios.push({
        valor: Number(pt.valor),
        data: (r.data as string) ?? null,
        excursao_id: r.excursao_id as string,
        passeio_nome: r.nome as string,
      });
    }
  }

  return { excursoes, resumos, pagamentos, despesas, passeios, passageiros, parcelas };
}
