"use server";

import { auth } from "@/auth";
import { type CheckResult, runAllChecks } from "@/lib/health/checks";
import { sendAdminTestEmail } from "@/lib/health/test-email";

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
  return sendAdminTestEmail("Admin › Santé des intégrations");
}
