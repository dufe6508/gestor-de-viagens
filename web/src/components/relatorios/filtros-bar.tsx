"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, MapPin } from "lucide-react";
import { PERIODOS, type PeriodoPreset } from "@/lib/metricas";
import type { ExcursaoRef } from "@/lib/relatorios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * Filtros globais da área de relatórios (plano §6): pills de Período e Excursão.
 * Controlado pela página (estado vive na URL) — os widgets reagem na hora.
 */
export function FiltrosBar({
  periodo,
  excursaoId,
  excursoes,
  onPeriodo,
  onExcursao,
}: {
  periodo: PeriodoPreset;
  excursaoId: string; // "todas" ou id
  excursoes: ExcursaoRef[];
  onPeriodo: (p: PeriodoPreset) => void;
  onExcursao: (id: string) => void;
}) {
  const [periodoOpen, setPeriodoOpen] = useState(false);
  const [excursaoOpen, setExcursaoOpen] = useState(false);

  const labelPeriodo = PERIODOS.find((p) => p.id === periodo)?.label ?? "Período";
  const labelExcursao =
    excursaoId === "todas"
      ? "Todas as excursões"
      : (excursoes.find((e) => e.id === excursaoId)?.nome ?? "Excursão");

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <FiltroPill
          icon={<CalendarDays className="size-3.5" strokeWidth={1.75} />}
          label={labelPeriodo}
          ativo={periodo !== "este_ano"}
          onClick={() => setPeriodoOpen(true)}
        />
        <FiltroPill
          icon={<MapPin className="size-3.5" strokeWidth={1.75} />}
          label={labelExcursao}
          ativo={excursaoId !== "todas"}
          onClick={() => setExcursaoOpen(true)}
        />
      </div>

      {/* Período */}
      <Dialog open={periodoOpen} onOpenChange={setPeriodoOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Período</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1 py-1">
            {PERIODOS.map((p) => (
              <OpcaoRow
                key={p.id}
                label={p.label}
                ativo={p.id === periodo}
                onClick={() => {
                  onPeriodo(p.id);
                  setPeriodoOpen(false);
                }}
              />
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Excursão */}
      <Dialog open={excursaoOpen} onOpenChange={setExcursaoOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Excursão</DialogTitle>
          </DialogHeader>
          <ul className="max-h-[55dvh] space-y-1 overflow-y-auto py-1">
            <OpcaoRow
              label="Todas as excursões"
              ativo={excursaoId === "todas"}
              onClick={() => {
                onExcursao("todas");
                setExcursaoOpen(false);
              }}
            />
            {excursoes.map((e) => (
              <OpcaoRow
                key={e.id}
                label={e.nome}
                ativo={e.id === excursaoId}
                onClick={() => {
                  onExcursao(e.id);
                  setExcursaoOpen(false);
                }}
              />
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FiltroPill({
  icon,
  label,
  ativo,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`surface flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-transform duration-150 ease-(--ease-enter) active:scale-[0.97] ${
        ativo ? "text-foreground ring-1 ring-inset ring-white/20" : "text-muted-foreground"
      }`}
    >
      <span className="text-faint">{icon}</span>
      <span className="max-w-44 truncate">{label}</span>
      <ChevronDown className="size-3.5 shrink-0 text-faint" strokeWidth={2} />
    </button>
  );
}

function OpcaoRow({
  label,
  ativo,
  onClick,
}: {
  label: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex h-12 w-full items-center gap-3 rounded-md px-3 text-left text-base transition-colors duration-150 ${
          ativo
            ? "bg-primary/12 font-medium text-foreground ring-1 ring-inset ring-primary/25"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {ativo && <Check className="size-4 shrink-0 text-primary" />}
      </button>
    </li>
  );
}
