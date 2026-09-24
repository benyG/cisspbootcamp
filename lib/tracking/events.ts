/**
 * Funnel measurement — docs/CONVERSION.md §3. Pure definitions and maths;
 * no I/O here so the report logic is unit-tested.
 */

export const EVENT_NAMES = [
  "landing_view",
  "cta_click",
  "scanner_start",
  "scanner_step",
  "scanner_blocked",
  "scanner_submit",
  "result_view",
  "result_return",
  "book_click",
  "booking_done",
  "offer_view",
  "pay_click",
  "paid",
  "price_country_change",
  "faq_open",
  "examboot_click",
  "examboot_done",
  "service_view",
  "service_pay_click",
  "service_paid",
  "service_booked",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}

/** Events the browser may send; everything else is recorded server-side only. */
export const CLIENT_EVENTS: readonly EventName[] = [
  "landing_view",
  "cta_click",
  "scanner_start",
  "scanner_step",
  "scanner_blocked",
  "result_view",
  "book_click",
  "price_country_change",
  "faq_open",
  "service_view",
];

/** The seven steps of the weekly funnel, in order, with their public wording. */
export const FUNNEL_STEPS: ReadonlyArray<{ name: EventName; label: string }> = [
  { name: "landing_view", label: "Visites" },
  { name: "scanner_start", label: "Scanner commencé" },
  { name: "scanner_submit", label: "Scanner terminé" },
  { name: "result_view", label: "Résultat vu" },
  { name: "booking_done", label: "Appel réservé" },
  { name: "offer_view", label: "Offre vue" },
  { name: "paid", label: "Payé" },
];

/** Completion below this (submitted / started) flags a question that loses people. */
export const SCANNER_COMPLETION_ALERT = 0.6;

export type FunnelRow = {
  name: EventName;
  label: string;
  count: number;
  previous: number;
  /** Conversion from the previous step, 0–100, null for the first step or an empty previous step. */
  rateFromPrevious: number | null;
  /** Change versus the previous period, in percentage points of the count, null when the previous period was empty. */
  deltaPercent: number | null;
};

export function buildFunnel(
  counts: Partial<Record<EventName, number>>,
  previous: Partial<Record<EventName, number>>,
): FunnelRow[] {
  return FUNNEL_STEPS.map((stepDef, index) => {
    const count = counts[stepDef.name] ?? 0;
    const before = previous[stepDef.name] ?? 0;
    const prevStep = index > 0 ? (counts[FUNNEL_STEPS[index - 1].name] ?? 0) : 0;
    return {
      name: stepDef.name,
      label: stepDef.label,
      count,
      previous: before,
      rateFromPrevious: index === 0 || prevStep === 0 ? null : Math.round((count / prevStep) * 100),
      deltaPercent: before === 0 ? null : Math.round(((count - before) / before) * 100),
    };
  });
}

export type DropoffRow = { step: number; reached: number; /** Share of starters who reached this step, 0–100. */ share: number };

/** Per-question reach of the scanner, from the count of visitors who answered each step. */
export function buildDropoff(reachedByStep: ReadonlyMap<number, number>, totalSteps: number): DropoffRow[] {
  const starters = reachedByStep.get(1) ?? 0;
  const rows: DropoffRow[] = [];
  for (let step = 1; step <= totalSteps; step += 1) {
    const reached = reachedByStep.get(step) ?? 0;
    rows.push({ step, reached, share: starters === 0 ? 0 : Math.round((reached / starters) * 100) });
  }
  return rows;
}

/** The question after which the largest share of starters leaves, or null when nobody started. */
export function worstDrop(rows: readonly DropoffRow[]): { step: number; lostPercent: number } | null {
  let worst: { step: number; lostPercent: number } | null = null;
  for (let i = 1; i < rows.length; i += 1) {
    const lost = rows[i - 1].share - rows[i].share;
    if (lost > 0 && (worst === null || lost > worst.lostPercent)) worst = { step: rows[i - 1].step, lostPercent: lost };
  }
  return worst;
}

export function completionRate(started: number, submitted: number): number | null {
  return started === 0 ? null : submitted / started;
}
