"use client";

import { useMemo, useState } from "react";
import { gerarParcelas } from "@/lib/parcelas";
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

export interface AlvoParcelamento {
  id: string;
  nome: string;
  valor_total: number;
}

const hoje = () => new Date().toISOString().slice(0, 10);

/*
 * Modal único de parcelamento — usado pela lista (em massa) e pelo detalhe
 * (individual). Só coleta nº de parcelas + data do 1º vencimento e mostra o
 * preview gerado por gerarParcelas; quem grava é o chamador (onConfirm).
 */
export function ParcelamentoDialog({
  open,
  onOpenChange,
  alvos,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alvos: AlvoParcelamento[];
  onConfirm: (numParcelas: number, primeiroVenc: string) => Promise<void>;
}) {
  const [nParcelas, setNParcelas] = useState("2");
  const [primeiroVenc, setPrimeiroVenc] = useState(hoje());
  const [saving, setSaving] = useState(false);

  const n = Number(nParcelas);
  const nValido = Number.isInteger(n) && n >= 1 && n <= 48;
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(primeiroVenc);
  const semValor = alvos.filter((a) => a.valor_total <= 0);

  // Preview: individual mostra as parcelas; em massa, o resumo.
  const preview = useMemo(() => {
    if (!nValido || !dataValida || alvos.length !== 1 || alvos[0].valor_total <= 0) return null;
    return gerarParcelas(alvos[0].valor_total, n, primeiroVenc);
  }, [alvos, n, nValido, primeiroVenc, dataValida]);

  async function handleConfirm() {
    if (!nValido || !dataValida) return;
    setSaving(true);
    try {
      await onConfirm(n, primeiroVenc);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>
            {alvos.length === 1 ? `Parcelar — ${alvos[0].nome}` : `Parcelar ${alvos.length} passageiros`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="parc-n">Nº de parcelas *</Label>
              <Input
                id="parc-n"
                inputMode="numeric"
                value={nParcelas}
                onChange={(e) => setNParcelas(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parc-venc">1º vencimento *</Label>
              <Input
                id="parc-venc"
                type="date"
                value={primeiroVenc}
                onChange={(e) => setPrimeiroVenc(e.target.value)}
              />
            </div>
          </div>

          {!nValido && nParcelas !== "" && (
            <p className="text-sm text-destructive">Nº de parcelas deve ser um inteiro de 1 a 48.</p>
          )}

          {semValor.length > 0 && (
            <p className="text-sm text-warning">
              {semValor.length === 1
                ? `${semValor[0].nome} está sem valor definido e será pulado.`
                : `${semValor.length} passageiros sem valor definido serão pulados.`}
            </p>
          )}

          {preview && (
            <div className="surface-soft max-h-56 space-y-1 overflow-y-auto rounded-md p-3.5">
              {preview.map((p) => (
                <div key={p.numero} className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Parcela {p.numero}</span>
                  <span className="money">
                    {brl(p.valor)}
                    <span className="text-faint"> · {p.vencimento.split("-").reverse().join("/")}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {alvos.length > 1 && nValido && (
            <p className="text-sm text-muted-foreground">
              Cada passageiro terá o próprio valor dividido em {n}x, vencendo todo mês a partir de{" "}
              {primeiroVenc.split("-").reverse().join("/")}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={saving || !nValido || !dataValida || semValor.length === alvos.length}
            className="w-full"
            size="lg"
          >
            {saving ? "Gerando…" : `Gerar parcelas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
