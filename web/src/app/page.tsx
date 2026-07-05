"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  Plus,
  MapPin,
  Check,
  CalendarDays,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  listExcursoes,
  createExcursao,
  deleteExcursao,
  getResumo,
  listPassageiros,
} from "@/lib/data";
import type { Excursao, ResumoExcursao, PassageiroRow } from "@/lib/types";
import { brl } from "@/lib/format";
import { DonutProgress, OverviewBars } from "@/components/charts";
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
  const router = useRouter();
  const [excursoes, setExcursoes] = useState<Excursao[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoExcursao | null>(null);
  const [passageiros, setPassageiros] = useState<PassageiroRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [switchOpen, setSwitchOpen] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", destino: "", data_inicio: "", data_fim: "" });
  const [excluindo, setExcluindo] = useState<Excursao | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!excluindo) return;
    setDeleting(true);
    try {
      await deleteExcursao(excluindo.id);
      toast.success("Excursão excluída");
      setExcluindo(null);
      if (selectedId === excluindo.id) setSelectedId(null);
      await loadExcursoes();
    } catch (e) {
      toast.error("Não foi possível excluir", { description: String((e as Error).message) });
    } finally {
      setDeleting(false);
    }
  }

  const selected = excursoes.find((e) => e.id === selectedId) ?? null;
  const atrasados = passageiros.filter((p) => p.status_pagamento === "atrasado").length;
  const aReceber = resumo?.total_a_receber ?? 0;
  const recebido = resumo?.total_recebido ?? 0;
  const caixa = recebido - (resumo?.despesas_pagas ?? 0);
  const falta = Math.max(aReceber - recebido, 0);
  const totalDespesas = resumo?.total_despesas ?? 0;
  const lucro = aReceber - totalDespesas;
  const dias = diasAte(selected?.data_inicio);

  // Passageiros em atraso viram um toast cancelável (X), não um card fixo.
  const atrasoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    const key = `${selected.id}:${atrasados}`;
    if (atrasados > 0 && atrasoRef.current !== key) {
      atrasoRef.current = key;
      toast.custom(
        (t) => (
          <div
            className="mx-auto inline-flex w-fit items-center gap-2.5 rounded-full border border-[#f2564b]/30 py-1.5 pr-2 pl-3 shadow-[0_6px_18px_-12px_rgba(0,0,0,0.6)]"
            style={{
              backgroundColor: "#1a0d0c",
              backgroundImage:
                "linear-gradient(150deg, rgba(242,86,75,0.12), rgba(242,86,75,0.02) 58%)",
            }}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f2564b]/20">
              <TriangleAlert className="size-3.5 text-[#ff6a5f]" strokeWidth={2.4} />
            </span>
            <span className="whitespace-nowrap text-[13px] font-semibold text-white">
              {atrasados} em atraso
            </span>
            <button
              onClick={() => {
                router.push(`/excursao?id=${selected.id}`);
                toast.dismiss(t);
              }}
              className="ml-1 rounded-full bg-[#f2564b] px-3.5 py-1 text-xs font-semibold text-white transition-transform duration-150 hover:bg-[#ff6a5f] active:scale-95"
            >
              Ver
            </button>
            <button
              onClick={() => toast.dismiss(t)}
              aria-label="Fechar"
              className="grid size-6 shrink-0 place-items-center rounded-full text-white/45 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ),
        { id: `atraso-${selected.id}`, duration: Infinity },
      );
    }
  }, [selected, atrasados, router]);

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
            <section className="glass-card rounded-lg p-6">
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
            <section className="glass-card glass-card-soft flex items-center gap-5 rounded-lg p-5">
              <DonutProgress recebido={recebido} total={aReceber} />
              <div className="min-w-0 flex-1 space-y-3.5">
                <div>
                  <p className="text-xs text-faint">Recebido</p>
                  <p className="money mt-0.5 text-xl font-semibold" style={{ color: "var(--progress, #46c98a)" }}>
                    {brl(recebido)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-faint">Falta receber</p>
                  <p className="money mt-0.5 text-xl font-semibold">{brl(falta)}</p>
                </div>
              </div>
            </section>

            {/* Atraso agora é toast cancelável (efeito acima). */}

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

            {/* 6. Visão geral — barras comparativas */}
            <section className="surface rounded-lg p-5">
              <p className="mb-5 text-sm font-medium text-muted-foreground">Visão geral</p>
              <OverviewBars
                bars={[
                  { label: "A receber", value: aReceber, cor: "#6b7280" },
                  { label: "Recebido", value: recebido, cor: "#22c55e" },
                  { label: "Despesas", value: totalDespesas, cor: "#f87171" },
                  { label: "Lucro", value: lucro, cor: "#22c55e" },
                ]}
              />
            </section>
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
                <li
                  key={e.id}
                  className={`group flex items-center rounded-md transition-colors duration-150 ${
                    active ? "bg-primary/12 ring-1 ring-inset ring-primary/25" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedId(e.id);
                      setSwitchOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
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
                  <button
                    onClick={() => setExcluindo(e)}
                    aria-label={`Excluir ${e.nome}`}
                    className="mr-2 grid size-9 shrink-0 place-items-center rounded-full text-faint transition-colors duration-150 hover:bg-destructive/12 hover:text-destructive"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
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

      {/* Excluir excursão */}
      <Dialog open={excluindo != null} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Excluir excursão</DialogTitle>
          </DialogHeader>
          <p className="py-1 text-sm text-muted-foreground">
            Excluir <span className="font-semibold text-foreground">{excluindo?.nome}</span>? Só é
            possível se ela não tiver passageiros nem despesas. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
