import { revalidateTag } from "next/cache";

import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { formatCohortMonth, remainingSeats, selectRegistrationCohort } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { buildOffer, loadOpenCohorts } from "@/lib/registration";

/**
 * "Votre place est tenue 48 h" — docs/CONVERSION.md §2.4. After the discovery
 * call, Ben keeps a seat for the prospect: it is counted in the public gauge,
 * the prospect gets a dated deadline, a reminder before it lapses, and the
 * seat frees itself at expiry. Endowment, with a real clock.
 */
export const HOLD_HOURS = 48;
export const HOLD_REMINDER_HOURS_BEFORE = 12;

const HOUR_MS = 60 * 60_000;

export type HoldResult = { ok: true; holdId: number; expiresAt: Date } | { ok: false; error: string };

export async function activeHoldFor(leadId: number, now = new Date()) {
  return prisma.seatHold.findFirst({
    where: { leadId, releasedAt: null, expiresAt: { gt: now } },
    include: { cohort: { select: { id: true, name: true, startsAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function holdSeat(leadId: number, now = new Date()): Promise<HoldResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 }, registrations: { where: { status: "paid" }, take: 1 } },
  });
  if (!lead) return { ok: false, error: "Lead introuvable." };
  if (lead.unsubscribedAt) return { ok: false, error: "Ce prospect s'est désinscrit." };
  if (lead.registrations.length > 0) return { ok: false, error: "Déjà inscrit : rien à tenir." };
  if (await activeHoldFor(leadId, now)) return { ok: false, error: "Une place est déjà tenue pour ce prospect." };

  const cohort = selectRegistrationCohort(await loadOpenCohorts(now, leadId, "cissp"), now, "cissp");
  if (!cohort) return { ok: false, error: "Aucune cohorte ouverte aux admissions." };
  if (remainingSeats(cohort) <= 0) return { ok: false, error: "Plus aucune place libre sur cette cohorte." };

  const expiresAt = new Date(now.getTime() + HOLD_HOURS * HOUR_MS);
  const response = lead.scannerResponses[0] ?? null;

  const hold = await prisma.$transaction(async (tx) => {
    const created = await tx.seatHold.create({ data: { leadId, cohortId: cohort.id, expiresAt } });
    // Holding a seat means Ben has spoken to them: the registration link opens.
    if (response && response.status === "pending_review") {
      await tx.scannerResponse.update({ where: { id: response.id }, data: { status: "approved" } });
    }
    await tx.lead.update({ where: { id: leadId }, data: { nextFollowupAt: null } });
    await tx.actionLog.create({ data: { leadId, type: "seat_held", payload: { holdId: created.id, cohortId: cohort.id, expiresAt } } });
    return created;
  });
  revalidateTag(COHORTS_CACHE_TAG);

  const offer = await buildOffer(leadId, now);
  const price = offer.offer ? `${offer.offer.usdLabel}${offer.offer.localLabel ? ` (environ ${offer.offer.localLabel})` : ""}` : null;
  const link = response ? `${env.NEXT_PUBLIC_APP_URL}/inscription?t=${response.resultToken}` : `${env.NEXT_PUBLIC_APP_URL}/inscription`;

  await sendEmail({
    to: lead.email,
    subject: `${lead.firstName}, votre place est tenue jusqu'au ${formatDeadline(expiresAt)}`,
    text:
      `Bonjour ${lead.firstName},\n\n` +
      `Suite à notre échange, je vous garde une place dans la ${cohort.name} (démarrage en ${formatCohortMonth(cohort.startsAt)}).\n\n` +
      `Elle est tenue jusqu'au ${formatDeadline(expiresAt)}. Passé ce délai, elle est remise à disposition des autres candidats.\n\n` +
      (price ? `Tarif : ${price}, prix promotionnel de lancement.\n\n` : "") +
      `Pour confirmer votre place : ${link}\n\n` +
      `À très vite,\nBen\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${lead.unsubscribeToken}`,
  });

  return { ok: true, holdId: hold.id, expiresAt };
}

export async function releaseHold(holdId: number, reason: "manual" | "expired" | "paid", now = new Date()): Promise<void> {
  const hold = await prisma.seatHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.releasedAt) return;
  await prisma.$transaction([
    prisma.seatHold.update({ where: { id: holdId }, data: { releasedAt: now, releaseReason: reason } }),
    prisma.actionLog.create({ data: { leadId: hold.leadId, type: "seat_released", payload: { holdId, reason } } }),
  ]);
  revalidateTag(COHORTS_CACHE_TAG);
}

/**
 * Called by the reminders cron: sends the reminder before expiry, then frees
 * lapsed holds. Idempotent.
 */
export async function processSeatHolds(now = new Date()): Promise<{ reminded: number; expired: number }> {
  const reminderBefore = new Date(now.getTime() + HOLD_REMINDER_HOURS_BEFORE * HOUR_MS);
  const due = await prisma.seatHold.findMany({
    where: { releasedAt: null, reminderSentAt: null, expiresAt: { gt: now, lte: reminderBefore } },
    include: { lead: { include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 } } }, cohort: true },
  });
  let reminded = 0;
  for (const hold of due) {
    if (hold.lead.unsubscribedAt) continue;
    const response = hold.lead.scannerResponses[0];
    const link = response ? `${env.NEXT_PUBLIC_APP_URL}/inscription?t=${response.resultToken}` : `${env.NEXT_PUBLIC_APP_URL}/inscription`;
    const sent = await sendEmail({
      to: hold.lead.email,
      subject: `${hold.lead.firstName}, votre place est libérée ${formatDeadline(hold.expiresAt)}`,
      text:
        `Bonjour ${hold.lead.firstName},\n\n` +
        `Votre place dans la ${hold.cohort.name} est tenue jusqu'au ${formatDeadline(hold.expiresAt)}. Ensuite, elle repart à d'autres candidats.\n\n` +
        `Pour la confirmer maintenant : ${link}\n\n` +
        `Une question ? Répondez à cet e-mail.\n\nBen\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${hold.lead.unsubscribeToken}`,
    });
    if (sent.sent || sent.reason === "RESEND_API_KEY manquante") {
      await prisma.seatHold.update({ where: { id: hold.id }, data: { reminderSentAt: now } });
      reminded++;
    }
  }

  const lapsed = await prisma.seatHold.findMany({ where: { releasedAt: null, expiresAt: { lte: now } }, select: { id: true } });
  for (const hold of lapsed) await releaseHold(hold.id, "expired", now);

  return { reminded, expired: lapsed.length };
}

/** "jeudi 24 septembre à 18:30" in the coach's zone. */
export function formatDeadline(date: Date, timeZone = "Africa/Douala"): string {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} à ${time}`;
}
