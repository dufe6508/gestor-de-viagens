"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Search,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ArrowDownUp,
  Tag,
  Settings2,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  listCategorias,
  listDespesas,
  createDespesa,
  updateDespesa,
  deleteDespesa,
  createCategoria,
  updateCategoria,
  resumirPorCategoria,
  parseValor,
  type Categoria,
  type DespesaRow,
  type DespesaInput,
  type StatusDespesa,
} from "@/lib/despesas";
import { listExcursoes } from "@/lib/data";
import type { Excursao } from "@/lib/types";
import { brl } from "@/lib/format";
import { DespesasDonut, type DonutSegment } from "@/components/despesas-donut";
import { CategoriaIcon, ICON_OPTIONS, COR_OPTIONS, muteColor } from "@/components/despesas-icons";
import { Fab } from "@/components/fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Periodo = "todos" | "30d" | "mes" | "ano";
type Ordem = "data" | "valor";

const hoje = () => new Date().toISOString().slice(0, 10);

function dentroDoPeriodo(data: string | null, periodo: Periodo): boolean {
  if (periodo === "todos") return true;
  if (!data) return false;
  const d = new Date(data + "T00:00:00");
  const agora = new Date();
  if (periodo === "30d") {
    const lim = new Date(agora);
    lim.setDate(lim.getDate() - 30);
    return d >= lim;
  }
  if (periodo === "mes")
    return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
  return d.getFullYear() === agora.getFullYear(); // ano
}

// ---- Tela ----

