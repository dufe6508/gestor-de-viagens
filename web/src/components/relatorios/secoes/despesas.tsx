"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Layers, TrendingDown } from "lucide-react";
import { brl } from "@/lib/format";
import {
  deltaPct,
  labelMes,
  noRange,
  rangesDoPreset,
  somaPorMes,
  ultimasChavesMes,
  type PeriodoPreset,
} from "@/lib/metricas";
import { filtrarPorExcursao, hojeISO, type DatasetRelatorios } from "@/lib/relatorios";
import { KpiCard } from "@/components/relatorios/kpi-card";
import { ChartCard } from "@/components/relatorios/chart-card";
import { DespesasDonut, type DonutSegment } from "@/components/despesas-donut";
import { Bars } from "@/components/charts";
import { muteColor } from "@/components/despesas-icons";
import { renderWidgets, type Widget } from "@/components/relatorios/registry";

/*
 * Aba Despesas — para onde vai o dinheiro (plano §4, aba 5). Reusa o donut
 * interativo de /despesas (cores das categorias) como padrão único.
 */
export function Despesas({
  dataset,
  periodo,
  excursaoId,
}: {
  dataset: DatasetRelatorios;
  periodo: PeriodoPreset;
  excursaoId: string;
}) {
  const hoje = hojeISO();
  const [catSel, setCatSel] = useState<string | null>(null);

  const m = useMemo(() => {
    const todas = filtrarPorExcursao(dataset.despesas, excursaoId);
    const { atual, anterior } = rangesDoPreset(periodo, hoje);
    const desp = todas.filter((d) => noRange(d.data, atual));

    const total = desp.reduce((s, d) => s + d.valor, 0);
    const totalAnterior = anterior
      ? todas.filter((d) => noRange(d.data, anterior)).reduce((s, d) => s + d.valor, 0)
      : null;
    const delta = totalAnterior != null ? deltaPct(total, totalAnterior) : null;

    // Por categoria (agrega, ordena desc).
    const map = new Map<string, { id: string; nome: string; cor: string; total: number; qtd: number }>();
    for (const d of desp) {
      const key = d.categoria_id ?? "__sem__";
      const cur = map.get(key) ?? { id: key, nome: d.categoria_nome, cor: d.categoria_cor, total: 0, qtd: 0 };
      cur.total += d.valor;
      cur.qtd += 1;
      map.set(key, cur);
    }
    const categorias = [...map.values()].sort((a, b) => b.total - a.total);
    const maior = categorias[0] ?? null;

    // Evolução mensal (6 meses).
    const chaves = ultimasChavesMes(hoje, 6);
    const porMes = somaPorMes(desp, chaves);
    const evolucao = chaves.map((c, i) => ({ label: labelMes(c), value: porMes[i] }));
    const mediaMensal = porMes.reduce((s, v) => s + v, 0) / (chaves.length || 1);

    // Top 10 maiores despesas individuais.
    const top = [...desp].sort((a, b) => b.valor - a.valor).slice(0, 10);

    return { total, delta, categorias, maior, evolucao, mediaMensal, top, qtd: desp.length };
  }, [dataset, periodo, excursaoId, hoje]);

  const segments: DonutSegment[] = m.categorias.map((c) => ({
    id: c.id,
    label: c.nome,
    cor: muteColor(c.cor),
    valor: c.total,
    pct: m.total > 0 ? c.total / m.total : 0,
  }));

  const catAtiva = catSel ? m.categorias.find((c) => c.id === catSel) : null;
  const detalhe = catAtiva
    ? m.top.filter((d) => (d.categoria_id ?? "__sem__") === catSel)
    : m.top;

  const widgets: Widget[] = [
    {
      id: "kpis-despesas",
      node: (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Total no período"
            valor={brl(m.total)}
            delta={m.delta != null ? { pct: m.delta, melhorSubir: false } : null}
            hint={`${m.qtd} lançamento${m.qtd === 1 ? "" : "s"}`}
            icon={TrendingDown}
          />
          <KpiCard
            label="Maior categoria"
            valor={m.maior ? brl(m.maior.total) : brl(0)}
            hint={m.maior?.nome ?? "—"}
            icon={Layers}
          />
          <KpiCard label="Média mensal" valor={brl(m.mediaMensal)} icon={CalendarDays} />
          <KpiCard
            label="Categorias"
            valor={String(m.categorias.length)}
            hint="ativas no período"
            icon={Layers}
          />
        </div>
      ),
    },
    {
      id: "donut-categoria",
      node: (
        <ChartCard
          titulo="Por categoria"
          subtitulo="Toque numa fatia para detalhar"
          vazio={m.categorias.length === 0 && "Nenhuma despesa no período"}
        >
          <div className="flex flex-col items-center">
            <DespesasDonut
              segments={segments}
              total={m.total}
              quantidade={m.qtd}
              selectedId={catSel}
              onSelect={setCatSel}
            />
            <ul className="mt-5 w-full space-y-1.5">
              {m.categorias.map((c) => {
                const ativo = catSel === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setCatSel(ativo ? null : c.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 ${
                        ativo ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: muteColor(c.cor) }} />
                      <span className="min-w-0 flex-1 truncate text-left text-[13px] text-muted-foreground">{c.nome}</span>
                      <span className="money shrink-0 text-[13px] font-semibold text-foreground">{brl(c.total)}</span>
                      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-faint">
                        {Math.round((m.total > 0 ? c.total / m.total : 0) * 100)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </ChartCard>
      ),
    },
    {
      id: "evolucao-despesas",
      node: (
        <ChartCard
          titulo="Evolução mensal"
          subtitulo="Despesas nos últimos 6 meses"
          vazio={m.total === 0 && "Sem despesas para exibir"}
        >
          <Bars points={m.evolucao} height={120} />
        </ChartCard>
      ),
    },
    {
      id: "top-despesas",
      node: (
        <ChartCard
          titulo={catAtiva ? `Maiores — ${catAtiva.nome}` : "Maiores despesas"}
          subtitulo={catAtiva ? "Filtrado pela categoria" : "Top 10 do período"}
          vazio={detalhe.length === 0 && "Nenhuma despesa"}
        >
          <ul className="divide-y divide-white/[0.05]">
            {detalhe.map((d, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: muteColor(d.categoria_cor) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{d.nome}</span>
                  <span className="block truncate text-[11px] text-faint">{d.categoria_nome}</span>
                </span>
                <span className="money shrink-0 text-sm font-semibold text-foreground">{brl(d.valor)}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ),
    },
  ];

  return renderWidgets(widgets);
}
