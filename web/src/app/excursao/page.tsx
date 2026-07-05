"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search } from "lucide-react";
import {
  getExcursao,
  getResumo,
  listPassageiros,
  addPassageiro,
  registrarPagamento,
} from "@/lib/data";
import type { Excursao, ResumoExcursao, PassageiroRow, StatusPagamento } from "@/lib/types";
import { brl } from "@/lib/format";
import { Fab } from "@/components/fab";
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

const statusPag: Record<
  StatusPagamento,
  { label: string; variant: "success" | "destructive" | "secondary" }
> = {
  quitado: { label: "Quitado", variant: "success" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  em_dia: { label: "Em dia", variant: "secondary" },
};

// Cor do anel do avatar por status — cor só onde tem significado.
const avatarRing: Record<StatusPagamento, string> = {
  quitado: "ring-success/35",
  atrasado: "ring-destructive/40",
  em_dia: "ring-white/10",
};

function avatarInitials(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "danger";
}) {
  const c =
    tone === "positive"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-xs text-faint">{label}</p>
      <p className={`money mt-0.5 truncate text-sm font-semibold ${c}`}>{brl(value)}</p>
    </div>
  );
}

function ExcursaoView() {
  const id = useSearchParams().get("id") ?? "";
  const [excursao, setExcursao] = useState<Excursao | null>(null);
  const [resumo, setResumo] = useState<ResumoExcursao | null>(null);
  const [passageiros, setPassageiros] = useState<PassageiroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoForm, setNovoForm] = useState({ nome: "", valor: "" });
  const [pagOpen, setPagOpen] = useState(false);
  const [pagAlvo, setPagAlvo] = useState<PassageiroRow | null>(null);
  const [pagValor, setPagValor] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const [e, r, p] = await Promise.all([getExcursao(id), getResumo(id), listPassageiros(id)]);
      setExcursao(e);
      setResumo(r);
      setPassageiros(p);
    } catch (err) {
      toast.error("Erro ao carregar", { description: String((err as Error).message) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleNovoPassageiro() {
    const valor = Number(novoForm.valor.replace(",", "."));
    if (!novoForm.nome.trim()) return toast.error("Informe o nome");
    if (Number.isNaN(valor) || valor < 0) return toast.error("Valor inválido");
    setSaving(true);
    try {
      await addPassageiro(id, novoForm.nome.trim(), valor);
      toast.success("Passageiro adicionado");
      setNovoOpen(false);
      setNovoForm({ nome: "", valor: "" });
      load();
    } catch (err) {
      toast.error("Erro ao adicionar", { description: String((err as Error).message) });
    } finally {
      setSaving(false);
    }
  }

  function abrirPagamento(p: PassageiroRow) {
    setPagAlvo(p);
    setPagValor(p.saldo > 0 ? String(p.saldo) : "");
    setPagOpen(true);
  }

  async function handlePagamento() {
    const valor = Number(pagValor.replace(",", "."));
    if (Number.isNaN(valor) || valor <= 0) return toast.error("Valor inválido");
    setSaving(true);
    try {
      await registrarPagamento(pagAlvo!.id, valor);
      toast.success(`Pagamento de ${brl(valor)} registrado`);
      setPagOpen(false);
      load();
    } catch (err) {
      toast.error("Erro ao registrar", { description: String((err as Error).message) });
    } finally {
      setSaving(false);
    }
  }

  if (!id) return <p className="p-8 text-center text-muted-foreground">Excursão não informada.</p>;

  const lucro = resumo ? resumo.total_a_receber - resumo.total_despesas : 0;
  const filtrados = passageiros.filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
        {/* Header */}
        <header className="mb-5 flex items-center gap-3">
          <Link
            href="/"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[1.375rem] font-semibold tracking-tight">
              {excursao?.nome ?? "…"}
            </h1>
            {excursao?.destino && (
              <p className="truncate text-sm text-faint">{excursao.destino}</p>
            )}
          </div>
        </header>

        {/* Resumo compacto */}
        <section className="surface relative mb-6 overflow-hidden rounded-lg p-5">
          <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Recebido" value={resumo?.total_recebido ?? 0} tone="positive" />
            <MiniStat label="A receber" value={resumo?.total_a_receber ?? 0} />
            <MiniStat label="Lucro" value={lucro} tone={lucro >= 0 ? "positive" : "danger"} />
          </div>
        </section>

        {/* Passageiros */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Passageiros <span className="text-faint">· {passageiros.length}</span>
          </h2>
        </div>

        {passageiros.length > 3 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              placeholder="Buscar passageiro"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-lg bg-card" />
            ))}
          </div>
        ) : passageiros.length === 0 ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <p className="font-semibold">Nenhum passageiro</p>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">Adicione o primeiro.</p>
            <Button onClick={() => setNovoOpen(true)}>
              <Plus /> Novo passageiro
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtrados.map((p) => {
              const st = statusPag[p.status_pagamento];
              return (
                <li key={p.id} className="surface flex items-center gap-3 rounded-lg p-3">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.05] text-sm font-semibold text-muted-foreground ring-1 ring-inset ${avatarRing[p.status_pagamento]}`}
                  >
                    {avatarInitials(p.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.nome}</span>
                      <Badge variant={st.variant} className="shrink-0">
                        {st.label}
                      </Badge>
                    </div>
                    <p className="money mt-0.5 truncate text-xs">
                      {p.saldo > 0 ? (
                        <>
                          <span className="text-destructive">Falta {brl(p.saldo)}</span>
                          <span className="text-faint"> · de {brl(p.valor_total)}</span>
                        </>
                      ) : (
                        <span className="text-faint">{brl(p.valor_total)} pago</span>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={p.saldo <= 0 ? "ghost" : "secondary"}
                    onClick={() => abrirPagamento(p)}
                    disabled={p.saldo <= 0}
                  >
                    {p.saldo <= 0 ? "Quitado" : "Pagar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {!loading && passageiros.length > 0 && (
        <Fab label="Novo passageiro" onClick={() => setNovoOpen(true)}>
          <Plus className="size-6" strokeWidth={2} />
        </Fab>
      )}

      {/* Novo passageiro */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Novo passageiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="pnome">Nome *</Label>
              <Input
                id="pnome"
                placeholder="Ex: João"
                value={novoForm.nome}
                onChange={(ev) => setNovoForm({ ...novoForm, nome: ev.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pvalor">Valor total (R$)</Label>
              <Input
                id="pvalor"
                inputMode="decimal"
                placeholder="Ex: 1450"
                value={novoForm.valor}
                onChange={(ev) => setNovoForm({ ...novoForm, valor: ev.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleNovoPassageiro} disabled={saving} className="w-full" size="lg">
              {saving ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar pagamento */}
      <Dialog open={pagOpen} onOpenChange={setPagOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          {pagAlvo && (
            <div className="space-y-4 py-1">
              <div className="surface-raised rounded-md p-3.5 text-sm">
                <p className="font-medium">{pagAlvo.nome}</p>
                <p className="money mt-0.5 text-muted-foreground">
                  Falta {brl(pagAlvo.saldo)} de {brl(pagAlvo.valor_total)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pagvalor">Valor recebido (R$) *</Label>
                <Input
                  id="pagvalor"
                  inputMode="decimal"
                  value={pagValor}
                  onChange={(ev) => setPagValor(ev.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handlePagamento} disabled={saving} className="w-full" size="lg">
              {saving ? "Registrando…" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ExcursaoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}>
      <ExcursaoView />
    </Suspense>
  );
}
