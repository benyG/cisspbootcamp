import { zonedInstant } from "@/lib/cohort-sessions";
import { COURSE_HOURS, MOCK_EXAM_DELAY_DAYS, type Session, isoDay, packSessions } from "@/lib/reading-plan/data";

/**
 * Personal calendars (Ben, 04/10): a participant who cannot follow the
 * cohort's calendar picks their own days over one month; the 40 hours are
 * packed in order into them. Pure: the rules, the packing and the checks,
 * shared by the participant's page and the server. Hours are Montréal time.
 *
 * Rules Ben set:
 * - weekdays (Monday to Friday, Wednesday included): 2 h, from 16 h at the earliest;
 * - weekends: 5 h 30 of teaching plus a 30-minute pause, from 10 h at the
 *   earliest; a day can be extended to 7 h in all, pause included (6 h 30 of teaching);
 * - Ben sets the latest end for weekdays and for weekends;
 * - the month runs from the day the link is sent; days Ben is busy are closed;
 * - the mock exam follows 7 days after the last session.
 */

export const PERSONAL_ZONE = "America/Toronto";
export const PERSONAL_ZONE_LABEL = "heure de Montréal";
export const WINDOW_DAYS = 30;
export const WEEKDAY_EARLIEST = 16 * 60;
export const WEEKEND_EARLIEST = 10 * 60;
export const WEEKDAY_HOURS = 2;
export const WEEKEND_HOURS = 5.5;
export const WEEKEND_EXTENDED_HOURS = 6.5;
export const WEEKEND_PAUSE_MINUTES = 30;
/** Start times are offered every half hour. */
export const START_STEP_MINUTES = 30;
export const TOTAL_HOURS = COURSE_HOURS;

export type Limits = { latestEndWeekday: number; latestEndWeekend: number };
export const DEFAULT_LIMITS: Limits = { latestEndWeekday: 22 * 60, latestEndWeekend: 19 * 60 };

/** One chosen day: date (YYYY-MM-DD), start in minutes after midnight (Montréal), weekend extension. */
export type PersonalDay = { date: string; start: number; extend: boolean };
export type Busy = ReadonlyArray<{ start: Date; end: Date }>;

export function isWeekendDate(date: string): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function teachingHours(date: string, extend: boolean): number {
  if (!isWeekendDate(date)) return WEEKDAY_HOURS;
  return extend ? WEEKEND_EXTENDED_HOURS : WEEKEND_HOURS;
}

/** Wall-clock length of the day, pause included. */
export function dayMinutes(date: string, extend: boolean): number {
  return teachingHours(date, extend) * 60 + (isWeekendDate(date) ? WEEKEND_PAUSE_MINUTES : 0);
}

/** "16:30" from 990. */
export function clockOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "16 h 30" from 990. */
export function clockLabel(minutes: number): string {
  const m = minutes % 60;
  return `${Math.floor(minutes / 60)} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

export function slotOf(day: PersonalDay): { startsAt: Date; endsAt: Date } {
  const startsAt = zonedInstant(day.date, clockOf(day.start), PERSONAL_ZONE);
  return { startsAt, endsAt: new Date(startsAt.getTime() + dayMinutes(day.date, day.extend) * 60_000) };
}

/** The month a link opens: the sending day (Montréal) and the 30 days after it. */
export function windowDates(sentAt: Date): string[] {
  const first = sentAt.toLocaleDateString("en-CA", { timeZone: PERSONAL_ZONE });
  return Array.from({ length: WINDOW_DAYS + 1 }, (_, i) => isoDay(first, i));
}

/**
 * Start times allowed on a day: from the earliest start, so that the day
 * ends by Ben's latest end; never in the past, never over one of Ben's busy
 * slots.
 */
export function startOptions(date: string, extend: boolean, limits: Limits, busy: Busy = [], now?: Date): number[] {
  const weekend = isWeekendDate(date);
  if (extend && !weekend) return [];
  const earliest = weekend ? WEEKEND_EARLIEST : WEEKDAY_EARLIEST;
  const latestStart = (weekend ? limits.latestEndWeekend : limits.latestEndWeekday) - dayMinutes(date, extend);
  const out: number[] = [];
  for (let m = earliest; m <= latestStart; m += START_STEP_MINUTES) {
    const { startsAt, endsAt } = slotOf({ date, start: m, extend });
    if (now && startsAt.getTime() <= now.getTime()) continue;
    if (busy.some((b) => b.start.getTime() < endsAt.getTime() && b.end.getTime() > startsAt.getTime())) continue;
    out.push(m);
  }
  return out;
}

/** The course packed into the chosen days; days beyond the 40 hours are dropped. */
export function personalSessions(days: ReadonlyArray<PersonalDay>): Session[] {
  return packSessions(days.map((d) => ({ date: d.date, room: teachingHours(d.date, d.extend) })));
}

export function placedHours(sessions: ReadonlyArray<Session>): number {
  return sessions.reduce((sum, s) => sum + s.hours, 0);
}

export function mockExamDate(sessions: ReadonlyArray<Session>): string | null {
  const last = sessions[sessions.length - 1];
  return last ? isoDay(last.date, MOCK_EXAM_DELAY_DAYS) : null;
}

/**
 * Checks a proposal against the rules, the window and Ben's agenda. Returns
 * the days actually used (sorted, the extra ones dropped), or the reason to
 * refuse, in French for the participant.
 */
export function checkProposal(
  days: ReadonlyArray<PersonalDay>,
  ctx: { window: ReadonlyArray<string>; limits: Limits; busy?: Busy; now?: Date },
): { ok: true; days: PersonalDay[]; sessions: Session[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  for (const d of days) {
    if (seen.has(d.date)) return { ok: false, error: "Un même jour est choisi deux fois." };
    seen.add(d.date);
    if (!ctx.window.includes(d.date)) return { ok: false, error: "Un jour choisi est hors de la période proposée." };
    if (!startOptions(d.date, d.extend, ctx.limits, ctx.busy, ctx.now).includes(d.start)) {
      return { ok: false, error: `L'horaire du ${d.date.split("-").reverse().join("/")} n'est plus disponible : choisissez-en un autre.` };
    }
  }
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const sessions = personalSessions(sorted);
  if (placedHours(sessions) < TOTAL_HOURS) return { ok: false, error: `Il manque des heures : les ${TOTAL_HOURS} h du programme doivent tenir dans vos jours.` };
  return { ok: true, days: sorted.slice(0, sessions.length), sessions };
}
