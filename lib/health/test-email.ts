import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";

/** One test e-mail to the admin address: the only health check that writes something, on an explicit request. */
export async function sendAdminTestEmail(from: string): Promise<{ ok: boolean; message: string }> {
  const result = await sendEmail({
    to: env.ADMIN_EMAIL,
    subject: "E-mail de test · santé des intégrations",
    text: ["Bonjour Ben,", "", "Cet e-mail de test confirme que l’envoi fonctionne : vos prospects reçoivent bien leurs résultats, confirmations et relances.", "", `Envoyé depuis ${from}.`].join("\n"),
  }).catch((error) => ({ sent: false as const, reason: String(error) }));
  return result.sent
    ? { ok: true, message: `E-mail envoyé à ${env.ADMIN_EMAIL}. Vérifiez votre boîte (et les indésirables).` }
    : { ok: false, message: `Échec de l’envoi : ${"reason" in result && result.reason ? result.reason : "raison inconnue"}.` };
}
