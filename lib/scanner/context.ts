import { prisma } from "@/lib/db";
import {
  type CohortCandidate,
  availabilityQuestionLabel,
  selectRegistrationCohort,
} from "@/lib/cohorts";
import { formatUsdCents, isQuoteOnly, resolveTierCode } from "@/lib/pricing";

/**
 * What the questionnaire needs from the database to render: the tier
 * prices, and the cohort a prospect could join right now. Read on every
 * request — a new cohort must show up without a deploy.
 */
export type ScannerContext = {
  tiers: Array<{ code: string; amountUsd: number; countries: string[] }>;
  cohort: CohortCandidate | null;
  availabilityLabel: string;
};

export async function loadScannerContext(now = new Date()): Promise<ScannerContext> {
  const [tiers, cohorts] = await Promise.all([
    prisma.pricingTier.findMany(),
    prisma.cohort.findMany({
      where: { status: "open" },
      include: {
        _count: { select: { registrations: { where: { status: "paid" } }, seatHolds: { where: { releasedAt: null, expiresAt: { gt: now } } } } },
      },
    }),
  ]);

  const candidates: CohortCandidate[] = cohorts.map((cohort) => ({
    id: cohort.id,
    program: cohort.program,
    name: cohort.name,
    startsAt: cohort.startsAt,
    capacity: cohort.capacity,
    status: cohort.status,
    confirmedCount: cohort._count.registrations,
    heldCount: cohort._count.seatHolds,
  }));

  const cohort = selectRegistrationCohort(candidates, now, "cissp");

  return {
    tiers: tiers.map((tier) => ({
      code: tier.code,
      amountUsd: tier.amountUsd,
      countries: Array.isArray(tier.countries) ? (tier.countries as string[]) : [],
    })),
    cohort,
    availabilityLabel: availabilityQuestionLabel(cohort),
  };
}

/** Price label for the budget question, given the country picked earlier. */
export function priceLabelFor(
  country: string | undefined,
  tiers: ScannerContext["tiers"],
): string {
  const code = resolveTierCode(country, tiers);
  if (isQuoteOnly(code)) return "sur devis";
  const tier = tiers.find((candidate) => candidate.code === code);
  return tier ? formatUsdCents(tier.amountUsd) : "sur devis";
}
