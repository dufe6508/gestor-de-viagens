"use client";

import { useMemo, useState } from "react";
import { brl } from "@/lib/format";
import { filtrarPorExcursao, type DatasetRelatorios, type ResumoRow } from "@/lib/relatorios";
import { ChartCard } from "@/components/relatorios/chart-card";
import { DonutProgress, RankBars, type RankRow } from "@/components/charts";
import { renderWidgets, type Widget } from "@/components/relatorios/registry";

/*
 * Aba Excursões — quanto cada viagem deu + raio-X (plano §4, aba 3).
 * O comparativo alterna a métrica; cada card traz o essencial da viagem.
 */
type Metrica = "lucro" | "total_recebido" | "total_despesas";
const METRICAS: { id: Metrica; label: string }[] = [
  { id: "lucro", label: "Lucro" },
  { id: "total_recebido", label: "Recebido" },
  { id: "total_despesas", label: "Despesas" },
];

interface RaioX extends ResumoRow {
  pax: number;
  quitados: number;
  atrasados: number;
  ticket: number;
  custoPax: number;
  margem: number;
}

export function Excursoes({
  dataset,
  excursaoId,
}: {
  dataset: DatasetRelatorios;
  excursaoId: string;
}) {
  const [metrica, setMetrica] = useState<Metrica>("lucro");

  const excursoes = useMemo<RaioX[]>(() => {
    const resumos = filtrarPorExcursao(dataset.resumos, excursaoId);
    return resumos.map((r) => {
      const pax = dataset.passageiros.filter((p) => p.excursao_id === r.excursao_id);
      const quitados = pax.filter((p) => p.status_pagamento === "quitado").length;
      const atrasados = pax.filter((p) => p.status_pagamento === "atrasado").length;
      return {
        ...r,
        pax: pax.length,
        quitados,
        atrasados,
        ticket: pax.length > 0 ? r.total_a_receber / pax.length : 0,
        custoPax: pax.length > 0 ? r.total_despesas / pax.length : 0,
        margem: r.total_recebido > 0 ? r.lucro / r.total_recebido : 0,
      };
    });
  }, [dataset, excursaoId]);

  const rank: RankRow[] = [...excursoes]
    .sort((a, b) => b[metrica] - a[metrica])
    .map((r) => ({ id: r.excursao_id, label: r.nome, value: r[metrica] }));

  const widgets: Widget[] = [
    {
      id: "comparativo",
      visivel: excursoes.length > 0,
      node: (
        <ChartCard titulo="Comparativo" subtitulo="Entre excursões">
          <div className="mb-4 flex gap-1.5">
            {METRICAS.map((mt) => (
              <button
                key={mt.id}
                onClick={() => setMetrica(mt.id)}
                className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors duration-150 ${
                  metrica === mt.id
                    ? "bg-white/[0.1] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04]"
                }`}
              >
                {mt.label}
              </button>
            ))}
          </div>
          <RankBars rows={rank} />
        </ChartCard>
      ),
    },
    ...excursoes.map<Widget>((r) => ({
      id: `raiox-${r.excursao_id}`,
      node: <RaioXCard r={r} />,
    })),
  ];

  if (excursoes.length === 0) {
    return (
      <ChartCard titulo="Excursões" vazio="Nenhuma excursão para exibir">
        <div />
      </ChartCard>
    );
  }

  return renderWidgets(widgets);
}

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  encerrada: "Encerrada",
};

function RaioXCard({ r }: { r: RaioX }) {
  const falta = Math.max(r.total_a_receber - r.total_recebido, 0);
  return (
    <section className="glass-card glass-card-soft rounded-lg p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{r.nome}</h3>
          <span className="text-xs text-faint">{STATUS_LABEL[r.status] ?? r.status}</span>
        </div>
        <span
          className={`money shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            r.lucro < 0 ? "bg-destructive/15 text-destructive" : "bg-[var(--progress,#46c98a)]/15 text-[var(--progress,#46c98a)]"
          }`}
        >
          {brl(r.lucro)}
        </span>
      </header>

      <div className="flex items-center gap-5">
        <DonutProgress recebido={r.total_recebido} total={r.total_a_receber} size={116} stroke={12} />
        <dl className="min-w-0 flex-1 space-y-2.5">
          <Linha rotulo="Recebido" valor={brl(r.total_recebido)} />
          <Linha rotulo="Falta" valor={brl(falta)} />
          <Linha rotulo="Despesas" valor={brl(r.total_despesas)} />
        </dl>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-4">
        <Mini rotulo="Passageiros" valor={`${r.quitados}/${r.pax}`} sub="quitados" />
        <Mini rotulo="Ticket médio" valor={brl(r.ticket)} />
        <Mini rotulo="Custo/pax" valor={brl(r.custoPax)} />
      </div>
      {r.atrasados > 0 && (
        <p className="mt-3 text-xs text-destructive">
          {r.atrasados} passageiro{r.atrasados > 1 ? "s" : ""} em atraso
        </p>
      )}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-faint">{rotulo}</dt>
      <dd className="money text-sm font-semibold text-foreground">{valor}</dd>
    </div>
  );
}

function Mini({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-faint">{rotulo}</p>
      <p className="money mt-0.5 truncate text-sm font-semibold text-foreground">{valor}</p>
      {sub && <p className="truncate text-[10px] text-faint">{sub}</p>}
    </div>
  );
}
