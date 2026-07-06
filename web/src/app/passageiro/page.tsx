"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PassageiroDetalhe } from "@/components/passageiro-detalhe";

function View() {
  const id = useSearchParams().get("id");
  const router = useRouter();

  // Fundo corporativo chapado (sem glow) enquanto esta tela estiver montada.
  useEffect(() => {
    document.body.classList.add("flat-bg");
    return () => document.body.classList.remove("flat-bg");
  }, []);

  if (!id) return <p className="p-8 text-center text-muted-foreground">Passageiro não informado.</p>;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-nav md:max-w-2xl">
      <PassageiroDetalhe id={id} onClose={() => router.back()} />
    </main>
  );
}

export default function PassageiroPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}>
      <View />
    </Suspense>
  );
}
