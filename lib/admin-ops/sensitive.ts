import { revalidateTag } from "next/cache";

import { cohortDeletionProblem } from "@/lib/cohorts";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { markServiceOrderPaid } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { examBootEnabled } from "@/lib/examboot/client";
import { firstDueUsd } from "@/lib/installments";
import { publishOnLinkedin } from "@/lib/linkedin";
import { sendEmail } from "@/lib/messaging/email";
import { readBytes } from "@/lib/minimax";
import { sendOnboardingDocuments } from "@/lib/onboarding";
import { recommendedProgram } from "@/lib/programs";
import { markBalancePaid, markRegistrationPaid, registerByAdmin } from "@/lib/registration";

import type { OpResult } from "./leads";

/**
 * Actions that move money, write to a prospect, publish or delete: the
 * admin's buttons call them, and so do the MCP plug's requests once Ben has
 * clicked "Valider" (lot 3, docs/MCP.md). The callers check the session.
 */

/** Netticket fallback mode (SPECS A4): Ben saw the money, confirms by hand. */
export async function confirmRegistrationPayment(registrationId: number, transactionId?: string | null, now = new Date()): Promise<OpResult> {
  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) return { ok: false, error: `Aucune inscription n°${registrationId}.` };
  if (registration.status === "paid") return { ok: false, error: "Cette inscription est déjà payée." };
  await markRegistrationPaid({ reference: registration.reference, amountPaidUsdCents: firstDueUsd(registration), paidAt: now, netticketTransactionId: transactionId || `manuel-${now.getTime()}` });
  await prisma.actionLog.create({ data: { leadId: registration.leadId, type: "payment_confirmed_manually", payload: { registrationId: registration.id } } });
  return { ok: true, message: `Paiement confirmé (${registration.reference}).` };
}

/** A second instalment that reached Ben outside the app. */
export async function confirmBalance(registrationId: number, note?: string | null, now = new Date()): Promise<OpResult> {
  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) return { ok: false, error: `Aucune inscription n°${registrationId}.` };
  if (registration.balanceUsd <= 0 || registration.balancePaidAt) return { ok: false, error: "Pas de solde dû sur cette inscription." };
  const result = await markBalancePaid({ reference: registration.reference, amountPaidUsdCents: registration.balanceUsd, paidAt: now, method: "manual", note: note || "confirmé par Ben" });
  if (!result.ok) return { ok: false, error: "Solde non enregistré." };
  if (!result.alreadyPaid) await prisma.actionLog.create({ data: { leadId: registration.leadId, type: "balance_confirmed_manually", payload: { registrationId: registration.id } } });
  return { ok: true, message: `Solde confirmé (${registration.reference}).` };
}

/** A consulting order paid outside the app. */
export async function confirmServiceOrder(orderId: number, transactionId?: string | null, now = new Date()): Promise<OpResult> {
  const order = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: `Aucune commande de conseil n°${orderId}.` };
  if (order.status === "paid") return { ok: false, error: "Cette commande est déjà payée." };
  await markServiceOrderPaid({ reference: order.reference, amountPaidUsdCents: order.amountUsd, paidAt: now, netticketTransactionId: transactionId || `manuel-${now.getTime()}` });
  await prisma.actionLog.create({ data: { leadId: order.leadId, type: "payment_confirmed_manually", payload: { orderId: order.id } } });
  return { ok: true, message: `Paiement de la séance confirmé (${order.reference}).` };
}

export const PAYMENT_MODES = ["virement", "espèces", "mobile money hors application", "carte hors application", "offert", "autre"] as const;

/** Direct registration (Ben, 26/09): paid outside the app, seat paid at once; optionally the e-mails. */
export async function registerDirect(input: { leadId: number; cohortId: number; amountUsdCents: number; paymentMode: (typeof PAYMENT_MODES)[number]; paymentDetail?: string; notify: boolean; onboard: boolean }): Promise<OpResult> {
  const result = await registerByAdmin({ leadId: input.leadId, cohortId: input.cohortId, amountUsdCents: input.amountUsdCents, paymentNote: [input.paymentMode, input.paymentDetail].filter(Boolean).join(" · "), notify: input.notify });
  if (!result.ok) return { ok: false, error: result.error };
  let message = `Inscription confirmée (${result.reference}).${result.emailSent ? " E-mail « place réservée » envoyé avec le reçu." : input.notify ? " L’e-mail « place réservée » n’est pas parti." : ""}`;
  if (input.onboard) {
    const cohort = await prisma.cohort.findUnique({ where: { id: input.cohortId }, select: { program: true } });
    const documents = cohort ? await prisma.document.findMany({ where: { program: cohort.program, active: true }, select: { id: true } }) : [];
    const sent = await sendOnboardingDocuments({ leadId: input.leadId, documentIds: documents.map((d) => d.id) });
    message += sent.ok ? " Documents de préparation envoyés." : ` Documents non envoyés : ${sent.error}`;
  }
  return { ok: true, message };
}

