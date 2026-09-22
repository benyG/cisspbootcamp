import { formatWhen } from "@/lib/booking";
import { formatCohortMonth } from "@/lib/cohorts";
import { listCohortsWithGauge } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { HOT_LEAD_THRESHOLD, REVIEW_SLA_HOURS, hoursSince } from "@/lib/followups";
import { leadVars, loadTemplate, renderTemplate, waMeLink } from "@/lib/messaging/templates";

/**
 * The coach's daily queue — SPECS A6. Ben opens /admin, sees what to do, does
 * it, closes. Ordered by priority; every row carries its direct action.
 */

export type QueueItem =
  | { kind: "review"; id: number; leadId: number; name: string; country: string; readiness: string; heat: number; hoursWaiting: number; late: boolean }
  | { kind: "call"; bookingId: number; leadId: number; name: string; when: string; meetUrl: string | null; readiness: string | null; heat: number; goals: string | null; timeline: string | null }
  | { kind: "followup"; leadId: number; name: string; heat: number; stage: string; waLink: string | null; emailSubject: string; emailBody: string; email: string; overdueDays: number }
  | { kind: "payment"; registrationId: number; leadId: number; name: string; reference: string; amountUsd: number; cohortName: string; ageHours: number }
  | { kind: "hot"; leadId: number; name: string; heat: number; readiness: string | null; waLink: string | null; email: string; inviteBody: string }
  | { kind: "hold"; holdId: number; leadId: number; name: string; cohortName: string; hoursLeft: number; reminded: boolean };

export type Kpis = { leadsThisWeek: number; callsThisWeek: number; confirmed: number; capacity: number; cohortName: string | null };

