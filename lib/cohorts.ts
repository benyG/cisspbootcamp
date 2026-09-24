/**
 * Which cohort a prospect could join — SPECS A5.
 *
 * The scanner is open permanently, whether or not a cohort is on sale, so
 * nothing here is hardcoded: the questionnaire reads the cohort of the moment
 * and degrades gracefully when there is none.
 */

export type CohortCandidate = {
  id: number;
  /** "cissp" (default) or "cc" — see lib/programs.ts. */
  program?: string;
  name: string;
  startsAt: Date;
  capacity: number;
  status: string;
  /** Paid registrations already confirmed on this cohort. */
  confirmedCount: number;
  /** Seats kept for prospects after their call (SeatHold), not yet paid. */
  heldCount?: number;
};

/** Only cohorts in this state can take a registration. */
const SELLABLE_STATUS = "open";

/**
 * Admission window (Ben, 22/09/2026): registrations close a fixed number of
 * days before the cohort starts, always. The promotional price is only
 * guaranteed inside that window, and the countdown shown on the site is this
 * exact deadline — never a timer that resets.
 */
export const ADMISSION_CLOSE_DAYS = 7;

const DAY_MS = 24 * 60 * 60_000;

export function admissionClosesAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - ADMISSION_CLOSE_DAYS * DAY_MS);
}

export function isAdmissionOpen(startsAt: Date, now: Date): boolean {
  return admissionClosesAt(startsAt).getTime() > now.getTime();
}

/** "4 janvier" — the deadline day, read in UTC like the cohort month. */
export function formatAdmissionDeadline(startsAt: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(admissionClosesAt(startsAt));
}

export function remainingSeats(cohort: CohortCandidate): number {
  return Math.max(0, cohort.capacity - cohort.confirmedCount - (cohort.heldCount ?? 0));
}

export function hasSeats(cohort: CohortCandidate): boolean {
  return remainingSeats(cohort) > 0;
}

/**
 * The cohort a new registration should target: the soonest open one whose
 * admission window is still open and that still has a seat. A full cohort rolls over to the next open
 * one automatically, which is what the waiting list relies on.
 *
 * Returns null when nothing is on sale — a normal state, not an error.
 */
export function selectRegistrationCohort(
  cohorts: readonly CohortCandidate[],
  now: Date,
  program = "cissp",
): CohortCandidate | null {
  const eligible = cohorts
    .filter((cohort) => (cohort.program ?? "cissp") === program)
    .filter((cohort) => cohort.status === SELLABLE_STATUS)
    .filter((cohort) => isAdmissionOpen(cohort.startsAt, now))
    .filter(hasSeats)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return eligible[0] ?? null;
}

/** "janvier 2027" — read in UTC so the label never shifts by a day. */
export function formatCohortMonth(startsAt: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(startsAt);
}

/**
 * Wording of the availability question. Keeping the question in place when no
 * cohort is open matters: it still scores, so heat stays comparable between a
 * prospect who answered during a sale window and one who did not.
 */
export function availabilityQuestionLabel(
  cohort: CohortCandidate | null,
): string {
  if (!cohort) {
    return "Dès qu'une nouvelle cohorte sera annoncée, seriez-vous disponible dans les 3 mois ?";
  }

  return `Seriez-vous disponible pour la cohorte de ${formatCohortMonth(cohort.startsAt)} ?`;
}

// --- Jauge (SPECS A5) ---------------------------------------------------

export type Gauge = {
  capacity: number;
  /** Paid registrations. */
  confirmed: number;
  /** Seats held for a prospect after the call, counted as taken until they expire. */
  held: number;
  /** Prospects who said "yes" to this cohort in the scanner but have not paid. */
  preEngaged: number;
  remaining: number;
  /** 0–100, confirmed seats. */
  confirmedPercent: number;
  /** 0–100, confirmed + held seats. */
  takenPercent: number;
  /** 0–100, confirmed + pre-engaged, capped at capacity — the dotted part. */
  projectedPercent: number;
  /** "3 places restantes sur 10" — the public wording. */
  label: string;
};

export function buildGauge(input: { capacity: number; confirmed: number; preEngaged: number; held?: number }): Gauge {
  const capacity = Math.max(0, input.capacity);
  const confirmed = Math.max(0, Math.min(capacity, input.confirmed));
  const held = Math.max(0, Math.min(capacity - confirmed, input.held ?? 0));
  const preEngaged = Math.max(0, input.preEngaged);
  const remaining = capacity - confirmed - held;
  const projected = Math.min(capacity, confirmed + held + preEngaged);
  const percent = (value: number) => (capacity === 0 ? 0 : Math.round((value / capacity) * 100));

  return {
    capacity,
    confirmed,
    held,
    preEngaged,
    remaining,
    confirmedPercent: percent(confirmed),
    takenPercent: percent(confirmed + held),
    projectedPercent: percent(projected),
    label:
      remaining === 0
        ? "Complet"
        : `${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""} sur ${capacity}`,
  };
}

/** Admin wording for CohortStatus. */
export const COHORT_STATUS_LABEL: Record<string, string> = {
  planned: "Planifiée",
  open: "Inscriptions ouvertes",
  full: "Complète",
  running: "En cours",
  done: "Terminée",
};
