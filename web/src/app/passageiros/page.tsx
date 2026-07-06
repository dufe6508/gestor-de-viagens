"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  listPassageiros,
  addPassageiro,
  bulkSetValor,
  parcelar,
  getPassageiroDetalhe,
  parseValor,
  type PassageiroRow,
  type StatusPagamento,
} from "@/lib/passageiros";
import { getExcursao, getResumo } from "@/lib/data";
import type { Excursao, ResumoExcursao } from "@/lib/types";
import { brl } from "@/lib/format";
import { haptic } from "@/lib/utils";
import { StatusBadge, derivarStatus } from "@/components/status-badge";
import { ParcelamentoDialog } from "@/components/parcelamento-dialog";
import { PassageiroDetalhe } from "@/components/passageiro-detalhe";
import { PagamentoFlow, type FlowTarget } from "@/components/pagamento-flow";
import { Fab } from "@/components/fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  { value: "nome", label: "Nome A–Z" },
  { value: "divida", label: "Maior dívida" },
  { value: "vence", label: "Vence antes" },
  { value: "num", label: "Cadastro" },
];

const PAGE_SIZE = 20;

// Categoria no cadastro (opcional). Sem categoria = vaga normal.
type Tipo = "familia" | "infantil";
const VALOR_NORMAL = 1450;
const VALOR_TIPO: Record<Tipo, number> = { familia: 650, infantil: 0 };

