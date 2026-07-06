"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { biometriaAtiva, biometriaSuportada, verificarBiometria } from "@/lib/biometria";
import { initPushNotifications } from "@/lib/notificacoes";
import { Button } from "@/components/ui/button";

type Estado = "verificando" | "liberado" | "bloqueado";

/*
 * Gate de entrada — só age em app nativo (Capacitor) e com a opção ligada em
 * Configurações. No navegador (biometriaSuportada() === false) libera direto.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>("verificando");

  async function tentar() {
    if (!biometriaSuportada() || !biometriaAtiva()) {
      setEstado("liberado");
      return;
    }
    setEstado("verificando");
    const ok = await verificarBiometria();
    setEstado(ok ? "liberado" : "bloqueado");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    tentar();
    initPushNotifications();
  }, []);

  if (estado === "liberado") return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-secondary">
        <Fingerprint className="size-8 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div>
        <p className="font-semibold">
          {estado === "verificando" ? "Confirme sua identidade" : "Autenticação necessária"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {estado === "verificando" ? "Aguardando digital…" : "Toque para tentar novamente."}
        </p>
      </div>
      {estado === "bloqueado" && <Button onClick={tentar}>Tentar novamente</Button>}
    </div>
  );
}
