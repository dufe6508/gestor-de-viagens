"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { PERIODOS, type PeriodoPreset } from "@/lib/metricas";
import { getDatasetRelatorios, type DatasetRelatorios } from "@/lib/relatorios";
import { FiltrosBar } from "@/components/relatorios/filtros-bar";
import { VisaoGeral } from "@/components/relatorios/secoes/visao-geral";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TabId = "visao" | "financeiro" | "excursoes" | "pagamentos" | "despesas";

const TABS: { id: TabId; label: string }[] = [
  { id: "visao", label: "Visão geral" },
  { id: "financeiro", label: "Financeiro" },
  { id: "excursoes", label: "Excursões" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "despesas", label: "Despesas" },
];

function isTab(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}
function isPeriodo(v: string | null): v is PeriodoPreset {
  return PERIODOS.some((p) => p.id === v);
}

function RelatoriosView() {
  const router = useRouter();
  const params = useSearchParams();

  const tab: TabId = isTab(params.get("tab")) ? (params.get("tab") as TabId) : "visao";
  const periodo: PeriodoPreset = isPeriodo(params.get("periodo"))
    ? (params.get("periodo") as PeriodoPreset)
    : "este_ano";
  const excursaoId = params.get("excursao") ?? "todas";

  const [dataset, setDataset] = useState<DatasetRelatorios | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDataset(await getDatasetRelatorios());
    } catch (e) {
      toast.error("Erro ao carregar relatórios", {
        description: String((e as Error).message),
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Filtros vivem na URL: voltar/atualizar preserva a análise.
  const setParam = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) next.set(k, v);
      router.replace(`/relatorios?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-7 pb-nav md:max-w-2xl">
      <header className="mb-5 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06]">
          <BarChart3 className="size-[18px] text-foreground" strokeWidth={1.75} />
        </span>
        <h1 className="flex-1 text-[1.375rem] font-semibold tracking-tight">Relatórios</h1>
      </header>

      <Tabs value={tab} onValueChange={(v) => setParam({ tab: String(v) })}>
        <TabsList variant="line" className="mb-4 h-auto w-full justify-start gap-1 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="shrink-0 flex-none px-2.5 py-1.5">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mb-4">
          <FiltrosBar
            periodo={periodo}
            excursaoId={excursaoId}
            excursoes={dataset?.excursoes ?? []}
            onPeriodo={(p) => setParam({ periodo: p })}
            onExcursao={(id) => setParam({ excursao: id })}
          />
        </div>

        {loading || !dataset ? (
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-28 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
        ) : (
          <>
            <TabsContent value="visao">
              <VisaoGeral dataset={dataset} periodo={periodo} excursaoId={excursaoId} />
            </TabsContent>
            <TabsContent value="financeiro">
              <EmBreve titulo="Financeiro" />
            </TabsContent>
            <TabsContent value="excursoes">
              <EmBreve titulo="Excursões" />
            </TabsContent>
            <TabsContent value="pagamentos">
              <EmBreve titulo="Pagamentos" />
            </TabsContent>
            <TabsContent value="despesas">
              <EmBreve titulo="Despesas" />
            </TabsContent>
          </>
        )}
      </Tabs>
    </main>
  );
}

function EmBreve({ titulo }: { titulo: string }) {
  return (
    <div className="glass-card glass-card-softer mt-2 rounded-lg px-5 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">Em breve — próxima fase do módulo.</p>
    </div>
  );
}

export default function RelatoriosPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}
    >
      <RelatoriosView />
    </Suspense>
  );
}
