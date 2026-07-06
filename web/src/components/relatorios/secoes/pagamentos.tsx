"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Wallet,
} from "lucide-react";
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
 * A agenda é retrátil: cada faixa abre/fecha; a de atrasadas já vem aberta.
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
  // Faixas abertas da agenda (retrátil). Atrasadas já vem aberta.
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(["atrasada"]));
  const toggle = (id: string) =>
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const gruposAgenda: { id: string; titulo: string; tone: "negativo" | "alerta" | "neutro"; itens: ParcelaRow[] }[] = [
    ...FAIXA_ORDEM.map((f) => ({
      id: f,
      titulo: FAIXA_LABEL[f],
      tone: (f === "atrasada" ? "negativo" : f === "semana" ? "alerta" : "neutro") as "negativo" | "alerta" | "neutro",
      itens: m.agenda.get(f)!,
    })),
    { id: "semdata", titulo: "Sem data", tone: "neutro" as const, itens: m.semData },
  ].filter((g) => g.itens.length > 0);

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
          subtitulo="Toque numa faixa para abrir; no passageiro, para receber"
          vazio={gruposAgenda.length === 0 && "Nada em aberto — tudo quitado"}
        >
          <div className="space-y-2">
            {gruposAgenda.map((g) => (
              <GrupoAgenda
                key={g.id}
                titulo={g.titulo}
                total={g.itens.reduce((s, p) => s + p.saldo, 0)}
                qtd={g.itens.length}
                tone={g.tone}
                itens={g.itens}
                aberto={abertos.has(g.id)}
                onToggle={() => toggle(g.id)}
                onItem={irPassageiro}
              />
            ))}
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
  qtd,
  tone,
  itens,
  aberto,
  onToggle,
  onItem,
}: {
  titulo: string;
  total: number;
  qtd: number;
  tone: "negativo" | "alerta" | "neutro";
  itens: ParcelaRow[];
  aberto: boolean;
  onToggle: () => void;
  onItem: (id: string) => void;
}) {
  const corPonto =
    tone === "negativo" ? "var(--destructive)" : tone === "alerta" ? "var(--warning)" : "var(--muted-foreground)";
  const corTitulo =
    tone === "negativo" ? "text-destructive" : tone === "alerta" ? "text-warning" : "text-muted-foreground";
  return (
    <div className="overflow-hidden rounded-md bg-white/[0.03]">
      <button
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.03]"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: corPonto }} />
        <span className={`text-sm font-semibold ${corTitulo}`}>{titulo}</span>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-faint">{qtd}</span>
        <span className="ml-auto money text-xs font-semibold text-muted-foreground">{brl(total)}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-faint transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {aberto && (
        <ul className="space-y-1 px-1.5 pb-1.5">
          {itens.map((p, i) => (
            <li key={`${p.passageiro_id}-${i}`}>
              <button
                onClick={() => onItem(p.passageiro_id)}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-white/[0.05] active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.nome}</span>
                {p.vencimento && (
                  <span className="money shrink-0 text-[11px] text-faint">{dataCurta(p.vencimento)}</span>
                )}
                <span className="money shrink-0 text-sm font-semibold text-foreground">{brl(p.saldo)}</span>
                <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function dataCurta(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
