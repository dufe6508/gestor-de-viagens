// Módulo Passageiros — toda a I/O de passageiros/parcelas/pagamentos passa por aqui
// (mesmo princípio de data.ts; separado p/ isolar o módulo).
// Estado financeiro NUNCA é gravado — sempre lido das views v_passageiro_saldo/v_parcela_saldo.
// parcela.status (coluna) é deprecada: não ler nem escrever.
import { supabase } from "./supabase";
import { getEmpresaId } from "./data";
import { gerarParcelas, alocarPagamento, redistribuirParcelas } from "./parcelas";

export type StatusPagamento = "quitado" | "atrasado" | "em_dia";

export interface PassageiroRow {
  id: string;
  nome: string;
  valor_total: number;
  valor_pago: number;
  saldo: number;
  status_pagamento: StatusPagamento;
  proximo_vencimento: string | null;
}

export interface ParcelaRow {
  id: string;
  numero: number;
  valor: number;
  vencimento: string | null;
  valor_pago: number;
  saldo: number;
  status: "paga" | "atrasada" | "pendente";
}

export interface PagamentoRow {
  id: string;
  valor: number;
  data: string;
  forma: string | null;
  parcela_numero: number | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export async function listPassageiros(excursaoId: string): Promise<PassageiroRow[]> {
  const [{ data: pax, error: e1 }, { data: saldos, error: e2 }] = await Promise.all([
    supabase
      .from("passageiro")
      .select("id, valor_total, cliente:cliente_id(nome)")
      .eq("excursao_id", excursaoId)
      .order("created_at"),
    supabase
      .from("v_passageiro_saldo")
      .select("passageiro_id, valor_pago, saldo, status_pagamento, proximo_vencimento")
      .eq("excursao_id", excursaoId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const saldoById = new Map((saldos ?? []).map((s) => [s.passageiro_id as string, s]));

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
      status_pagamento: (s?.status_pagamento ?? "em_dia") as StatusPagamento,
      proximo_vencimento: (s?.proximo_vencimento as string) ?? null,
    };
  });
}

export async function addPassageiro(excursaoId: string, nome: string): Promise<void> {
  const empresa_id = await getEmpresaId();
  // Cria o cliente e o vincula à excursão numa inscrição (valor definido depois).
  const { data: cli, error: e1 } = await supabase
    .from("cliente")
    .insert({ empresa_id, nome })
    .select("id")
    .single();
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("passageiro").insert({
    excursao_id: excursaoId,
    cliente_id: cli.id,
    valor_total: 0,
  });
  if (e2) throw e2;
}

export async function getPassageiroDetalhe(id: string): Promise<{
  passageiro: PassageiroRow & { excursao_id: string; excursao_nome: string; obs: string | null };
  parcelas: ParcelaRow[];
  pagamentos: PagamentoRow[];
}> {
  const [
    { data: p, error: e1 },
    { data: s, error: e2 },
    { data: parc, error: e3 },
    { data: pags, error: e4 },
  ] = await Promise.all([
    supabase
      .from("passageiro")
      .select("id, excursao_id, valor_total, obs, cliente:cliente_id(nome), excursao:excursao_id(nome)")
      .eq("id", id)
      .single(),
    supabase
      .from("v_passageiro_saldo")
      .select("valor_pago, saldo, status_pagamento, proximo_vencimento")
      .eq("passageiro_id", id)
      .single(),
    supabase
      .from("v_parcela_saldo")
      .select("parcela_id, numero, valor, vencimento, valor_pago, saldo, status")
      .eq("passageiro_id", id)
      .order("numero"),
    supabase
      .from("pagamento")
      .select("id, valor, data, forma, parcela:parcela_id(numero)")
      .eq("passageiro_id", id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;

  const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente;
  const exc = Array.isArray(p.excursao) ? p.excursao[0] : p.excursao;

  return {
    passageiro: {
      id: p.id as string,
      nome: (cli?.nome as string) ?? "—",
      valor_total: Number(p.valor_total),
      valor_pago: Number(s.valor_pago),
      saldo: Number(s.saldo),
      status_pagamento: s.status_pagamento as StatusPagamento,
      proximo_vencimento: (s.proximo_vencimento as string) ?? null,
      excursao_id: p.excursao_id as string,
      excursao_nome: (exc?.nome as string) ?? "—",
      obs: (p.obs as string) ?? null,
    },
    parcelas: (parc ?? []).map((r) => ({
      id: r.parcela_id as string,
      numero: Number(r.numero),
      valor: Number(r.valor),
      vencimento: (r.vencimento as string) ?? null,
      valor_pago: Number(r.valor_pago),
      saldo: Number(r.saldo),
      status: r.status as ParcelaRow["status"],
    })),
    pagamentos: (pags ?? []).map((r) => {
      const par = Array.isArray(r.parcela) ? r.parcela[0] : r.parcela;
      return {
        id: r.id as string,
        valor: Number(r.valor),
        data: r.data as string,
        forma: (r.forma as string) ?? null,
        parcela_numero: par?.numero != null ? Number(par.numero) : null,
      };
    }),
  };
}

export async function updateValorTotal(id: string, valor: number): Promise<void> {
  const { error } = await supabase.from("passageiro").update({ valor_total: valor }).eq("id", id);
  if (error) throw error;

  // Redistribui o saldo restante nas parcelas ainda abertas.
  const [{ data: abertas, error: e1 }, { data: s, error: e2 }] = await Promise.all([
    supabase
      .from("v_parcela_saldo")
      .select("parcela_id, numero, saldo")
      .eq("passageiro_id", id)
      .neq("status", "paga"),
    supabase.from("v_passageiro_saldo").select("valor_pago").eq("passageiro_id", id).single(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!abertas || abertas.length === 0) return;

  const novoSaldo = valor - Number(s.valor_pago);
  const novas = redistribuirParcelas(
    novoSaldo,
    abertas.map((p) => ({ id: p.parcela_id as string, numero: Number(p.numero), saldo: Number(p.saldo) })),
  );
  const results = await Promise.all(
    novas.map((n) => supabase.from("parcela").update({ valor: n.valor }).eq("id", n.id)),
  );
  for (const { error: e } of results) if (e) throw e;
}

// Fluxo em massa: define valor ANTES de parcelar — não redistribui parcelas.
export async function bulkSetValor(ids: string[], valor: number): Promise<void> {
  const { error } = await supabase.from("passageiro").update({ valor_total: valor }).in("id", ids);
  if (error) throw error;
}

// (Re)parcela cada passageiro. Pula quem não tem valor ou já tem pagamento vinculado a parcela.
export async function parcelar(
  ids: string[],
  n: number,
  primeiroVenc: string,
): Promise<{ ok: number; pulados: number }> {
  let ok = 0;
  let pulados = 0;
  for (const id of ids) {
    const { data: p, error: e1 } = await supabase
      .from("passageiro")
      .select("valor_total")
      .eq("id", id)
      .single();
    if (e1) throw e1;
    const total = Number(p.valor_total);
    if (total <= 0) {
      pulados++;
      continue;
    }
    const { data: vinc, error: e2 } = await supabase
      .from("pagamento")
      .select("id")
      .eq("passageiro_id", id)
      .not("parcela_id", "is", null)
      .limit(1);
    if (e2) throw e2;
    if (vinc && vinc.length > 0) {
      pulados++;
      continue;
    }
    const { error: e3 } = await supabase.from("parcela").delete().eq("passageiro_id", id);
    if (e3) throw e3;
    const { error: e4 } = await supabase.from("parcela").insert(
      gerarParcelas(total, n, primeiroVenc).map((g) => ({
        passageiro_id: id,
        numero: g.numero,
        valor: g.valor,
        vencimento: g.vencimento,
      })),
    );
    if (e4) throw e4;
    ok++;
  }
  return { ok, pulados };
}

export async function registrarPagamento(
  passageiroId: string,
  valor: number,
  data: string,
  forma?: string,
  parcelaId?: string,
): Promise<void> {
  if (parcelaId) {
    const { error } = await supabase.from("pagamento").insert({
      passageiro_id: passageiroId,
      parcela_id: parcelaId,
      valor,
      data,
      forma: forma || null,
    });
    if (error) throw error;
    return;
  }
  // Sem parcela indicada: aloca nas abertas (mais antigas primeiro); sobra vira avulso.
  const { data: abertas, error: e1 } = await supabase
    .from("v_parcela_saldo")
    .select("parcela_id, numero, saldo")
    .eq("passageiro_id", passageiroId)
    .neq("status", "paga");
  if (e1) throw e1;
  const alocs = alocarPagamento(
    valor,
    (abertas ?? []).map((p) => ({ id: p.parcela_id as string, numero: Number(p.numero), saldo: Number(p.saldo) })),
  );
  // Um único insert de array = atômico.
  const { error: e2 } = await supabase.from("pagamento").insert(
    alocs.map((a) => ({
      passageiro_id: passageiroId,
      parcela_id: a.parcela_id,
      valor: a.valor,
      data,
      forma: forma || null,
    })),
  );
  if (e2) throw e2;
}

// Quita a próxima parcela em aberto (menor número); null se não houver.
export async function pagarProximaParcela(
  passageiroId: string,
): Promise<{ numero: number; valor: number } | null> {
  const { data, error } = await supabase
    .from("v_parcela_saldo")
    .select("parcela_id, numero, saldo")
    .eq("passageiro_id", passageiroId)
    .neq("status", "paga")
    .order("numero")
    .limit(1);
  if (error) throw error;
  const prox = data?.[0];
  if (!prox) return null;
  const saldo = Number(prox.saldo);
  const { error: e2 } = await supabase.from("pagamento").insert({
    passageiro_id: passageiroId,
    parcela_id: prox.parcela_id,
    valor: saldo,
    data: hoje(),
  });
  if (e2) throw e2;
  return { numero: Number(prox.numero), valor: saldo };
}

export async function updatePagamento(
  id: string,
  valor: number,
  data: string,
  forma?: string,
): Promise<void> {
  const { error } = await supabase
    .from("pagamento")
    .update({ valor, data, forma: forma || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePagamento(id: string): Promise<void> {
  const { error } = await supabase.from("pagamento").delete().eq("id", id);
  if (error) throw error;
}

// FKs sem cascade — ordem obrigatória: pagamentos → parcelas → passageiro.
export async function deletePassageiro(id: string): Promise<void> {
  const { error: e1 } = await supabase.from("pagamento").delete().eq("passageiro_id", id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("parcela").delete().eq("passageiro_id", id);
  if (e2) throw e2;
  const { error: e3 } = await supabase.from("passageiro").delete().eq("id", id);
  if (e3) throw e3;
}

// Converte "1.450,50" (BR) ou "1450.50" em número; NaN se inválido.
// (mesma lógica de despesas.parseValor, mas contrato aqui é NaN, não null)
export function parseValor(s: string): number {
  let t = s.trim();
  if (!t) return NaN;
  // Tem vírgula → vírgula é decimal, ponto é milhar.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
