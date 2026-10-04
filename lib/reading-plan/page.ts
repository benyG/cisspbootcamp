import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_START, DOMAINS, type Session, buildSessions, planDates } from "./data";

/**
 * The reading plan page: the static template with its data inlined. `start`
 * is the cohort's first day, YYYY-MM-DD; the calendar is built from it here.
 */

const TEMPLATE_PATH = path.join(process.cwd(), "lib/reading-plan/template.html");

let template: Promise<string> | null = null;

export function isPlanDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

/** JSON safe inside a <script> element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * `personal`: a participant's own calendar (Ben, 04/10), its sessions on the
 * days they chose instead of the cohort's run of days.
 */
export function renderReadingPlan(html: string, start: string, personal?: { sessions: Session[]; mockExam: string }): string {
  const from = personal?.sessions[0]?.date ?? (isPlanDate(start) ? start : DEFAULT_START);
  const data = personal
    ? { domains: DOMAINS, sessions: personal.sessions, defaultStart: from, mockExam: personal.mockExam, personal: true }
    : { domains: DOMAINS, sessions: buildSessions(from), defaultStart: from, mockExam: planDates(from).mockExam, personal: false };
  return html.replace("__DATA__", () => scriptJson(data));
}

export async function readingPlanPage(start: string, personal?: { sessions: Session[]; mockExam: string }): Promise<string> {
  template ??= readFile(TEMPLATE_PATH, "utf8");
  return renderReadingPlan(await template, start, personal);
}

/** The cohort's first day as the page expects it. Cohorts start in the evening, UTC. */
export function planStart(startsAt: Date): string {
  return startsAt.toISOString().slice(0, 10);
}

/**
 * The participant's link. With the cohort id, the page reads the cohort's
 * current start (Ben, 03/10: a start moved after the e-mail went out must
 * move the plan too); the date stays as the fallback.
 */
export function readingPlanUrl(appUrl: string, startsAt: Date, cohortId?: number): string {
  return `${appUrl}/plan-de-lecture?debut=${planStart(startsAt)}${cohortId ? `&cohorte=${cohortId}` : ""}`;
}

/**
 * Last day of a CISSP cohort, from the weekday calendar (Ben, 29/09): a cohort
 * that does not start on a Monday may end later. Same time of day as the start.
 */
export function cisspEndsAt(startsAt: Date): Date {
  const start = planStart(startsAt);
  const days = Math.round((Date.parse(`${planDates(start).end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
  return new Date(startsAt.getTime() + days * 86_400_000);
}
