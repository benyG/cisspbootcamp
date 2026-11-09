import { Prisma } from "@prisma/client";

import { formatWhen } from "@/lib/booking";
import { ordersAwaitingBooking } from "@/lib/consulting";
import { formatCohortMonth } from "@/lib/cohorts";
import { listCohortsWithGauge } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { HOT_LEAD_THRESHOLD, REVIEW_SLA_HOURS, hoursSince } from "@/lib/followups";
import { BALANCE_ALERT_DAYS, balanceAlert, firstDueUsd } from "@/lib/installments";
import { leadVars, loadTemplate, renderTemplate, waMeLink } from "@/lib/messaging/templates";
import { KEEP_DAYS, outputSchema, readDecisions } from "@/lib/analyst/rules";
import { buildCampaignPlan, dueActions, readCampaign } from "@/lib/campaign";
import { unfinishedCallDue } from "@/lib/playbooks/rules";
import { countryLabel, quoteSummary } from "@/lib/quotes";

/**
 * The coach's daily queue — SPECS A6. Ben opens /admin, sees what to do, does
 * it, closes. Ordered by priority; every row carries its direct action.
 */

export type QueueItem =
  | { kind: "review"; id: number; leadId: number; name: string; country: string; readiness: string; heat: number; hoursWaiting: number; late: boolean }
  | { kind: "call"; bookingId: number; leadId: number; name: string; when: string; meetUrl: string | null; readiness: string | null; heat: number; goals: string | null; timeline: string | null; consulting: { service: string; number: number; total: number } | null }
  | { kind: "session"; orderId: number; leadId: number; name: string; service: string; number: number; total: number; daysSincePaid: number }
  | { kind: "followup"; leadId: number; name: string; heat: number; stage: string; waLink: string | null; emailSubject: string; emailBody: string; email: string; overdueDays: number }
  | { kind: "payment"; registrationId: number; leadId: number; name: string; reference: string; amountUsd: number; cohortName: string; ageHours: number }
  | { kind: "unfinished"; registrationId: number; leadId: number; name: string; reference: string; cohortName: string; days: number; waLink: string | null; email: string }
  | { kind: "drafts"; cohortId: number; cohortName: string; count: number }
  | { kind: "campaign"; cohortId: number; key: string; cohortName: string; text: string; by: string; href: string | null; dueLabel: string }
  | { kind: "analyst"; week: string; rank: number; title: string; action: string; watch: string }
  | { kind: "mcp"; count: number; oldest: Date }
  | { kind: "balance"; registrationId: number; leadId: number; name: string; reference: string; balanceUsd: number; cohortName: string; startsAt: Date; started: boolean; whatsapp: string | null }
  | { kind: "hot"; leadId: number; name: string; heat: number; readiness: string | null; waLink: string | null; email: string; inviteBody: string }
  | { kind: "hold"; holdId: number; leadId: number; name: string; cohortName: string; hoursLeft: number; reminded: boolean }
  | { kind: "personal"; scheduleId: number; cohortId: number; leadId: number; name: string; cohortName: string; hoursWaiting: number }
  | { kind: "replay"; accessId: number; cohortId: number; leadId: number; name: string; cohortName: string; note: string }
  | { kind: "quote"; quoteId: number; organization: string; summary: string; contact: string; note: string };

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
      include: { lead: { include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 } } }, serviceOrder: { include: { service: { select: { name: true } }, bookings: { where: { status: { in: ["scheduled", "done"] } }, orderBy: { startsAt: "asc" }, select: { id: true } } } } },
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
  const current = cohorts.find((c) => c.program === "cissp" && c.status === "open" && c.startsAt.getTime() > now.getTime()) ?? cohorts.find((c) => c.program === "cissp" && c.status === "running") ?? null;
  const cohortVars = current ? { cohortName: current.name, cohortMonth: formatCohortMonth(current.startsAt) } : {};

  const items: QueueItem[] = [];

  for (const r of pendingReviews) {
    const h = hoursSince(r.createdAt, now);
    items.push({ kind: "review", id: r.id, leadId: r.lead.id, name: `${r.lead.firstName} ${r.lead.lastName}`, country: r.lead.country, readiness: r.readiness, heat: r.heatScore, hoursWaiting: h, late: h >= REVIEW_SLA_HOURS });
  }

  for (const b of todaysCalls) {
    const analysis = b.lead.scannerResponses[0]?.analysis as { timeline?: { label?: string } } | undefined;
    const consulting = b.serviceOrder ? { service: b.serviceOrder.service.name, number: b.serviceOrder.bookings.findIndex((x) => x.id === b.id) + 1, total: b.serviceOrder.sessionsTotal } : null;
    items.push({ kind: "call", bookingId: b.id, leadId: b.lead.id, name: `${b.lead.firstName} ${b.lead.lastName}`, when: formatWhen(b.startsAt, "Africa/Douala"), meetUrl: b.meetUrl, readiness: b.lead.readiness, heat: b.lead.heatScore, goals: b.lead.goals, timeline: analysis?.timeline?.label ?? null, consulting });
  }

  // Paid consulting sessions with no slot chosen: a nudge from Ben, not a chase.
  for (const o of await ordersAwaitingBooking(now)) {
    items.push({ kind: "session", orderId: o.id, leadId: o.lead.id, name: `${o.lead.firstName} ${o.lead.lastName}`, service: o.service.name, number: o.sessionsBooked + 1, total: o.sessionsTotal, daysSincePaid: o.daysSincePaid });
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
    items.push({ kind: "payment", registrationId: p.id, leadId: p.lead.id, name: `${p.lead.firstName} ${p.lead.lastName}`, reference: p.reference, amountUsd: firstDueUsd(p), cohortName: p.cohort.name, ageHours: hoursSince(p.createdAt, now) });
  }

  // Content rhythm (lot 7): drafts proposed automatically, waiting to be read.
  const drafts = await prisma.marketingPost.groupBy({ by: ["cohortId"], where: { autoDraft: true, publishedAt: null, scheduledFor: null }, _count: { _all: true } });
  if (drafts.length) {
    const names = await prisma.cohort.findMany({ where: { id: { in: drafts.map((d) => d.cohortId!).filter(Boolean) } }, select: { id: true, name: true } });
    for (const d of drafts) if (d.cohortId) items.push({ kind: "drafts", cohortId: d.cohortId, cohortName: names.find((n) => n.id === d.cohortId)?.name ?? "", count: d._count._all });
  }

  // Campaign plans (lot 5): the actions to validate whose date has come.
  for (const c of await campaignActions(now)) items.push(c);
  for (const a of await analystActions(now).catch(() => [])) items.push(a);

  // Playbook "inscription non finalisée" (lot 3): e-mailed 3 days ago, still unpaid: Ben calls.
  for (const u of await unfinishedCalls(now)) items.push(u);

  // Second instalments still due on the eve of the first day (Ben, 04/11): Ben decides, nothing automatic.
  const balances = await prisma.registration.findMany({
    where: { status: "paid", balanceUsd: { gt: 0 }, balancePaidAt: null, cohort: { startsAt: { lte: new Date(now.getTime() + BALANCE_ALERT_DAYS * 86_400_000), gte: new Date(now.getTime() - 60 * 86_400_000) } } },
    orderBy: { cohort: { startsAt: "asc" } },
    include: { lead: { select: { id: true, firstName: true, lastName: true, whatsapp: true } }, cohort: { select: { name: true, startsAt: true } } },
  });
  for (const b of balances) {
    if (!balanceAlert({ ...b, startsAt: b.cohort.startsAt }, now)) continue;
    items.push({ kind: "balance", registrationId: b.id, leadId: b.lead.id, name: `${b.lead.firstName} ${b.lead.lastName}`, reference: b.reference, balanceUsd: b.balanceUsd, cohortName: b.cohort.name, startsAt: b.cohort.startsAt, started: b.cohort.startsAt.getTime() <= now.getTime(), whatsapp: b.lead.whatsapp });
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

  // Personal calendars waiting for Ben's confirmation (Ben, 04/10).
  const proposals = await prisma.personalSchedule.findMany({
    where: { status: "proposed" },
    orderBy: { proposedAt: "asc" },
    include: { lead: { select: { id: true, firstName: true, lastName: true } }, cohort: { select: { id: true, name: true } } },
  });
  for (const p of proposals) {
    items.push({ kind: "personal", scheduleId: p.id, cohortId: p.cohort.id, leadId: p.lead.id, name: `${p.lead.firstName} ${p.lead.lastName}`, cohortName: p.cohort.name, hoursWaiting: hoursSince(p.proposedAt ?? p.updatedAt, now) });
  }

  // Requests to reopen expired replays (Ben, 12/10).
  const replayRequests = await prisma.replayAccess.findMany({
    where: { requestedAt: { not: null } },
    orderBy: { requestedAt: "asc" },
    include: { lead: { select: { id: true, firstName: true, lastName: true } }, cohort: { select: { id: true, name: true } } },
  });
  for (const r of replayRequests) {
    items.push({ kind: "replay", accessId: r.id, cohortId: r.cohort.id, leadId: r.lead.id, name: `${r.lead.firstName} ${r.lead.lastName}`, cohortName: r.cohort.name, note: r.requestNote ?? "" });
  }

  // Company quote requests not answered yet (Ben, 21/10).
  const quotes = await prisma.quoteRequest.findMany({ where: { status: "new" }, orderBy: { createdAt: "asc" } });
  for (const q of quotes) {
    items.push({ kind: "quote", quoteId: q.id, organization: q.organization, summary: quoteSummary(q as Parameters<typeof quoteSummary>[0]), contact: `${q.contactName} · ${countryLabel(q.country)}`, note: q.need ?? "" });
  }

  // Sensitive actions Claude prepared through the MCP plug (lot 3), waiting for Ben.
  const mcp = await Promise.resolve()
    .then(() => prisma.mcpRequest.findMany({ where: { status: "pending", expiresAt: { gt: now } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }))
    .catch(() => []);
  if (mcp.length) items.unshift({ kind: "mcp", count: mcp.length, oldest: mcp[0]!.createdAt });

  return {
    items,
    kpis: { leadsThisWeek, callsThisWeek, confirmed: current?.gauge.confirmed ?? 0, capacity: current?.capacity ?? 10, cohortName: current?.name ?? null },
  };
}

/**
 * Unfinished checkouts the playbook e-mailed at least 3 days ago that are
 * still unpaid, and that Ben has not marked as handled: one call each.
 */
async function unfinishedCalls(now: Date): Promise<QueueItem[]> {
  const logs = await prisma.actionLog.findMany({
    where: { type: { in: ["playbook_unfinished", "playbook_unfinished_done"] }, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
    orderBy: { createdAt: "asc" },
    select: { type: true, leadId: true, createdAt: true, payload: true },
  });
  const handled = new Set(logs.filter((l) => l.type === "playbook_unfinished_done").map((l) => (l.payload as { registrationId?: number } | null)?.registrationId));
  const due = logs.filter((l) => l.type === "playbook_unfinished" && unfinishedCallDue(l.createdAt, now) && !handled.has((l.payload as { registrationId?: number } | null)?.registrationId));
  if (!due.length) return [];
  const ids = due.map((l) => Number((l.payload as { registrationId?: number }).registrationId)).filter(Number.isFinite);
  const regs = await prisma.registration.findMany({
    where: { id: { in: ids }, status: "pending" },
    include: { cohort: { select: { id: true, name: true, program: true } }, lead: { select: { id: true, firstName: true, lastName: true, email: true, whatsapp: true, unsubscribedAt: true, registrations: { where: { status: "paid" }, select: { cohortId: true } } } } },
  });
  return regs.flatMap((r) => {
    if (r.lead.unsubscribedAt || r.lead.registrations.some((p) => p.cohortId === r.cohort.id)) return [];
    const log = due.find((l) => (l.payload as { registrationId?: number }).registrationId === r.id)!;
    const text = r.cohort.program === "ia"
      ? `Bonjour ${r.lead.firstName}, vous avez commencé votre inscription au Bâtisseur IA sans la terminer. Un souci de paiement ou une question ? Nous pouvons vous aider.`
      : `Bonjour ${r.lead.firstName}, vous avez commencé votre inscription (${r.cohort.name}) sans la terminer. Un souci de paiement ou une question ? Je peux vous aider.`;
    return [{ kind: "unfinished" as const, registrationId: r.id, leadId: r.lead.id, name: `${r.lead.firstName} ${r.lead.lastName}`, reference: r.reference, cohortName: r.cohort.name, days: Math.floor((now.getTime() - log.createdAt.getTime()) / 86_400_000), waLink: r.lead.whatsapp ? waMeLink(r.lead.whatsapp, text) : null, email: r.lead.email }];
  });
}

/** The orientations Ben kept from the analyst (08/11), for two weeks, until marked done. */
async function analystActions(now: Date): Promise<QueueItem[]> {
  const reports = await prisma.analystReport.findMany({ where: { createdAt: { gte: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } }, select: { weekKey: true, output: true, decisions: true } });
  if (!reports.length) return [];
  const done = new Set((await prisma.actionLog.findMany({ where: { type: "analyst_done" }, select: { payload: true } })).map((d) => { const p = d.payload as { week?: string; rank?: number } | null; return `${p?.week}#${p?.rank}`; }));
  return reports.flatMap((r) => {
    const out = outputSchema.safeParse(r.output);
    if (!out.success) return [];
    const decisions = readDecisions(r.decisions);
    return out.data.bets.flatMap((b, i) => (decisions[String(i + 1)]?.status === "kept" && !done.has(`${r.weekKey}#${i + 1}`) ? [{ kind: "analyst" as const, week: r.weekKey, rank: i + 1, title: b.title, action: b.action, watch: `${b.watch.metric} : ${b.watch.target}` }] : []));
  });
}

/** The campaign actions waiting for Ben (lot 5): "à valider", due, not marked done. */
async function campaignActions(now: Date): Promise<QueueItem[]> {
  const cohorts = await prisma.cohort.findMany({
    where: { campaign: { not: Prisma.DbNull }, endsAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
    select: { id: true, program: true, name: true, startsAt: true, endsAt: true, capacity: true, targetSeats: true, campaign: true },
  });
  if (!cohorts.length) return [];
  const done = new Set(
    (await prisma.actionLog.findMany({ where: { type: "campaign_done" }, select: { payload: true } }))
      .map((l) => l.payload as { cohortId?: number; key?: string } | null)
      .map((p) => `${p?.cohortId}:${p?.key}`),
  );
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return cohorts.flatMap((c) => {
    const campaign = readCampaign(c.campaign);
    if (!campaign) return [];
    const plan = buildCampaignPlan({ program: c.program, startsAt: c.startsAt, endsAt: c.endsAt, goal: c.targetSeats ?? c.capacity }, campaign);
    const doneHere = new Set([...done].filter((k) => k.startsWith(`${c.id}:`)).map((k) => k.slice(String(c.id).length + 1)));
    return dueActions(plan, doneHere, now).map((a) => ({ kind: "campaign" as const, cohortId: c.id, key: a.key, cohortName: c.name, text: a.text, by: a.by, href: a.href ?? null, dueLabel: fmt.format(a.date) }));
  });
}
