import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { createSessionEvent, setEventAttendees } from "@/lib/calendar/google";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { IA_JOURNEES, IA_ZONE, type IaDay, JOURNEES, type Picks, checkPicks, journeeSlot, shortDate } from "@/lib/ia-days";
import { sendEmail } from "@/lib/messaging/email";
import { PROGRAMS } from "@/lib/programs";
import { iaUrl } from "@/lib/ia-domain";

/**
 * Bâtisseur IA participant calendars (lib/ia-days.ts): the page where a
 * paid participant picks J2 to J5, the Google invitations (one event per
 * date, every participant of that date invited) and the reminder the day
 * before. Seats are final once taken.
 */

export type PlanResult = { ok: true; message: string } | { ok: false; error: string };

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
export const iaPlanUrl = (token: string) => iaUrl(`/ia/calendrier/${token}`, appUrl());
const validToken = (token: string) => /^[A-Za-z0-9_-]{20,64}$/.test(token);

/** Open days from the participant's J1 on, with seats taken, and their own seats. */
export async function planByToken(token: string) {
  if (!validToken(token)) return null;
  const plan = await prisma.iaPlan.findUnique({ where: { token }, include: { lead: { select: { id: true, firstName: true } }, cohort: { select: { id: true, name: true } } } });
  if (!plan) return null;
  const seats = await prisma.iaSeat.findMany({ where: { leadId: plan.leadId, cohortId: plan.cohortId }, include: { day: { select: { date: true, start: true, meetUrl: true } } }, orderBy: { journee: "asc" } });
  const held: Picks = Object.fromEntries(seats.map((s) => [s.journee, s.day.date]));
  const from = held[1] ?? "";
  const rows = await prisma.iaDay.findMany({ where: { date: { gt: from } }, orderBy: { date: "asc" }, include: { _count: { select: { seats: true } } } });
  const days: IaDay[] = rows.map((d) => ({ id: d.id, date: d.date, journee: d.journee, capacity: d.capacity, seats: d._count.seats, closed: d.closed, start: d.start }));
  return { plan, seats, held, days };
}

