import { supabase } from "./supabase";
import { resetEmpresaCache } from "./data";

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
  // Web: volta pra origem. Nativo (Capacitor) precisa de deep link — configurar
  // quando gerar o APK (redirectTo com esquema do app).
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
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