/**
 * "Valider et envoyer" a diagnosis: stores the message, opens the result
 * page, sends the e-mail. The only path by which a diagnosis reaches a
 * prospect. Without a message, the one already written is sent.
 */
export async function sendDiagnosis(id: number, message?: string | null, now = new Date()): Promise<OpResult> {
  const response = await prisma.scannerResponse.findUnique({ where: { id }, include: { lead: true } });
  if (!response) return { ok: false, error: "Diagnostic introuvable" };
  if (response.lead.unsubscribedAt) return { ok: false, error: "Ce prospect s'est désinscrit : envoi impossible." };
  const text = (message ?? response.coachMessage).trim();
  if (text.length < 20) return { ok: false, error: "Le message est trop court pour être envoyé." };
  const app = env.NEXT_PUBLIC_APP_URL;
  const resultUrl = `${app}/scanner/resultat/${response.resultToken}`;
  const unsubscribeUrl = `${app}/desinscription/${response.lead.unsubscribeToken}`;

  await prisma.scannerResponse.update({ where: { id }, data: { coachMessage: text, status: "approved", reviewedAt: now } });
  const email = await sendEmail({
    to: response.lead.email,
    subject: `${response.lead.firstName}, la suite après votre analyse CISSP`,
    text:
      `${text}\n\n` +
      (response.readiness === "not_yet"
        ? (recommendedProgram("not_yet", response.answers as { experience: "none" | "one_two" | "three_four" | "five_plus"; professionalStatus: "employed" | "student" | "career_change" | "freelance" }) === "cc"
            ? `La formation CC en 15 jours : ${app}/demarrer?t=${response.resultToken}\n`
            : "") +
          `Réserver une séance de conseil carrière : ${app}/conseil?t=${response.resultToken}\n`
        : `Réserver 15 minutes : ${app}/rdv?t=${response.resultToken}\n`) +
      (examBootEnabled() ? `Tester votre raisonnement sur 5 questions d'entraînement CISSP : ${app}/test-cissp?t=${response.resultToken}&from=relance\n` : "") +
      `Revoir votre analyse : ${resultUrl}\n\n` +
      `—\nPour ne plus recevoir de messages : ${unsubscribeUrl}`,
  });
  await prisma.$transaction([
    prisma.scannerResponse.update({ where: { id }, data: email.sent ? { status: "sent", sentAt: now } : {} }),
    prisma.lead.update({ where: { id: response.leadId }, data: { status: "contacted" } }),
    prisma.actionLog.create({ data: { leadId: response.leadId, type: email.sent ? "diagnosis_sent" : "diagnosis_approved_email_failed", channel: "email", payload: email.sent ? { emailId: email.id } : { reason: email.reason } } }),
  ]);
  if (!email.sent) return { ok: false, error: `Validé, mais l'e-mail n'est pas parti (${email.reason}). La page de résultat est en ligne.` };
  return { ok: true, message: `Analyse envoyée à ${response.lead.firstName}.` };
}

export async function setDiagnosisAside(id: number, now = new Date()): Promise<OpResult> {
  const row = await prisma.scannerResponse.findUnique({ where: { id }, select: { id: true } });
  if (!row) return { ok: false, error: "Diagnostic introuvable" };
  await prisma.scannerResponse.update({ where: { id }, data: { status: "set_aside", reviewedAt: now } });
  return { ok: true, message: "Analyse mise de côté." };
}

/** One follow-up e-mail Ben has read, with the unsubscribe link. Consenting prospects only. */
export async function sendLeadEmail(leadId: number, subject: string, text: string): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.consentAt || lead.unsubscribedAt) return { ok: false, error: "Cette personne n'a pas accepté d'être recontactée." };
  const result = await sendEmail({ to: lead.email, subject, text: `${text}\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${lead.unsubscribeToken}` });
  if (!result.sent) return { ok: false, error: `E-mail non envoyé : ${result.reason}` };
  await prisma.actionLog.create({ data: { leadId: lead.id, type: "marketing_followup_sent", channel: "email", payload: { subject } } });
  return { ok: true, message: `E-mail envoyé à ${lead.firstName}.` };
}

