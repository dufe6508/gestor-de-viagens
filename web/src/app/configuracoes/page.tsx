"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Fingerprint } from "lucide-react";
import {
  biometriaAtiva,
  biometriaDisponivelNoAparelho,
  biometriaSuportada,
  setBiometriaAtiva,
  verificarBiometria,
} from "@/lib/biometria";
import { Switch } from "@/components/ui/switch";

export default function ConfiguracoesPage() {
  const [ativa, setAtiva] = useState(false);
  const [disponivel, setDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAtiva(biometriaAtiva());
    biometriaDisponivelNoAparelho().then(setDisponivel);
  }, []);

  async function alternar(v: boolean) {
    if (v) {
      // Confirma com uma digital real antes de ligar a exigência.
      setCarregando(true);
      const ok = await verificarBiometria();
      setCarregando(false);
      if (!ok) return toast.error("Não foi possível confirmar a digital");
    }
    setBiometriaAtiva(v);
    setAtiva(v);
    toast.success(v ? "Biometria ativada" : "Biometria desativada");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
      <header className="mb-5 flex items-center gap-2">
        <Link
          href="/"
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </Link>
        <h1 className="text-[1.375rem] font-semibold tracking-tight">Configurações</h1>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-white/[0.02]">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
            <Fingerprint className="size-5 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Biometria</p>
            <p className="text-sm text-muted-foreground">
              {biometriaSuportada()
                ? disponivel
                  ? "Pedir digital ao abrir o app"
                  : "Sem digital cadastrada neste aparelho"
                : "Disponível só no app instalado"}
            </p>
          </div>
          <Switch
            checked={ativa}
            onCheckedChange={alternar}
            disabled={carregando || !biometriaSuportada() || !disponivel}
            aria-label="Ativar biometria"
          />
        </div>
      </section>
    </main>
  );
}
