import { ADMISSION_CLOSE_DAYS } from "@/lib/cohorts";

/**
 * Cohort pilotage (Ben, 06/11, lot 2 of docs/PILOTAGE.md): each cohort has a
 * goal, a target curve from the campaign opening to the admissions close,
 * and a forecast from the recent pace. Pure: the page, the Monday report
 * and the playbooks read the same numbers. Constants are Ben's to adjust.
 */

/** The campaign opens this many days before the first day. */
export const CAMPAIGN_DAYS = 60;

/**
 * Share of the goal expected at each milestone, in days before the first
 * day (validated on the prototype, 06/11). The last point is the admissions
 * close, set per programme.
 */
export const TARGET_CURVE: ReadonlyArray<readonly [number, number]> = [
  [-CAMPAIGN_DAYS, 0],
  [-45, 0.2],
  [-21, 0.5],
];

/** The pace of the last this-many days drives the forecast. */
export const PACE_WINDOW_DAYS = 21;
/** Below this many days of campaign, the pace is too young to forecast. */
export const MIN_PACE_DAYS = 7;

const DAY_MS = 86_400_000;

/** Last day a seat can be bought, relative to the first day: J-7 for certifications, J-1 for the Bâtisseur IA. */
export function closeDayFor(program: string): number {
  return program === "ia" ? -1 : -ADMISSION_CLOSE_DAYS;
}

/** Whole days from the first day to `date` (negative before it), on UTC calendar days. */
export function dayFromStart(startsAt: Date, date: Date): number {
  const day = (d: Date) => Math.floor(d.getTime() / DAY_MS);
  return day(date) - day(startsAt);
}

/** The curve's points for a programme, ending at 100 % on the admissions close. */
export function curveFor(program: string): Array<readonly [number, number]> {
  const close = closeDayFor(program);
  return [...TARGET_CURVE.filter(([d]) => d < close), [close, 1] as const];
}

/** Share of the goal expected on day `j` (0 before the campaign, 1 from the close). */
export function expectedShare(j: number, program: string): number {
  const curve = curveFor(program);
  if (j <= curve[0]![0]) return 0;
  for (let i = 1; i < curve.length; i++) {
    const [a, ya] = curve[i - 1]!;
    const [b, yb] = curve[i]!;
    if (j <= b) return ya + ((yb - ya) * (j - a)) / (b - a);
  }
  return 1;
}

export type PilotInput = {
  program: string;
  startsAt: Date;
  goal: number;
  /** When each paid seat was taken. */
  paidAt: readonly Date[];
};

export type PilotState =
  | "not_open" // before J-60
  | "late"
  | "on_track"
  | "ahead"
  | "reached"
  | "closed"; // admissions closed below the goal

export type Pilot = {
  day: number;
  closeDay: number;
  goal: number;
  paid: number;
  /** Seats expected today on the curve, rounded. */
  expected: number;
  /** Seats short of the curve today (0 when on track or ahead). */
  behind: number;
  /** Seats forecast at the close, or null before the campaign has a pace. */
  forecast: number | null;
  /** Paid seats per week over the pace window. */
  weeklyPace: number;
  state: PilotState;
};

/**
 * Where a cohort stands today. The forecast extends the pace of the last
 * three weeks (or of the campaign so far, when younger) to the close:
 * simple enough to explain in one sentence, and never above the goal's
 * double nor below what is already paid.
 */
export function pilot(input: PilotInput, now: Date): Pilot {
  const day = dayFromStart(input.startsAt, now);
  const closeDay = closeDayFor(input.program);
  const goal = Math.max(1, input.goal);
  const paid = input.paidAt.filter((d) => d.getTime() <= now.getTime()).length;
  const expected = Math.round(expectedShare(day, input.program) * goal);
  const behind = Math.max(0, expected - paid);

  const campaignDays = day + CAMPAIGN_DAYS;
  const window = Math.min(PACE_WINDOW_DAYS, Math.max(campaignDays, 0));
  const recent = window > 0 ? input.paidAt.filter((d) => { const ago = (now.getTime() - d.getTime()) / DAY_MS; return ago >= 0 && ago < window; }).length : 0;
  const perDay = window > 0 ? recent / window : 0;
  const daysLeft = Math.max(0, closeDay - day);
  const forecast = day < -CAMPAIGN_DAYS || (window < MIN_PACE_DAYS && daysLeft > 0) ? null : Math.min(goal * 2, Math.max(paid, Math.round(paid + perDay * daysLeft)));

  let state: PilotState;
  if (paid >= goal) state = "reached";
  else if (day > closeDay) state = "closed";
  else if (day < -CAMPAIGN_DAYS) state = "not_open";
  else if (behind > 0) state = "late";
  else if (paid > expected) state = "ahead";
  else state = "on_track";

  return { day, closeDay, goal, paid, expected, behind, forecast, weeklyPace: Math.round(perDay * 7 * 10) / 10, state };
}

export const STATE_LABEL: Record<PilotState, string> = {
  not_open: "Campagne pas encore ouverte",
  late: "En retard",
  on_track: "Dans les temps",
  ahead: "En avance",
  reached: "Objectif atteint",
  closed: "Admissions fermées",
};

/** "En retard de 2 places", "Dans les temps"… */
export function stateLabel(p: Pilot): string {
  if (p.state === "late") return `En retard de ${p.behind} place${p.behind > 1 ? "s" : ""}`;
  return STATE_LABEL[p.state];
}

/** The forecast in one sentence, for the page and the report. */
export function forecastSentence(p: Pilot): string {
  if (p.state === "not_open") return `La campagne s’ouvre à J-${CAMPAIGN_DAYS}.`;
  if (p.state === "reached") return `Objectif atteint : ${p.paid} place${p.paid > 1 ? "s" : ""} payée${p.paid > 1 ? "s" : ""} sur ${p.goal}.`;
  if (p.state === "closed") return `Admissions fermées avec ${p.paid} place${p.paid > 1 ? "s" : ""} sur ${p.goal}.`;
  if (p.forecast === null) return "Prévision dans quelques jours, quand la campagne aura un rythme.";
  const pace = p.weeklyPace ? `${String(p.weeklyPace).replace(".", ",")} inscription${p.weeklyPace >= 2 ? "s" : ""} par semaine` : "aucune inscription ces dernières semaines";
  return `À ce rythme (${pace}), la cohorte finirait à ${p.forecast} sur ${p.goal} à la fermeture des admissions.`;
}

/** Points of the target curve and of the paid seats, for the chart: [day, seats]. */
export function chartSeries(input: PilotInput, now: Date): { target: Array<[number, number]>; paid: Array<[number, number]>; today: number } {
  const goal = Math.max(1, input.goal);
  const today = dayFromStart(input.startsAt, now);
  const target = curveFor(input.program).map(([d, s]) => [d, s * goal] as [number, number]);
  const days = input.paidAt.map((d) => Math.max(-CAMPAIGN_DAYS, dayFromStart(input.startsAt, d))).filter((d) => d <= today).sort((a, b) => a - b);
  const paid: Array<[number, number]> = [[-CAMPAIGN_DAYS, 0]];
  days.forEach((d, i) => { paid.push([d, i], [d, i + 1]); });
  paid.push([Math.max(-CAMPAIGN_DAYS, Math.min(today, closeDayFor(input.program))), days.length]);
  return { target, paid, today };
}