export async function loadQueue(now = new Date()): Promise<{ items: QueueItem[]; kpis: Kpis }> {
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const weekStart = new Date(dayStart.getTime() - ((dayStart.getDay() + 6) % 7) * 86_400_000);

  const [pendingReviews, todaysCalls, dueFollowups, manualPayments, hotLeads, leadsThisWeek, callsThisWeek, cohorts, templates] = await Promise.all([
    prisma.scannerResponse.findMany({
      where: { status: "pending_review", lead: { unsubscribedAt: null } },
      orderBy: { createdAt: "asc" },
      include: { lead: { select: { id: true, firstName: true, lastName: true, country: true } } },
    }),
    prisma.booking.findMany({
      where: { status: "scheduled", startsAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { startsAt: "asc" },
      include: { lead: { include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    }),
    prisma.lead.findMany({
      where: { nextFollowupAt: { lte: now }, unsubscribedAt: null, status: { notIn: ["registered", "lost"] } },
      orderBy: [{ heatScore: "desc" }, { nextFollowupAt: "asc" }],
      include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 }, registrations: { where: { status: { in: ["pending", "pending_manual"] } }, take: 1 } },
      take: 20,
    }),
    prisma.registration.findMany({
      where: { status: "pending_manual" },
      orderBy: { createdAt: "asc" },
      include: { lead: { select: { id: true, firstName: true, lastName: true } }, cohort: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: {
        heatScore: { gte: HOT_LEAD_THRESHOLD },
        unsubscribedAt: null,
        status: { in: ["new", "contacted"] },
        bookings: { none: { status: { in: ["scheduled", "done"] } } },
      },
      orderBy: { heatScore: "desc" },
      include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: 10,
    }),
    prisma.lead.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.booking.count({ where: { startsAt: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 86_400_000) }, status: { in: ["scheduled", "done"] } } }),
    listCohortsWithGauge(),
    Promise.all(["followup_scanner_j2", "followup_scanner_j7", "followup_after_call_j3", "unpaid_reminder_j1", "unpaid_reminder_j3", "invite_to_book"].map(async (key) => [key, await loadTemplate(key)] as const)),
  ]);

  const tpl = Object.fromEntries(templates) as Record<string, { subject: string | null; body: string } | null>;
  const current = cohorts.find((c) => c.status === "open" && c.startsAt.getTime() > now.getTime()) ?? cohorts.find((c) => c.status === "running") ?? null;
  const cohortVars = current ? { cohortName: current.name, cohortMonth: formatCohortMonth(current.startsAt) } : {};

  const items: QueueItem[] = [];

  for (const r of pendingReviews) {
    const h = hoursSince(r.createdAt, now);
    items.push({ kind: "review", id: r.id, leadId: r.lead.id, name: `${r.lead.firstName} ${r.lead.lastName}`, country: r.lead.country, readiness: r.readiness, heat: r.heatScore, hoursWaiting: h, late: h >= REVIEW_SLA_HOURS });
  }

  for (const b of todaysCalls) {
    const analysis = b.lead.scannerResponses[0]?.analysis as { timeline?: { label?: string } } | undefined;
    items.push({ kind: "call", bookingId: b.id, leadId: b.lead.id, name: `${b.lead.firstName} ${b.lead.lastName}`, when: formatWhen(b.startsAt, "Africa/Douala"), meetUrl: b.meetUrl, readiness: b.lead.readiness, heat: b.lead.heatScore, goals: b.lead.goals, timeline: analysis?.timeline?.label ?? null });
  }

  for (const l of dueFollowups) {
    const unpaid = l.registrations[0];
    const key = unpaid ? (l.followupCount === 0 ? "unpaid_reminder_j1" : "unpaid_reminder_j3") : l.status === "called" ? "followup_after_call_j3" : l.followupCount === 0 ? "followup_scanner_j2" : "followup_scanner_j7";
    const t = tpl[key];
    const vars = leadVars({ firstName: l.firstName, lastName: l.lastName, appUrl: env.NEXT_PUBLIC_APP_URL, resultToken: l.scannerResponses[0]?.resultToken, ...cohortVars });
    const body = renderTemplate(t?.body ?? "Bonjour {{prenom}}, …", vars);
    items.push({
      kind: "followup", leadId: l.id, name: `${l.firstName} ${l.lastName}`, heat: l.heatScore,
      stage: unpaid ? "Place réservée, non payée" : l.status === "called" ? "Après l'appel" : l.followupCount === 0 ? "Scanner, J+2" : "Scanner, J+7",
      waLink: l.whatsapp ? waMeLink(l.whatsapp, body) : null,
      emailSubject: renderTemplate(t?.subject ?? "Un mot de Ben", vars), emailBody: body, email: l.email,
      overdueDays: l.nextFollowupAt ? Math.floor((now.getTime() - l.nextFollowupAt.getTime()) / 86_400_000) : 0,
    });
  }

  for (const p of manualPayments) {
    items.push({ kind: "payment", registrationId: p.id, leadId: p.lead.id, name: `${p.lead.firstName} ${p.lead.lastName}`, reference: p.reference, amountUsd: p.amountUsd, cohortName: p.cohort.name, ageHours: hoursSince(p.createdAt, now) });
  }

  for (const l of hotLeads) {
    const vars = leadVars({ firstName: l.firstName, lastName: l.lastName, appUrl: env.NEXT_PUBLIC_APP_URL, resultToken: l.scannerResponses[0]?.resultToken, ...cohortVars });
    const body = renderTemplate(tpl.invite_to_book?.body ?? "Bonjour {{prenom}}, 15 minutes pour en parler ? {{lien_rdv}}", vars);
    items.push({ kind: "hot", leadId: l.id, name: `${l.firstName} ${l.lastName}`, heat: l.heatScore, readiness: l.readiness, waLink: l.whatsapp ? waMeLink(l.whatsapp, body) : null, email: l.email, inviteBody: body });
  }

  const holds = await prisma.seatHold.findMany({
    where: { releasedAt: null, expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
    include: { lead: { select: { id: true, firstName: true, lastName: true } }, cohort: { select: { name: true } } },
  });
  for (const h of holds) {
    items.push({ kind: "hold", holdId: h.id, leadId: h.lead.id, name: `${h.lead.firstName} ${h.lead.lastName}`, cohortName: h.cohort.name, hoursLeft: Math.max(0, Math.round((h.expiresAt.getTime() - now.getTime()) / 3_600_000)), reminded: h.reminderSentAt !== null });
  }

  return {
    items,
    kpis: { leadsThisWeek, callsThisWeek, confirmed: current?.gauge.confirmed ?? 0, capacity: current?.capacity ?? 10, cohortName: current?.name ?? null },
  };
}