/** Takes the seats picked on the calendar page, under a row lock so two people never get the last place. */
export async function pickJournees(token: string, wanted: Picks, now = new Date()): Promise<PlanResult> {
  if (!validToken(token)) return { ok: false, error: "Lien invalide." };
  const plan = await prisma.iaPlan.findUnique({ where: { token }, include: { lead: true } });
  if (!plan) return { ok: false, error: "Lien invalide." };
  const paid = await prisma.registration.count({ where: { leadId: plan.leadId, cohortId: plan.cohortId, status: "paid" } });
  if (!paid) return { ok: false, error: "Ce calendrier s’ouvre une fois l’inscription payée." };

  let added: Array<{ journee: number; day: IaDay }> = [];
  try {
    await prisma.$transaction(async (tx) => {
      const ids = (await tx.iaDay.findMany({ where: { date: { in: Object.values(wanted).filter((d): d is string => !!d) } }, select: { id: true } })).map((d) => d.id);
      if (ids.length) await tx.$queryRaw`SELECT id FROM ia_days WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const seats = await tx.iaSeat.findMany({ where: { leadId: plan.leadId, cohortId: plan.cohortId }, include: { day: { select: { date: true } } } });
      const held: Picks = Object.fromEntries(seats.map((s) => [s.journee, s.day.date]));
      const rows = await tx.iaDay.findMany({ where: { id: { in: ids } }, include: { _count: { select: { seats: true } } } });
      const days: IaDay[] = rows.map((d) => ({ id: d.id, date: d.date, journee: d.journee, capacity: d.capacity, seats: d._count.seats, closed: d.closed, start: d.start }));
      const checked = checkPicks(days, held, wanted, now);
      if (!checked.ok) throw new PickError(checked.error);
      for (const { journee, day } of checked.added) {
        await tx.iaSeat.create({ data: { leadId: plan.leadId, cohortId: plan.cohortId, journee, dayId: day.id } });
      }
      await tx.actionLog.create({ data: { leadId: plan.leadId, type: "ia_journees_picked", payload: { cohortId: plan.cohortId, picks: checked.added.map((a) => ({ journee: a.journee, date: a.day.date })) } } });
      added = checked.added;
    });
  } catch (error) {
    if (error instanceof PickError) return { ok: false, error: error.message };
    console.error("[ia] choix des journées", error);
    return { ok: false, error: "La réservation n’a pas pu être enregistrée. Réessayez dans un instant." };
  }

  for (const { day } of added) await syncDayInvites(day.id, now).catch((error) => console.error("[ia] invitation", day.date, error));
  const list = added.sort((a, b) => a.journee - b.journee).map((a) => `- J${a.journee}, ${shortDate(a.day.date)} : ${JOURNEES[a.journee - 1]!.title}`);
  await sendEmail({
    to: plan.lead.email,
    subject: `Vos journées sont réservées · ${PROGRAMS.ia.name}`,
    text: [
      `Bonjour ${plan.lead.firstName},`,
      "",
      "Vos journées sont réservées :",
      ...list,
      "",
      "L’invitation de chaque journée arrive dans votre agenda, avec le lien de la visio. La veille, je vous envoie un rappel.",
      "",
      `Votre calendrier : ${iaPlanUrl(token)}`,
      "",
      "Ben",
    ].join("\n"),
  }).catch(() => undefined);
  return { ok: true, message: added.length > 1 ? `${added.length} journées réservées.` : "Journée réservée." };
}

class PickError extends Error {}

/**
 * One Google event per date, every participant of that date invited, with
 * a Meet link. Created with the first seat, then its guest list follows.
 */
export async function syncDayInvites(dayId: number, now = new Date()): Promise<number> {
  const day = await prisma.iaDay.findUnique({ where: { id: dayId }, include: { seats: { include: { lead: { select: { email: true, firstName: true, lastName: true } } } } } });
  if (!day || !day.seats.length) return 0;
  const attendees = day.seats.map((s) => ({ email: s.lead.email, name: `${s.lead.firstName} ${s.lead.lastName}`.trim() }));
  if (day.eventId) {
    await setEventAttendees(day.eventId, attendees);
  } else {
    const { startsAt, endsAt } = journeeSlot(day.date, day.start);
    const j = JOURNEES[day.journee - 1]!;
    const event = await createSessionEvent({
      summary: `${PROGRAMS.ia.name} · J${day.journee} · ${j.title}`,
      description: `J${day.journee} sur ${IA_JOURNEES} : ${j.text}\n\n5 h de formation et 1 h de pause. Le programme : ${iaUrl("/ia", appUrl())}`,
      start: startsAt,
      end: endsAt,
      timeZone: IA_ZONE,
      attendees,
      requestId: randomUUID(),
    });
    await prisma.iaDay.update({ where: { id: day.id }, data: { eventId: event.eventId, meetUrl: event.meetUrl } });
  }
  const pending = day.seats.filter((s) => !s.invitedAt).map((s) => s.id);
  if (pending.length) await prisma.iaSeat.updateMany({ where: { id: { in: pending } }, data: { invitedAt: now } });
  return pending.length;
}

/** Cron: invitations that failed (agenda disconnected) are retried for every upcoming date. */
export async function syncIaInvites(now = new Date()): Promise<number> {
  const today = now.toISOString().slice(0, 10);
  const days = await prisma.iaDay.findMany({ where: { date: { gte: today }, seats: { some: { invitedAt: null } } }, select: { id: true, date: true } });
  let invited = 0;
  for (const day of days) {
    try {
      invited += await syncDayInvites(day.id, now);
    } catch (error) {
      console.error("[ia] invitations", day.date, error);
    }
  }
  return invited;
}

/** Reminder the day before each journée: no clock time (Ben), the Meet link. */
export async function sendIaReminders(now = new Date()): Promise<number> {
  const from = new Date(now.getTime() + 12 * 3_600_000), to = new Date(now.getTime() + 36 * 3_600_000);
  const dates = [from, to].map((d) => d.toISOString().slice(0, 10));
  const seats = await prisma.iaSeat.findMany({ where: { remindedAt: null, day: { date: { in: [...new Set(dates)] } } }, include: { day: true, lead: { select: { email: true, firstName: true } } } });
  let sent = 0;
  for (const seat of seats) {
    const { startsAt } = journeeSlot(seat.day.date, seat.day.start);
    if (startsAt < from || startsAt > to) continue;
    const j = JOURNEES[seat.journee - 1]!;
    const plan = await prisma.iaPlan.findUnique({ where: { leadId_cohortId: { leadId: seat.leadId, cohortId: seat.cohortId } }, select: { token: true } });
    const result = await sendEmail({
      to: seat.lead.email,
      subject: `Demain : J${seat.journee} du ${PROGRAMS.ia.name}`,
      text: [
        `Bonjour ${seat.lead.firstName},`,
        "",
        `Demain, ${shortDate(seat.day.date)}, c’est la J${seat.journee} : ${j.title}. ${j.text}`,
        "",
        seat.day.meetUrl ? `Le lien de la visio : ${seat.day.meetUrl} (il est aussi dans l’invitation de votre agenda, à l’heure de votre fuseau).` : "Le lien de la visio est dans l’invitation de votre agenda, à l’heure de votre fuseau.",
        seat.journee === 1
          ? `Avant de commencer, vérifiez que vos comptes Claude, GitHub et Vercel sont prêts : ${iaUrl("/ia/guide", appUrl())}`
          : "Ayez votre ordinateur chargé, votre compte Claude ouvert et votre application sous la main.",
        ...(plan ? ["", `Votre calendrier : ${iaPlanUrl(plan.token)}`] : []),
        "",
        "À demain,",
        "Ben",
      ].join("\n"),
    });
    if (result.sent) {
      await prisma.iaSeat.update({ where: { id: seat.id }, data: { remindedAt: now } });
      sent++;
    }
  }
  return sent;
}

/** After a paid entry: the J1 invitation, best effort (the cron retries). */
export async function inviteEntry(leadId: number, cohortId: number, now = new Date()): Promise<void> {
  const seat = await prisma.iaSeat.findUnique({ where: { leadId_cohortId_journee: { leadId, cohortId, journee: 1 } }, select: { dayId: true } });
  if (seat) await syncDayInvites(seat.dayId, now).catch((error) => console.error("[ia] invitation J1", error));
}

/** Saves the participant's project sheet; Ben is told the first time and when it changes. */
export async function saveBrief(token: string, raw: unknown, now = new Date()): Promise<PlanResult> {
  if (!validToken(token)) return { ok: false, error: "Lien invalide." };
  const { briefSchema } = await import("@/lib/ia-brief-schema");
  const { briefLines } = await import("@/lib/ia-brief");
  const parsed = briefSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Fiche incomplète." };
  const plan = await prisma.iaPlan.findUnique({ where: { token }, include: { lead: { select: { id: true, firstName: true, lastName: true, email: true } }, cohort: { select: { name: true } } } });
  if (!plan) return { ok: false, error: "Lien invalide." };
  const first = !plan.briefAt;
  await prisma.iaPlan.update({ where: { id: plan.id }, data: { brief: JSON.parse(JSON.stringify(parsed.data)), briefAt: now } });
  await prisma.actionLog.create({ data: { leadId: plan.leadId, type: "ia_brief_saved", payload: { cohortId: plan.cohortId, first } } }).catch(() => undefined);
  await sendEmail({
    to: env.ADMIN_EMAIL,
    subject: `Fiche projet ${first ? "reçue" : "mise à jour"} : ${`${plan.lead.firstName} ${plan.lead.lastName}`.trim()} · ${PROGRAMS.ia.name}`,
    text: [`${plan.lead.firstName} ${plan.lead.lastName}`.trim() + ` · ${plan.lead.email} · ${PROGRAMS.ia.name} — ${plan.cohort.name}`, "", ...briefLines(parsed.data), "", `Fiche : ${appUrl()}/admin/leads/${plan.leadId}`].join("\n"),
  }).catch(() => undefined);
  return { ok: true, message: first ? "Fiche envoyée à Ben. Vous pouvez la modifier jusqu’à la J1." : "Fiche mise à jour." };
}
