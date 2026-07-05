"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronDown,
  Plus,
  MapPin,
  Check,
  ChevronRight,
  TriangleAlert,
  CalendarDays,
} from "lucide-react";
import {
  listExcursoes,
  createExcursao,
  getResumo,
  listPassageiros,
} from "@/lib/data";
import type { Excursao, ResumoExcursao, PassageiroRow } from "@/lib/types";
import { brl } from "@/lib/format";
import { DonutProgress } from "@/components/charts";
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

const STORAGE_KEY = "excursao_selecionada";

function diasAte(data: string | null | undefined): number | null {
  if (!data) return null;
  const alvo = new Date(data + "T00:00:00").getTime();
  const hoje = new Date().setHours(0, 0, 0, 0);
  const dias = Math.round((alvo - hoje) / 86_400_000);
  return dias >= 0 ? dias : null;
}

function dataCurta(data: string | null | undefined): string {
  if (!data) return "";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function HomePage() {
  const [excursoes, setExcursoes] = useState<Excursao[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoExcursao | null>(null);
  const [passageiros, setPassageiros] = useState<PassageiroRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [switchOpen, setSwitchOpen] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", destino: "", data_inicio: "", data_fim: "" });

  const loadExcursoes = useCallback(async () => {
    try {
      const list = await listExcursoes();
      setExcursoes(list);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const valid = list.find((e) => e.id === stored)?.id ?? list[0]?.id ?? null;
      setSelectedId(valid);
    } catch (e) {
      toast.error("Erro ao carregar", { description: String((e as Error).message) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExcursoes();
  }, [loadExcursoes]);

  const loadDados = useCallback(async (id: string) => {
    try {
      const [r, p] = await Promise.all([getResumo(id), listPassageiros(id)]);
      setResumo(r);
      setPassageiros(p);
    } catch (e) {
      toast.error("Erro ao carregar excursão", { description: String((e as Error).message) });
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResumo(null);
      setPassageiros([]);
      return;
    }
    localStorage.setItem(STORAGE_KEY, selectedId);
    loadDados(selectedId);
  }, [selectedId, loadDados]);

  async function handleCreate() {
    if (!form.nome.trim()) return toast.error("Dê um nome à excursão");
    setSaving(true);
    try {
      const nova = await createExcursao({
        nome: form.nome.trim(),
        destino: form.destino.trim(),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
      });
      toast.success("Excursão criada");
      setNovaOpen(false);
      setForm({ nome: "", destino: "", data_inicio: "", data_fim: "" });
      await loadExcursoes();
      setSelectedId(nova.id);
    } catch (e) {
      toast.error("Erro ao criar", { description: String((e as Error).message) });
    } finally {
      setSaving(false);
    }
  }

  const selected = excursoes.find((e) => e.id === selectedId) ?? null;
  const atrasados = passageiros.filter((p) => p.status_pagamento === "atrasado").length;
  const aReceber = resumo?.total_a_receber ?? 0;
  const recebido = resumo?.total_recebido ?? 0;
  const caixa = recebido - (resumo?.despesas_pagas ?? 0);
  const falta = Math.max(aReceber - recebido, 0);
  const dias = diasAte(selected?.data_inicio);

  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-7 pb-nav md:max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            <div className="h-12 animate-pulse rounded-full bg-white/[0.04]" />
            <div className="h-44 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
        ) : !selected ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <span className="surface mb-5 grid size-16 place-items-center rounded-full">
              <MapPin className="size-7 text-faint" strokeWidth={1.5} />
            </span>
            <p className="text-lg font-semibold">Nenhuma excursão</p>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">Crie a primeira para começar.</p>
            <Button size="lg" onClick={() => setNovaOpen(true)}>
              <Plus /> Nova excursão
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Seletor pill — largura do conteúdo, não do card */}
            <button
              onClick={() => setSwitchOpen(true)}
              className="surface flex h-10 w-fit max-w-full items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 text-left transition-transform duration-150 ease-(--ease-enter) active:scale-[0.97]"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-foreground">
                <MapPin className="size-3.5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 truncate text-sm font-semibold">{selected.nome}</span>
              <ChevronDown className="size-3.5 shrink-0 text-faint" strokeWidth={2} />
            </button>

            {/* 2. Herói — saldo em caixa */}
            <section className="surface relative overflow-hidden rounded-lg p-6">
              {/* brilho especular sutil no topo */}
              <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <p className="text-sm text-muted-foreground">Saldo em caixa</p>
              <p
                className={`money mt-2 text-[2.5rem] font-semibold leading-none ${
                  caixa < 0 ? "text-destructive" : "text-primary-strong"
                }`}
              >
                {brl(caixa)}
              </p>
              <div className="mt-6 flex items-center gap-8 border-t border-white/8 pt-4">
                <div>
                  <p className="text-xs text-faint">A receber</p>
                  <p className="money mt-0.5 text-base font-semibold">{brl(aReceber)}</p>
                </div>
                <div>
                  <p className="text-xs text-faint">Recebido</p>
                  <p className="money mt-0.5 text-base font-semibold">{brl(recebido)}</p>
                </div>
              </div>
            </section>

            {/* 3. Progresso de recebimento */}
            <section className="surface flex items-center gap-5 rounded-lg p-5">
              <DonutProgress recebido={recebido} total={aReceber} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-faint">Falta receber</p>
                <p className="money mt-1 text-2xl font-semibold">{brl(falta)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  de <span className="money">{brl(aReceber)}</span> no total
                </p>
              </div>
            </section>

            {/* 4. Precisa de atenção — linha compacta */}
            {atrasados > 0 && (
              <Link
                href={`/excursao?id=${selected.id}`}
                className="surface flex items-center gap-2.5 rounded-lg border-destructive/25! bg-destructive/8! px-3 py-2.5 transition-colors duration-150 hover:bg-destructive/12!"
              >
                <TriangleAlert className="size-4 shrink-0 text-destructive" strokeWidth={2} />
                <span className="flex-1 text-[13px] font-medium text-destructive">
                  {atrasados} passageiro{atrasados > 1 ? "s" : ""} em atraso
                </span>
                <ChevronRight className="size-4 shrink-0 text-destructive/60" strokeWidth={1.75} />
              </Link>
            )}

            {/* 5. Linha do tempo — linha compacta */}
            {dias != null && (
              <section className="surface flex items-center gap-2.5 rounded-lg px-3 py-2.5">
                <CalendarDays className="size-4 shrink-0 text-faint" strokeWidth={1.75} />
                <p className="flex-1 text-[13px] text-muted-foreground">
                  {dias === 0 ? (
                    <span className="font-semibold text-foreground">A viagem é hoje</span>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground tabular-nums">{dias}</span> dia
                      {dias > 1 ? "s" : ""} para a viagem
                    </>
                  )}
                </p>
                {selected.data_inicio && (
                  <span className="money shrink-0 text-xs text-faint">
                    {dataCurta(selected.data_inicio)}
                    {selected.data_fim && ` – ${dataCurta(selected.data_fim)}`}
                  </span>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {!loading && (
        <Fab label="Nova excursão" onClick={() => setNovaOpen(true)}>
          <Plus className="size-6" strokeWidth={2} />
        </Fab>
      )}

      {/* Trocar excursão */}
      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Trocar excursão</DialogTitle>
          </DialogHeader>
          <ul className="max-h-[55dvh] space-y-1.5 overflow-y-auto py-1">
            {excursoes.map((e) => {
              const active = e.id === selectedId;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => {
                      setSelectedId(e.id);
                      setSwitchOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors duration-150 ${
                      active ? "bg-primary/12 ring-1 ring-inset ring-primary/25" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full ${
                        active ? "bg-primary text-primary-foreground" : "bg-white/[0.06] text-foreground"
                      }`}
                    >
                      <MapPin className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.nome}</p>
                      <p className="truncate text-xs text-faint">{e.destino || "Sem destino"}</p>
                    </div>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSwitchOpen(false);
                setNovaOpen(true);
              }}
            >
              <Plus /> Nova excursão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova excursão */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Nova excursão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                placeholder="Ex: Arraial do Cabo 2027"
                value={form.nome}
                onChange={(ev) => setForm({ ...form, nome: ev.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destino">Destino</Label>
              <Input
                id="destino"
                placeholder="Ex: Arraial do Cabo - RJ"
                value={form.destino}
                onChange={(ev) => setForm({ ...form, destino: ev.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="di">Início</Label>
                <Input
                  id="di"
                  type="date"
                  value={form.data_inicio}
                  onChange={(ev) => setForm({ ...form, data_inicio: ev.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="df">Fim</Label>
                <Input
                  id="df"
                  type="date"
                  value={form.data_fim}
                  onChange={(ev) => setForm({ ...form, data_fim: ev.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} className="w-full" size="lg">
              {saving ? "Criando…" : "Criar excursão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
