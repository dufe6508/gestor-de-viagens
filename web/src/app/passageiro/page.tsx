"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import {
  getPassageiroDetalhe,
  updateValorTotal,
  parcelar,
  registrarPagamento,
  updatePagamento,
  deletePagamento,
  deletePassageiro,
  parseValor,
  type ParcelaRow,
  type PagamentoRow,
} from "@/lib/passageiros";
import { alocarPagamento } from "@/lib/parcelas";
import { brl } from "@/lib/format";
import { ParcelamentoDialog } from "@/components/parcelamento-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Detalhe = Awaited<ReturnType<typeof getPassageiroDetalhe>>;

const hoje = () => new Date().toISOString().slice(0, 10);

function ddmmaa(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

const numToInput = (n: number) => n.toFixed(2).replace(".", ",");

function PassageiroView() {
  const id = useSearchParams().get("id");
  const router = useRouter();

  const [det, setDet] = useState<Detalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDet(await getPassageiroDetalhe(id));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // ---- Editar valor total (inline no hero) ----
  const [editandoValor, setEditandoValor] = useState(false);
  const [valorInput, setValorInput] = useState("");
  const [salvandoValor, setSalvandoValor] = useState(false);

  async function confirmarValor() {
    if (!det) return;
    const v = parseValor(valorInput);
    if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido");
    const tinhaAbertas = det.parcelas.some((p) => p.status !== "paga");
    setSalvandoValor(true);
    try {
      await updateValorTotal(det.passageiro.id, v);
      toast.success(
        tinhaAbertas ? "Valor atualizado — parcelas redistribuídas" : "Valor atualizado",
      );
      setEditandoValor(false);
      load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: String((e as Error).message) });
    } finally {
      setSalvandoValor(false);
    }
  }

  // ---- Parcelamento ----
  const [parcOpen, setParcOpen] = useState(false);

  async function confirmarParcelamento(n: number, primeiroVenc: string) {
    if (!det) return;
    try {
      const r = await parcelar([det.passageiro.id], n, primeiroVenc);
      if (r.pulados > 0) {
        toast.warning("Não é possível reparcelar: já há parcelas pagas");
      } else {
        toast.success(`Parcelado em ${n}x`);
      }
      load();
    } catch (e) {
      toast.error("Erro ao parcelar", { description: String((e as Error).message) });
      throw e;
    }
  }

  // ---- Pagar parcela (quitar saldo dela hoje) ----
  const [pagandoId, setPagandoId] = useState<string | null>(null);

  async function pagarParcela(p: ParcelaRow) {
    if (!det || pagandoId) return;
    setPagandoId(p.id);
    try {
      await registrarPagamento(det.passageiro.id, p.saldo, hoje(), undefined, p.id);
      toast.success(`Parcela ${p.numero} paga`);
      load();
    } catch (e) {
      toast.error("Erro ao registrar", { description: String((e as Error).message) });
    } finally {
      setPagandoId(null);
    }
  }

  // ---- Registrar pagamento (sheet) ----
  const [pagOpen, setPagOpen] = useState(false);
  const [pagValor, setPagValor] = useState("");
  const [pagData, setPagData] = useState(hoje());
  const [pagForma, setPagForma] = useState("");
  const [pagSaving, setPagSaving] = useState(false);

  const abertas = useMemo(
    () => (det ? det.parcelas.filter((p) => p.status !== "paga" && p.saldo > 0) : []),
    [det],
  );

  function abrirRegistrar() {
    if (!det) return;
    const prox = abertas[0];
    setPagValor(numToInput(prox ? prox.saldo : det.passageiro.saldo));
    setPagData(hoje());
    setPagForma("");
    setPagOpen(true);
  }

  const preview = useMemo(() => {
    if (abertas.length === 0) return null;
    const v = parseValor(pagValor);
    if (Number.isNaN(v) || v <= 0) return null;
    const alocs = alocarPagamento(
      v,
      abertas.map((p) => ({ id: p.id, numero: p.numero, saldo: p.saldo })),
    );
    const porId = new Map(abertas.map((p) => [p.id, p]));
    return alocs
      .map((a) => {
        if (!a.parcela_id) return `${brl(a.valor)} sem parcela (avulso)`;
        const parc = porId.get(a.parcela_id);
        if (!parc) return null;
        return a.valor >= parc.saldo
          ? `Quita parcela ${parc.numero}`
          : `Abate ${brl(a.valor)} da parcela ${parc.numero}`;
      })
      .filter(Boolean)
      .join(" · ");
  }, [abertas, pagValor]);

  async function confirmarPagamento() {
    if (!det) return;
    const v = parseValor(pagValor);
    if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido");
    if (!pagData) return toast.error("Informe a data");
    setPagSaving(true);
    try {
      await registrarPagamento(det.passageiro.id, v, pagData, pagForma.trim() || undefined);
      toast.success("Pagamento registrado");
      setPagOpen(false);
      load();
    } catch (e) {
      toast.error("Erro ao registrar", { description: String((e as Error).message) });
    } finally {
      setPagSaving(false);
    }
  }

  // ---- Editar pagamento (sheet) ----
  const [editPag, setEditPag] = useState<PagamentoRow | null>(null);
  const [epValor, setEpValor] = useState("");
  const [epData, setEpData] = useState("");
  const [epForma, setEpForma] = useState("");
  const [epSaving, setEpSaving] = useState(false);

  function abrirEditPag(p: PagamentoRow) {
    setEpValor(numToInput(p.valor));
    setEpData(p.data.slice(0, 10));
    setEpForma(p.forma ?? "");
    setEditPag(p);
  }

  async function confirmarEditPag() {
    if (!editPag) return;
    const v = parseValor(epValor);
    if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido");
    if (!epData) return toast.error("Informe a data");
    setEpSaving(true);
    try {
      await updatePagamento(editPag.id, v, epData, epForma.trim() || undefined);
      toast.success("Pagamento atualizado");
      setEditPag(null);
      load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: String((e as Error).message) });
    } finally {
      setEpSaving(false);
    }
  }

  // ---- Excluir pagamento (dialog central) ----
  const [delPag, setDelPag] = useState<PagamentoRow | null>(null);

  async function confirmarDelPag() {
    if (!delPag) return;
    try {
      await deletePagamento(delPag.id);
      toast.success("Pagamento excluído");
      setDelPag(null);
      load();
    } catch (e) {
      toast.error("Erro ao excluir", { description: String((e as Error).message) });
    }
  }

  // ---- Excluir passageiro (dialog central) ----
  const [delPaxOpen, setDelPaxOpen] = useState(false);
  const [delPaxSaving, setDelPaxSaving] = useState(false);

  async function confirmarDelPax() {
    if (!det) return;
    setDelPaxSaving(true);
    try {
      await deletePassageiro(det.passageiro.id);
      toast.success("Passageiro excluído");
      router.push(`/passageiros?id=${det.passageiro.excursao_id}`);
    } catch (e) {
      toast.error("Erro ao excluir", { description: String((e as Error).message) });
      setDelPaxSaving(false);
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
      </main>
    );
  }

  if (notFound || !det) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-24 text-center">
        <p className="text-lg font-semibold">Passageiro não encontrado</p>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          O link pode estar quebrado ou o registro foi removido.
        </p>
        <Button render={<Link href="/" />} size="lg">
          Voltar ao início
        </Button>
      </main>
    );
  }

  const { passageiro, parcelas, pagamentos } = det;
  const quitado = passageiro.saldo <= 0;
  const pct =
    passageiro.valor_total > 0
      ? Math.min(1, passageiro.valor_pago / passageiro.valor_total)
      : 0;

  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
        {/* Header */}
        <header className="mb-5 flex items-center gap-2">
          <Link
            href={`/passageiros?id=${passageiro.excursao_id}`}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
            aria-label="Voltar para a lista de passageiros"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.375rem] font-semibold tracking-tight">
              {passageiro.nome}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{passageiro.excursao_nome}</p>
          </div>
          <button
            onClick={() => setDelPaxOpen(true)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-destructive"
            aria-label={`Excluir ${passageiro.nome}`}
          >
            <Trash2 className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="space-y-5">
          {/* Hero — saldo */}
          <section className="glass-card rounded-lg p-5">
            {quitado ? (
              <>
                <p className="text-sm text-muted-foreground">Quitado</p>
                <p className="money mt-1.5 text-[2.25rem] font-semibold leading-none text-success">
                  {brl(passageiro.valor_pago)}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Falta</p>
                <p className="money mt-1.5 text-[2.25rem] font-semibold leading-none text-destructive">
                  {brl(passageiro.saldo)}
                </p>
              </>
            )}

            {editandoValor ? (
              <div className="mt-3 flex items-center gap-2">
                <Label htmlFor="valor-total" className="sr-only">
                  Valor total (R$)
                </Label>
                <Input
                  id="valor-total"
                  inputMode="decimal"
                  value={valorInput}
                  onChange={(e) => setValorInput(e.target.value)}
                  className="h-11 max-w-40"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={confirmarValor}
                  disabled={salvandoValor}
                  aria-label="Confirmar valor total"
                >
                  <Check strokeWidth={1.75} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditandoValor(false)}
                  aria-label="Cancelar edição do valor"
                >
                  <X strokeWidth={1.75} />
                </Button>
              </div>
            ) : (
              <p className="mt-1.5 flex items-center gap-1 text-sm text-faint">
                de <span className="money text-muted-foreground">{brl(passageiro.valor_total)}</span>
                <button
                  onClick={() => {
                    setValorInput(numToInput(passageiro.valor_total));
                    setEditandoValor(true);
                  }}
                  className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
                  aria-label="Editar valor total"
                >
                  <Pencil className="size-4" strokeWidth={1.75} />
                </button>
              </p>
            )}

            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct * 100}%`, backgroundColor: "var(--progress)" }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-faint">
                {Math.round(pct * 100)}%
              </span>
            </div>
          </section>

          {/* Parcelas */}
          <section>
            <h2 className="mb-2 text-base font-semibold">Parcelas</h2>
            {parcelas.length === 0 ? (
              passageiro.saldo > 0 ? (
                <div className="surface-soft flex items-center gap-3 rounded-lg p-4">
                  <p className="flex-1 text-sm text-muted-foreground">Sem parcelamento</p>
                  <Button size="sm" variant="secondary" onClick={() => setParcOpen(true)}>
                    Parcelar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem parcelamento.</p>
              )
            ) : (
              <>
                <ul className="space-y-0.5">
                  {parcelas.map((p) => (
                    <li key={p.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5">
                      <span className="w-4 shrink-0 text-sm tabular-nums text-muted-foreground">
                        {p.numero}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="money text-sm font-medium">{brl(p.valor)}</p>
                        <p className="text-xs text-faint">
                          {ddmmaa(p.vencimento)}
                          {p.valor_pago > 0 && p.status !== "paga" && (
                            <span className="ml-1.5 text-[11px] text-warning">
                              {brl(p.valor_pago)} pagos
                            </span>
                          )}
                        </p>
                      </div>
                      {p.status === "paga" ? (
                        <Badge variant="success">Paga</Badge>
                      ) : p.status === "atrasada" ? (
                        <Badge variant="destructive">Atrasada</Badge>
                      ) : (
                        <Badge variant="secondary">Aberta</Badge>
                      )}
                      {p.status !== "paga" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => pagarParcela(p)}
                          disabled={pagandoId != null}
                        >
                          Pagar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={() => setParcOpen(true)}
                >
                  Reparcelar
                </Button>
              </>
            )}
          </section>

          {/* Pagamentos */}
          <section>
            <h2 className="mb-2 text-base font-semibold">Pagamentos</h2>
            {pagamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento ainda.</p>
            ) : (
              <ul className="space-y-0.5">
                {pagamentos.map((p) => (
                  <li key={p.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="text-faint">{ddmmaa(p.data)}</span>
                        <span className="text-faint"> · </span>
                        <span className="money font-medium text-success">{brl(p.valor)}</span>
                        {p.forma && <span className="text-faint"> · {p.forma}</span>}
                        {p.parcela_numero != null && (
                          <span className="text-faint"> · parc. {p.parcela_numero}</span>
                        )}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => abrirEditPag(p)}
                      aria-label={`Editar pagamento de ${brl(p.valor)}`}
                    >
                      <Pencil className="size-4" strokeWidth={1.75} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDelPag(p)}
                      aria-label={`Excluir pagamento de ${brl(p.valor)}`}
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <Button size="lg" className="mt-4 w-full" onClick={abrirRegistrar}>
              <Plus strokeWidth={1.75} /> Registrar pagamento
            </Button>
          </section>
        </div>
      </main>

      {/* Parcelar / reparcelar */}
      <ParcelamentoDialog
        open={parcOpen}
        onOpenChange={setParcOpen}
        alvos={[
          { id: passageiro.id, nome: passageiro.nome, valor_total: passageiro.valor_total },
        ]}
        onConfirm={confirmarParcelamento}
      />

      {/* Registrar pagamento — sheet */}
      <Dialog open={pagOpen} onOpenChange={setPagOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pag-valor">Valor (R$)</Label>
                <Input
                  id="pag-valor"
                  inputMode="decimal"
                  value={pagValor}
                  onChange={(e) => setPagValor(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pag-data">Data</Label>
                <Input
                  id="pag-data"
                  type="date"
                  value={pagData}
                  onChange={(e) => setPagData(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pag-forma">Forma (opcional)</Label>
              <Input
                id="pag-forma"
                placeholder="Pix, dinheiro…"
                value={pagForma}
                onChange={(e) => setPagForma(e.target.value)}
              />
            </div>
            {preview && (
              <div className="surface-soft rounded-md p-3.5 text-sm text-muted-foreground">
                {preview}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={confirmarPagamento} disabled={pagSaving} className="w-full" size="lg">
              {pagSaving ? "Salvando…" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar pagamento — sheet */}
      <Dialog open={editPag != null} onOpenChange={(o) => !o && setEditPag(null)}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Editar pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-valor">Valor (R$)</Label>
                <Input
                  id="ep-valor"
                  inputMode="decimal"
                  value={epValor}
                  onChange={(e) => setEpValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-data">Data</Label>
                <Input
                  id="ep-data"
                  type="date"
                  value={epData}
                  onChange={(e) => setEpData(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-forma">Forma (opcional)</Label>
              <Input
                id="ep-forma"
                placeholder="Pix, dinheiro…"
                value={epForma}
                onChange={(e) => setEpForma(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={confirmarEditPag} disabled={epSaving} className="w-full" size="lg">
              {epSaving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir pagamento — confirmação central */}
      <Dialog open={delPag != null} onOpenChange={(o) => !o && setDelPag(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Excluir pagamento?</DialogTitle>
          </DialogHeader>
          {delPag && (
            <p className="text-sm text-muted-foreground">
              Excluir pagamento de {brl(delPag.valor)}? O saldo devedor volta a aumentar.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelPag(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarDelPag}>
              <Trash2 /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir passageiro — confirmação central */}
      <Dialog open={delPaxOpen} onOpenChange={setDelPaxOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Excluir {passageiro.nome}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pagamentos.length} pagamento(s) e as parcelas serão apagados de vez.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelPaxOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarDelPax} disabled={delPaxSaving}>
              <Trash2 /> {delPaxSaving ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PassageiroPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}>
      <PassageiroView />
    </Suspense>
  );
}
