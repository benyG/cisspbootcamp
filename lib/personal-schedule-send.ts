import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createSessionEvent, fetchBusy, setEventAttendees } from "@/lib/calendar/google";
import { SESSION_REMINDER_MINUTES, reminderMessage, sessionDay, sessionDescription } from "@/lib/cohort-sessions";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import {
  DEFAULT_LIMITS,
  type Limits,
  PERSONAL_ZONE,
  type PersonalDay,
  checkProposal,
  mockExamDate,
  personalSessions,
  slotOf,
  windowDates,
} from "@/lib/personal-schedule";
import type { Session } from "@/lib/reading-plan/data";
import { createToken } from "@/lib/tokens";

/**
 * Personal calendars, the I/O side (Ben, 04/10): Ben sends the link, the
 * participant proposes, Ben confirms (events and e-mails) or refuses with a
 * message. Rules and packing live in lib/personal-schedule.ts.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

// ---- Ben's limits (latest end, weekdays and weekends), in site_settings.

const SETTINGS_KEY = "personalSchedule";
const limitsSchema = z.object({
  latestEndWeekday: z.coerce.number().int().min(18 * 60).max(24 * 60).default(DEFAULT_LIMITS.latestEndWeekday),
  latestEndWeekend: z.coerce.number().int().min(16 * 60 + 30).max(24 * 60).default(DEFAULT_LIMITS.latestEndWeekend),
});

export async function loadLimits(): Promise<Limits> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
  const parsed = limitsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : DEFAULT_LIMITS;
}

export async function saveLimits(value: unknown): Promise<Limits> {
  const parsed = limitsSchema.parse(value);
  await prisma.siteSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value: parsed }, update: { value: parsed } });
  return parsed;
}

// ---- links

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
export const plannerUrl = (token: string) => `${appUrl()}/calendrier/${token}`;
export const personalPlanUrl = (token: string) => `${appUrl()}/plan-de-lecture?calendrier=${token}`;

const daysSchema = z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.number().int().min(0).max(24 * 60), extend: z.boolean() })).max(40);

export function storedDays(value: unknown): PersonalDay[] {
  const parsed = daysSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** remindedAt: when the e-mail an hour before left (ISO), once. */
export type StoredEvent = { n: number; date: string; startsAt: string; endsAt: string; eventId: string; meetUrl: string | null; remindedAt?: string };

// ---- Ben sends the link

export async function invitePersonalSchedule(cohortId: number, leadId: number, now = new Date()): Promise<ActionResult> {
  const registration = await prisma.registration.findFirst({ where: { cohortId, leadId, status: "paid" }, include: { lead: true, cohort: true } });
  if (!registration) return { ok: false, error: "Seule une personne inscrite et payée dans cette cohorte peut recevoir un calendrier personnel." };
  const existing = await prisma.personalSchedule.findUnique({ where: { cohortId_leadId: { cohortId, leadId } } });
  if (existing?.status === "confirmed") return { ok: false, error: "Son calendrier personnel est déjà confirmé." };
  const token = existing?.token ?? createToken();
  await prisma.personalSchedule.upsert({
    where: { cohortId_leadId: { cohortId, leadId } },
    create: { cohortId, leadId, token, sentAt: now },
    update: { status: "invited", sentAt: now, days: Prisma.DbNull, proposedAt: null, refusedAt: null, refusalNote: null },
  });
  const window = windowDates(now);
  const result = await sendEmail({
    to: registration.lead.email,
    subject: "Choisissez vos jours de session · CISSP Bootcamp",
    text: [
      `Bonjour ${registration.lead.firstName},`,
      "",
      "Comme convenu, vous pouvez suivre le programme à votre rythme : choisissez vous-même vos jours de session sur le mois qui vient.",
      `Ouvrez ce lien, cochez vos jours disponibles jusqu’au ${longDate(window[window.length - 1])}, choisissez l’heure de chaque jour, puis envoyez-moi votre proposition :`,
      plannerUrl(token),
      "",
      "Je la confirme, puis vous recevez une invitation Google Agenda par session, avec le lien Meet.",
      "",
      "À bientôt,",
      "Ben",
    ].join("\n"),
  });
  await prisma.actionLog.create({ data: { leadId, type: "personal_schedule_invited", channel: "email", payload: { cohortId } } });
  return { ok: true, message: result.sent ? `Lien envoyé à ${registration.lead.firstName} : ${plannerUrl(token)}` : `Lien créé (e-mail non envoyé : ${result.reason}) : ${plannerUrl(token)}` };
}

// ---- the participant's page

export async function scheduleByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.personalSchedule.findUnique({ where: { token }, include: { lead: { select: { id: true, firstName: true, lastName: true, email: true } }, cohort: { select: { id: true, name: true } } } });
}

/**
 * Ben's busy times over the link's month. Without Google Calendar (not
 * connected yet), nothing is closed and the page says so.
 */
