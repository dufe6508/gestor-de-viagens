"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { brl } from "@/lib/format";
import {
  acumular,
  deltaPct,
  labelMes,
  noRange,
  proximasChavesMes,
  rangesDoPreset,
  somaNoRange,
  somaPorMes,
  ultimasChavesMes,
  type PeriodoPreset,
} from "@/lib/metricas";
import {
  filtrarPorExcursao,
  hojeISO,
  parcelasAbertas,
  type DatasetRelatorios,
} from "@/lib/relatorios";
import { KpiCard } from "@/components/relatorios/kpi-card";
import { ChartCard } from "@/components/relatorios/chart-card";
import { FlowBars, LegendBar, Sparkline, type FlowMonth } from "@/components/charts";
import { renderWidgets, type Widget } from "@/components/relatorios/registry";

/*
 * Aba Financeiro — o dinheiro no tempo (plano §4, aba 2). Passeio é fluxo de
 * caixa puro: entra e é repassado (líquido zero), aparece no bruto do fluxo e
 * no extrato como entrada + repasse.
 */

// Cores de forma de pagamento (dessaturadas, fora da paleta semântica).
const CORES_FORMA = ["#7fa8c0", "#8b93f8", "#79c9a0", "#c7a06a", "#d08a7d", "#9d8ec0"];

interface Linha {
  tipo: "entrada" | "saida";
  rotulo: string;
  sub: string;
  valor: number;
  data: string | null;
}

