import { unstable_cache } from "next/cache";

import { type Gauge, admissionClosesAt, buildGauge, isAdmissionOpen } from "@/lib/cohorts";
import { prisma } from "@/lib/db";

/**
 * Cohorts with their gauge (SPECS A5): paid seats, plus the prospects who
 * said "yes" to the next cohort in the scanner and have not paid yet — the
 * dotted part of the bar.
 *
 * Pre-engagement is counted against the soonest open cohort only, since that
 * is the one the question named when they answered.
 */
export type CohortWithGauge = {
  id: number;
  program: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: string;
  gauge: Gauge;
};

export async function listCohortsWithGauge(): Promise<CohortWithGauge[]> {
  const now = new Date();
  const [cohorts, preEngaged] = await Promise.all([
    prisma.cohort.findMany({
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { registrations: { where: { status: "paid" } }, seatHolds: { where: { releasedAt: null, expiresAt: { gt: now } } } } } },
    }),
    prisma.scannerResponse.count({
      where: {
        answers: { path: "$.cohortAvailability", equals: "yes" },
        lead: { status: { notIn: ["registered", "lost"] }, unsubscribedAt: null },
      },
    }),
  ]);

  const nextOpen = cohorts.find((c) => c.program === "cissp" && c.status === "open" && isAdmissionOpen(c.startsAt, now));

  return cohorts.map((cohort) => ({
    id: cohort.id,
    program: cohort.program,
    name: cohort.name,
    startsAt: cohort.startsAt,
    endsAt: cohort.endsAt,
    capacity: cohort.capacity,
    status: cohort.status,
    gauge: buildGauge({
      capacity: cohort.capacity,
      confirmed: cohort._count.registrations,
      held: cohort._count.seatHolds,
      preEngaged: nextOpen?.id === cohort.id ? preEngaged : 0,
    }),
  }));
}

/** Cache tag for anything that changes the public gauge: payments, cohort edits. */
export const COHORTS_CACHE_TAG = "cohorts";

export type PublicCohort = { name: string; startsAt: Date; admissionClosesAt: Date; gauge: Gauge };

/**
 * unstable_cache serialises its result to JSON, so a Date comes back as a
 * string. The cached layer therefore carries an ISO string, and the public
 * function rebuilds the Date — the bug that took the landing down on 22/09.
 */
const cachedPublicCohort = unstable_cache(
  async (program: string): Promise<{ name: string; startsAt: string; gauge: Gauge } | null> => {
    const cohorts = await listCohortsWithGauge();
    const now = new Date();
    const next = cohorts.find((c) => c.program === program && c.status === "open" && isAdmissionOpen(c.startsAt, now));
    return next ? { name: next.name, startsAt: next.startsAt.toISOString(), gauge: next.gauge } : null;
  },
  ["public-cohort-summary-v4"],
  { revalidate: 60, tags: [COHORTS_CACHE_TAG] },
);

/**
 * What the landing (or /demarrer) shows: the next open cohort of that
 * programme and its public gauge, or null. Cached 60 s (CLAUDE.md: public
 * reads must not hit MySQL on every visit) and invalidated by tag the moment
 * a seat is paid, so the gauge stays honest.
 */
export async function publicCohortSummary(program: "cissp" | "cc" = "cissp"): Promise<PublicCohort | null> {
  const cached = await cachedPublicCohort(program);
  if (!cached) return null;
  const startsAt = new Date(cached.startsAt);
  return { ...cached, startsAt, admissionClosesAt: admissionClosesAt(startsAt) };
}