/** Re-sends the booking link to a client who paid a session but has not booked. */
export async function remindSessionBookingCore(orderId: number): Promise<OpResult> {
  const order = await prisma.serviceOrder.findUnique({ where: { id: orderId }, include: { lead: true, service: true } });
  if (!order) return { ok: false, error: `Aucune commande de conseil n°${orderId}.` };
  if (order.status !== "paid") return { ok: false, error: "Commande non payée." };
  if (order.lead.unsubscribedAt) return { ok: false, error: "Ce client s'est désinscrit." };
  const base = env.NEXT_PUBLIC_APP_URL;
  const result = await sendEmail({
    to: order.lead.email,
    subject: `Votre séance « ${order.service.name} » vous attend`,
    text:
      `Bonjour ${order.lead.firstName},\n\n` +
      `Votre séance est réglée mais aucun créneau n'est encore choisi. Il suffit d'un clic : ${base}/conseil/rdv/${order.bookingToken}\n\n` +
      `Les créneaux ouverts sont le mercredi soir ; si aucun ne vous convient, répondez à ce message et on trouve une autre heure.\n\n` +
      `Ben\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${base}/desinscription/${order.lead.unsubscribeToken}`,
  });
  await prisma.actionLog.create({ data: { leadId: order.leadId, type: "session_booking_reminded", channel: "email", payload: { orderId: order.id, sent: result.sent } } });
  return result.sent ? { ok: true, message: `Rappel envoyé à ${order.lead.firstName}.` } : { ok: false, error: `E-mail non envoyé : ${result.reason}` };
}

/** Publishes a kept post on Ben's LinkedIn now, with an uploaded or a generated image, or none. */
export async function publishPostNow(postId: number, image: { upload: { bytes: Uint8Array; type: string } } | { imageId: number } | null): Promise<{ ok: true; url: string; message: string } | { ok: false; error: string }> {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, error: "Post introuvable." };
  if (post.linkedinUrn) return { ok: false, error: "Ce post est déjà publié sur LinkedIn." };
  if (post.channel !== "linkedin") return { ok: false, error: "Ce post n'est pas un post LinkedIn." };
  const brief = (() => { try { return (JSON.parse(post.visualBrief) as { onScreenText?: string }).onScreenText ?? ""; } catch { return ""; } })();
  let picture: { bytes: Uint8Array; type: string; alt: string } | null = null;
  if (image && "upload" in image) picture = { ...image.upload, alt: brief || "Visuel CISSP Bootcamp" };
  else if (image) {
    const row = await prisma.marketingImage.findFirst({ where: { id: image.imageId, postId: post.id } });
    const bytes = row ? await readBytes(row.imagePathname) : null;
    if (!row || !bytes) return { ok: false, error: "Image générée introuvable." };
    picture = { bytes, type: "image/png", alt: row.headline || brief || "Visuel CISSP Bootcamp" };
  }
  try {
    const published = await publishOnLinkedin({ text: post.text, image: picture });
    await prisma.marketingPost.update({ where: { id: post.id }, data: { linkedinUrn: published.urn || null, publishedAt: new Date(), autoDraft: false, scheduledFor: null } });
    return { ok: true, url: published.url, message: `Publié sur LinkedIn : ${published.url}` };
  } catch (error) {
    console.error("[linkedin] publication", error);
    return { ok: false, error: error instanceof Error ? error.message : "Publication refusée par LinkedIn." };
  }
}

/** Preparation documents to every paid participant who has not had them yet (or to one). */
export async function sendCohortDocuments(cohortId: number, onlyLeadId?: number): Promise<OpResult> {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: { registrations: { where: { status: "paid", ...(onlyLeadId ? { leadId: onlyLeadId } : {}) }, select: { id: true, leadId: true } } },
  });
  if (!cohort) return { ok: false, error: `Aucune cohorte n°${cohortId}.` };
  const leadIds = cohort.registrations.map((r) => r.leadId);
  const logs = onlyLeadId || !leadIds.length ? [] : await prisma.actionLog.findMany({ where: { leadId: { in: leadIds }, type: "onboarding_sent" }, select: { payload: true } });
  const sentTo = new Set(logs.map((l) => (l.payload as { registrationId?: number } | null)?.registrationId).filter((x): x is number => typeof x === "number"));
  const targets = cohort.registrations.filter((r) => !sentTo.has(r.id));
  const documents = await prisma.document.findMany({ where: { program: cohort.program, active: true }, select: { id: true } });
  let sent = 0;
  const failures: string[] = [];
  for (const r of targets) {
    const result = await sendOnboardingDocuments({ leadId: r.leadId, documentIds: documents.map((d) => d.id) });
    if (result.ok) sent++;
    else failures.push(result.error);
  }
  if (targets.length === 0) return { ok: true, message: "Tous les inscrits ont déjà reçu les documents." };
  if (sent === 0) return { ok: false, error: `Aucun envoi : ${failures[0] ?? "erreur inconnue"}` };
  return { ok: true, message: `Documents envoyés à ${sent} inscrit${sent > 1 ? "s" : ""}.${failures.length ? ` Échec pour ${failures.length} : ${failures[0]}` : ""}` };
}

