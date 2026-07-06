"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CalendarDays, ChevronRight, Wallet } from "lucide-react";
import { brl } from "@/lib/format";
import {
  agingBucket,
  diasEntre,
  faixaVencimento,
  somaNoRange,
  somarDias,
  type FaixaVencimento,
} from "@/lib/metricas";
import {
  filtrarPorExcursao,
  hojeISO,
  parcelasAbertas,
  type DatasetRelatorios,
  type ParcelaRow,
} from "@/lib/relatorios";
import { KpiCard } from "@/components/relatorios/kpi-card";
import { ChartCard } from "@/components/relatorios/chart-card";
import { LegendBar } from "@/components/charts";
import { renderWidgets, type Widget } from "@/components/relatorios/registry";

/*
 * Aba Pagamentos — cobrança (plano §4, aba 4). Relatório ACIONÁVEL: cada
 * parcela/devedor leva à tela do passageiro para registrar o pagamento na hora.
 */

const FAIXA_LABEL: Record<FaixaVencimento, string> = {
  atrasada: "Atrasadas",
  semana: "Esta semana",
  mes: "Este mês",
  depois: "Depois",
};
const FAIXA_ORDEM: FaixaVencimento[] = ["atrasada", "semana", "mes", "depois"];

export function Pagamentos({
  dataset,
  excursaoId,
}: {
  dataset: DatasetRelatorios;
  excursaoId: string;
}) {
  const router = useRouter();
  const hoje = hojeISO();

  const m = useMemo(() => {
    const parcelas = filtrarPorExcursao(dataset.parcelas, excursaoId);
    const abertas = parcelasAbertas(parcelas);
    const pagamentos = filtrarPorExcursao(dataset.pagamentos, excursaoId);
    const passageiros = filtrarPorExcursao(dataset.passageiros, excursaoId);

    // Quebra do "a receber" por situação da parcela (valor).
    const pagoTot = parcelas.reduce((s, p) => s + (p.valor - p.saldo), 0);
    const vencidas = abertas.filter((p) => p.status === "atrasada");
    const pendentes = abertas.filter((p) => p.status === "pendente");
    const valorVencido = vencidas.reduce((s, p) => s + p.saldo, 0);
    const valorPendente = pendentes.reduce((s, p) => s + p.saldo, 0);

    // Recebido em janelas fixas (rolagem de 7 dias e mês corrente).
    const semana = { de: somarDias(hoje, -6), ate: hoje };
    const mesR = { de: hoje.slice(0, 8) + "01", ate: hoje };
    const recSemana = somaNoRange(pagamentos, semana);
    const recMes = somaNoRange(pagamentos, mesR);

    // Vence nos próximos 7 dias (pendente).
    const lim7 = somarDias(hoje, 7);
    const vence7 = pendentes.filter(
      (p) => p.vencimento != null && p.vencimento >= hoje && p.vencimento <= lim7,
    );
    const valorVence7 = vence7.reduce((s, p) => s + p.saldo, 0);

    // Agenda: agrupa parcelas abertas com vencimento por faixa.
    const agenda = new Map<FaixaVencimento, ParcelaRow[]>();
    for (const f of FAIXA_ORDEM) agenda.set(f, []);
    const semData: ParcelaRow[] = [];
    for (const p of abertas) {
      if (!p.vencimento) {
        semData.push(p);
        continue;
      }
      agenda.get(faixaVencimento(p.vencimento, hoje))!.push(p);
    }
    for (const arr of agenda.values())
      arr.sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""));

    // Devedores: maior saldo em aberto, com aging da parcela mais antiga vencida.
    const vencidoByPax = new Map<string, string>(); // passageiro → venc mais antigo
    for (const p of vencidas) {
      const cur = vencidoByPax.get(p.passageiro_id);
      if (p.vencimento && (!cur || p.vencimento < cur)) vencidoByPax.set(p.passageiro_id, p.vencimento);
    }
    const devedores = passageiros
      .filter((p) => p.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 8)
      .map((p) => {
        const venc = vencidoByPax.get(p.passageiro_id);
        const dias = venc ? diasEntre(venc, hoje) : 0;
        return { ...p, atraso: dias > 0 ? agingBucket(dias) : null, dias };
      });

    const totalReceber = pagoTot + valorPendente + valorVencido;
    return {
      pagoTot,
      valorVencido,
      valorPendente,
      qtdVencidas: vencidas.length,
      recSemana,
      recMes,
      valorVence7,
      qtdVence7: vence7.length,
      agenda,
      semData,
      devedores,
      totalReceber,
      temParcelas: parcelas.length > 0,
    };
  }, [dataset, excursaoId, hoje]);

  const irPassageiro = (id: string) => router.push(`/passageiro?id=${id}`);

  const statusSegments = [
    { id: "pago", label: "Pagas", cor: "var(--progress, #46c98a)", valor: m.pagoTot, pct: frac(m.pagoTot, m.totalReceber) },
    { id: "pendente", label: "A vencer", cor: "#8b93f8", valor: m.valorPendente, pct: frac(m.valorPendente, m.totalReceber) },
    { id: "vencida", label: "Vencidas", cor: "var(--destructive)", valor: m.valorVencido, pct: frac(m.valorVencido, m.totalReceber) },
  ];

  const widgets: Widget[] = [
    {
      id: "kpis-cobranca",
      node: (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Parcelas vencidas"
            valor={brl(m.valorVencido)}
            hint={m.qtdVencidas > 0 ? `${m.qtdVencidas} parcela${m.qtdVencidas > 1 ? "s" : ""}` : "nenhuma"}
            tone={m.valorVencido > 0 ? "negativo" : "neutro"}
            icon={AlertTriangle}
          />
          <KpiCard
            label="Vence em 7 dias"
            valor={brl(m.valorVence7)}
            hint={m.qtdVence7 > 0 ? `${m.qtdVence7} parcela${m.qtdVence7 > 1 ? "s" : ""}` : "nada à vista"}
            tone={m.valorVence7 > 0 ? "alerta" : "neutro"}
            icon={CalendarClock}
          />
          <KpiCard label="Recebido na semana" valor={brl(m.recSemana)} icon={Wallet} />
          <KpiCard label="Recebido no mês" valor={brl(m.recMes)} icon={CalendarDays} />
        </div>
      ),
    },
    {
      id: "status-parcelas",
      node: (
        <ChartCard
          titulo="Situação das parcelas"
          subtitulo="Do total a receber"
          vazio={!m.temParcelas && "Nenhuma parcela gerada ainda"}
        >
          <LegendBar segments={statusSegments} />
        </ChartCard>
      ),
    },
    {
      id: "agenda",
      node: (
        <ChartCard
          titulo="Agenda de vencimentos"
          subtitulo="Toque para abrir o passageiro e receber"
          vazio={
            [...m.agenda.values()].every((a) => a.length === 0) &&
            m.semData.length === 0 &&
            "Nada em aberto — tudo quitado"
          }
        >
          <div className="space-y-4">
            {FAIXA_ORDEM.map((f) => {
              const itens = m.agenda.get(f)!;
              if (itens.length === 0) return null;
              const total = itens.reduce((s, p) => s + p.saldo, 0);
              return (
                <GrupoAgenda
                  key={f}
                  titulo={FAIXA_LABEL[f]}
                  total={total}
                  tone={f === "atrasada" ? "negativo" : f === "semana" ? "alerta" : "neutro"}
                  itens={itens}
                  hoje={hoje}
                  onItem={irPassageiro}
                />
              );
            })}
            {m.semData.length > 0 && (
              <GrupoAgenda
                titulo="Sem data"
                total={m.semData.reduce((s, p) => s + p.saldo, 0)}
                tone="neutro"
                itens={m.semData}
                hoje={hoje}
                onItem={irPassageiro}
              />
            )}
          </div>
        </ChartCard>
      ),
    },
    {
      id: "devedores",
      visivel: m.devedores.length > 0,
      node: (
        <ChartCard titulo="Maiores devedores" subtitulo="Saldo em aberto por passageiro">
          <ul className="space-y-1">
            {m.devedores.map((d) => (
              <li key={d.passageiro_id}>
                <button
                  onClick={() => irPassageiro(d.passageiro_id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-white/[0.04] active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{d.nome}</span>
                    {d.atraso ? (
                      <span className="text-[11px] text-destructive">
                        vencido há {d.dias} {d.dias === 1 ? "dia" : "dias"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-faint">em dia</span>
                    )}
                  </span>
                  <span className="money shrink-0 text-sm font-semibold text-foreground">{brl(d.saldo)}</span>
                  <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </ChartCard>
      ),
    },
  ];

  return renderWidgets(widgets);
}

function frac(v: number, total: number): number {
  return total > 0 ? v / total : 0;
}

function GrupoAgenda({
  titulo,
  total,
  tone,
  itens,
  hoje,
  onItem,
}: {
  titulo: string;
  total: number;
  tone: "negativo" | "alerta" | "neutro";
  itens: ParcelaRow[];
  hoje: string;
  onItem: (id: string) => void;
}) {
  const corTitulo =
    tone === "negativo" ? "text-destructive" : tone === "alerta" ? "text-warning" : "text-muted-foreground";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-xs font-semibold ${corTitulo}`}>{titulo}</span>
        <span className="money text-xs text-faint">{brl(total)}</span>
      </div>
      <ul className="space-y-1">
        {itens.map((p, i) => {
          const venc = p.vencimento;
          return (
            <li key={`${p.passageiro_id}-${i}`}>
              <button
                onClick={() => onItem(p.passageiro_id)}
                className="flex w-full items-center gap-3 rounded-md bg-white/[0.03] px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.06] active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.nome}</span>
                {venc && (
                  <span className="money shrink-0 text-[11px] text-faint">{dataCurta(venc)}</span>
                )}
                <span className="money shrink-0 text-sm font-semibold text-foreground">{brl(p.saldo)}</span>
                <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function dataCurta(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
