import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { QUESTIONS } from "@/lib/scanner/questions";
import {
  type DropoffRow,
  type EventName,
  FUNNEL_STEPS,
  type FunnelRow,
  SCANNER_COMPLETION_ALERT,
  buildDropoff,
  buildFunnel,
  completionRate,
  worstDrop,
} from "@/lib/tracking/events";

/**
 * The weekly tunnel report (docs/CONVERSION.md §3.3): one screen, read in
 * ten seconds. Distinct visitors per step; a server-side event with no
 * cookie counts by its lead instead, so webhooks are not lost.
 */

const WEEK_MS = 7 * 24 * 60 * 60_000;

export type TunnelReport = {
  since: Date;
  until: Date;
  funnel: FunnelRow[];
  dropoff: DropoffRow[];
  questionLabels: string[];
  completion: number | null;
  completionAlert: boolean;
  worstDrop: { step: number; lostPercent: number } | null;
  sources: Array<{ source: string; visits: number; submitted: number; paid: number }>;
  countries: Array<{ country: string; submitted: number; paid: number }>;
  ctas: Array<{ label: string; clicks: number }>;
  faq: Array<{ question: string; opens: number }>;
  returns: number;
  examboot: { byPlacement: Array<{ placement: string; started: number; completed: number; averagePercent: number | null }> };
  /** Consulting (docs/OFFRES.md): views of a service page, payment clicks, paid orders, sessions booked. */
  services: Array<{ service: string; views: number; payClicks: number; paid: number; booked: number }>;
};

type CountRow = { name: string; visitors: bigint | number };

