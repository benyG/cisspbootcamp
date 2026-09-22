"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";

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

  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { id, message } = parsed.data;
  const response = await prisma.scannerResponse.findUnique({
    where: { id },
    include: { lead: true },
  });
  if (!response) return { ok: false, error: "Diagnostic introuvable" };
  if (response.lead.unsubscribedAt) {
    return { ok: false, error: "Ce prospect s'est désinscrit : envoi impossible." };
  }

  const now = new Date();
  const resultUrl = `${env.NEXT_PUBLIC_APP_URL}/scanner/resultat/${response.resultToken}`;
  const unsubscribeUrl = `${env.NEXT_PUBLIC_APP_URL}/desinscription/${response.lead.unsubscribeToken}`;

  await prisma.scannerResponse.update({
    where: { id },
    data: { coachMessage: message, status: "approved", reviewedAt: now },
  });

  const email = await sendEmail({
    to: response.lead.email,
    subject: `${response.lead.firstName}, la suite après votre analyse CISSP`,
    text:
      `${message}\n\n` +
      `Réserver 15 minutes : ${env.NEXT_PUBLIC_APP_URL}/rdv?t=${response.resultToken}\n` +
      `Revoir votre analyse : ${resultUrl}\n\n` +
      `—\nPour ne plus recevoir de messages : ${unsubscribeUrl}`,
  });

  await prisma.$transaction([
    prisma.scannerResponse.update({
      where: { id },
      data: email.sent ? { status: "sent", sentAt: now } : {},
    }),
    prisma.lead.update({
      where: { id: response.leadId },
      data: { status: response.readiness === "not_yet" ? "nurture" : "contacted" },
    }),
    prisma.actionLog.create({
      data: {
        leadId: response.leadId,
        type: email.sent ? "diagnosis_sent" : "diagnosis_approved_email_failed",
        channel: "email",
        payload: email.sent ? { emailId: email.id } : { reason: email.reason },
      },
    }),
  ]);

  revalidatePath("/admin/diagnostics");
  revalidatePath(`/admin/diagnostics/${id}`);

  if (!email.sent) {
    return {
      ok: false,
      error: `Validé, mais l'e-mail n'est pas parti (${email.reason}). La page de résultat est en ligne.`,
    };
  }
  return { ok: true };
}

export async function setAsideDiagnosis(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Identifiant invalide" };

  await prisma.scannerResponse.update({
    where: { id: id.data },
    data: { status: "set_aside", reviewedAt: new Date() },
  });

  revalidatePath("/admin/diagnostics");
  return { ok: true };
}
