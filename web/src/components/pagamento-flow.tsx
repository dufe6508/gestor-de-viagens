"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, CircleDollarSign, Coins, SlidersHorizontal } from "lucide-react";
import {
  registrarPagamento,
  pagarProximaParcela,
  parseValor,
  type ParcelaRow,
} from "@/lib/passageiros";
import { brl } from "@/lib/format";
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

const hoje = () => new Date().toISOString().slice(0, 10);
const numToInput = (n: number) => n.toFixed(2).replace(".", ",");
const ddmmaa = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

export interface FlowTarget {
  id: string;
  nome: string;
  saldo: number;
  parcelas: ParcelaRow[];
}

/*
 * Fluxo de pagamento a partir do botão da lista:
 * - Sem parcelamento → confirmação de pagamento integral.
 * - Com parcelamento → menu (quitar próxima · parcial · personalizado).
 * Reseta o estado a cada abertura via `key` no Inner.
 */
export function PagamentoFlow({
  target,
  onOpenChange,
  onDone,
}: {
  target: FlowTarget | null;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const abertas = useMemo(
    () => (target ? target.parcelas.filter((p) => p.status !== "paga" && p.saldo > 0) : []),
    [target],
  );
  const comParcelas = abertas.length > 0;

  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent variant={comParcelas ? "sheet" : "center"} showCloseButton={!comParcelas}>
        {target && (
          <Inner
            key={target.id}
            target={target}
            abertas={abertas}
            comParcelas={comParcelas}
            close={() => onOpenChange(false)}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Inner({
  target,
  abertas,
  comParcelas,
  close,
  onDone,
}: {
  target: FlowTarget;
  abertas: ParcelaRow[];
  comParcelas: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const prox = abertas[0];
  const [step, setStep] = useState<"root" | "valor">("root");
  const [modo, setModo] = useState<"parcial" | "personalizado">("parcial");
  const [valor, setValor] = useState(() => numToInput(comParcelas ? 0 : target.saldo));
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState("");
  const [saving, setSaving] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setSaving(true);
    try {
      await fn();
      toast.success(ok);
      onDone();
      close();
    } catch (e) {
      toast.error("Erro no pagamento", { description: String((e as Error).message) });
    } finally {
      setSaving(false);
    }
  }

  // ---- Integral (sem parcelamento) ----
  if (!comParcelas) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-border bg-white/[0.02] px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Pagamento integral
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {target.nome} · pacote de <span className="money">{brl(target.saldo)}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-int">Valor recebido (R$)</Label>
            <Input
              id="pf-int"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={() => {
              const v = parseValor(valor);
              if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido");
              run(() => registrarPagamento(target.id, v, hoje()), "Pagamento registrado");
            }}
          >
            <CircleDollarSign strokeWidth={1.75} /> Confirmar pagamento
          </Button>
        </DialogFooter>
      </>
    );
  }

  // ---- Menu (com parcelamento) ----
  if (step === "root") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-1">
          <FlowOption
            icon={CalendarClock}
            title="Quitar próxima parcela"
            meta={prox ? `Parcela ${prox.numero} · vence ${ddmmaa(prox.vencimento)}` : undefined}
            valor={prox ? brl(prox.saldo) : undefined}
            disabled={saving}
            onClick={() =>
              run(async () => {
                const r = await pagarProximaParcela(target.id);
                if (!r) throw new Error("Sem parcela em aberto");
              }, "Parcela quitada")
            }
          />
          <FlowOption
            icon={Coins}
            title="Pagamento parcial"
            meta="Abate nas parcelas mais antigas"
            disabled={saving}
            onClick={() => {
              setModo("parcial");
              setValor(numToInput(prox ? prox.saldo : 0));
              setStep("valor");
            }}
          />
          <FlowOption
            icon={SlidersHorizontal}
            title="Pagamento personalizado"
            meta="Valor, data e forma"
            disabled={saving}
            onClick={() => {
              setModo("personalizado");
              setValor(numToInput(target.saldo));
              setStep("valor");
            }}
          />
        </div>
      </>
    );
  }

  // ---- Passo de valor (parcial / personalizado) ----
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep("root")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </button>
          <DialogTitle>
            {modo === "parcial" ? "Pagamento parcial" : "Pagamento personalizado"}
          </DialogTitle>
        </div>
      </DialogHeader>
      <div className="space-y-4 py-1">
        {modo === "personalizado" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-v">Valor (R$)</Label>
              <Input
                id="pf-v"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-d">Data</Label>
              <Input id="pf-d" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="pf-v">Valor recebido (R$)</Label>
            <Input
              id="pf-v"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
            />
          </div>
        )}
        {modo === "personalizado" && (
          <div className="space-y-1.5">
            <Label htmlFor="pf-f">Forma (opcional)</Label>
            <Input
              id="pf-f"
              placeholder="Pix, dinheiro…"
              value={forma}
              onChange={(e) => setForma(e.target.value)}
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          size="lg"
          className="w-full"
          disabled={saving}
          onClick={() => {
            const v = parseValor(valor);
            if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido");
            const d = modo === "personalizado" ? data : hoje();
            if (!d) return toast.error("Informe a data");
            run(
              () => registrarPagamento(target.id, v, d, modo === "personalizado" ? forma.trim() || undefined : undefined),
              "Pagamento registrado",
            );
          }}
        >
          Confirmar
        </Button>
      </DialogFooter>
    </>
  );
}

function FlowOption({
  icon: Icon,
  title,
  meta,
  valor,
  onClick,
  disabled,
}: {
  icon: typeof Coins;
  title: string;
  meta?: string;
  valor?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-50"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/6 text-foreground">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {meta && <span className="block truncate text-xs text-faint">{meta}</span>}
      </span>
      {valor && <span className="money shrink-0 text-sm text-muted-foreground">{valor}</span>}
    </button>
  );
}
