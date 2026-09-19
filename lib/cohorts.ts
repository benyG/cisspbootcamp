/**
 * Which cohort a prospect could join — SPECS A5.
 *
 * The scanner is open permanently, whether or not a cohort is on sale, so
 * nothing here is hardcoded: the questionnaire reads the cohort of the moment
 * and degrades gracefully when there is none.
 */

export type CohortCandidate = {
  id: number;
  name: string;
  startsAt: Date;
  capacity: number;
  status: string;
  /** Paid registrations already confirmed on this cohort. */
  confirmedCount: number;
};

/** Only cohorts in this state can take a registration. */
const SELLABLE_STATUS = "open";

export function remainingSeats(cohort: CohortCandidate): number {
  return Math.max(0, cohort.capacity - cohort.confirmedCount);
}

export function hasSeats(cohort: CohortCandidate): boolean {
  return remainingSeats(cohort) > 0;
}

/**
 * The cohort a new registration should target: the soonest open one that has
 * not started and still has a seat. A full cohort rolls over to the next open
 * one automatically, which is what the waiting list relies on.
 *
 * Returns null when nothing is on sale — a normal state, not an error.
 */
export function selectRegistrationCohort(
  cohorts: readonly CohortCandidate[],
  now: Date,
): CohortCandidate | null {
  const eligible = cohorts
    .filter((cohort) => cohort.status === SELLABLE_STATUS)
    .filter((cohort) => cohort.startsAt.getTime() > now.getTime())
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