export async function busyOver(window: string[]): Promise<{ busy: Array<{ start: Date; end: Date }>; calendar: boolean }> {
  try {
    const busy = await fetchBusy({ start: new Date(`${window[0]}T00:00:00Z`), end: new Date(Date.parse(`${window[window.length - 1]}T23:59:59Z`) + 86_400_000) });
    return { busy, calendar: true };
  } catch (error) {
    console.error("[calendrier personnel] disponibilités", error);
    return { busy: [], calendar: false };
  }
}

export async function proposePersonalSchedule(token: string, days: PersonalDay[], now = new Date()): Promise<ActionResult> {
  const schedule = await scheduleByToken(token);
  if (!schedule) return { ok: false, error: "Lien invalide." };
  if (schedule.status === "proposed") return { ok: false, error: "Votre proposition est déjà envoyée : Ben la regarde." };
  if (schedule.status === "confirmed") return { ok: false, error: "Votre calendrier est déjà confirmé." };
  const window = windowDates(schedule.sentAt);
  const [limits, { busy }] = await Promise.all([loadLimits(), busyOver(window)]);
  const checked = checkProposal(days, { window, limits, busy, now });
  if (!checked.ok) return checked;
  await prisma.personalSchedule.update({ where: { id: schedule.id }, data: { status: "proposed", days: checked.days, proposedAt: now, refusalNote: null } });
  await prisma.actionLog.create({ data: { leadId: schedule.lead.id, type: "personal_schedule_proposed", payload: { cohortId: schedule.cohort.id, sessions: checked.sessions.length } } });
  await sendEmail({
    to: env.ADMIN_EMAIL,
    subject: `Calendrier personnel à confirmer : ${schedule.lead.firstName} ${schedule.lead.lastName}`,
    text: [
      `${schedule.lead.firstName} ${schedule.lead.lastName} (${schedule.cohort.name}) propose ${checked.sessions.length} sessions, du ${longDate(checked.sessions[0].date)} au ${longDate(checked.sessions[checked.sessions.length - 1].date)}.`,
      "",
      `Confirmer ou refuser : ${appUrl()}/admin/cohortes/${schedule.cohort.id}/calendriers/${schedule.id}`,
    ].join("\n"),
  });
  return { ok: true, message: "Proposition envoyée." };
}

// ---- Ben confirms or refuses

/**
 * Creates one Google event (with Meet) per day for the participant alone,
 * e-mails the recap (days and contents, no hours: the invitations carry
 * them) and the personal reading plan, then takes the person off the
 * cohort's upcoming group sessions.
 */
export async function confirmPersonalSchedule(id: number, now = new Date()): Promise<ActionResult> {
  const schedule = await prisma.personalSchedule.findUnique({ where: { id }, include: { lead: true, cohort: { include: { sessions: true } } } });
  if (!schedule) return { ok: false, error: "Calendrier introuvable." };
  if (schedule.status !== "proposed") return { ok: false, error: "Rien à confirmer : la proposition n'est pas en attente." };
  const days = storedDays(schedule.days);
  const sessions = personalSessions(days);
  const planUrl = personalPlanUrl(schedule.token);
  const already = (Array.isArray(schedule.events) ? (schedule.events as StoredEvent[]) : []).filter((e) => e && typeof e.n === "number");
  const events: StoredEvent[] = [...already];
  try {
    for (const session of sessions) {
      if (events.some((e) => e.n === session.n)) continue; // created by an earlier, interrupted confirmation
      const day = days.find((d) => d.date === session.date)!;
      const { startsAt, endsAt } = slotOf(day);
      const event = await createSessionEvent({
        summary: `CISSP Bootcamp · J${session.n}`,
        description: sessionDescription({ session, startsAt, endsAt, meetUrl: null, planUrl }),
        start: startsAt,
        end: endsAt,
        timeZone: PERSONAL_ZONE,
        attendees: [{ email: schedule.lead.email, name: `${schedule.lead.firstName} ${schedule.lead.lastName}`.trim() }],
        requestId: randomUUID(),
      });
      events.push({ n: session.n, date: session.date, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), eventId: event.eventId, meetUrl: event.meetUrl });
    }
  } catch (error) {
    console.error("[calendrier personnel] création", error);
    await prisma.personalSchedule.update({ where: { id }, data: { events } });
    return { ok: false, error: `Google Agenda a refusé une invitation (${events.length} sur ${sessions.length} créées) : ${error instanceof Error ? error.message : "erreur inconnue"}. Recliquez sur Confirmer : les invitations déjà créées ne sont pas refaites.` };
  }
  await prisma.personalSchedule.update({ where: { id }, data: { status: "confirmed", confirmedAt: now, events } });

  // Off the cohort's upcoming group sessions; the paid seat stays.
  const remaining = await groupParticipants(schedule.cohortId);
  for (const s of schedule.cohort.sessions) {
    if (!s.googleEventId || !s.sentAt || s.startsAt <= now) continue;
    try {
      await setEventAttendees(s.googleEventId, [...remaining.map((p) => ({ email: p.email, name: `${p.firstName} ${p.lastName}`.trim() })), ...(s.guestEmail ? [{ email: s.guestEmail }] : [])]);
    } catch (error) {
      console.error("[calendrier personnel] retrait des sessions collectives", s.day, error);
    }
  }

  await sendEmail({ to: schedule.lead.email, subject: "Votre calendrier est confirmé · CISSP Bootcamp", text: confirmedMessage(schedule.lead.firstName, sessions, planUrl) });
  await prisma.actionLog.create({ data: { leadId: schedule.leadId, type: "personal_schedule_confirmed", channel: "email", payload: { cohortId: schedule.cohortId, sessions: sessions.length } } });
  return { ok: true, message: `Calendrier confirmé : ${sessions.length} invitations envoyées à ${schedule.lead.firstName}.` };
}

