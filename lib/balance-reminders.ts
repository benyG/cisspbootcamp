import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { senderFor, signatureFor } from "@/lib/ia-brand";
import { BALANCE_REMINDER_DAYS, balanceReminderDue } from "@/lib/installments";
import { sendEmail } from "@/lib/messaging/email";
import { formatUsdCents } from "@/lib/pricing";
import { PROGRAMS } from "@/lib/programs";
import { balanceDeadline, balanceUrl } from "@/lib/registration";

/**
 * Second-instalment reminders (Ben, 04/11), from the 15-minute cron: one
 * e-mail a week before the first day, one two days before, with the payment
 * link. Never a clock time. Someone who unsubscribed gets none: Ben's
 * action queue tells him on the eve instead.
 */
export function balanceReminderEmail(input: { program?: string; firstName: string; programName: string; cohortName: string; balanceUsd: number; startsAt: Date; reference: string; unsubscribeToken: string; last: boolean }): { subject: string; text: string } {
  return {
    subject: input.last ? `Dernier rappel : votre second versement — ${input.programName}` : `Votre second versement — ${input.programName}`,
    text: [
      `Bonjour ${input.firstName},`,
      "",
      `${input.last ? "Petit rappel avant le démarrage" : "Le démarrage approche"} : le second versement de votre inscription à la ${input.programName} — ${input.cohortName}, ${formatUsdCents(input.balanceUsd)}, est à régler avant le premier jour, le ${balanceDeadline(input.startsAt)}.`,
      "",
      `Par carte ou mobile money, en deux minutes : ${balanceUrl(input.reference)}`,
      "",
      "Déjà réglé, ou un souci ? Répondez à ce message.",
      "",
      signatureFor(input.program ?? "", "Ben"),
      "",
      "—",
      `Pour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${input.unsubscribeToken}`,
    ].join("\n"),
  };
}

export async function sendBalanceReminders(now = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + (BALANCE_REMINDER_DAYS[0] + 1) * 86_400_000);
  const open = await prisma.registration.findMany({
    where: { status: "paid", balanceUsd: { gt: 0 }, balancePaidAt: null, balanceReminders: { lt: BALANCE_REMINDER_DAYS.length }, lead: { unsubscribedAt: null }, cohort: { startsAt: { gt: now, lte: horizon } } },
    include: { lead: { select: { firstName: true, email: true, unsubscribeToken: true } }, cohort: { select: { name: true, program: true, startsAt: true } } },
    take: 100,
  });
  let sent = 0;
  for (const r of open) {
    const next = balanceReminderDue({ ...r, startsAt: r.cohort.startsAt }, now);
    if (next === null) continue;
    // Claim the reminder first: two cron runs never send it twice.
    const claimed = await prisma.registration.updateMany({ where: { id: r.id, balanceReminders: r.balanceReminders, balancePaidAt: null }, data: { balanceReminders: next + 1 } });
    if (claimed.count === 0) continue;
    const email = balanceReminderEmail({ program: r.cohort.program, firstName: r.lead.firstName, programName: PROGRAMS[r.cohort.program].name, cohortName: r.cohort.name, balanceUsd: r.balanceUsd, startsAt: r.cohort.startsAt, reference: r.reference, unsubscribeToken: r.lead.unsubscribeToken, last: next === BALANCE_REMINDER_DAYS.length - 1 });
    const result = await sendEmail({ to: r.lead.email, ...email, fromName: senderFor(r.cohort.program) }).catch(() => ({ sent: false }));
    if (result.sent) sent++;
    await prisma.actionLog.create({ data: { leadId: r.leadId, type: "balance_reminder", channel: "email", payload: { reference: r.reference, reminder: next + 1, sent: result.sent } } });
  }
  return sent;
}
