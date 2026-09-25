import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_START, DOMAINS, SESSIONS } from "./data";

/**
 * The reading plan page: the static template with its data inlined. `start`
 * is the cohort's first day, YYYY-MM-DD; the page computes every date from it.
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

export function renderReadingPlan(html: string, start: string): string {
  const data = { domains: DOMAINS, sessions: SESSIONS, defaultStart: isPlanDate(start) ? start : DEFAULT_START };
  return html.replace("__DATA__", () => scriptJson(data));
}

export async function readingPlanPage(start: string): Promise<string> {
  template ??= readFile(TEMPLATE_PATH, "utf8");
  return renderReadingPlan(await template, start);
}

/** The cohort's first day as the page expects it. Cohorts start in the evening, UTC. */
export function planStart(startsAt: Date): string {
  return startsAt.toISOString().slice(0, 10);
}

export function readingPlanUrl(appUrl: string, startsAt: Date): string {
  return `${appUrl}/plan-de-lecture?debut=${planStart(startsAt)}`;
}