function DespesasView() {
  const urlExcursao = useSearchParams().get("id") ?? "todas";

  const [excursoes, setExcursoes] = useState<Excursao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [despesas, setDespesas] = useState<DespesaRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [fExcursao, setFExcursao] = useState(urlExcursao);
  const [fCategoria, setFCategoria] = useState<string | null>(null); // seleção = drilldown
  const [fPeriodo, setFPeriodo] = useState<Periodo>("todos");
  const [fValorMin, setFValorMin] = useState("");
  const [fValorMax, setFValorMax] = useState("");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("data");
  const [listaAberta, setListaAberta] = useState(false);

  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exc, cats, desp] = await Promise.all([
        listExcursoes(),
        listCategorias(true),
        listDespesas(),
      ]);
      setExcursoes(exc);
      setCategorias(cats);
      setDespesas(desp);
    } catch (e) {
      toast.error("Erro ao carregar", { description: String((e as Error).message) });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const base = useMemo(() => {
    const min = parseValor(fValorMin);
    const max = parseValor(fValorMax);
    const q = busca.trim().toLowerCase();
    return despesas.filter((d) => {
      if (fExcursao !== "todas" && d.excursao_id !== fExcursao) return false;
      if (!dentroDoPeriodo(d.data, fPeriodo)) return false;
      if (min != null && d.valor < min) return false;
      if (max != null && d.valor > max) return false;
      if (q && !d.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [despesas, fExcursao, fPeriodo, fValorMin, fValorMax, busca]);

  const resumoCategorias = useMemo(() => resumirPorCategoria(base), [base]);
  const total = useMemo(() => base.reduce((s, d) => s + d.valor, 0), [base]);
  const media = base.length ? total / base.length : 0;
  const maior = resumoCategorias[0] ?? null;

  const segments: DonutSegment[] = resumoCategorias.map((r) => ({
    id: r.categoria_id ?? "__sem__",
    label: r.nome,
    cor: muteColor(r.cor),
    valor: r.total,
    pct: r.pct,
  }));

  const lista = useMemo(() => {
    let l = base;
    if (fCategoria) l = l.filter((d) => (d.categoria_id ?? "__sem__") === fCategoria);
    return [...l].sort((a, b) =>
      ordem === "valor" ? b.valor - a.valor : (b.data ?? "").localeCompare(a.data ?? ""),
    );
  }, [base, fCategoria, ordem]);

  const catSelecionada = fCategoria
    ? resumoCategorias.find((r) => (r.categoria_id ?? "__sem__") === fCategoria)
    : null;

  const filtrosAtivos =
    (fExcursao !== "todas" ? 1 : 0) +
    (fPeriodo !== "todos" ? 1 : 0) +
    (fValorMin.trim() || fValorMax.trim() ? 1 : 0);

  // Abre a lista automaticamente quando há drilldown de categoria.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fCategoria) setListaAberta(true);
  }, [fCategoria]);

  // ---- CRUD despesa ----
  const [despOpen, setDespOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DespForm>({
    nome: "",
    categoria_id: "",
    valor: "",
    data: hoje(),
    status: "pago",
    excursao_id: "",
  });

  function abrirNova() {
    const excDefault = fExcursao !== "todas" ? fExcursao : excursoes[0]?.id ?? "";
    setEditId(null);
    setForm({
      nome: "",
      categoria_id: fCategoria && fCategoria !== "__sem__" ? fCategoria : categorias[0]?.id ?? "",
      valor: "",
      data: hoje(),
      status: "pago",
      excursao_id: excDefault,
    });
    setDespOpen(true);
  }

  function abrirEdicao(d: DespesaRow) {
    setEditId(d.id);
    setForm({
      nome: d.nome,
      categoria_id: d.categoria_id ?? "",
      valor: String(d.valor).replace(".", ","),
      data: d.data ?? hoje(),
      status: d.status,
      excursao_id: d.excursao_id,
    });
    setDespOpen(true);
  }

  async function salvarDespesa() {
    const valor = parseValor(form.valor);
    if (!form.nome.trim()) return toast.error("Informe a descrição");
    if (valor == null || valor <= 0) return toast.error("Valor inválido");
    if (!form.excursao_id) return toast.error("Selecione a excursão");
    // Campos secundários (forma/responsável/obs) foram removidos do fluxo — preserva o que já existe na edição.
    const orig = editId ? despesas.find((d) => d.id === editId) : null;
    const input: DespesaInput = {
      excursao_id: form.excursao_id,
      nome: form.nome.trim(),
      categoria_id: form.categoria_id || null,
      valor,
      data: form.data || null,
      status: form.status,
      forma_pagamento: orig?.forma_pagamento ?? null,
      responsavel: orig?.responsavel ?? null,
      obs: orig?.obs ?? null,
    };
    setSaving(true);
    try {
      if (editId) await updateDespesa(editId, input);
      else await createDespesa(input);
      toast.success(editId ? "Despesa atualizada" : "Despesa lançada");
      setDespOpen(false);
      load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: String((e as Error).message) });
    } finally {
      setSaving(false);
    }
  }

  const [delAlvo, setDelAlvo] = useState<DespesaRow | null>(null);
  async function confirmarExclusao() {
    if (!delAlvo) return;
    try {
      await deleteDespesa(delAlvo.id);
      toast.success("Despesa excluída");
      setDelAlvo(null);
      load();
    } catch (e) {
      toast.error("Erro ao excluir", { description: String((e as Error).message) });
    }
  }

  const semExcursao = !loading && excursoes.length === 0;

  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
        {/* Header */}
        <header className="mb-5 flex items-center gap-2">
          <Link
            href="/"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <h1 className="flex-1 text-[1.375rem] font-semibold tracking-tight">Despesas</h1>
          <button
            onClick={() => setCatsOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
            aria-label="Gerenciar categorias"
          >
            <Settings2 className="size-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setFiltrosOpen(true)}
            className="relative grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="size-5" strokeWidth={1.75} />
            {filtrosAtivos > 0 && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
            )}
          </button>
        </header>

        {loading ? (
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-72 animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
        ) : semExcursao ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <p className="text-lg font-semibold">Nenhuma excursão</p>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              Crie uma excursão para lançar despesas.
            </p>
            <Button render={<Link href="/" />} size="lg">
              Ir para início
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filtro de excursão ativo (chip) */}
            {fExcursao !== "todas" && (
              <div className="flex items-center gap-2 text-sm text-faint">
                <span>{excursoes.find((e) => e.id === fExcursao)?.nome}</span>
                <button
                  onClick={() => setFExcursao("todas")}
                  className="text-primary hover:underline"
                >
                  ver todas
                </button>
              </div>
            )}

            {/* Hero de resumo — total + indicadores em linha */}
            <section className="surface rounded-lg p-5">
              <p className="text-sm text-muted-foreground">Total gasto</p>
              <p className="money mt-1.5 text-[2.25rem] font-semibold leading-none text-foreground">
                {brl(total)}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-1 border-t border-white/8 pt-4">
                <Indicador label="Despesas" value={String(base.length)} />
                <Indicador label="Média" value={brl(media)} money />
                <Indicador
                  label="Maior"
                  value={maior ? maior.nome : "—"}
                  dot={maior ? muteColor(maior.cor) : undefined}
                />
              </div>
            </section>

            {base.length === 0 ? (
              <div className="mt-10 flex flex-col items-center text-center">
                <span className="surface mb-4 grid size-16 place-items-center rounded-full">
                  <Tag className="size-7 text-faint" strokeWidth={1.5} />
                </span>
                <p className="font-semibold">Nenhuma despesa</p>
                <p className="mt-1 mb-5 text-sm text-muted-foreground">
                  {filtrosAtivos > 0 ? "Ajuste os filtros ou lance uma nova." : "Lance a primeira."}
                </p>
                <Button onClick={abrirNova}>
                  <Plus /> Nova despesa
                </Button>
              </div>
            ) : (
              <>
                {/* Composição de gastos — donut compacto + legenda */}
                <section className="surface rounded-lg p-5">
                  <div className="mb-1 flex items-baseline justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Composição</p>
                    {fCategoria && (
                      <button
                        onClick={() => setFCategoria(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        limpar seleção
                      </button>
                    )}
                  </div>

                  <div className="flex justify-center py-2">
                    <DespesasDonut
                      segments={segments}
                      total={total}
                      quantidade={base.length}
                      selectedId={fCategoria}
                      onSelect={setFCategoria}
                    />
                  </div>

                  {/* Legenda: linhas minimalistas, seleção evidente */}
                  <ul className="mt-5 space-y-0.5">
                    {resumoCategorias.map((r) => {
                      const id = r.categoria_id ?? "__sem__";
                      const active = fCategoria === id;
                      const cor = muteColor(r.cor);
                      return (
                        <li key={id}>
                          <button
                            onClick={() => setFCategoria(active ? null : id)}
                            className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-all duration-150 ${
                              active
                                ? "bg-primary/12 ring-1 ring-inset ring-primary/30"
                                : "opacity-90 hover:bg-white/[0.03] hover:opacity-100"
                            }`}
                          >
                            <span
                              className="size-2.5 shrink-0 rounded-full transition-transform duration-150"
                              style={{
                                backgroundColor: cor,
                                boxShadow: active ? `0 0 0 3px ${cor}33` : undefined,
                              }}
                            />
                            <span
                              className={`min-w-0 flex-1 truncate text-sm ${active ? "font-semibold" : "font-medium"}`}
                            >
                              {r.nome}
                            </span>
                            <span className="money shrink-0 text-sm text-muted-foreground">
                              {brl(r.total)}
                            </span>
                            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-faint">
                              {Math.round(r.pct * 100)}%
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {/* Lançamentos — accordion recolhido */}
                <section className="surface overflow-hidden rounded-lg">
                  <button
                    onClick={() => setListaAberta((v) => !v)}
                    className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
                    aria-expanded={listaAberta}
                  >
                    <span className="flex-1 text-base font-semibold">
                      {catSelecionada ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: muteColor(catSelecionada.cor) }}
                          />
                          {catSelecionada.nome}
                        </span>
                      ) : (
                        "Lançamentos"
                      )}
                      <span className="ml-1.5 text-faint">· {lista.length}</span>
                    </span>
                    {fCategoria && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFCategoria(null);
                        }}
                        className="rounded-full px-2 py-1 text-xs text-faint hover:text-foreground"
                      >
                        limpar
                      </span>
                    )}
                    <ChevronDown
                      className={`size-4 shrink-0 text-faint transition-transform duration-300 ease-(--ease-enter) ${
                        listaAberta ? "rotate-180" : ""
                      }`}
                      strokeWidth={2}
                    />
                  </button>

                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-(--ease-move)"
                    style={{ gridTemplateRows: listaAberta ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-white/8 px-3 pt-3 pb-3">
                        {/* controles */}
                        <div className="mb-2 flex items-center gap-2">
                          {base.length > 4 && (
                            <div className="relative flex-1">
                              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                              <Input
                                placeholder="Buscar"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="h-10 pl-9 text-sm"
                              />
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setOrdem(ordem === "data" ? "valor" : "data")}
                          >
                            <ArrowDownUp />
                            {ordem === "data" ? "Data" : "Valor"}
                          </Button>
                        </div>

                        <ul className="space-y-0.5">
                          {lista.map((d) => (
                            <li
                              key={d.id}
                              className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-white/[0.03]"
                            >
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-muted-foreground">
                                <CategoriaIcon nome={d.categoria_icone} className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-medium">{d.nome}</span>
                                  {d.status === "previsto" && (
                                    <Badge variant="warning" className="h-[18px] shrink-0 px-1.5 text-[10px]">
                                      Previsto
                                    </Badge>
                                  )}
                                </div>
                                <p className="truncate text-xs text-faint">
                                  {d.categoria_nome}
                                  {d.data &&
                                    ` · ${new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
                                </p>
                              </div>
                              <span className="money shrink-0 text-sm font-semibold">
                                {brl(d.valor)}
                              </span>
                              <div className="flex shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100">
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => abrirEdicao(d)}
                                  aria-label={`Editar ${d.nome}`}
                                  className="size-8"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => setDelAlvo(d)}
                                  aria-label={`Excluir ${d.nome}`}
                                  className="size-8"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {!loading && !semExcursao && (
        <Fab label="Nova despesa" onClick={abrirNova}>
          <Plus className="size-6" strokeWidth={2} />
        </Fab>
      )}

      <DespesaDialog
        open={despOpen}
        onOpenChange={setDespOpen}
        editing={editId != null}
        form={form}
        setForm={setForm}
        categorias={categorias}
        excursoes={excursoes}
        saving={saving}
        onSave={salvarDespesa}
      />

      <FiltrosDialog
        open={filtrosOpen}
        onOpenChange={setFiltrosOpen}
        excursoes={excursoes}
        fExcursao={fExcursao}
        setFExcursao={setFExcursao}
        fPeriodo={fPeriodo}
        setFPeriodo={setFPeriodo}
        fValorMin={fValorMin}
        setFValorMin={setFValorMin}
        fValorMax={fValorMax}
        setFValorMax={setFValorMax}
        onLimpar={() => {
          setFExcursao("todas");
          setFPeriodo("todos");
          setFValorMin("");
          setFValorMax("");
        }}
      />

      <CategoriasDialog
        open={catsOpen}
        onOpenChange={setCatsOpen}
        categorias={categorias}
        onChanged={load}
      />

      {/* Confirmar exclusão — dialog central curto */}
      <Dialog open={delAlvo != null} onOpenChange={(o) => !o && setDelAlvo(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Excluir despesa?</DialogTitle>
          </DialogHeader>
          {delAlvo && (
            <p className="text-sm text-muted-foreground">
              &ldquo;{delAlvo.nome}&rdquo; ({brl(delAlvo.valor)}) será removida. Não dá para
              desfazer.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelAlvo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao}>
              <Trash2 /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Subcomponentes ----

function Indicador({
  label,
  value,
  money,
  dot,
}: {
  label: string;
  value: string;
  money?: boolean;
  dot?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-faint">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5">
        {dot && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
        <span className={`truncate text-sm font-semibold ${money ? "money" : ""}`}>{value}</span>
      </p>
    </div>
  );
}

/** Chip de escolha — categoria, período, situação. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-[border-color,background-color,color] duration-150 active:scale-95 ${
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-[0_2px_10px_-3px_rgb(0_0_0_/_0.6)]"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

type DespForm = {
  nome: string;
  categoria_id: string;
  valor: string;
  data: string;
  status: StatusDespesa;
  excursao_id: string;
};

function DespesaDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  categorias,
  excursoes,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: boolean;
  form: DespForm;
  setForm: (f: DespForm) => void;
  categorias: Categoria[];
  excursoes: Excursao[];
  saving: boolean;
  onSave: () => void;
}) {
  const cats = categorias.filter((c) => c.ativo || c.id === form.categoria_id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar despesa" : "Nova despesa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="d-nome">Descrição</Label>
            <Input
              id="d-nome"
              placeholder="Ex: Compras no mercado"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="d-valor">Valor (R$)</Label>
              <Input
                id="d-valor"
                inputMode="decimal"
                placeholder="350,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-data">Data</Label>
              <Input
                id="d-data"
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
          </div>

          {/* Categoria — chips */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => {
                const active = form.categoria_id === c.id;
                return (
                  <Chip
                    key={c.id}
                    active={active}
                    onClick={() => setForm({ ...form, categoria_id: c.id })}
                  >
                    <CategoriaIcon nome={c.icone} className="size-3.5 opacity-70" />
                    {c.nome}
                  </Chip>
                );
              })}
            </div>
          </div>

          {/* Situação */}
          <div className="space-y-1.5">
            <Label>Situação</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["pago", "previsto"] as StatusDespesa[]).map((s) => (
                <Chip
                  key={s}
                  active={form.status === s}
                  onClick={() => setForm({ ...form, status: s })}
                >
                  <span className="mx-auto">{s === "pago" ? "Pago" : "Previsto"}</span>
                </Chip>
              ))}
            </div>
          </div>

          {excursoes.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="d-exc">Excursão</Label>
              <NativeSelect
                id="d-exc"
                value={form.excursao_id}
                onChange={(e) => setForm({ ...form, excursao_id: e.target.value })}
              >
                {excursoes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onSave} disabled={saving} className="w-full" size="lg">
            {saving ? "Salvando…" : editing ? "Salvar" : "Lançar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FiltrosDialog({
  open,
  onOpenChange,
  excursoes,
  fExcursao,
  setFExcursao,
  fPeriodo,
  setFPeriodo,
  fValorMin,
  setFValorMin,
  fValorMax,
  setFValorMax,
  onLimpar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  excursoes: Excursao[];
  fExcursao: string;
  setFExcursao: (v: string) => void;
  fPeriodo: Periodo;
  setFPeriodo: (v: Periodo) => void;
  fValorMin: string;
  setFValorMin: (v: string) => void;
  fValorMax: string;
  setFValorMax: (v: string) => void;
  onLimpar: () => void;
}) {
  const periodos: { v: Periodo; label: string }[] = [
    { v: "todos", label: "Tudo" },
    { v: "30d", label: "30 dias" },
    { v: "mes", label: "Este mês" },
    { v: "ano", label: "Este ano" },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="f-exc">Excursão</Label>
            <NativeSelect id="f-exc" value={fExcursao} onChange={(e) => setFExcursao(e.target.value)}>
              <option value="todas">Todas</option>
              {excursoes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label>Período</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {periodos.map((p) => (
                <Chip key={p.v} active={fPeriodo === p.v} onClick={() => setFPeriodo(p.v)}>
                  <span className="mx-auto">{p.label}</span>
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Faixa de valor (R$)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                inputMode="decimal"
                placeholder="Mín."
                value={fValorMin}
                onChange={(e) => setFValorMin(e.target.value)}
              />
              <Input
                inputMode="decimal"
                placeholder="Máx."
                value={fValorMax}
                onChange={(e) => setFValorMax(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onLimpar}>
            Limpar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Ver resultados</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriasDialog({
  open,
  onOpenChange,
  categorias,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categorias: Categoria[];
  onChanged: () => void;
}) {
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(COR_OPTIONS[0]);
  const [icone, setIcone] = useState(ICON_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  function abrirNova() {
    setEditando(null);
    setNome("");
    setCor(COR_OPTIONS[0]);
    setIcone(ICON_OPTIONS[0]);
    setCriando(true);
  }
  function abrirEdicao(c: Categoria) {
    setEditando(c);
    setNome(c.nome);
    setCor(c.cor);
    setIcone(c.icone);
    setCriando(true);
  }

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      if (editando) await updateCategoria(editando.id, { nome: nome.trim(), cor, icone });
      else await createCategoria({ nome: nome.trim(), cor, icone });
      toast.success("Categoria salva");
      setCriando(false);
      onChanged();
    } catch (e) {
      toast.error("Erro ao salvar", { description: String((e as Error).message) });
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(c: Categoria) {
    try {
      await updateCategoria(c.id, { ativo: !c.ativo });
      toast.success(c.ativo ? "Categoria desativada" : "Categoria reativada");
      onChanged();
    } catch (e) {
      toast.error("Erro", { description: String((e as Error).message) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>
            {criando ? (editando ? "Editar categoria" : "Nova categoria") : "Categorias"}
          </DialogTitle>
        </DialogHeader>

        {criando ? (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="c-nome">Nome</Label>
              <Input
                id="c-nome"
                placeholder="Ex: Combustível"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className="grid size-9 place-items-center rounded-full transition-transform duration-150 active:scale-90"
                    style={{
                      backgroundColor: c,
                      boxShadow:
                        cor === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : undefined,
                    }}
                    aria-label={`Cor ${c}`}
                  >
                    {cor === c && <Check className="size-4 text-background" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcone(ic)}
                    className={`grid size-10 place-items-center rounded-md border transition-colors duration-150 ${
                      icone === ic
                        ? "border-primary/50 bg-primary/12 text-foreground"
                        : "border-white/10 text-muted-foreground hover:border-white/20"
                    }`}
                    aria-label={ic}
                  >
                    <CategoriaIcon nome={ic} className="size-4.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ul className="max-h-[55dvh] space-y-1 overflow-y-auto py-1">
            {categorias.map((c) => (
              <li
                key={c.id}
                className={`flex items-center gap-3 rounded-md px-2 py-2 ${c.ativo ? "" : "opacity-50"}`}
              >
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: muteColor(c.cor) }} />
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/5 text-muted-foreground">
                  <CategoriaIcon nome={c.icone} className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {c.nome}
                  {!c.ativo && <span className="ml-1.5 text-xs text-faint">(inativa)</span>}
                </span>
                <Button size="icon-sm" variant="ghost" onClick={() => abrirEdicao(c)} aria-label={`Editar ${c.nome}`}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="xs" variant="ghost" onClick={() => toggleAtivo(c)}>
                  {c.ativo ? "Desativar" : "Ativar"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {criando ? (
            <>
              <Button variant="ghost" onClick={() => setCriando(false)}>
                Voltar
              </Button>
              <Button onClick={salvar} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={abrirNova}>
              <Plus /> Nova categoria
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DespesasPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}>
      <DespesasView />
    </Suspense>
  );
}
