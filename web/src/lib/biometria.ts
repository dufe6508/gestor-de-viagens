import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";

const STORAGE_KEY = "biometria_ativa";

export function biometriaAtiva(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setBiometriaAtiva(v: boolean): void {
  localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
}

// Só existe em app nativo (Android/iOS via Capacitor) — no navegador não há sensor.
export function biometriaSuportada(): boolean {
  return Capacitor.isNativePlatform();
}

export async function biometriaDisponivelNoAparelho(): Promise<boolean> {
  if (!biometriaSuportada()) return false;
  try {
    const r = await NativeBiometric.isAvailable();
    return r.isAvailable;
  } catch {
    return false;
  }
}

// Pede a digital/face. Resolve true em sucesso, false em cancelamento/falha.
export async function verificarBiometria(): Promise<boolean> {
  if (!biometriaSuportada()) return true; // web: nada a verificar
  try {
    await NativeBiometric.verifyIdentity({
      title: "Gestor de Excursões",
      reason: "Confirme sua identidade para entrar",
    });
    return true;
  } catch {
    return false;
  }
}
