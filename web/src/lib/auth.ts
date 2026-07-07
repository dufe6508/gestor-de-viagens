import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { supabase } from "./supabase";
import { resetEmpresaCache } from "./data";

// Esquema de deep link do APK (= appId). O listener em AuthGate captura o
// redirect de volta e troca o code pela sessão.
export const OAUTH_REDIRECT_NATIVE = "com.gestordeexcursoes.app://login-callback";

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signUpEmail(email: string, senha: string) {
  const { error } = await supabase.auth.signUp({ email, password: senha });
  if (error) throw error;
}

export async function signInEmail(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

export async function signInGoogle() {
  const native = Capacitor.isNativePlatform();
  // Web: redireciona na própria aba. APK: abre navegador do sistema e volta via
  // deep link (skipBrowserRedirect impede o webview de tentar navegar sozinho).
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: native ? OAUTH_REDIRECT_NATIVE : window.location.origin,
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;
  if (native && data?.url) await Browser.open({ url: data.url });
}

// Botão "Teste": sessão anônima que enxerga a empresa demo (dados fictícios).
export async function signInTeste() {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
  resetEmpresaCache();
}

// Garante que um usuário real (não anônimo) tenha a própria empresa.
// Anônimo (teste) usa a demo — nunca cria empresa. Idempotente.
export async function ensureEmpresa(): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.is_anonymous) return;
  const { data: existente } = await supabase
    .from("empresa")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existente) return;
  const nome = user.email?.split("@")[0] || "Minha empresa";
  const { error } = await supabase.from("empresa").insert({ owner_id: user.id, nome });
  if (error) throw error;
  resetEmpresaCache();
}
