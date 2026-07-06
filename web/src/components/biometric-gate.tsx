"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import {
  biometriaAtiva,
  biometriaSuportada,
  setBiometriaAtiva,
  verificarBiometria,
} from "@/lib/biometria";
import { Button } from "@/components/ui/button";

type Estado = "verificando" | "liberado" | "bloqueado";

// Se a verificação nunca resolver (prompt travado, app em background), não
// prende o usuário pra sempre numa tela em branco.
const TIMEOUT_MS = 10_000;

/*
 * Gate de entrada — só age em app nativo (Capacitor) e com a opção ligada em
 * Configurações. No navegador (biometriaSuportada() === false) libera direto.
 *
 * Sempre tem saída: se travar/falhar, "Entrar sem biometria" desliga a opção
 * e libera na hora — nunca tranca o usuário fora do próprio app (a tela de
 * Configurações que desativaria a opção fica DENTRO da árvore protegida, sem
 * este botão não haveria como alcançá-la de volta).
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>("verificando");

  async function tentar() {
    if (!biometriaSuportada() || !biometriaAtiva()) {
      setEstado("liberado");
      return;
    }
    setEstado("verificando");
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), TIMEOUT_MS));
    const ok = await Promise.race([verificarBiometria(), timeout]);
    setEstado(ok ? "liberado" : "bloqueado");
  }

  function entrarSemBiometria() {
    setBiometriaAtiva(false);
    setEstado("liberado");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    tentar();
    // Push notifications: NÃO inicializar aqui. Requer projeto Firebase +
    // google-services.json (ainda não configurado) — sem isso,
    // FirebaseMessaging.getInstance() lança IllegalStateException nativa que
    // o bridge do Capacitor relança sem tratamento, derrubando o app inteiro.
    // Religar (lib/notificacoes.ts) só depois do Firebase configurado.
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
      {estado === "bloqueado" && (
        <div className="flex flex-col items-center gap-2">
          <Button onClick={tentar}>Tentar novamente</Button>
          <button
            onClick={entrarSemBiometria}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Entrar sem biometria (desativa a opção)
          </button>
        </div>
      )}
    </div>
  );
}
