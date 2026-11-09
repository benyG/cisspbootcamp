"use server";

import { auth } from "@/auth";
import { env } from "@/lib/env";
import { type CheckResult, runAllChecks } from "@/lib/health/checks";
import { sendEmail } from "@/lib/messaging/email";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

/** Runs every integration check (read-only). */
export async function runHealthChecks(): Promise<{ at: string; results: CheckResult[] }> {
  await requireAdmin();
  return { at: new Date().toISOString(), results: await runAllChecks() };
}

/** Sends one test e-mail to the admin address: the only check that writes something, on an explicit click. */
export async function sendTestEmail(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const result = await sendEmail({
    to: env.ADMIN_EMAIL,
    subject: "E-mail de test · santé des intégrations",
    text: ["Bonjour Ben,", "", "Cet e-mail de test confirme que l’envoi fonctionne : vos prospects reçoivent bien leurs résultats, confirmations et relances.", "", "Envoyé depuis Admin › Santé des intégrations."].join("\n"),
  }).catch((error) => ({ sent: false as const, reason: String(error) }));
  return result.sent
    ? { ok: true, message: `E-mail envoyé à ${env.ADMIN_EMAIL}. Vérifiez votre boîte (et les indésirables).` }
    : { ok: false, message: `Échec de l’envoi : ${"reason" in result && result.reason ? result.reason : "raison inconnue"}.` };
}
