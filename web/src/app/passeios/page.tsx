"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Search,
  Ticket,
  Trash2,
  Check,
  ChevronDown,
  Pencil,
  UserPlus,
  X,
} from "lucide-react";
import {
  listPasseios,
  createPasseio,
  updatePasseio,
  deletePasseio,
  addParticipantes,
  removeParticipante,
  setParticipante,
  parseValor,
  type PasseioRow,
  type PasseioInput,
} from "@/lib/passeios";
import { listPassageiros } from "@/lib/passageiros";
import { getExcursao } from "@/lib/data";
import type { Excursao } from "@/lib/types";
import { brl } from "@/lib/format";
import { haptic } from "@/lib/utils";
import { PasseioIcon, PASSEIO_ICON_OPTIONS } from "@/components/passeio-icons";
import { Fab } from "@/components/fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Simples = { id: string; nome: string };

// "YYYY-MM-DD" → "dd/mm/yyyy"
const ddmmyyyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

function PasseiosView() {
  const excursaoId = useSearchParams().get("id") ?? "";

  const [excursao, setExcursao] = useState<Excursao | null>(null);
  const [passeios, setPasseios] = useState<PasseioRow[]>([]);
  const [passageiros, setPassageiros] = useState<Simples[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<PasseioRow | null>(null);
  const [excluir, setExcluir] = useState<PasseioRow | null>(null);
  const [addAlvo, setAddAlvo] = useState<PasseioRow | null>(null);

  const load = useCallback(async () => {
    if (!excursaoId) return;
    try {
      const [exc, ps, pax] = await Promise.all([
        getExcursao(excursaoId),
        listPasseios(excursaoId),
        listPassageiros(excursaoId),
      ]);
      setExcursao(exc);
      setPasseios(ps);
      setPassageiros(pax.map((p) => ({ id: p.id, nome: p.nome })));
    } catch (e) {
      toast.error("Erro ao carregar", { description: String((e as Error).message) });
    } finally {
      setLoading(false);
    }
  }, [excursaoId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function abrirNovo() {
    setEditando(null);
    setFormOpen(true);
  }
  function abrirEdicao(p: PasseioRow) {
    setEditando(p);
    setFormOpen(true);
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    try {
      await deletePasseio(excluir.id);
      toast.success("Passeio excluído");
      setExcluir(null);
      load();
    } catch (e) {
      toast.error("Erro ao excluir", { description: String((e as Error).message) });
    }
  }

  if (!excursaoId)
    return <p className="p-8 text-center text-muted-foreground">Excursão não informada.</p>;

  return (
    <>
      {/* Fundo 100% preto só nesta página */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-black" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
        <header className="mb-5 flex items-center gap-2">
          <Link
            href={`/?id=${excursaoId}`}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.375rem] font-semibold tracking-tight">Passeios</h1>
            {excursao && (
              <p className="truncate text-sm text-muted-foreground">
                {excursao.nome}
                {!loading && ` · ${passeios.length} passeio${passeios.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        ) : passeios.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <span className="surface mb-4 grid size-16 place-items-center rounded-full">
              <Ticket className="size-7 text-faint" strokeWidth={1.5} />
            </span>
            <p className="font-semibold">Nenhum passeio</p>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">Crie o primeiro.</p>
            <Button onClick={abrirNovo}>
              <Plus /> Novo passeio
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {passeios.map((p) => (
              <PasseioCard
                key={p.id}
                passeio={p}
                onChanged={load}
                onEditar={() => abrirEdicao(p)}
                onExcluir={() => setExcluir(p)}
                onAddPessoas={() => setAddAlvo(p)}
              />
            ))}
          </div>
        )}
      </main>

      {!loading && passeios.length > 0 && (
        <Fab label="Novo passeio" onClick={abrirNovo}>
          <Plus className="size-6" strokeWidth={2} />
        </Fab>
      )}

      <PasseioForm
        open={formOpen}
        onOpenChange={setFormOpen}
        excursaoId={excursaoId}
        passageiros={passageiros}
        editando={editando}
        onSaved={load}
      />

      {/* Adicionar pessoas a um passeio existente */}
      <AddPessoasSheet
        alvo={addAlvo}
        passageiros={passageiros}
        onOpenChange={(o) => !o && setAddAlvo(null)}
        onSaved={load}
      />

      {/* Confirmar exclusão */}
      <Dialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir passeio</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Excluir “{excluir?.nome}” e todos os seus participantes? Não pode ser desfeito.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Card de passeio (expansível) ----

function PasseioCard({
  passeio,
  onChanged,
  onEditar,
  onExcluir,
  onAddPessoas,
}: {
  passeio: PasseioRow;
  onChanged: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onAddPessoas: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const pagos = passeio.participantes.filter((p) => p.pago).length;
  const recebido = passeio.participantes.reduce((s, p) => s + (p.pago ? p.valor : 0), 0);
  const previsto = passeio.participantes.reduce((s, p) => s + p.valor, 0);

  async function togglePago(passageiroId: string, pago: boolean) {
    haptic();
    try {
      await setParticipante(passeio.id, passageiroId, { pago: !pago });
      onChanged();
    } catch (e) {
      toast.error("Erro", { description: String((e as Error).message) });
    }
  }

  async function salvarValor(passageiroId: string, valorAtual: number, str: string) {
    const v = parseValor(str);
    if (v === null) return toast.error("Valor inválido");
    if (v === valorAtual) return;
    try {
      await setParticipante(passeio.id, passageiroId, { valor: v });
      onChanged();
    } catch (e) {
      toast.error("Erro", { description: String((e as Error).message) });
    }
  }

  async function remover(passageiroId: string, nome: string) {
    try {
      await removeParticipante(passeio.id, passageiroId);
      toast.success(`${nome} removido`);
      onChanged();
    } catch (e) {
      toast.error("Erro ao remover", { description: String((e as Error).message) });
    }
  }

  return (
    <section className="glass-card glass-card-solid overflow-hidden rounded-lg">
      <button
        onClick={() => {
          haptic();
          setAberto((a) => !a);
        }}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-white/[0.03]"
      >
        <span className="surface grid size-11 shrink-0 place-items-center rounded-full">
          <PasseioIcon nome={passeio.icone} className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{passeio.nome}</p>
          <p className="truncate text-xs text-faint">
            {passeio.data ? ddmmyyyy(passeio.data) + " · " : ""}
            {brl(passeio.valor_unitario)}/pessoa
            {passeio.fornecedor ? ` · ${passeio.fornecedor}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="money text-sm font-semibold text-success">{brl(recebido)}</p>
          <p className="text-[11px] text-faint">
            {pagos}/{passeio.participantes.length} pagos
          </p>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-faint transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {aberto && (
        <div className="border-t border-white/8 px-3 pb-3">
          {passeio.participantes.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">
              Ninguém neste passeio ainda.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {passeio.participantes.map((pt) => (
                <li key={pt.passageiro_id} className="flex items-center gap-2 py-2">
                  <button
                    onClick={() => togglePago(pt.passageiro_id, pt.pago)}
                    aria-pressed={pt.pago}
                    aria-label={pt.pago ? "Marcar como não pago" : "Marcar como pago"}
                    className={`grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-150 ${
                      pt.pago
                        ? "border-success bg-success/20 text-success"
                        : "border-border-strong text-transparent hover:border-foreground"
                    }`}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm">{pt.nome}</span>
                  <div className="relative w-28 shrink-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      R$
                    </span>
                    <Input
                      defaultValue={pt.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      inputMode="decimal"
                      aria-label={`Valor de ${pt.nome}`}
                      onBlur={(e) => salvarValor(pt.passageiro_id, pt.valor, e.target.value)}
                      className="h-9 rounded-full border-white/10 bg-white/[0.06] pl-9 pr-3 text-right text-[13px] tabular-nums"
                    />
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remover ${pt.nome}`}
                    onClick={() => remover(pt.passageiro_id, pt.nome)}
                  >
                    <X className="size-4" strokeWidth={2} />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onAddPessoas}>
              <UserPlus /> Adicionar pessoas
            </Button>
            <Button size="sm" variant="ghost" onClick={onEditar}>
              <Pencil /> Editar
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Excluir passeio"
              onClick={onExcluir}
              className="ml-auto"
            >
              <Trash2 className="size-4 text-destructive" strokeWidth={1.75} />
            </Button>
          </div>
          <p className="mt-1.5 text-right text-xs text-faint">Previsto {brl(previsto)}</p>
        </div>
      )}
    </section>
  );
}

// ---- Lista de passageiros com busca + checkbox (reutilizada) ----

function PassageiroChecklist({
  passageiros,
  selecionados,
  onToggle,
  excluir,
}: {
  passageiros: Simples[];
  selecionados: Set<string>;
  onToggle: (id: string) => void;
  excluir?: Set<string>;
}) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return passageiros.filter(
      (p) => !excluir?.has(p.id) && (!q || p.nome.toLowerCase().includes(q)),
    );
  }, [passageiros, busca, excluir]);

  const todosSel = lista.length > 0 && lista.every((p) => selecionados.has(p.id));
  function toggleTodos() {
    // marca os que faltam; se já estão todos, desmarca. Usa onToggle (batelado).
    for (const p of lista) if (selecionados.has(p.id) === todosSel) onToggle(p.id);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-faint"
          strokeWidth={1.75}
        />
        <Input
          aria-label="Buscar passageiro"
          placeholder="Buscar passageiro"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>
      {lista.length > 0 && (
        <button
          type="button"
          onClick={toggleTodos}
          className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <span
            className={`grid size-4 place-items-center rounded border transition-colors duration-150 ${
              todosSel
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong text-transparent"
            }`}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          {todosSel ? "Limpar seleção" : `Selecionar todos (${lista.length})`}
        </button>
      )}
      <div className="max-h-56 overflow-y-auto rounded-md border border-border">
        {lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {passageiros.length === 0 ? "Nenhum passageiro na excursão." : "Nada encontrado."}
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {lista.map((p) => {
              const on = selecionados.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(p.id)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.03]"
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded border transition-colors duration-150 ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong text-transparent"
                      }`}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="truncate text-sm">{p.nome}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Form de criar/editar passeio ----

function PasseioForm({
  open,
  onOpenChange,
  excursaoId,
  passageiros,
  editando,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  excursaoId: string;
  passageiros: Simples[];
  editando: PasseioRow | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("MapPin");
  const [valorStr, setValorStr] = useState("");
  const [data, setData] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  // Preenche ao abrir (edição) ou zera (novo). Sincroniza prop→estado no open.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    if (editando) {
      setNome(editando.nome);
      setIcone(editando.icone);
      setValorStr(editando.valor_unitario > 0 ? String(editando.valor_unitario) : "");
      setData(editando.data ?? "");
      setFornecedor(editando.fornecedor ?? "");
    } else {
      setNome("");
      setIcone("MapPin");
      setValorStr("");
      setData("");
      setFornecedor("");
    }
    setSel(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggle(id: string) {
    setSel((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome do passeio");
    const v = parseValor(valorStr) ?? 0;
    const input: PasseioInput = {
      nome: nome.trim(),
      icone,
      data: data || null,
      fornecedor: fornecedor.trim() || null,
      valor_unitario: v,
    };
    setSalvando(true);
    try {
      if (editando) {
        await updatePasseio(editando.id, input);
        toast.success("Passeio atualizado");
      } else {
        await createPasseio(excursaoId, input, [...sel]);
        toast.success("Passeio criado");
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Erro ao salvar", { description: String((e as Error).message) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar passeio" : "Novo passeio"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Ícone */}
          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-2">
              {PASSEIO_ICON_OPTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcone(key)}
                  aria-pressed={icone === key}
                  aria-label={key}
                  className={`grid size-10 place-items-center rounded-lg border transition-colors duration-150 ${
                    icone === key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  <PasseioIcon nome={key} className="size-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-nome">Nome</Label>
            <Input
              id="ps-nome"
              placeholder="Ex: Passeio de bugre"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ps-valor">Valor por pessoa (R$)</Label>
              <Input
                id="ps-valor"
                inputMode="decimal"
                placeholder="80,00"
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ps-data">Data</Label>
              <Input
                id="ps-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-forn">Fornecedor / agência (opcional)</Label>
            <Input
              id="ps-forn"
              placeholder="Ex: Bugre Tur"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
            />
          </div>

          {/* Participantes — só na criação (na edição, gerenciar no card) */}
          {!editando && (
            <div className="space-y-1.5">
              <Label>Quem vai ({sel.size})</Label>
              <PassageiroChecklist passageiros={passageiros} selecionados={sel} onToggle={toggle} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={salvar} disabled={salvando} className="w-full" size="lg">
            {salvando ? "Salvando…" : editando ? "Salvar" : "Criar passeio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Sheet p/ adicionar pessoas a passeio existente ----

function AddPessoasSheet({
  alvo,
  passageiros,
  onOpenChange,
  onSaved,
}: {
  alvo: PasseioRow | null;
  passageiros: Simples[];
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (alvo) setSel(new Set());
  }, [alvo]);

  const jaTem = useMemo(
    () => new Set((alvo?.participantes ?? []).map((p) => p.passageiro_id)),
    [alvo],
  );

  function toggle(id: string) {
    setSel((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function salvar() {
    if (!alvo || sel.size === 0) return onOpenChange(false);
    setSalvando(true);
    try {
      await addParticipantes(alvo.id, [...sel], alvo.valor_unitario);
      toast.success(`${sel.size} adicionado${sel.size === 1 ? "" : "s"}`);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Erro ao adicionar", { description: String((e as Error).message) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!alvo} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>Adicionar pessoas</DialogTitle>
        </DialogHeader>
        <div className="py-1">
          <PassageiroChecklist
            passageiros={passageiros}
            selecionados={sel}
            onToggle={toggle}
            excluir={jaTem}
          />
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={salvando || sel.size === 0} className="w-full" size="lg">
            {salvando ? "Adicionando…" : `Adicionar (${sel.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PasseiosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}>
      <PasseiosView />
    </Suspense>
  );
}
