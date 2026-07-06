// Módulo Passeios — toda a I/O de passeios/participantes passa por aqui.
// Passeio é NEUTRO / pass-through (RASCUNHO §"Passeio"): entra+sai, não conta no lucro.
// Só controla quem foi e se pagou. valor por participante é editável (default = valor_unitario).
import { supabase } from "./supabase";
export { parseValor } from "./despesas"; // reaproveita o parser BR (número | null)

export interface ParticipanteRow {
  passageiro_id: string;
  nome: string;
  valor: number;
  pago: boolean;
}

export interface PasseioRow {
  id: string;
  excursao_id: string;
  nome: string;
  icone: string;
  data: string | null;
  fornecedor: string | null;
  valor_unitario: number;
  participantes: ParticipanteRow[];
}

export interface PasseioInput {
  nome: string;
  icone: string;
  data: string | null;
  fornecedor: string | null;
  valor_unitario: number;
}

// cliente vem aninhado (objeto ou array) — normaliza p/ o nome.
function nomeDe(p: unknown): string {
  const pass = Array.isArray(p) ? p[0] : p;
  const cli = pass && (Array.isArray(pass.cliente) ? pass.cliente[0] : pass.cliente);
  return (cli?.nome as string) ?? "—";
}

export async function listPasseios(excursaoId: string): Promise<PasseioRow[]> {
  const { data, error } = await supabase
    .from("passeio")
    .select(
      "id, excursao_id, nome, icone, data, fornecedor, valor_unitario, participantes:passeio_participante(passageiro_id, valor, pago, passageiro:passageiro_id(cliente:cliente_id(nome)))",
    )
    .eq("excursao_id", excursaoId)
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id as string,
    excursao_id: r.excursao_id as string,
    nome: r.nome as string,
    icone: (r.icone as string) ?? "MapPin",
    data: (r.data as string) ?? null,
    fornecedor: (r.fornecedor as string) ?? null,
    valor_unitario: Number(r.valor_unitario),
    participantes: (r.participantes ?? [])
      .map((p: Record<string, unknown>) => ({
        passageiro_id: p.passageiro_id as string,
        nome: nomeDe(p.passageiro),
        valor: Number(p.valor),
        pago: Boolean(p.pago),
      }))
      .sort((a: ParticipanteRow, b: ParticipanteRow) => a.nome.localeCompare(b.nome, "pt-BR")),
  }));
}

export async function createPasseio(
  excursaoId: string,
  input: PasseioInput,
  passageiroIds: string[],
): Promise<void> {
  const { data: p, error } = await supabase
    .from("passeio")
    .insert({
      excursao_id: excursaoId,
      nome: input.nome,
      icone: input.icone,
      data: input.data,
      fornecedor: input.fornecedor,
      valor_unitario: input.valor_unitario,
    })
    .select("id")
    .single();
  if (error) throw error;
  await addParticipantes(p.id as string, passageiroIds, input.valor_unitario);
}

export async function updatePasseio(id: string, input: PasseioInput): Promise<void> {
  const { error } = await supabase
    .from("passeio")
    .update({
      nome: input.nome,
      icone: input.icone,
      data: input.data,
      fornecedor: input.fornecedor,
      valor_unitario: input.valor_unitario,
    })
    .eq("id", id);
  if (error) throw error;
}

// FK sem cascade — remove participantes antes do passeio.
export async function deletePasseio(id: string): Promise<void> {
  const { error: e1 } = await supabase.from("passeio_participante").delete().eq("passeio_id", id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("passeio").delete().eq("id", id);
  if (e2) throw e2;
}

// Adiciona só os que ainda não estão no passeio (evita colisão de PK).
export async function addParticipantes(
  passeioId: string,
  passageiroIds: string[],
  valorPadrao: number,
): Promise<void> {
  if (passageiroIds.length === 0) return;
  const { data: existentes, error: e1 } = await supabase
    .from("passeio_participante")
    .select("passageiro_id")
    .eq("passeio_id", passeioId);
  if (e1) throw e1;
  const jaTem = new Set((existentes ?? []).map((x) => x.passageiro_id as string));
  const novos = passageiroIds.filter((id) => !jaTem.has(id));
  if (novos.length === 0) return;
  const { error: e2 } = await supabase.from("passeio_participante").insert(
    novos.map((passageiro_id) => ({
      passeio_id: passeioId,
      passageiro_id,
      valor: valorPadrao,
      pago: false,
    })),
  );
  if (e2) throw e2;
}

export async function removeParticipante(passeioId: string, passageiroId: string): Promise<void> {
  const { error } = await supabase
    .from("passeio_participante")
    .delete()
    .eq("passeio_id", passeioId)
    .eq("passageiro_id", passageiroId);
  if (error) throw error;
}

export async function setParticipante(
  passeioId: string,
  passageiroId: string,
  patch: { valor?: number; pago?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from("passeio_participante")
    .update(patch)
    .eq("passeio_id", passeioId)
    .eq("passageiro_id", passageiroId);
  if (error) throw error;
}
