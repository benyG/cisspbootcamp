import { randomUUID } from "node:crypto";

import { cancelCallEvent, createSessionEvent, moveCallEvent, setEventAttendees } from "@/lib/calendar/google";
import { calendarMessage, reissuedMessage, reminderMessage, SESSION_REMINDER_MINUTES, SESSION_TIMEZONE, sessionDefaults, sessionDescription, sessionMessage, sessionSlot, sessionSubject, sessionSummary } from "@/lib/cohort-sessions";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { type Session, buildSessions } from "@/lib/reading-plan/data";
import { planStart, readingPlanUrl } from "@/lib/reading-plan/page";

/**
 * Sending the live sessions of a cohort (Ben, 02/10): a Google Calendar event
 * with a Meet link for every paid participant, plus a personal e-mail with
 * the day's content; moving, re-sending, and the reminder an hour before.
 */

export type SessionResult = { ok: true; message: string } | { ok: false; error: string };

export async function cohortPlan(cohortId: number) {
  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, include: { sessions: true } });
  if (!cohort) return null;
  return { cohort, days: buildSessions(planStart(cohort.startsAt)), planUrl: readingPlanUrl(env.NEXT_PUBLIC_APP_URL, cohort.startsAt, cohort.id) };
}

/** Paid participants, one per person. */
export async function sessionParticipants(cohortId: number) {
  const registrations = await prisma.registration.findMany({
    where: { cohortId, status: "paid" },
    include: { lead: { select: { id: true, firstName: true, lastName: true, email: true, country: true, unsubscribedAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<number>();
  return registrations.map((r) => r.lead).filter((l) => !seen.has(l.id) && seen.add(l.id));
}

/** timezone: the zone Ben typed the hours in (Dakar by default). */
type SendInput = { cohortId: number; day: number; start: string; pause: number; timezone?: string; guestEmail: string | null; reminder: boolean; excludeLeadIds: number[] };

async function createAndInvite(plan: NonNullable<Awaited<ReturnType<typeof cohortPlan>>>, session: Session, input: SendInput, participants: Awaited<ReturnType<typeof sessionParticipants>>, personalEmail: boolean, reissue = false) {
  const subjectOf = (startsAt: Date) => (reissue ? `Nouvelle invitation · ${sessionSubject(session, startsAt)}` : sessionSubject(session, startsAt));
  const textOf = (text: string) => (reissue ? reissuedMessage(text, session) : text);
  const timezone = input.timezone ?? SESSION_TIMEZONE;
  const { startsAt, endsAt } = sessionSlot(session, input.start, input.pause, timezone);
  const attendees = [...participants.map((p) => ({ email: p.email, name: `${p.firstName} ${p.lastName}`.trim() })), ...(input.guestEmail ? [{ email: input.guestEmail }] : [])];
  const event = await createSessionEvent({
    summary: sessionSummary(session),
    description: sessionDescription({ session, startsAt, endsAt, meetUrl: null, planUrl: plan.planUrl }),
    start: startsAt,
    end: endsAt,
    timeZone: timezone,
    attendees,
    requestId: randomUUID(),
  });
  const record = await prisma.cohortSession.upsert({
    where: { cohortId_day: { cohortId: plan.cohort.id, day: session.n } },
    create: { cohortId: plan.cohort.id, day: session.n, startsAt, endsAt, timezone, pauseMinutes: input.pause, googleEventId: event.eventId, meetUrl: event.meetUrl, guestEmail: input.guestEmail, reminder: input.reminder, invitedCount: attendees.length, sentAt: new Date() },
    update: { startsAt, endsAt, timezone, pauseMinutes: input.pause, googleEventId: event.eventId, meetUrl: event.meetUrl, guestEmail: input.guestEmail, reminder: input.reminder, invitedCount: attendees.length, sentAt: new Date(), remindedAt: null },
  });
  let emailed = 0;
  if (personalEmail) {
    for (const p of participants) {
      const result = await sendEmail({
        to: p.email,
        subject: subjectOf(startsAt),
        text: textOf(sessionMessage({ firstName: p.firstName, session, startsAt, endsAt, meetUrl: event.meetUrl, planUrl: plan.planUrl })),
      });
      if (result.sent) emailed++;
    }
    if (input.guestEmail) {
      await sendEmail({ to: input.guestEmail, subject: subjectOf(startsAt), text: textOf(sessionMessage({ firstName: "", session, startsAt, endsAt, meetUrl: event.meetUrl, planUrl: plan.planUrl }).replace("Bonjour ,", "Bonjour,")) });
    }
  }
  if (participants.length) {
    await prisma.actionLog.createMany({ data: participants.map((p) => ({ leadId: p.id, type: "cohort_session_invited", channel: "email", payload: { cohortId: plan.cohort.id, day: session.n, meetUrl: event.meetUrl } })) });
  }
  return { record, startsAt, endsAt, meetUrl: event.meetUrl, emailed };
}

/** Sends one day's invitation. */
export async function sendCohortSession(input: SendInput): Promise<SessionResult> {
  const plan = await cohortPlan(input.cohortId);
  if (!plan) return { ok: false, error: "Cohorte introuvable." };
  const session = plan.days.find((d) => d.n === input.day);
  if (!session || session.rest) return { ok: false, error: "Ce jour n'a pas de session." };
  if (plan.cohort.sessions.some((s) => s.day === input.day && s.sentAt)) return { ok: false, error: `L'invitation J${input.day} est déjà partie : déplacez-la ou renvoyez-la.` };
  const participants = (await sessionParticipants(input.cohortId)).filter((p) => !input.excludeLeadIds.includes(p.id));
  if (participants.length === 0 && !input.guestEmail) return { ok: false, error: "Personne à inviter : aucun participant payé coché." };
  try {
    const sent = await createAndInvite(plan, session, input, participants, true);
    return { ok: true, message: `Invitation J${session.n} envoyée à ${participants.length + (input.guestEmail ? 1 : 0)} personne(s)${sent.meetUrl ? ` · ${sent.meetUrl}` : ""}.` };
  } catch (error) {
    console.error("[sessions] envoi", error);
    return { ok: false, error: `Google Agenda a refusé la création : ${error instanceof Error ? error.message : "erreur inconnue"}. Vérifiez la connexion Google dans Paramètres.` };
  }
}

/**
 * Every remaining day at once, with the default hours. Google sends each
 * invitation; participants get one e-mail with the whole calendar instead
 * of one per day.
 */
export async function sendRemainingSessions(cohortId: number, now = new Date()): Promise<SessionResult> {
  const plan = await cohortPlan(cohortId);
  if (!plan) return { ok: false, error: "Cohorte introuvable." };
  const participants = await sessionParticipants(cohortId);
  if (participants.length === 0) return { ok: false, error: "Aucun participant payé dans cette cohorte." };
  const todo = plan.days.filter((d) => !d.rest && !plan.cohort.sessions.some((s) => s.day === d.n && s.sentAt) && sessionSlot(d, sessionDefaults(d.date).start, 0).startsAt > now);
  if (todo.length === 0) return { ok: false, error: "Toutes les sessions à venir sont déjà envoyées." };
  const items: Array<{ session: Session; startsAt: Date; endsAt: Date; meetUrl: string | null }> = [];
  try {
    for (const session of todo) {
      const d = sessionDefaults(session.date);
      const sent = await createAndInvite(plan, session, { cohortId, day: session.n, start: d.start, pause: d.pause, guestEmail: null, reminder: true, excludeLeadIds: [] }, participants, false);
      items.push({ session, startsAt: sent.startsAt, endsAt: sent.endsAt, meetUrl: sent.meetUrl });
    }
  } catch (error) {
    console.error("[sessions] envoi groupé", error);
    if (items.length === 0) return { ok: false, error: `Google Agenda a refusé la création : ${error instanceof Error ? error.message : "erreur inconnue"}.` };
  }
  for (const p of participants) {
    await sendEmail({ to: p.email, subject: `Vos ${items.length} prochaines sessions · CISSP Bootcamp`, text: calendarMessage({ firstName: p.firstName, items, planUrl: plan.planUrl }) });
  }
  return { ok: true, message: `${items.length} session(s) envoyée(s) sur ${todo.length}, et le calendrier complet à ${participants.length} participant(s).` };
}

/** New hours for a sent session: Google tells every guest; the reminder is re-armed. */
export async function moveCohortSession(input: { cohortId: number; day: number; start: string; pause: number; timezone?: string }): Promise<SessionResult> {
  const plan = await cohortPlan(input.cohortId);
  const record = plan?.cohort.sessions.find((s) => s.day === input.day);
  const session = plan?.days.find((d) => d.n === input.day);
  if (!plan || !record?.googleEventId || !session) return { ok: false, error: "Session introuvable." };
  const timezone = input.timezone ?? record.timezone;
  const { startsAt, endsAt } = sessionSlot(session, input.start, input.pause, timezone);
  try {
    await moveCallEvent(record.googleEventId, startsAt, endsAt);
  } catch (error) {
    console.error("[sessions] déplacement", error);
    return { ok: false, error: "Google Agenda a refusé le déplacement." };
  }
  await prisma.cohortSession.update({ where: { id: record.id }, data: { startsAt, endsAt, timezone, pauseMinutes: input.pause, remindedAt: null } });
  return { ok: true, message: `J${input.day} déplacée : Google Agenda prévient chaque invité, le lien Meet reste le même.` };
}

/**
 * A new invitation for a sent day (Ben, 03/10), typically after the
 * cohort's start moved: a new event and Meet link on the plan's current
 * day, at the hours given, to every paid participant (and the guest);
 * then the old event is cancelled, which Google removes from each
 * guest's calendar with a notice. New first, so nobody is left without.
 */
export async function reissueCohortSession(input: { cohortId: number; day: number; start: string; pause: number; timezone?: string }): Promise<SessionResult> {
  const plan = await cohortPlan(input.cohortId);
  const record = plan?.cohort.sessions.find((s) => s.day === input.day && s.sentAt);
  const session = plan?.days.find((d) => d.n === input.day);
  if (!plan || !record || !session || session.rest) return { ok: false, error: "Session introuvable." };
  const participants = await sessionParticipants(input.cohortId);
  if (participants.length === 0 && !record.guestEmail) return { ok: false, error: "Personne à inviter : aucun participant payé." };
  const oldEventId = record.googleEventId;
  let sent: Awaited<ReturnType<typeof createAndInvite>>;
  try {
    sent = await createAndInvite(plan, session, { ...input, guestEmail: record.guestEmail, reminder: record.reminder, excludeLeadIds: [] }, participants, true, true);
  } catch (error) {
    console.error("[sessions] réémission", error);
    return { ok: false, error: `Google Agenda a refusé la nouvelle invitation : ${error instanceof Error ? error.message : "erreur inconnue"}. L'ancienne est intacte.` };
  }
  let cancelled = true;
  if (oldEventId) {
    try {
      await cancelCallEvent(oldEventId);
    } catch (error) {
      // Already deleted by hand (404/410) is fine; anything else is reported.
      cancelled = /→ (404|410)/.test(error instanceof Error ? error.message : "");
      if (!cancelled) console.error("[sessions] annulation de l'ancienne invitation", error);
    }
  }
  const who = participants.length + (record.guestEmail ? 1 : 0);
  return {
    ok: true,
    message: `Nouvelle invitation J${session.n} envoyée à ${who} personne(s)${sent.meetUrl ? ` · ${sent.meetUrl}` : ""}. ${cancelled ? "L'ancienne est annulée et retirée de leur agenda." : "L'ancienne n'a pas pu être annulée : supprimez-la dans Google Agenda."}`,
  };
}

/** Re-sends the e-mail, and invites participants who paid since the first sending. */
export async function resendCohortSession(input: { cohortId: number; day: number }): Promise<SessionResult> {
  const plan = await cohortPlan(input.cohortId);
  const record = plan?.cohort.sessions.find((s) => s.day === input.day);
  const session = plan?.days.find((d) => d.n === input.day);
  if (!plan || !record?.googleEventId || !session) return { ok: false, error: "Session introuvable." };
  const participants = await sessionParticipants(input.cohortId);
  const attendees = [...participants.map((p) => ({ email: p.email, name: `${p.firstName} ${p.lastName}`.trim() })), ...(record.guestEmail ? [{ email: record.guestEmail }] : [])];
  try {
    await setEventAttendees(record.googleEventId, attendees);
  } catch (error) {
    console.error("[sessions] invités", error);
    return { ok: false, error: "Google Agenda a refusé la mise à jour des invités." };
  }
  let emailed = 0;
  for (const p of participants) {
    const result = await sendEmail({ to: p.email, subject: sessionSubject(session, record.startsAt), text: sessionMessage({ firstName: p.firstName, session, startsAt: record.startsAt, endsAt: record.endsAt, meetUrl: record.meetUrl, planUrl: plan.planUrl }) });
    if (result.sent) emailed++;
  }
  await prisma.cohortSession.update({ where: { id: record.id }, data: { invitedCount: attendees.length } });
  return { ok: true, message: `Lien J${input.day} renvoyé à ${emailed} participant(s).` };
}

/** Cron, every 15 minutes: the reminder an hour before each session, once. */
export async function sendSessionReminders(now = new Date()): Promise<number> {
  const due = await prisma.cohortSession.findMany({
    where: { reminder: true, sentAt: { not: null }, remindedAt: null, startsAt: { gte: now, lte: new Date(now.getTime() + SESSION_REMINDER_MINUTES * 60_000) } },
  });
  let sent = 0;
  for (const record of due) {
    const plan = await cohortPlan(record.cohortId);
    const session = plan?.days.find((d) => d.n === record.day);
    if (!plan || !session) continue;
    const participants = await sessionParticipants(record.cohortId);
    for (const p of participants) {
      if (p.unsubscribedAt) continue;
      const result = await sendEmail({ to: p.email, subject: `Dans une heure : J${session.n} · CISSP Bootcamp`, text: reminderMessage({ firstName: p.firstName, session, startsAt: record.startsAt, endsAt: record.endsAt, meetUrl: record.meetUrl }) });
      if (result.sent) sent++;
    }
    await prisma.cohortSession.update({ where: { id: record.id }, data: { remindedAt: now } });
  }
  return sent;
}
