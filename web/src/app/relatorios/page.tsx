"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { PERIODOS, type PeriodoPreset } from "@/lib/metricas";
import { getDatasetRelatorios, type DatasetRelatorios } from "@/lib/relatorios";
import { FiltrosBar } from "@/components/relatorios/filtros-bar";
import { VisaoGeral } from "@/components/relatorios/secoes/visao-geral";
import { Financeiro } from "@/components/relatorios/secoes/financeiro";
import { Excursoes } from "@/components/relatorios/secoes/excursoes";
import { Pagamentos } from "@/components/relatorios/secoes/pagamentos";
import { Despesas } from "@/components/relatorios/secoes/despesas";

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

      {/* Abas em chips que quebram em linhas — todas visíveis, sem arrastar */}
      <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const ativo = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={ativo}
              onClick={() => setParam({ tab: t.id })}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 active:scale-[0.97] ${
                ativo
                  ? "bg-primary text-primary-foreground"
                  : "surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

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
      ) : tab === "visao" ? (
        <VisaoGeral dataset={dataset} periodo={periodo} excursaoId={excursaoId} />
      ) : tab === "financeiro" ? (
        <Financeiro dataset={dataset} periodo={periodo} excursaoId={excursaoId} />
      ) : tab === "excursoes" ? (
        <Excursoes dataset={dataset} excursaoId={excursaoId} />
      ) : tab === "pagamentos" ? (
        <Pagamentos dataset={dataset} excursaoId={excursaoId} />
      ) : (
        <Despesas dataset={dataset} periodo={periodo} excursaoId={excursaoId} />
      )}
    </main>
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
