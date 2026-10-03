import type { Session } from "@/lib/reading-plan/data";

/**
 * Live sessions of a cohort as Google Meet invitations (Ben, 02/10). Pure:
 * default hours, time zone arithmetic and the texts; the I/O lives in
 * lib/cohort-sessions-send.ts. Hours Ben approved on 02/10: evenings 19 h to
 * 21 h, weekends from 9 h with a one-hour break, in Dakar time.
 */

export const SESSION_TIMEZONE = "Africa/Dakar";
export const SESSION_TIMEZONE_LABEL = "heure de Dakar";
export const DEFAULT_EVENING_START = "19:00";
export const DEFAULT_WEEKEND_START = "09:00";
export const DEFAULT_WEEKEND_PAUSE_MINUTES = 60;
/** The reminder e-mail leaves this long before the session. */
export const SESSION_REMINDER_MINUTES = 60;

export function isWeekendDay(date: string): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function sessionDefaults(date: string): { start: string; pause: number } {
  return isWeekendDay(date) ? { start: DEFAULT_WEEKEND_START, pause: DEFAULT_WEEKEND_PAUSE_MINUTES } : { start: DEFAULT_EVENING_START, pause: 0 };
}

export function isClock(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Minutes the zone is ahead of UTC at that instant. */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** "2026-10-05" at "19:00" in that zone, as an instant. */
export function zonedInstant(date: string, clock: string, timeZone: string): Date {
  const naive = new Date(`${date}T${clock}:00Z`);
  const first = new Date(naive.getTime() - offsetMinutes(naive, timeZone) * 60_000);
  return new Date(naive.getTime() - offsetMinutes(first, timeZone) * 60_000);
}

/** Start and end of a session: its teaching hours plus the break. */
export function sessionSlot(session: Pick<Session, "date" | "hours">, start: string, pauseMinutes: number, timeZone = SESSION_TIMEZONE): { startsAt: Date; endsAt: Date } {
  const startsAt = zonedInstant(session.date, start, timeZone);
  return { startsAt, endsAt: new Date(startsAt.getTime() + (session.hours * 60 + pauseMinutes) * 60_000) };
}

const clockLabel = (d: Date, timeZone: string) => d.toLocaleTimeString("fr-FR", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).replace(":", " h ").replace(" h 00", " h").replace(/^0(\d)/, "$1");

/** "lundi 5 octobre, de 19 h à 21 h" */
export function slotLabel(startsAt: Date, endsAt: Date, timeZone = SESSION_TIMEZONE): string {
  const day = startsAt.toLocaleDateString("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" });
  return `${day}, de ${clockLabel(startsAt, timeZone)} à ${clockLabel(endsAt, timeZone)}`;
}

const KIND: Record<string, string> = { full: "en entier", only: "seulement", except: "tout, sauf", range: "partie", review: "retour sur" };

function readingLines(session: Session): string {
  return session.read.length
    ? session.read.map((r) => `• Chapitre ${r.ch} (${KIND[r.kind]}${r.text ? ` : ${r.text}` : ""})`).join("\n")
    : "• Pas de lecture : cette session relie ce que vous avez lu.";
}

export function sessionSummary(session: Session): string {
  return `CISSP Bootcamp · J${session.n}`;
}

export function sessionSubject(session: Session, startsAt: Date, timeZone = SESSION_TIMEZONE): string {
  const day = startsAt.toLocaleDateString("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" });
  return `J${session.n} · ${day}, ${clockLabel(startsAt, timeZone)} · CISSP Bootcamp`;
}

type MessageInput = { session: Session; startsAt: Date; endsAt: Date; meetUrl: string | null; planUrl: string; timeZone?: string };

/** The event's description: the same content, without a first name. */
export function sessionDescription(input: MessageInput): string {
  const { session } = input;
  return [
    `Au programme : ${session.title}.`,
    session.goal,
    "",
    "À avoir lu avant la session :",
    readingLines(session),
    session.todo ? `\n${session.todo}` : null,
    "",
    `Plan de lecture : ${input.planUrl}`,
  ].filter((l): l is string => l !== null).join("\n");
}

/** The e-mail each participant receives, with their first name. */
export function sessionMessage(input: MessageInput & { firstName: string }): string {
  const tz = input.timeZone ?? SESSION_TIMEZONE;
  return [
    `Bonjour ${input.firstName},`,
    "",
    `Notre session J${input.session.n} a lieu le ${slotLabel(input.startsAt, input.endsAt, tz)} (${SESSION_TIMEZONE_LABEL}). L’invitation Google Agenda l’inscrit dans votre agenda à votre heure locale.`,
    "",
    sessionDescription(input).replace(`\nPlan de lecture : ${input.planUrl}`, ""),
    "",
    `Rejoindre la session : ${input.meetUrl ?? "le lien est dans l’invitation Google Agenda"}`,
    `Votre plan de lecture : ${input.planUrl}`,
    "",
    "À bientôt,",
    "Ben",
  ].join("\n");
}

/** The reminder an hour before. */
export function reminderMessage(input: { firstName: string; session: Session; startsAt: Date; endsAt: Date; meetUrl: string | null; timeZone?: string }): string {
  const tz = input.timeZone ?? SESSION_TIMEZONE;
  return [
    `Bonjour ${input.firstName},`,
    "",
    `Notre session J${input.session.n} commence dans une heure : ${slotLabel(input.startsAt, input.endsAt, tz)} (${SESSION_TIMEZONE_LABEL}).`,
    `Au programme : ${input.session.title}.`,
    "",
    `Rejoindre la session : ${input.meetUrl ?? "le lien est dans l’invitation Google Agenda"}`,
    "",
    "À tout à l’heure,",
    "Ben",
  ].join("\n");
}

/** One e-mail with the whole calendar, when Ben sends every remaining day at once. */
export function calendarMessage(input: { firstName: string; items: Array<{ session: Session; startsAt: Date; endsAt: Date; meetUrl: string | null }>; planUrl: string; timeZone?: string }): string {
  const tz = input.timeZone ?? SESSION_TIMEZONE;
  return [
    `Bonjour ${input.firstName},`,
    "",
    `Voici le calendrier de nos prochaines sessions (${SESSION_TIMEZONE_LABEL}). Chacune vous arrive aussi en invitation Google Agenda, à votre heure locale.`,
    "",
    ...input.items.map((i) => `J${i.session.n} · ${slotLabel(i.startsAt, i.endsAt, tz)}\n${i.session.title}\nLien : ${i.meetUrl ?? "dans l’invitation"}\n`),
    `Ce qu’il faut lire avant chaque session est dans votre plan de lecture : ${input.planUrl}`,
    "",
    "À bientôt,",
    "Ben",
  ].join("\n");
}

/**
 * A sent invitation no longer on its plan day (Ben, 03/10: the cohort's
 * start moved after sending). Compares calendar days in the session's zone.
 */
export function isSessionOutdated(sent: { startsAt: Date; timezone: string }, planDate: string): boolean {
  return sent.startsAt.toLocaleDateString("en-CA", { timeZone: sent.timezone }) !== planDate;
}

/** The e-mail of a re-issued invitation: says the old one is cancelled. */
export function reissuedMessage(message: string, session: Session): string {
  const lines = message.split("\n");
  lines.splice(2, 0, `L’invitation précédente pour J${session.n} est annulée et retirée de votre agenda : voici la nouvelle, avec un nouveau lien Meet. Seul ce lien compte.`, "");
  return lines.join("\n");
}
