import { Prisma } from "@prisma/client";

import { type AdChannel, type AdCounts, type AdDestination, type AdMetrics, adMetrics } from "@/lib/ads";
import { prisma } from "@/lib/db";

/**
 * Paid campaigns with their real counts (lot 8): visitors who came through
 * the link, prospects whose first touch was the link, and paid seats of
 * those prospects. Read-only.
 */

export type AdRow = {
  id: number;
  code: string;
  name: string;
  channel: AdChannel;
  destination: AdDestination;
  cohortId: number | null;
  cohortName: string | null;
  budgetUsd: number | null;
  spentUpdatedAt: Date | null;
  active: boolean;
  createdAt: Date;
  metrics: AdMetrics;
};

/** Counts per utm_campaign code. */
export async function adCounts(codes: string[]): Promise<Map<string, Omit<AdCounts, "spentCents">>> {
  const out = new Map<string, Omit<AdCounts, "spentCents">>(codes.map((c) => [c, { visits: 0, leads: 0, paid: 0, revenueCents: 0 }]));
  if (!codes.length) return out;
  const [visits, leads, paid] = await Promise.all([
    prisma.$queryRaw<Array<{ code: string; visitors: bigint | number }>>(Prisma.sql`
      SELECT utm_campaign AS code, COUNT(DISTINCT COALESCE(visitor_id, CONCAT('lead:', lead_id))) AS visitors
      FROM funnel_events
      WHERE utm_campaign IN (${Prisma.join(codes)})
      GROUP BY utm_campaign`),
    prisma.lead.groupBy({ by: ["utmCampaign"], where: { utmCampaign: { in: codes } }, _count: { _all: true } }),
    prisma.registration.findMany({ where: { status: "paid", lead: { utmCampaign: { in: codes } } }, select: { amountUsd: true, lead: { select: { utmCampaign: true } } } }),
  ]);
  for (const v of visits) { const row = out.get(v.code); if (row) row.visits = Number(v.visitors); }
  for (const l of leads) { const row = l.utmCampaign ? out.get(l.utmCampaign) : undefined; if (row) row.leads = l._count._all; }
  for (const r of paid) { const row = r.lead.utmCampaign ? out.get(r.lead.utmCampaign) : undefined; if (row) { row.paid += 1; row.revenueCents += r.amountUsd; } }
  return out;
}

export async function loadAdCampaigns(where: Prisma.AdCampaignWhereInput = {}): Promise<AdRow[]> {
  const rows = await prisma.adCampaign.findMany({ where, orderBy: [{ active: "desc" }, { createdAt: "desc" }], include: { cohort: { select: { name: true } } } });
  const counts = await adCounts(rows.map((r) => r.code));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    channel: r.channel as AdChannel,
    destination: r.destination as AdDestination,
    cohortId: r.cohortId,
    cohortName: r.cohort?.name ?? null,
    budgetUsd: r.budgetUsd,
    spentUpdatedAt: r.spentUpdatedAt,
    active: r.active,
    createdAt: r.createdAt,
    metrics: adMetrics({ spentCents: r.spentCents, ...(counts.get(r.code) ?? { visits: 0, leads: 0, paid: 0, revenueCents: 0 }) }),
  }));
}
