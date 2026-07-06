"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckSquare, Plus, Search, Users, Zap } from "lucide-react";
import {
  listPassageiros,
  addPassageiro,
  bulkSetValor,
  parcelar,
  pagarProximaParcela,
  parseValor,
  type PassageiroRow,
  type StatusPagamento,
} from "@/lib/passageiros";
import { getExcursao, getResumo } from "@/lib/data";
import type { Excursao, ResumoExcursao } from "@/lib/types";
import { brl } from "@/lib/format";
import { haptic } from "@/lib/utils";
import { ParcelamentoDialog } from "@/components/parcelamento-dialog";
import { Fab } from "@/components/fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SelectField } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FiltroStatus = "todos" | StatusPagamento;
type Ordem = "num" | "nome" | "divida" | "vence";

const FILTROS: { v: FiltroStatus; label: string }[] = [
  { v: "todos", label: "Todos" },
  { v: "atrasado", label: "Atrasados" },
  { v: "em_dia", label: "Em dia" },
  { v: "quitado", label: "Quitados" },
];

const ORDENS = [
  { value: "num", label: "Nº" },
  { value: "nome", label: "Nome A–Z" },
  { value: "divida", label: "Maior dívida" },
  { value: "vence", label: "Vence antes" },
];

const BADGE: Record<StatusPagamento, { variant: "success" | "destructive" | "secondary"; label: string }> = {
  quitado: { variant: "success", label: "Quitado" },
  atrasado: { variant: "destructive", label: "Atrasado" },
  em_dia: { variant: "secondary", label: "Em dia" },
};

