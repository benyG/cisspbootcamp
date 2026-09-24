import { formatCohortMonth } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { documentList, planAttachments, safeFilename } from "@/lib/documents";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { loadTemplate, renderTemplate } from "@/lib/messaging/templates";

/**
 * The onboarding e-mail (Ben, 24/09): once a participant has paid, Ben picks
 * the preparation documents from the library and triggers one e-mail with
 * them attached. Nothing goes out on its own; each send is logged on the lead.
 */

export type OnboardingResult = { ok: true; documents: number } | { ok: false; error: string };

export async function sendOnboardingDocuments(input: { leadId: number; documentIds: number[] }): Promise<OnboardingResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { registrations: { where: { status: "paid" }, orderBy: { createdAt: "desc" }, take: 1, include: { cohort: true } } },
  });
  if (!lead) return { ok: false, error: "Lead introuvable." };
  const registration = lead.registrations[0];
  if (!registration) return { ok: false, error: "Ce lead n'a pas de place payée : les documents de préparation sont réservés aux inscrits." };

  const library = await prisma.document.findMany({
    where: { program: registration.cohort.program, active: true },
    select: { id: true, name: true, filename: true, size: true, active: true },
    orderBy: { createdAt: "asc" },
  });
  const plan = planAttachments(library, input.documentIds);
  if (!plan.ok) return plan;

  const files = await prisma.document.findMany({ where: { id: { in: plan.documents.map((d) => d.id) } }, select: { id: true, filename: true, content: true } });
  const attachments = plan.documents.map((d) => {
    const file = files.find((f) => f.id === d.id);
    return { filename: safeFilename(file?.filename ?? d.filename), content: Buffer.from(file?.content ?? new Uint8Array()) };
  });

  const template = await loadTemplate("onboarding_documents");
  const vars = {
    prenom: lead.firstName,
    nom: lead.lastName,
    cohorte: registration.cohort.name,
    mois_cohorte: formatCohortMonth(registration.cohort.startsAt),
    liste_documents: documentList(plan.documents),
  };
  const subject = renderTemplate(template?.subject ?? "Bienvenue dans la {{cohorte}} : vos documents de préparation", vars);
  const body =
    renderTemplate(template?.body ?? "Bonjour {{prenom}},\n\nVoici vos documents de préparation :\n{{liste_documents}}\n\nBen — Coach CISSP", vars) +
    `\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${lead.unsubscribeToken}`;

  const result = await sendEmail({ to: lead.email, subject, text: body, attachments });
  await prisma.actionLog.create({
    data: {
      leadId: lead.id,
      type: result.sent ? "onboarding_sent" : "onboarding_failed",
      channel: "email",
      payload: { registrationId: registration.id, documents: plan.documents.map((d) => ({ id: d.id, name: d.name })), totalBytes: plan.totalBytes, reason: result.sent ? undefined : result.reason },
    },
  });
  if (!result.sent) return { ok: false, error: `E-mail non envoyé : ${result.reason}` };
  return { ok: true, documents: plan.documents.length };
}
