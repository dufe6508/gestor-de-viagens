"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plane, FlaskConical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resetEmpresaCache } from "@/lib/data";
import {
  ensureEmpresa,
  signInEmail,
  signInGoogle,
  signInTeste,
  signUpEmail,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Estado = "carregando" | "deslogado" | "logado";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>("carregando");

  useEffect(() => {
    async function resolver(temSessao: boolean) {
      resetEmpresaCache();
      if (!temSessao) {
        setEstado("deslogado");
        return;
      }
      try {
        await ensureEmpresa();
        setEstado("logado");
      } catch (e) {
        toast.error("Erro ao preparar conta", { description: String((e as Error).message) });
        setEstado("deslogado");
      }
    }
    supabase.auth.getSession().then(({ data }) => resolver(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      resolver(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (estado === "carregando") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-8 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  if (estado === "deslogado") return <LoginScreen />;

  return <>{children}</>;
}

function LoginScreen() {
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return toast.error("Preencha email e senha");
    setCarregando(true);
    try {
      if (modo === "criar") {
        await signUpEmail(email.trim(), senha);
        // Sem confirmação de email: signUp já cria a sessão (onAuthStateChange assume).
        toast.success("Conta criada");
      } else {
        await signInEmail(email.trim(), senha);
      }
    } catch (err) {
      toast.error(modo === "criar" ? "Não foi possível criar conta" : "Não foi possível entrar", {
        description: String((err as Error).message),
      });
    } finally {
      setCarregando(false);
    }
  }

  async function comGoogle() {
    try {
      await signInGoogle();
    } catch (err) {
      toast.error("Erro com Google", { description: String((err as Error).message) });
    }
  }

  async function comTeste() {
    setCarregando(true);
    try {
      await signInTeste();
    } catch (err) {
      toast.error("Erro ao entrar no teste", { description: String((err as Error).message) });
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="surface mb-4 grid size-14 place-items-center rounded-2xl">
          <Plane className="size-6 text-primary" strokeWidth={1.75} />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Gerenciador de Viagens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {modo === "entrar" ? "Entre na sua conta" : "Crie sua conta"}
        </p>
      </div>

      <Button variant="outline" className="w-full" onClick={comGoogle} disabled={carregando}>
        <GoogleLogo /> Continuar com Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-white/10" />
        ou
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            autoComplete={modo === "criar" ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={carregando}>
          {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <button
        onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
        className="mt-4 text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {modo === "entrar" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
      </button>

      <button
        onClick={comTeste}
        disabled={carregando}
        className="glass-card glass-card-softer mt-8 flex w-full items-center gap-3 rounded-xl p-4 text-left transition-transform duration-150 ease-(--ease-enter) active:scale-[0.98] disabled:opacity-50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06]">
          <FlaskConical className="size-4 text-primary" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">Explorar sem conta</span>
          <span className="block text-xs text-muted-foreground">Ver o app com dados de exemplo</span>
        </span>
      </button>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
