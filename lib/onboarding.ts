import { get } from "@vercel/blob";

import { formatCohortMonth } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { signDocumentLink } from "@/lib/document-links";
import { documentList, planAttachments, safeFilename } from "@/lib/documents";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { loadTemplate, renderTemplate } from "@/lib/messaging/templates";

/**
 * The onboarding e-mail (Ben, 24/09): once a participant has paid, Ben picks
 * the preparation documents from the library and triggers one e-mail with
 * them. Files fit in attachments up to a budget; past it, each one goes as a
 * personal download link (Ben, 25/09: 30 MB per file). Nothing goes out on
 * its own; each send is logged on the lead.
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

  const files = await prisma.document.findMany({ where: { id: { in: plan.attached.map((d) => d.id) } }, select: { id: true, filename: true, content: true, blobPathname: true } });
  const attachments: Array<{ filename: string; content: Buffer }> = [];
  const links: Record<number, string> = {};
  for (const d of plan.attached) {
    const file = files.find((f) => f.id === d.id);
    const content = file ? await readDocument(file) : null;
    // A file that cannot be read now still reaches the participant, as a link.
    if (content) attachments.push({ filename: safeFilename(file?.filename ?? d.filename), content });
    else links[d.id] = downloadLink(d.id, lead.id);
  }
  for (const d of plan.linked) links[d.id] = downloadLink(d.id, lead.id);

  const template = await loadTemplate("onboarding_documents");
  const vars = {
    prenom: lead.firstName,
    nom: lead.lastName,
    cohorte: registration.cohort.name,
    mois_cohorte: formatCohortMonth(registration.cohort.startsAt),
    liste_documents: documentList(plan.documents, links),
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
      payload: { registrationId: registration.id, documents: plan.documents.map((d) => ({ id: d.id, name: d.name, as: links[d.id] ? "link" : "attachment" })), totalBytes: plan.totalBytes, reason: result.sent ? undefined : result.reason },
    },
  });
  if (!result.sent) return { ok: false, error: `E-mail non envoyé : ${result.reason}` };
  return { ok: true, documents: plan.documents.length };
}

function downloadLink(documentId: number, leadId: number): string {
  return `${env.NEXT_PUBLIC_APP_URL}/documents/${signDocumentLink(documentId, leadId, env.AUTH_SECRET)}`;
}

/** The bytes of a stored document: from private storage, or the legacy database column. */
async function readDocument(file: { content: Uint8Array | null; blobPathname: string | null }): Promise<Buffer | null> {
  if (file.content) return Buffer.from(file.content);
  if (!file.blobPathname) return null;
  try {
    const result = await get(file.blobPathname, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  } catch (error) {
    console.error("[onboarding] lecture du fichier", error);
    return null;
  }
}
