"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { nextFollowupAt } from "@/lib/followups";
import { sendOnboardingDocuments } from "@/lib/onboarding";
import { registerByAdmin } from "@/lib/registration";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}
const id = z.coerce.number().int().positive();

export async function updateLead(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({
    leadId: id,
    status: z.enum(["new", "contacted", "booked", "called", "registered", "nurture", "lost"]),
    notes: z.string().max(5000).optional().or(z.literal("")),
    tags: z.string().max(300).optional().or(z.literal("")),
    nextFollowupAt: z.string().optional().or(z.literal("")),
  }).safeParse({ leadId: formData.get("leadId"), status: formData.get("status"), notes: formData.get("notes"), tags: formData.get("tags"), nextFollowupAt: formData.get("nextFollowupAt") });
  if (!parsed.success) return;
  const { leadId, status, notes, tags, nextFollowupAt: due } = parsed.data;
  // "Inscrit" follows a paid seat; the dropdown alone never makes someone a participant.
  const keepStatus = status === "registered" && (await prisma.registration.count({ where: { leadId, status: "paid" } })) === 0;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(keepStatus ? {} : { status }),
      notes: notes || null,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      nextFollowupAt: due ? new Date(due) : null,
    },
  });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

const directSchema = z.object({
  leadId: id,
  cohortId: id,
  amountUsd: z.coerce.number().min(0).max(100_000),
  paymentMode: z.enum(["virement", "espèces", "mobile money hors application", "carte hors application", "offert", "autre"]),
  paymentDetail: z.string().trim().max(150).optional().default(""),
  notify: z.literal("on").optional(),
  onboard: z.literal("on").optional(),
});

/**
 * Direct registration (Ben, 26/09): someone paid outside the app, Ben puts
 * them in the cohort he picks and the seat is paid at once.
 */
export async function registerDirectly(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = directSchema.safeParse(Object.fromEntries(formData));
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  if (!parsed.success) redirect(`/admin/leads/${leadId.data}?inscription=${encodeURIComponent("Cohorte, montant et mode de paiement sont requis.")}`);
  const { cohortId, amountUsd, paymentMode, paymentDetail, notify, onboard } = parsed.data;
  const result = await registerByAdmin({
    leadId: leadId.data,
    cohortId,
    amountUsdCents: Math.round(amountUsd * 100),
    paymentNote: [paymentMode, paymentDetail].filter(Boolean).join(" · "),
    notify: notify === "on",
  });
  let message = result.ok ? `Inscription confirmée (${result.reference}).${result.emailSent ? " E-mail « place réservée » envoyé avec le reçu." : notify ? " L’e-mail « place réservée » n’est pas parti." : ""}` : result.error;
  // Same step, when ticked: the preparation e-mail with every active document of the programme.
  if (result.ok && onboard) {
    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { program: true } });
    const documents = cohort ? await prisma.document.findMany({ where: { program: cohort.program, active: true }, select: { id: true } }) : [];
    const sent = await sendOnboardingDocuments({ leadId: leadId.data, documentIds: documents.map((d) => d.id) });
    message += sent.ok ? " Documents de préparation envoyés." : ` Documents non envoyés : ${sent.error}`;
  }
  revalidatePath(`/admin/leads/${leadId.data}`);
  revalidatePath("/admin");
  revalidatePath("/admin/cohortes");
  redirect(`/admin/leads/${leadId.data}?inscription=${encodeURIComponent((result.ok ? "ok:" : "") + message)}`);
}

export async function markLost(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId.data }, data: { status: "lost", nextFollowupAt: null } }),
    prisma.actionLog.create({ data: { leadId: leadId.data, type: "marked_lost" } }),
  ]);
  revalidatePath(`/admin/leads/${leadId.data}`);
  revalidatePath("/admin");
}

export async function scheduleFollowup(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.lead.update({ where: { id: leadId.data }, data: { nextFollowupAt: nextFollowupAt("afterCall", 0, new Date()), followupCount: 0 } });
  revalidatePath(`/admin/leads/${leadId.data}`);
  revalidatePath("/admin");
}

/** Full deletion (SPECS A10): cascades through responses, bookings, registrations, log. */
export async function deleteLead(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.lead.delete({ where: { id: leadId.data } });
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  redirect("/admin/leads?supprime=1");
}

/** Ben picks the documents on a paid lead's sheet; one e-mail goes out with them attached. */
export async function sendOnboarding(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.parse(formData.get("leadId"));
  const documentIds = z.array(id).parse(formData.getAll("documentId"));
  const result = await sendOnboardingDocuments({ leadId, documentIds });
  revalidatePath(`/admin/leads/${leadId}`);
  redirect(`/admin/leads/${leadId}?onboarding=${result.ok ? "ok" : encodeURIComponent(result.error)}`);
}