// "YYYY-MM-DD" → "dd/mm"
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function PassageirosView() {
  const excursaoId = useSearchParams().get("id") ?? "";
  const router = useRouter();

  const [excursao, setExcursao] = useState<Excursao | null>(null);
  const [resumo, setResumo] = useState<ResumoExcursao | null>(null);
  const [passageiros, setPassageiros] = useState<PassageiroRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<FiltroStatus>("todos");
  const [ordem, setOrdem] = useState<Ordem>("num");

  // modo seleção
  const [selecionando, setSelecionando] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [valorOpen, setValorOpen] = useState(false);
  const [valorStr, setValorStr] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [parcelarOpen, setParcelarOpen] = useState(false);

  // novo passageiro
  const [novoOpen, setNovoOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!excursaoId) return;
    try {
      const [exc, res, pax] = await Promise.all([
        getExcursao(excursaoId),
        getResumo(excursaoId),
        listPassageiros(excursaoId),
      ]);
      setExcursao(exc);
      setResumo(res);
      setPassageiros(pax);
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

  // Nº fixo pela ordem de cadastro — calculado ANTES de filtro/ordenação.
  const numerados = useMemo(() => passageiros.map((p, i) => ({ ...p, num: i + 1 })), [passageiros]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const l = numerados.filter(
      (p) =>
        (fStatus === "todos" || p.status_pagamento === fStatus) &&
        (!q || p.nome.toLowerCase().includes(q)),
    );
    if (ordem === "nome") return [...l].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (ordem === "divida") return [...l].sort((a, b) => b.saldo - a.saldo);
    if (ordem === "vence")
      return [...l].sort((a, b) =>
        (a.proximo_vencimento ?? "9999").localeCompare(b.proximo_vencimento ?? "9999"),
      );
    return l;
  }, [numerados, busca, fStatus, ordem]);

  const recebido = Number(resumo?.total_recebido ?? 0);
  const aReceber = Number(resumo?.total_a_receber ?? 0);
  const falta = aReceber - recebido;

  // ---- seleção ----
  function limparSelecao() {
    setSel(new Set());
    setSelecionando(false);
  }
  function toggleSel(id: string) {
    setSel((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }
  const todosVisiveisSel = lista.length > 0 && lista.every((p) => sel.has(p.id));
  function toggleTodos() {
    setSel(todosVisiveisSel ? new Set() : new Set(lista.map((p) => p.id)));
  }

  const alvos = useMemo(
    () =>
      passageiros
        .filter((p) => sel.has(p.id))
        .map((p) => ({ id: p.id, nome: p.nome, valor_total: p.valor_total })),
    [passageiros, sel],
  );

  async function aplicarValor() {
    const v = parseValor(valorStr);
    if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido");
    setAplicando(true);
    try {
      await bulkSetValor([...sel], v);
      toast.success(`Valor de ${brl(v)} aplicado a ${sel.size} passageiro${sel.size > 1 ? "s" : ""}`);
      setValorOpen(false);
      setValorStr("");
      limparSelecao();
      load();
    } catch (e) {
      toast.error("Erro ao aplicar valor", { description: String((e as Error).message) });
    } finally {
      setAplicando(false);
    }
  }

  async function confirmarParcelamento(n: number, primeiroVenc: string) {
    try {
      const { ok, pulados } = await parcelar([...sel], n, primeiroVenc);
      if (pulados > 0)
        toast.success(`${ok} parcelados · ${pulados} pulados (já têm parcelas pagas ou sem valor)`);
      else toast.success(`${ok} parcelado${ok > 1 ? "s" : ""} em ${n}x`);
      limparSelecao();
      load();
    } catch (e) {
      toast.error("Erro ao parcelar", { description: String((e as Error).message) });
    }
  }

  // ---- ações por linha ----
  async function pagar(p: PassageiroRow) {
    haptic();
    try {
      const r = await pagarProximaParcela(p.id);
      if (!r) toast.info("Sem parcela em aberto");
      else {
        toast.success(`Parcela ${r.numero} · ${brl(r.valor)} recebida`);
        load();
      }
    } catch (e) {
      toast.error("Erro ao registrar pagamento", { description: String((e as Error).message) });
    }
  }

  async function adicionar(continuar: boolean) {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSalvando(true);
    try {
      await addPassageiro(excursaoId, nome.trim());
      toast.success(`${nome.trim()} adicionado`);
      setNome("");
      if (continuar) nomeRef.current?.focus();
      else setNovoOpen(false);
      load();
    } catch (e) {
      toast.error("Erro ao adicionar", { description: String((e as Error).message) });
    } finally {
      setSalvando(false);
    }
  }

  if (!excursaoId)
    return <p className="p-8 text-center text-muted-foreground">Excursão não informada.</p>;

  const cols = selecionando
    ? "grid-cols-[1.25rem_2rem_minmax(0,1fr)_5rem_5rem_6rem_2.75rem]"
    : "grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_6rem_2.75rem]";
  const semResultado = !loading && passageiros.length > 0 && lista.length === 0;

  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
        {/* Header */}
        <header className="mb-5 flex items-center gap-2">
          <Link
            href="/"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.375rem] font-semibold tracking-tight">Passageiros</h1>
            {excursao && (
              <p className="truncate text-sm text-muted-foreground">
                {excursao.nome}
                {!loading &&
                  ` · ${passageiros.length} passageiro${passageiros.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
        </header>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-lg bg-white/[0.04]" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        ) : passageiros.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <span className="surface mb-4 grid size-16 place-items-center rounded-full">
              <Users className="size-7 text-faint" strokeWidth={1.5} />
            </span>
            <p className="font-semibold">Nenhum passageiro</p>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">Cadastre o primeiro.</p>
            <Button onClick={() => setNovoOpen(true)}>
              <Plus /> Novo passageiro
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo financeiro */}
            <section className="glass-card grid grid-cols-3 gap-1 rounded-lg p-4">
              <div className="min-w-0">
                <p className="text-xs text-faint">Recebido</p>
                <p className="money mt-0.5 truncate text-sm font-semibold text-success">
                  {brl(recebido)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-faint">A receber</p>
                <p className="money mt-0.5 truncate text-sm font-semibold">{brl(aReceber)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-faint">Falta</p>
                <p
                  className={`money mt-0.5 truncate text-sm font-semibold ${
                    falta > 0 ? "text-destructive" : "text-faint"
                  }`}
                >
                  {brl(falta)}
                </p>
              </div>
            </section>

            {/* Toolbar */}
            <div className="space-y-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-faint"
                  strokeWidth={1.75}
                />
                <Input
                  aria-label="Buscar passageiro"
                  placeholder="Buscar por nome"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTROS.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    onClick={() => {
                      haptic();
                      setFStatus(f.v);
                    }}
                    aria-pressed={fStatus === f.v}
                    className={`inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium transition-colors duration-150 active:scale-95 ${
                      fStatus === f.v
                        ? "bg-white/10 text-foreground"
                        : "text-faint hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <SelectField
                  id="ordem"
                  value={ordem}
                  onValueChange={(v) => setOrdem(v as Ordem)}
                  options={ORDENS}
                  className="h-11 flex-1 text-sm data-[size=default]:h-11"
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    haptic();
                    if (selecionando) limparSelecao();
                    else setSelecionando(true);
                  }}
                  aria-pressed={selecionando}
                >
                  <CheckSquare strokeWidth={1.75} />
                  {selecionando ? "Cancelar" : "Selecionar"}
                </Button>
              </div>
            </div>

            {/* Tabela */}
            {semResultado ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum resultado para {busca.trim() ? `“${busca.trim()}”` : "esse filtro"}.
              </p>
            ) : (
              <section className="glass-card overflow-x-auto rounded-lg">
                <div className="min-w-[560px]">
                  {/* Header */}
                  <div
                    className={`grid ${cols} items-center gap-2 border-b border-white/8 px-3 py-2.5 text-xs uppercase tracking-wide text-faint`}
                  >
                    {selecionando && (
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={todosVisiveisSel}
                        onChange={toggleTodos}
                        aria-label="Selecionar todos"
                      />
                    )}
                    <span>Nº</span>
                    <span>Nome</span>
                    <span className="text-right">Total</span>
                    <span className="text-right">Pago</span>
                    <span className="text-right">Falta</span>
                    <span aria-hidden="true" />
                  </div>

                  {lista.map((p) => {
                    const quitado = p.status_pagamento === "quitado";
                    const badge = BADGE[p.status_pagamento];
                    const marcado = sel.has(p.id);
                    return (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (selecionando) toggleSel(p.id);
                          else router.push("/passageiro?id=" + p.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selecionando) toggleSel(p.id);
                            else router.push("/passageiro?id=" + p.id);
                          }
                        }}
                        className={`grid ${cols} min-h-11 cursor-pointer items-center gap-2 border-b border-white/[0.04] px-3 py-2 outline-none transition-colors duration-150 last:border-b-0 hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/60 active:scale-[0.995] ${
                          marcado ? "bg-white/[0.05]" : ""
                        }`}
                      >
                        {selecionando && (
                          <input
                            type="checkbox"
                            className="pointer-events-none size-4 accent-primary"
                            checked={marcado}
                            readOnly
                            tabIndex={-1}
                            aria-label={`Selecionar ${p.nome}`}
                          />
                        )}
                        <span className="text-sm tabular-nums text-faint">{p.num}</span>
                        <span className="truncate text-sm font-medium">{p.nome}</span>
                        <span className="money text-right text-[13px] text-muted-foreground">
                          {brl(p.valor_total)}
                        </span>
                        <span className="money text-right text-[13px] text-muted-foreground">
                          {brl(p.valor_pago)}
                        </span>
                        <div className="min-w-0 text-right">
                          <p
                            className={`money text-sm font-semibold ${
                              quitado ? "text-success" : "text-foreground"
                            }`}
                          >
                            {quitado ? "—" : brl(p.saldo)}
                          </p>
                          <div className="mt-0.5 flex items-center justify-end gap-1.5">
                            <Badge variant={badge.variant} className="h-[18px] px-1.5 text-[10px]">
                              {badge.label}
                            </Badge>
                            {!quitado && p.proximo_vencimento && (
                              <span className="text-[11px] text-faint">
                                vence {ddmm(p.proximo_vencimento)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={quitado}
                          aria-label="Pagar próxima parcela"
                          onClick={(e) => {
                            e.stopPropagation();
                            pagar(p);
                          }}
                        >
                          <Zap className="size-5" strokeWidth={1.75} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Barra de ações do modo seleção */}
      {selecionando && (
        <div className="glass-float fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-2 rounded-lg px-4 py-3 md:max-w-2xl">
          <span className="flex-1 truncate text-sm font-medium">
            {sel.size} selecionado{sel.size === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="secondary" disabled={sel.size === 0} onClick={() => setValorOpen(true)}>
            Valor
          </Button>
          <Button size="sm" disabled={sel.size === 0} onClick={() => setParcelarOpen(true)}>
            Parcelar
          </Button>
        </div>
      )}

      {!loading && !selecionando && (
        <Fab label="Novo passageiro" onClick={() => setNovoOpen(true)}>
          <Plus className="size-6" strokeWidth={2} />
        </Fab>
      )}

      {/* Novo passageiro — cadastro em série */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Novo passageiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="p-nome">Nome</Label>
            <Input
              id="p-nome"
              ref={nomeRef}
              placeholder="Ex: Maria da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar(true)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" disabled={salvando} onClick={() => adicionar(true)}>
              Adicionar e continuar
            </Button>
            <Button disabled={salvando} onClick={() => adicionar(false)}>
              {salvando ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Valor em massa */}
      <Dialog open={valorOpen} onOpenChange={setValorOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>
              Definir valor — {sel.size} passageiro{sel.size === 1 ? "" : "s"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="p-valor">Valor por passageiro (R$)</Label>
            <Input
              id="p-valor"
              inputMode="decimal"
              placeholder="1.450,00"
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={aplicarValor} disabled={aplicando} className="w-full" size="lg">
              {aplicando ? "Aplicando…" : "Aplicar valor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParcelamentoDialog
        open={parcelarOpen}
        onOpenChange={setParcelarOpen}
        alvos={alvos}
        onConfirm={confirmarParcelamento}
      />
    </>
  );
}

export default function PassageirosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}>
      <PassageirosView />
    </Suspense>
  );
}