async function distinctPerEvent(since: Date, until: Date): Promise<Partial<Record<EventName, number>>> {
  const rows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT name, COUNT(DISTINCT COALESCE(visitor_id, CONCAT('lead:', lead_id))) AS visitors
    FROM funnel_events
    WHERE created_at >= ${since} AND created_at < ${until}
    GROUP BY name`);
  const out: Partial<Record<EventName, number>> = {};
  for (const row of rows) out[row.name as EventName] = Number(row.visitors);
  return out;
}

export async function tunnelReport(now = new Date()): Promise<TunnelReport> {
  const until = now;
  const since = new Date(now.getTime() - WEEK_MS);
  const previousSince = new Date(since.getTime() - WEEK_MS);

  const [current, previous, steps, sources, countries, ctas, faq, tests, services] = await Promise.all([
    distinctPerEvent(since, until),
    distinctPerEvent(previousSince, since),
    prisma.$queryRaw<Array<{ step: number; visitors: bigint | number }>>(Prisma.sql`
      SELECT step, COUNT(DISTINCT visitor_id) AS visitors
      FROM funnel_events
      WHERE name = 'scanner_step' AND step IS NOT NULL AND created_at >= ${since} AND created_at < ${until}
      GROUP BY step`),
    prisma.$queryRaw<Array<{ source: string | null; visits: bigint | number; submitted: bigint | number; paid: bigint | number }>>(Prisma.sql`
      SELECT utm_source AS source,
        COUNT(DISTINCT CASE WHEN name = 'landing_view' THEN visitor_id END) AS visits,
        COUNT(DISTINCT CASE WHEN name = 'scanner_submit' THEN lead_id END) AS submitted,
        COUNT(DISTINCT CASE WHEN name = 'paid' THEN lead_id END) AS paid
      FROM funnel_events
      WHERE created_at >= ${since} AND created_at < ${until}
      GROUP BY utm_source
      ORDER BY visits DESC
      LIMIT 10`),
    prisma.$queryRaw<Array<{ country: string | null; submitted: bigint | number; paid: bigint | number }>>(Prisma.sql`
      SELECT country,
        COUNT(DISTINCT CASE WHEN name = 'scanner_submit' THEN lead_id END) AS submitted,
        COUNT(DISTINCT CASE WHEN name = 'paid' THEN lead_id END) AS paid
      FROM funnel_events
      WHERE country IS NOT NULL AND created_at >= ${since} AND created_at < ${until}
      GROUP BY country
      ORDER BY submitted DESC
      LIMIT 10`),
    prisma.funnelEvent.groupBy({
      by: ["label"],
      where: { name: "cta_click", createdAt: { gte: since, lt: until } },
      _count: { _all: true },
      orderBy: { _count: { label: "desc" } },
      take: 8,
    }),
    prisma.funnelEvent.groupBy({
      by: ["label"],
      where: { name: "faq_open", createdAt: { gte: since, lt: until } },
      _count: { _all: true },
      orderBy: { _count: { label: "desc" } },
      take: 8,
    }),
    prisma.$queryRaw<Array<{ placement: string; started: bigint | number; completed: bigint | number; average: number | null }>>(Prisma.sql`
      SELECT e.label AS placement,
        COUNT(*) AS started,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) AS completed,
        AVG(CASE WHEN t.status = 'completed' THEN t.percent END) AS average
      FROM funnel_events e
      LEFT JOIN practice_tests t ON t.lead_id = e.lead_id AND t.placement = e.label AND t.created_at >= ${since}
      WHERE e.name = 'examboot_click' AND e.created_at >= ${since} AND e.created_at < ${until}
      GROUP BY e.label
      ORDER BY started DESC`),
    prisma.$queryRaw<Array<{ service: string; views: bigint | number; pay_clicks: bigint | number; paid: bigint | number; booked: bigint | number }>>(Prisma.sql`
      SELECT SUBSTRING_INDEX(label, ':', 1) AS service,
        COUNT(DISTINCT CASE WHEN name = 'service_view' THEN COALESCE(visitor_id, CONCAT('lead:', lead_id)) END) AS views,
        COUNT(CASE WHEN name = 'service_pay_click' THEN 1 END) AS pay_clicks,
        COUNT(CASE WHEN name = 'service_paid' THEN 1 END) AS paid,
        COUNT(CASE WHEN name = 'service_booked' THEN 1 END) AS booked
      FROM funnel_events
      WHERE name IN ('service_view', 'service_pay_click', 'service_paid', 'service_booked') AND label IS NOT NULL AND label <> 'catalogue'
        AND created_at >= ${since} AND created_at < ${until}
      GROUP BY SUBSTRING_INDEX(label, ':', 1)
      ORDER BY paid DESC, views DESC`),
  ]);

  const reached = new Map<number, number>();
  for (const row of steps) reached.set(Number(row.step), Number(row.visitors));
  const dropoff = buildDropoff(reached, QUESTIONS.length);
  const completion = completionRate(current.scanner_start ?? 0, current.scanner_submit ?? 0);

  return {
    since,
    until,
    funnel: buildFunnel(current, previous),
    dropoff,
    questionLabels: QUESTIONS.map((q) => q.id),
    completion,
    completionAlert: completion !== null && (current.scanner_start ?? 0) >= 10 && completion < SCANNER_COMPLETION_ALERT,
    worstDrop: worstDrop(dropoff),
    sources: sources.map((r) => ({ source: r.source ?? "direct / inconnu", visits: Number(r.visits), submitted: Number(r.submitted), paid: Number(r.paid) })),
    countries: countries.map((r) => ({ country: r.country ?? "?", submitted: Number(r.submitted), paid: Number(r.paid) })),
    ctas: ctas.map((r) => ({ label: r.label ?? "?", clicks: r._count._all })),
    faq: faq.map((r) => ({ question: r.label ?? "?", opens: r._count._all })),
    returns: current.result_return ?? 0,
    examboot: {
      byPlacement: tests.map((r) => ({ placement: r.placement ?? "?", started: Number(r.started), completed: Number(r.completed), averagePercent: r.average === null ? null : Math.round(Number(r.average)) })),
    },
    services: services.map((r) => ({ service: r.service ?? "?", views: Number(r.views), payClicks: Number(r.pay_clicks), paid: Number(r.paid), booked: Number(r.booked) })),
  };
}

export { FUNNEL_STEPS };