// "YYYY-MM-DD" → "dd/mm"
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function PassageirosView() {
  const excursaoId = useSearchParams().get("id") ?? "";

  const [excursao, setExcursao] = useState<Excursao | null>(null);
  const [resumo, setResumo] = useState<ResumoExcursao | null>(null);
  const [passageiros, setPassageiros] = useState<PassageiroRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<FiltroStatus>("todos");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const [pagina, setPagina] = useState(1);

  // modal de detalhe + fluxo de pagamento
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [flowTarget, setFlowTarget] = useState<FlowTarget | null>(null);

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
  const [tipo, setTipo] = useState<Tipo | null>(null);
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

  // Fundo corporativo chapado (sem glow) só nesta tela.
  useEffect(() => {
    document.body.classList.add("flat-bg");
    return () => document.body.classList.remove("flat-bg");
  }, []);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const l = passageiros.filter(
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
    return l; // "num" = ordem de cadastro (created_at)
  }, [passageiros, busca, fStatus, ordem]);

  // Paginação — o Nº mostrado é a posição na lista ordenada (sequencial entre páginas).
  const totalPaginas = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * PAGE_SIZE;
  const visiveis = lista.slice(inicio, inicio + PAGE_SIZE);

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

  // Botão de pagamento por linha → abre o fluxo (integral ou menu de parcelas).
  async function abrirPagamento(p: PassageiroRow) {
    haptic();
    try {
      const det = await getPassageiroDetalhe(p.id);
      setFlowTarget({ id: p.id, nome: p.nome, saldo: det.passageiro.saldo, parcelas: det.parcelas });
    } catch (e) {
      toast.error("Erro ao abrir pagamento", { description: String((e as Error).message) });
    }
  }

  async function adicionar(continuar: boolean) {
    if (!nome.trim()) return toast.error("Informe o nome");
    const valor = tipo ? VALOR_TIPO[tipo] : VALOR_NORMAL;
    setSalvando(true);
    try {
      await addPassageiro(excursaoId, nome.trim(), valor);
      toast.success(`${nome.trim()} adicionado`);
      setNome("");
      setTipo(null);
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
            {/* Hero financeiro — respiro + hierarquia */}
            <section className="rounded-xl border border-border bg-white/[0.02] p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Falta receber
              </p>
              <p className="money mt-1 text-[2rem] font-semibold leading-none">{brl(Math.max(falta, 0))}</p>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${aReceber > 0 ? Math.min(100, (recebido / aReceber) * 100) : 0}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-faint">
                  {aReceber > 0 ? Math.round((recebido / aReceber) * 100) : 0}%
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Recebido</p>
                  <p className="money mt-0.5 truncate text-[15px] font-semibold text-success">
                    {brl(recebido)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Total</p>
                  <p className="money mt-0.5 truncate text-[15px] font-semibold">{brl(aReceber)}</p>
                </div>
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
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPagina(1);
                  }}
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
                      setPagina(1);
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
                  onValueChange={(v) => {
                    setOrdem(v as Ordem);
                    setPagina(1);
                  }}
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

            {/* Selecionar todos (modo seleção) */}
            {selecionando && lista.length > 0 && (
              <button
                type="button"
                onClick={toggleTodos}
                className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <input
                  type="checkbox"
                  className="pointer-events-none size-4 accent-primary"
                  checked={todosVisiveisSel}
                  readOnly
                  tabIndex={-1}
                  aria-hidden
                />
                {todosVisiveisSel ? "Limpar seleção" : `Selecionar todos (${lista.length})`}
              </button>
            )}

            {/* Lista de passageiros */}
            {semResultado ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum resultado para {busca.trim() ? `“${busca.trim()}”` : "esse filtro"}.
              </p>
            ) : (
              <section className="overflow-hidden rounded-xl border border-border bg-white/[0.02]">
                <ul className="divide-y divide-border">
                  {visiveis.map((p, i) => {
                    const kind = derivarStatus(p);
                    const quitado = kind === "quitado";
                    const marcado = sel.has(p.id);
                    const vencCor =
                      kind === "atrasado"
                        ? "text-destructive"
                        : kind === "vence_hoje" || kind === "vence_breve"
                          ? "text-warning"
                          : "text-faint";
                    return (
                      <li key={p.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Abrir ${p.nome}`}
                          onClick={() => {
                            if (selecionando) toggleSel(p.id);
                            else setDetalheId(p.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (selecionando) toggleSel(p.id);
                              else setDetalheId(p.id);
                            }
                          }}
                          className={`flex min-h-[80px] cursor-pointer items-center gap-3.5 px-4 py-4 outline-none transition-colors duration-150 hover:bg-white/[0.025] focus-visible:bg-white/[0.05] ${
                            marcado ? "bg-white/[0.05]" : ""
                          }`}
                        >
                          {selecionando ? (
                            <input
                              type="checkbox"
                              className="pointer-events-none size-5 shrink-0 accent-primary"
                              checked={marcado}
                              readOnly
                              tabIndex={-1}
                              aria-label={`Selecionar ${p.nome}`}
                            />
                          ) : (
                            <span className="w-5 shrink-0 text-center text-[13px] tabular-nums text-faint">
                              {inicio + i + 1}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                                {p.nome}
                              </span>
                              <StatusBadge kind={kind} />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
                              <span className="money shrink-0 whitespace-nowrap">
                                <span className="text-foreground">{brl(p.valor_pago)}</span>
                                <span className="text-faint"> / {brl(p.valor_total)}</span>
                              </span>
                              {!quitado && p.proximo_vencimento && (
                                <span className={`shrink-0 tabular-nums ${vencCor}`}>
                                  venc. {ddmm(p.proximo_vencimento)}
                                </span>
                              )}
                            </div>
                          </div>
                          {!selecionando && (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={quitado}
                              aria-label={`Registrar pagamento de ${p.nome}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirPagamento(p);
                              }}
                            >
                              <CircleDollarSign className="size-5" strokeWidth={1.75} />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {totalPaginas > 1 && (
                  <div className="flex items-center justify-center gap-5 border-t border-border px-3 py-2.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={paginaSegura <= 1}
                      onClick={() => setPagina((n) => Math.max(1, n - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft strokeWidth={1.75} />
                    </Button>
                    <span className="text-[13px] tabular-nums text-muted-foreground">
                      Página {paginaSegura} de {totalPaginas}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={paginaSegura >= totalPaginas}
                      onClick={() => setPagina((n) => Math.min(totalPaginas, n + 1))}
                      aria-label="Próxima página"
                    >
                      <ChevronRight strokeWidth={1.75} />
                    </Button>
                  </div>
                )}
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
        <Fab
          label="Novo passageiro"
          onClick={() => setNovoOpen(true)}
          className="bottom-[calc(6.75rem+env(safe-area-inset-bottom))]"
        >
          <Plus className="size-6" strokeWidth={2} />
        </Fab>
      )}

      {/* Novo passageiro — cadastro em série */}
      <Dialog
        open={novoOpen}
        onOpenChange={(o) => {
          setNovoOpen(o);
          if (!o) setTipo(null);
        }}
      >
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Novo passageiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Categoria (opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["familia", "infantil"] as Tipo[]).map((t) => {
                  const ativo = tipo === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo((cur) => (cur === t ? null : t))}
                      aria-pressed={ativo}
                      className={`flex flex-col items-start gap-0.5 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                        ativo
                          ? "border-primary bg-white/[0.06]"
                          : "border-border hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {t === "familia" ? "Família" : "Infantil"}
                      </span>
                      <span className="money text-xs text-faint">
                        {VALOR_TIPO[t] > 0 ? brl(VALOR_TIPO[t]) : "Grátis"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-faint">
                Sem categoria = vaga normal ({brl(VALOR_NORMAL)}). Ajustável depois.
              </p>
            </div>
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

      {/* Detalhe do passageiro — modal (sem trocar de página) */}
      <Dialog open={detalheId != null} onOpenChange={(o) => !o && setDetalheId(null)}>
        <DialogContent variant="sheet" showCloseButton={false}>
          {detalheId && (
            <PassageiroDetalhe
              id={detalheId}
              onClose={() => setDetalheId(null)}
              onChanged={load}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Fluxo de pagamento pelo botão da lista */}
      <PagamentoFlow
        target={flowTarget}
        onOpenChange={(o) => !o && setFlowTarget(null)}
        onDone={load}
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
