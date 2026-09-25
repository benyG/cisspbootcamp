import { formatAdmissionDeadline, formatCohortMonth, selectRegistrationCohort } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { loadOpenCohorts } from "@/lib/registration";

/**
 * The two automatic e-mails of the brainstorm of 24/09. Neither replaces
 * Ben's own message; they make sure the prospect never waits on it for a
 * link. Both respect unsubscription and go out once.
 */

const SIGNATURE = (unsubscribeToken: string) =>
  `Ben\nCoach CISSP\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${unsubscribeToken}`;

/** Right after the call: the payment link and the admission deadline, in three lines. */
export async function sendAfterCallEmail(leadId: number, outcome: "registered" | "to_follow_up"): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1, select: { resultToken: true } }, registrations: { where: { status: "paid" }, take: 1 } },
  });
  if (!lead || lead.unsubscribedAt || lead.registrations.length > 0) return false;
  const token = lead.scannerResponses[0]?.resultToken;
  if (!token) return false;

  const now = new Date();
  const cohort = selectRegistrationCohort(await loadOpenCohorts(now, lead.id), now);
  const base = env.NEXT_PUBLIC_APP_URL;
  const deadline = cohort ? ` Les admissions de la cohorte de ${formatCohortMonth(cohort.startsAt)} ferment le ${formatAdmissionDeadline(cohort.startsAt)}.` : "";

  const result = await sendEmail({
    to: lead.email,
    subject: outcome === "registered" ? `${lead.firstName}, votre place vous attend` : `${lead.firstName}, merci pour cet échange`,
    text:
      `Bonjour ${lead.firstName},\n\n` +
      (outcome === "registered"
        ? `Merci pour notre échange. Comme convenu, voici le lien pour réserver votre place : ${base}/inscription?t=${token}\n\n`
        : `Merci pour notre échange. Prenez le temps qu'il vous faut ; quand vous serez prêt, votre place se réserve ici : ${base}/inscription?t=${token}\n\n`) +
      `Carte bancaire ou mobile money, reçu immédiat.${deadline}\n\n` +
      `Une question d'ici là ? Répondez simplement à ce message.\n\n` +
      SIGNATURE(lead.unsubscribeToken),
  });
  await prisma.actionLog.create({ data: { leadId: lead.id, type: "after_call_email", channel: "email", payload: { outcome, sent: result.sent } } });
  return result.sent;
}

export const RESULT_REMINDER_AFTER_HOURS = 24;
export const RESULT_REMINDER_UNTIL_HOURS = 96;

/**
 * J+1 after the analysis, for a "ready" or "conditional" profile who has not
 * booked: one e-mail with the booking link. Runs from the cron; the window
 * is wide because the cron may run once a day, and the log guard makes it
 * send once whatever the cadence.
 */
export async function sendResultReminders(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - RESULT_REMINDER_UNTIL_HOURS * 3_600_000);
  const until = new Date(now.getTime() - RESULT_REMINDER_AFTER_HOURS * 3_600_000);
  const responses = await prisma.scannerResponse.findMany({
    where: {
      createdAt: { gte: since, lte: until },
      lead: {
        unsubscribedAt: null,
        status: { in: ["new", "contacted"] },
        bookings: { none: { status: { in: ["scheduled", "done"] } } },
        registrations: { none: {} },
        actions: { none: { type: "result_reminder" } },
      },
    },
    include: { lead: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let sent = 0;
  for (const response of responses) {
    const { lead } = response;
    const base = env.NEXT_PUBLIC_APP_URL;
    const result = await sendEmail({
      to: lead.email,
      subject: `${lead.firstName}, 15 minutes quand vous voulez`,
      text:
        `Bonjour ${lead.firstName},\n\n` +
        `Votre analyse est là : ${base}/scanner/resultat/${response.resultToken}\n\n` +
        `La suite logique, c'est un appel de 15 minutes avec moi pour caler votre date d'examen. Choisissez votre créneau : ${base}/rdv?t=${response.resultToken}\n\n` +
        `Sans engagement, et si le moment n'est pas le bon, dites-le-moi simplement.\n\n` +
        SIGNATURE(lead.unsubscribeToken),
    });
    await prisma.actionLog.create({ data: { leadId: lead.id, type: "result_reminder", channel: "email", payload: { sent: result.sent } } });
    if (result.sent) sent++;
  }
  return sent;
}
