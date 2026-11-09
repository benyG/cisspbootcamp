"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { sendDiagnosis, setDiagnosisAside } from "@/lib/admin-ops/sensitive";

const reviewSchema = z.object({
  id: z.coerce.number().int().positive(),
  message: z.string().trim().min(20, "Le message est trop court pour être envoyé."),
});

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

/**
 * Ben's "Valider et envoyer": stores the message as he last edited it, opens
 * the result page, and sends the e-mail. The only path by which a diagnosis
 * reaches a prospect.
 */
export async function approveDiagnosis(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = reviewSchema.safeParse({ id: formData.get("id"), message: formData.get("message") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const result = await sendDiagnosis(parsed.data.id, parsed.data.message);
  revalidatePath("/admin/diagnostics");
  revalidatePath(`/admin/diagnostics/${parsed.data.id}`);
  return result.ok ? { ok: true } : result;
}

export async function setAsideDiagnosis(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Identifiant invalide" };
  const result = await setDiagnosisAside(id.data);
  revalidatePath("/admin/diagnostics");
  return result.ok ? { ok: true } : result;
}
