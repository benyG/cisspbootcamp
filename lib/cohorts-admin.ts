import { unstable_cache } from "next/cache";

import { type Gauge, buildGauge } from "@/lib/cohorts";
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
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: string;
  gauge: Gauge;
};

export async function listCohortsWithGauge(): Promise<CohortWithGauge[]> {
  const [cohorts, preEngaged] = await Promise.all([
    prisma.cohort.findMany({
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { registrations: { where: { status: "paid" } } } } },
    }),
    prisma.scannerResponse.count({
      where: {
        answers: { path: "$.cohortAvailability", equals: "yes" },
        lead: { status: { notIn: ["registered", "lost"] }, unsubscribedAt: null },
      },
    }),
  ]);

  const now = Date.now();
  const nextOpen = cohorts.find((c) => c.status === "open" && c.startsAt.getTime() > now);

  return cohorts.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    startsAt: cohort.startsAt,
    endsAt: cohort.endsAt,
    capacity: cohort.capacity,
    status: cohort.status,
    gauge: buildGauge({
      capacity: cohort.capacity,
      confirmed: cohort._count.registrations,
      preEngaged: nextOpen?.id === cohort.id ? preEngaged : 0,
    }),
  }));
}

/** Cache tag for anything that changes the public gauge: payments, cohort edits. */
export const COHORTS_CACHE_TAG = "cohorts";

/**
 * What the landing shows: the next open cohort and its public gauge, or null.
 * Cached 60 s (CLAUDE.md: public reads must not hit MySQL on every visit) and
 * invalidated by tag the moment a seat is paid, so the gauge stays honest.
 */
export const publicCohortSummary = unstable_cache(
  async (): Promise<{ name: string; startsAt: Date; gauge: Gauge } | null> => {
    const cohorts = await listCohortsWithGauge();
    const now = Date.now();
    const next = cohorts.find((c) => c.status === "open" && c.startsAt.getTime() > now);
    return next ? { name: next.name, startsAt: next.startsAt, gauge: next.gauge } : null;
  },
  ["public-cohort-summary"],
  { revalidate: 60, tags: [COHORTS_CACHE_TAG] },
);