/** The price of a tier (CISSP) or of a programme for a tier, in USD cents; nothing else changes. */
export async function setPrice(input: { tier: string; program: "cissp" | "cc" | "ia"; amountUsdCents: number }): Promise<OpResult> {
  if (!Number.isInteger(input.amountUsdCents) || input.amountUsdCents < 0 || input.amountUsdCents > 10_000_000) return { ok: false, error: "Montant invalide." };
  const tier = await prisma.pricingTier.findUnique({ where: { code: input.tier }, select: { code: true } });
  if (!tier) return { ok: false, error: `Palier inconnu : ${input.tier}.` };
  if (input.program === "cissp") await prisma.pricingTier.update({ where: { code: input.tier }, data: { amountUsd: input.amountUsdCents } });
  else await prisma.programPrice.upsert({ where: { program_tier: { program: input.program, tier: input.tier } }, create: { program: input.program, tier: input.tier, amountUsd: input.amountUsdCents }, update: { amountUsd: input.amountUsdCents } });
  revalidateTag(COHORTS_CACHE_TAG);
  return { ok: true, message: `Prix mis à jour : ${input.program.toUpperCase()}, palier ${input.tier}, ${input.amountUsdCents / 100} USD.` };
}

/** Full deletion (SPECS A10): cascades through responses, bookings, registrations, log. */
export async function deleteLeadCore(leadId: number): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { ok: false, error: `Aucun prospect n°${leadId}.` };
  await prisma.lead.delete({ where: { id: leadId } });
  return { ok: true, message: "Prospect et toutes ses données supprimés." };
}

/**
 * Deletes a cohort created by mistake (Ben, 26/09). Its registrations and
 * live seat holds move to the target cohort first, each move logged on the
 * lead. Nothing is sent: Ben warns the people himself.
 */
export async function deleteCohortCore(input: { cohortId: number; targetId: number | null; acknowledged: boolean }, now = new Date()): Promise<OpResult & { sourceName?: string; targetName?: string; people?: number }> {
  const source = await prisma.cohort.findUnique({
    where: { id: input.cohortId },
    include: {
      registrations: { select: { id: true, leadId: true, status: true, reference: true } },
      seatHolds: { where: { releasedAt: null, expiresAt: { gt: now } }, select: { id: true, leadId: true } },
    },
  });
  if (!source) return { ok: false, error: `Aucune cohorte n°${input.cohortId}.` };
  const target = input.targetId ? await prisma.cohort.findUnique({ where: { id: input.targetId } }) : null;
  const leadIds = [...new Set([...source.registrations.map((r) => r.leadId), ...source.seatHolds.map((h) => h.leadId)])];
  const people = leadIds.length;
  const problem = cohortDeletionProblem({ sourceId: source.id, sourceProgram: source.program, people, target: target ? { id: target.id, program: target.program, status: target.status } : null, acknowledged: input.acknowledged });
  if (problem) return { ok: false, error: problem };

  await prisma.$transaction(async (tx) => {
    if (target && people > 0) {
      await tx.registration.updateMany({ where: { cohortId: source.id }, data: { cohortId: target.id } });
      await tx.seatHold.updateMany({ where: { id: { in: source.seatHolds.map((h) => h.id) } }, data: { cohortId: target.id } });
      await tx.actionLog.createMany({ data: leadIds.map((leadId) => ({ leadId, type: "moved_to_cohort", payload: { from: source.name, to: target.name, targetCohortId: target.id } })) });
      const paid = await tx.registration.count({ where: { cohortId: target.id, status: "paid" } });
      if (paid >= target.capacity && target.status === "open") await tx.cohort.update({ where: { id: target.id }, data: { status: "full" } });
    }
    await tx.cohort.delete({ where: { id: source.id } });
  });
  revalidateTag(COHORTS_CACHE_TAG);
  return { ok: true, sourceName: source.name, targetName: target?.name, people, message: `Cohorte « ${source.name} » supprimée.${target && people ? ` ${people} personne${people > 1 ? "s" : ""} déplacée${people > 1 ? "s" : ""} vers « ${target.name} » (prévenez-les vous-même).` : ""}` };
}