export function Financeiro({
  dataset,
  periodo,
  excursaoId,
}: {
  dataset: DatasetRelatorios;
  periodo: PeriodoPreset;
  excursaoId: string;
}) {
  const hoje = hojeISO();

  const m = useMemo(() => {
    const pagamentos = filtrarPorExcursao(dataset.pagamentos, excursaoId);
    const despesas = filtrarPorExcursao(dataset.despesas, excursaoId);
    const passeios = filtrarPorExcursao(dataset.passeios, excursaoId);
    const abertas = filtrarPorExcursao(parcelasAbertas(dataset.parcelas), excursaoId);

    const { atual, anterior } = rangesDoPreset(periodo, hoje);

    // Bruto: entradas = pagamentos + passeios (pass-through); saídas = despesas + repasse.
    const entradasBrutas = [...pagamentos, ...passeios];
    const saidasBrutas = [...despesas, ...passeios]; // repasse = mesmo valor do passeio

    const entradasPer = somaNoRange(entradasBrutas, atual);
    const saidasPer = somaNoRange(saidasBrutas, atual);
    const liquidoPer = entradasPer - saidasPer;
    // Δ sobre o líquido vs período anterior (deltaPct trata base 0 → null).
    const liquidoAnterior = anterior
      ? somaNoRange(entradasBrutas, anterior) - somaNoRange(saidasBrutas, anterior)
      : null;
    const deltaLiquido = liquidoAnterior != null ? deltaPct(liquidoPer, liquidoAnterior) : null;

    // Fluxo mensal (6 meses) + evolução acumulada.
    const chaves = ultimasChavesMes(hoje, 6);
    const entMes = somaPorMes(entradasBrutas, chaves);
    const saiMes = somaPorMes(saidasBrutas, chaves);
    const flow: FlowMonth[] = chaves.map((c, i) => ({
      label: labelMes(c),
      entrada: entMes[i],
      saida: saiMes[i],
    }));
    const acum = acumular(entMes.map((e, i) => e - saiMes[i]));
    const evolucao = chaves.map((c, i) => ({ label: labelMes(c), value: acum[i] }));

    // Forecast: receita prevista (saldo de parcelas a vencer) nos próximos 6 meses.
    const futuras = proximasChavesMes(hoje, 6);
    const prevMes = somaPorMes(
      abertas.map((p) => ({ valor: p.saldo, data: p.vencimento })),
      futuras,
    );
    const previstoTotal = prevMes.reduce((s, v) => s + v, 0);
    const forecast: FlowMonth[] = futuras.map((c, i) => ({
      label: labelMes(c),
      entrada: prevMes[i],
      saida: 0,
    }));

    // Mix de formas de pagamento no período.
    const porForma = new Map<string, number>();
    for (const p of pagamentos) {
      if (!noRange(p.data, atual)) continue;
      const k = p.forma?.trim() || "Não informado";
      porForma.set(k, (porForma.get(k) ?? 0) + p.valor);
    }
    const totalForma = [...porForma.values()].reduce((s, v) => s + v, 0);
    const formas = [...porForma.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, valor], i) => ({
        id: label,
        label,
        cor: CORES_FORMA[i % CORES_FORMA.length],
        valor,
        pct: totalForma > 0 ? valor / totalForma : 0,
      }));

    // Extrato: entradas + saídas + repasses de passeio, mais recentes primeiro.
    const extrato: Linha[] = [
      ...pagamentos.map((p) => ({ tipo: "entrada" as const, rotulo: "Pagamento", sub: p.forma || "recebido", valor: p.valor, data: p.data })),
      ...passeios.map((p) => ({ tipo: "entrada" as const, rotulo: p.passeio_nome, sub: "passeio (entra)", valor: p.valor, data: p.data })),
      ...despesas.map((d) => ({ tipo: "saida" as const, rotulo: d.nome, sub: d.categoria_nome, valor: d.valor, data: d.data })),
      ...passeios.map((p) => ({ tipo: "saida" as const, rotulo: p.passeio_nome, sub: "passeio (repasse)", valor: p.valor, data: p.data })),
    ].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")).slice(0, 40);

    return {
      entradasPer,
      saidasPer,
      liquidoPer,
      deltaLiquido,
      flow,
      evolucao,
      forecast,
      previstoTotal,
      formas,
      extrato,
      temMovimento: entradasBrutas.length > 0 || saidasBrutas.length > 0,
    };
  }, [dataset, periodo, excursaoId, hoje]);

  const widgets: Widget[] = [
    {
      id: "kpis-fluxo",
      node: (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Entradas" valor={brl(m.entradasPer)} tone="positivo" icon={ArrowUpRight} />
          <KpiCard label="Saídas" valor={brl(m.saidasPer)} tone="negativo" icon={ArrowDownRight} />
          <KpiCard
            label="Líquido"
            valor={brl(m.liquidoPer)}
            tone={m.liquidoPer < 0 ? "negativo" : "neutro"}
            delta={m.deltaLiquido != null ? { pct: m.deltaLiquido, melhorSubir: true } : null}
            icon={TrendingUp}
          />
        </div>
      ),
    },
    {
      id: "fluxo-mensal",
      node: (
        <ChartCard
          titulo="Fluxo de caixa"
          subtitulo="Entradas e saídas por mês (inclui passeios)"
          vazio={!m.temMovimento && "Sem movimentações ainda"}
        >
          <FlowBars months={m.flow} />
          <Legenda />
        </ChartCard>
      ),
    },
    {
      id: "evolucao",
      node: (
        <ChartCard
          titulo="Evolução do caixa"
          subtitulo="Líquido acumulado (6 meses)"
          vazio={!m.temMovimento && "Sem movimentações ainda"}
        >
          <Sparkline points={m.evolucao} />
        </ChartCard>
      ),
    },
    {
      id: "forecast",
      node: (
        <ChartCard
          titulo="Previsão de recebimento"
          subtitulo={
            m.previstoTotal > 0
              ? `${brl(m.previstoTotal)} a receber nos próximos 6 meses`
              : "Parcelas a vencer por mês"
          }
          vazio={m.previstoTotal === 0 && "Nenhuma parcela a vencer"}
        >
          <FlowBars months={m.forecast} ghostFrom={0} />
          <p className="mt-3 text-[11px] text-faint">Projeção — parcelas em aberto por mês de vencimento.</p>
        </ChartCard>
      ),
    },
    {
      id: "formas",
      visivel: m.formas.length > 0,
      node: (
        <ChartCard titulo="Formas de pagamento" subtitulo="Do que entrou no período">
          <LegendBar segments={m.formas} />
        </ChartCard>
      ),
    },
    {
      id: "extrato",
      node: (
        <ChartCard
          titulo="Extrato"
          subtitulo="Livro-caixa — entradas e saídas"
          vazio={m.extrato.length === 0 && "Sem lançamentos"}
        >
          <ul className="divide-y divide-white/[0.05]">
            {m.extrato.map((l, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full ${
                    l.tipo === "entrada" ? "bg-[var(--progress,#46c98a)]/15" : "bg-destructive/15"
                  }`}
                >
                  {l.tipo === "entrada" ? (
                    <ArrowUpRight className="size-3.5 text-[var(--progress,#46c98a)]" strokeWidth={2} />
                  ) : (
                    <ArrowDownRight className="size-3.5 text-destructive" strokeWidth={2} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{l.rotulo}</span>
                  <span className="block truncate text-[11px] text-faint">
                    {l.sub}
                    {l.data ? ` · ${dataCurta(l.data)}` : " · sem data"}
                  </span>
                </span>
                <span
                  className={`money shrink-0 text-sm font-semibold ${
                    l.tipo === "entrada" ? "text-[var(--progress,#46c98a)]" : "text-destructive"
                  }`}
                >
                  {l.tipo === "entrada" ? "+" : "−"}
                  {brl(l.valor)}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ),
    },
  ];

  return renderWidgets(widgets);
}

function Legenda() {
  return (
    <div className="mt-3 flex items-center gap-4">
      <span className="flex items-center gap-1.5 text-[11px] text-faint">
        <span className="size-2 rounded-full" style={{ backgroundColor: "var(--progress, #46c98a)" }} /> Entradas
      </span>
      <span className="flex items-center gap-1.5 text-[11px] text-faint">
        <span className="size-2 rounded-full bg-destructive" /> Saídas
      </span>
    </div>
  );
}

function dataCurta(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
