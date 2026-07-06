import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// Registro do dispositivo p/ push nativo. Sem servidor de campanhas no MVP —
// isso só deixa o app pronto p/ quando existir o envio (fora de escopo aqui).
// Exige projeto Firebase + google-services.json em android/app/ pra funcionar
// de fato; sem isso, falha em silêncio (não pode travar o app).
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== "granted") return;
    }
    await PushNotifications.register();
  } catch {
    // Firebase ainda não configurado — plumbing fica pronto, sem quebrar o app.
  }
}