export async function refusePersonalSchedule(id: number, note: string, now = new Date()): Promise<ActionResult> {
  const schedule = await prisma.personalSchedule.findUnique({ where: { id }, include: { lead: true } });
  if (!schedule) return { ok: false, error: "Calendrier introuvable." };
  if (schedule.status !== "proposed") return { ok: false, error: "Rien à refuser : la proposition n'est pas en attente." };
  // A refusal re-opens the page for a new month from today.
  await prisma.personalSchedule.update({ where: { id }, data: { status: "refused", refusedAt: now, refusalNote: note, sentAt: now } });
  const window = windowDates(now);
  await sendEmail({
    to: schedule.lead.email,
    subject: "Votre calendrier est à revoir · CISSP Bootcamp",
    text: [
      `Bonjour ${schedule.lead.firstName},`,
      "",
      "Je ne peux pas confirmer votre proposition telle quelle :",
      note,
      "",
      `Vous pouvez en faire une nouvelle, avec des jours jusqu’au ${longDate(window[window.length - 1])} :`,
      plannerUrl(schedule.token),
      "",
      "Merci,",
      "Ben",
    ].join("\n"),
  });
  await prisma.actionLog.create({ data: { leadId: schedule.leadId, type: "personal_schedule_refused", channel: "email", payload: { cohortId: schedule.cohortId } } });
  return { ok: true, message: `Proposition refusée : ${schedule.lead.firstName} a reçu votre message et peut en refaire une.` };
}

/** Paid participants who follow the cohort's group sessions: the ones with a confirmed personal calendar are left out. */
export async function groupParticipants(cohortId: number) {
  const [registrations, personal] = await Promise.all([
    prisma.registration.findMany({
      where: { cohortId, status: "paid" },
      include: { lead: { select: { id: true, firstName: true, lastName: true, email: true, country: true, unsubscribedAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.personalSchedule.findMany({ where: { cohortId, status: "confirmed" }, select: { leadId: true } }),
  ]);
  const out = new Set(personal.map((p) => p.leadId));
  const seen = new Set<number>();
  return registrations.map((r) => r.lead).filter((l) => !out.has(l.id) && !seen.has(l.id) && seen.add(l.id));
}

function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

/** The recap: days and contents, never an hour (Ben, 03/10). */
export function confirmedMessage(firstName: string, sessions: Session[], planUrl: string): string {
  const mock = mockExamDate(sessions);
  return [
    `Bonjour ${firstName},`,
    "",
    `Votre calendrier est confirmé : ${sessions.length} sessions. Chacune vous arrive en invitation Google Agenda, avec son heure (à votre heure locale) et le lien Meet.`,
    "",
    ...sessions.map((s) => `J${s.n} · ${sessionDay(s)}\n${s.title}\n`),
    mock ? `L’examen blanc vous sera envoyé le ${longDate(mock)}, une semaine après votre dernière session, pour réviser.` : "",
    "",
    `Votre plan de lecture, à vos dates : ${planUrl}`,
    "",
    "À bientôt,",
    "Ben",
  ].join("\n");
}


/**
 * Cron, every 15 minutes (Ben, 04/10): the e-mail an hour before each
 * personal session, as for the cohort's sessions, once per session.
 */
export async function sendPersonalReminders(now = new Date()): Promise<number> {
  const schedules = await prisma.personalSchedule.findMany({ where: { status: "confirmed" }, include: { lead: { select: { firstName: true, email: true, unsubscribedAt: true } } } });
  const horizon = now.getTime() + SESSION_REMINDER_MINUTES * 60_000;
  let sent = 0;
  for (const schedule of schedules) {
    const events = Array.isArray(schedule.events) ? (schedule.events as StoredEvent[]) : [];
    const due = events.filter((e) => !e.remindedAt && Date.parse(e.startsAt) >= now.getTime() && Date.parse(e.startsAt) <= horizon);
    if (!due.length) continue;
    const sessions = personalSessions(storedDays(schedule.days));
    for (const event of due) {
      const session = sessions.find((s) => s.n === event.n);
      if (!session) continue;
      const result = await sendEmail({
        to: schedule.lead.email,
        subject: `Dans une heure : J${session.n} · CISSP Bootcamp`,
        text: reminderMessage({ firstName: schedule.lead.firstName, session, startsAt: new Date(event.startsAt), endsAt: new Date(event.endsAt), meetUrl: event.meetUrl }),
      });
      if (result.sent) sent++;
      event.remindedAt = now.toISOString();
    }
    await prisma.personalSchedule.update({ where: { id: schedule.id }, data: { events } });
  }
  return sent;
}
