"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, TrendingUp, Users, Wallet } from "lucide-react";
import { brl } from "@/lib/format";
import {
  acumular,
  deltaPct,
  labelMes,
  rangesDoPreset,
  somaNoRange,
  somaPorMes,
  somarDias,
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
import { RankBars, Sparkline, type RankRow } from "@/components/charts";
import { renderWidgets, type Widget } from "@/components/relatorios/registry";

/*
 * Aba Visão geral — "a empresa em 10 segundos" (plano §4, aba 1).
 * Todos os widgets nascem sobre o registry (gancho da personalização, F5).
 */
export function VisaoGeral({
  dataset,
  periodo,
  excursaoId,
}: {
  dataset: DatasetRelatorios;
  periodo: PeriodoPreset;
  excursaoId: string;
}) {
  const router = useRouter();
  const hoje = hojeISO();

  const m = useMemo(() => {
    const { atual, anterior } = rangesDoPreset(periodo, hoje);

    const resumos = filtrarPorExcursao(dataset.resumos, excursaoId);
    const pagamentos = filtrarPorExcursao(dataset.pagamentos, excursaoId);
    const despesas = filtrarPorExcursao(dataset.despesas, excursaoId);
    const passageiros = filtrarPorExcursao(dataset.passageiros, excursaoId);
    const parcelas = filtrarPorExcursao(parcelasAbertas(dataset.parcelas), excursaoId);

    // Consolidado (acumulado, não recortado por período — é a foto de agora).
    const aReceber = resumos.reduce((s, r) => s + r.total_a_receber, 0);
    const recebidoTotal = resumos.reduce((s, r) => s + r.total_recebido, 0);
    const despesasTotal = resumos.reduce((s, r) => s + r.total_despesas, 0);
    const caixa = recebidoTotal - despesasTotal;
    const falta = Math.max(aReceber - recebidoTotal, 0);

    // Fluxo do período filtrado + Δ vs período anterior de mesmo tamanho.
    const entradasPer = somaNoRange(pagamentos, atual);
    const saidasPer = somaNoRange(despesas, atual);
    const lucroPer = entradasPer - saidasPer;
    const lucroAnterior = anterior
      ? somaNoRange(pagamentos, anterior) - somaNoRange(despesas, anterior)
      : null;
    const deltaLucro =
      lucroAnterior != null ? deltaPct(lucroPer, lucroAnterior) : null;

    // Cobrança: parcelas vencidas (status atrasada) e passageiros inadimplentes.
    const vencidas = parcelas.filter((p) => p.status === "atrasada");
    const valorVencido = vencidas.reduce((s, p) => s + p.saldo, 0);
    const inadimplentes = passageiros.filter(
      (p) => p.status_pagamento === "atrasado",
    );

    // Vence nos próximos 7 dias (pendente, não atrasada).
    const limite7 = somarDias(hoje, 7);
    const vence7 = parcelas.filter(
      (p) =>
        p.status === "pendente" &&
        p.vencimento != null &&
        p.vencimento >= hoje &&
        p.vencimento <= limite7,
    );
    const valorVence7 = vence7.reduce((s, p) => s + p.saldo, 0);

    // Passageiros ativos = de excursões não encerradas.
    const excAtivas = new Set(
      dataset.excursoes.filter((e) => e.status !== "encerrada").map((e) => e.id),
    );
    const ativos = passageiros.filter((p) => excAtivas.has(p.excursao_id)).length;

    // Sparkline: caixa (entradas − saídas) por mês, últimos 6 meses, acumulado.
    const chaves = ultimasChavesMes(hoje, 6);
    const entradaMes = somaPorMes(pagamentos, chaves);
    const saidaMes = somaPorMes(despesas, chaves);
    const liquidoAcum = acumular(entradaMes.map((e, i) => e - saidaMes[i]));
    const spark = chaves.map((c, i) => ({ label: labelMes(c), value: liquidoAcum[i] }));

    // Ranking de excursões por lucro (recebido − despesas), top 5.
    const rank: RankRow[] = [...resumos]
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 5)
      .map((r) => ({ id: r.excursao_id, label: r.nome, value: r.lucro }));

    return {
      aReceber,
      recebidoTotal,
      despesasTotal,
      caixa,
      falta,
      lucroPer,
      deltaLucro,
      valorVencido,
      qtdVencidas: vencidas.length,
      inadimplentes,
      valorVence7,
      qtdVence7: vence7.length,
      ativos,
      spark,
      rank,
      temMovimento: pagamentos.length > 0 || despesas.length > 0,
    };
  }, [dataset, periodo, excursaoId, hoje]);

  const irParaPagamentos = () => {
    const id = excursaoId !== "todas" ? excursaoId : dataset.excursoes[0]?.id;
    if (id) router.push(`/passageiros?id=${id}`);
  };

  const widgets: Widget[] = [
    {
      id: "heroi-caixa",
      node: (
        <section className="glass-card glass-card-soft rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Saldo em caixa</p>
          <p
            className={`money mt-2 text-[2.5rem] font-semibold leading-none ${
              m.caixa < 0 ? "text-destructive" : "text-primary-strong"
            }`}
          >
            {brl(m.caixa)}
          </p>
          <div className="mt-6 flex items-center gap-8 border-t border-white/8 pt-4">
            <div>
              <p className="text-xs text-faint">Recebido</p>
              <p className="money mt-0.5 text-base font-semibold">{brl(m.recebidoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-faint">Despesas</p>
              <p className="money mt-0.5 text-base font-semibold">{brl(m.despesasTotal)}</p>
            </div>
          </div>
        </section>
      ),
    },
    {
      id: "kpis",
      node: (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Falta receber"
            valor={brl(m.falta)}
            hint={`de ${brl(m.aReceber)}`}
            icon={Wallet}
          />
          <KpiCard
            label="Parcelas vencidas"
            valor={brl(m.valorVencido)}
            hint={m.qtdVencidas > 0 ? `${m.qtdVencidas} parcela${m.qtdVencidas > 1 ? "s" : ""}` : "em dia"}
            tone={m.valorVencido > 0 ? "negativo" : "neutro"}
            icon={AlertTriangle}
          />
          <KpiCard
            label="Passageiros ativos"
            valor={String(m.ativos)}
            icon={Users}
          />
          <KpiCard
            label="Lucro do período"
            valor={brl(m.lucroPer)}
            delta={m.deltaLucro != null ? { pct: m.deltaLucro, melhorSubir: true } : null}
            hint={m.deltaLucro == null ? "sem base anterior" : undefined}
            tone={m.lucroPer < 0 ? "negativo" : "neutro"}
            icon={TrendingUp}
          />
        </div>
      ),
    },
    {
      id: "spark-caixa",
      node: (
        <ChartCard
          titulo="Evolução do caixa"
          subtitulo="Líquido acumulado nos últimos 6 meses"
          vazio={!m.temMovimento && "Sem movimentações ainda"}
        >
          <Sparkline points={m.spark} />
        </ChartCard>
      ),
    },
    {
      id: "atencao",
      // Só aparece se houver algo a cobrar (some do registry via visivel=false).
      visivel: m.inadimplentes.length > 0 || m.qtdVence7 > 0,
      node: (
        <section className="glass-card glass-card-soft rounded-lg p-5">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Precisa de atenção</p>
          <div className="space-y-2">
            {m.inadimplentes.length > 0 && (
              <AtencaoLinha
                icon={<AlertTriangle className="size-4 text-destructive" strokeWidth={1.75} />}
                titulo={`${m.inadimplentes.length} inadimplente${m.inadimplentes.length > 1 ? "s" : ""}`}
                valor={brl(m.inadimplentes.reduce((s, p) => s + p.saldo, 0))}
                onClick={irParaPagamentos}
              />
            )}
            {m.qtdVence7 > 0 && (
              <AtencaoLinha
                icon={<CalendarClock className="size-4 text-warning" strokeWidth={1.75} />}
                titulo={`${m.qtdVence7} vence${m.qtdVence7 > 1 ? "m" : ""} em 7 dias`}
                valor={brl(m.valorVence7)}
                onClick={irParaPagamentos}
              />
            )}
          </div>
        </section>
      ),
    },
    {
      id: "rank-lucro",
      visivel: m.rank.length > 0,
      node: (
        <ChartCard titulo="Excursões por lucro" subtitulo="Recebido menos despesas">
          <RankBars rows={m.rank} />
        </ChartCard>
      ),
    },
  ];

  return renderWidgets(widgets);
}

function AtencaoLinha({
  icon,
  titulo,
  valor,
  onClick,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md bg-white/[0.03] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.06] active:scale-[0.99]"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.05]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{titulo}</span>
      <span className="money shrink-0 text-sm font-semibold text-muted-foreground">{valor}</span>
    </button>
  );
}
