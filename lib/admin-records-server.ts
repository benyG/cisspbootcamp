import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { PROGRAMS } from "@/lib/programs";

import {
  BUSINESS_KEY,
  type Business,
  PRIVACY_LABEL,
  type PrivacyKind,
  RECEIPT_SEQUENCE,
  type ReceiptKind,
  type Recurrence,
  anonymizedIdentity,
  deadlineReminder,
  formatReceiptNumber,
  nextOccurrence,
  receiptSource,
  resolveBusiness,
  retentionCutoff,
} from "./admin-records";

/**
 * Lot B · Administratif, the database side: numbered receipts issued on
 * every payment (and caught up by the cron), anonymisation instead of
 * deletion when paid records must stay, retention, data requests and
 * deadlines with their reminders.
 */

export async function loadBusiness(): Promise<Business> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: BUSINESS_KEY } });
    return resolveBusiness(row?.value);
  } catch {
    return resolveBusiness(null);
  }
}

export async function saveBusiness(next: Business): Promise<void> {
  const value = resolveBusiness(next);
  await prisma.siteSetting.upsert({ where: { key: BUSINESS_KEY }, create: { key: BUSINESS_KEY, value }, update: { value } });
}

// ── Receipts ────────────────────────────────────────────────────────────────

type Draft = {
  kind: ReceiptKind;
  leadId: number;
  registrationId: number | null;
  serviceOrderId: number | null;
  reference: string;
  buyerName: string;
  buyerEmail: string;
  buyerCountry: string;
  label: string;
  amountUsd: number;
  method: "stripe" | "netticket" | "manual";
  paymentNote: string | null;
  paidAt: Date;
};

async function draftFor(kind: ReceiptKind, id: number): Promise<Draft | null> {
  if (kind === "service") {
    const o = await prisma.serviceOrder.findUnique({ where: { id }, include: { lead: true, service: { select: { name: true } } } });
    if (!o || o.status !== "paid" || !o.paidAt) return null;
    return { kind, leadId: o.leadId, registrationId: null, serviceOrderId: o.id, reference: o.reference, buyerName: `${o.lead.firstName} ${o.lead.lastName}`.trim(), buyerEmail: o.lead.email, buyerCountry: o.lead.country, label: o.service.name, amountUsd: o.amountUsd, method: o.method, paymentNote: null, paidAt: o.paidAt };
  }
  const r = await prisma.registration.findUnique({ where: { id }, include: { lead: true, cohort: { select: { name: true, program: true } } } });
  if (!r || r.status !== "paid" || !r.paidAt) return null;
  const product = `${PROGRAMS[r.cohort.program].productName} — ${r.cohort.name}`;
  const base = { leadId: r.leadId, registrationId: r.id, serviceOrderId: null, reference: r.reference, buyerName: `${r.lead.firstName} ${r.lead.lastName}`.trim(), buyerEmail: r.lead.email, buyerCountry: r.lead.country };
  if (kind === "balance") {
    if (r.balanceUsd <= 0 || !r.balancePaidAt) return null;
    return { ...base, kind, label: `${product} · solde`, amountUsd: r.balanceUsd, method: r.balanceMethod ?? r.method, paymentNote: r.balanceNote, paidAt: r.balancePaidAt };
  }
  return { ...base, kind, label: r.balanceUsd > 0 ? `${product} · premier versement` : product, amountUsd: r.amountUsd - r.balanceUsd, method: r.method, paymentNote: r.paymentNote, paidAt: r.paidAt };
}

/**
 * Issues the receipt of one payment, numbered next in the sequence, once.
 * The counter moves inside the same transaction as the insert, so a failed
 * insert leaves no hole. Never throws: the cron catches up anything missed.
 */
export async function issueReceipt(kind: ReceiptKind, id: number): Promise<{ number: string } | null> {
  try {
    const source = receiptSource(kind, id);
    const existing = await prisma.receipt.findUnique({ where: { source }, select: { number: true } });
    if (existing) return existing;
    const draft = await draftFor(kind, id);
    if (!draft) return null;
    return await prisma.$transaction(async (tx) => {
      const again = await tx.receipt.findUnique({ where: { source }, select: { number: true } });
      if (again) return again;
      const seq = await tx.sequence.upsert({ where: { name: RECEIPT_SEQUENCE }, create: { name: RECEIPT_SEQUENCE, value: 1 }, update: { value: { increment: 1 } } });
      const number = formatReceiptNumber(seq.value);
      await tx.receipt.create({ data: { ...draft, number, source } });
      return { number };
    });
  } catch (error) {
    console.error("[receipt]", kind, id, error);
    return null;
  }
}

/** Payments without a receipt yet, oldest first (the cron, and payments made before lot B). */
export async function issueMissingReceipts(limit = 40): Promise<number> {
  const have = new Set((await prisma.receipt.findMany({ select: { source: true } })).map((r) => r.source));
  const [regs, orders] = await Promise.all([
    prisma.registration.findMany({ where: { status: "paid", paidAt: { not: null } }, select: { id: true, paidAt: true, balanceUsd: true, balancePaidAt: true } }),
    prisma.serviceOrder.findMany({ where: { status: "paid", paidAt: { not: null } }, select: { id: true, paidAt: true } }),
  ]);
  const todo: Array<{ kind: ReceiptKind; id: number; at: Date }> = [];
  for (const r of regs) {
    if (!have.has(receiptSource("registration", r.id))) todo.push({ kind: "registration", id: r.id, at: r.paidAt! });
    if (r.balanceUsd > 0 && r.balancePaidAt && !have.has(receiptSource("balance", r.id))) todo.push({ kind: "balance", id: r.id, at: r.balancePaidAt });
  }
  for (const o of orders) if (!have.has(receiptSource("service", o.id))) todo.push({ kind: "service", id: o.id, at: o.paidAt! });
  todo.sort((a, b) => a.at.getTime() - b.at.getTime());
  let issued = 0;
  for (const t of todo.slice(0, limit)) if (await issueReceipt(t.kind, t.id)) issued++;
  return issued;
}

// ── Deletion, anonymisation, retention ──────────────────────────────────────

/**
 * What "supprimer" does (lot B): a lead with nothing paid is deleted
 * entirely; a lead with a payment is anonymised, so the seat stays counted
 * and the receipts stay in the accounts (their copy of the name is kept
 * there, as the accounts require).
 */
export async function eraseLead(leadId: number, now = new Date()): Promise<"deleted" | "anonymized" | "not_found"> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, anonymizedAt: true } });
  if (!lead) return "not_found";
  const [paidRegs, paidOrders, receipts] = await Promise.all([
    prisma.registration.count({ where: { leadId, status: "paid" } }),
    prisma.serviceOrder.count({ where: { leadId, status: "paid" } }),
    prisma.receipt.count({ where: { leadId } }),
  ]);
  if (!paidRegs && !paidOrders && !receipts) {
    await prisma.lead.delete({ where: { id: leadId } });
    return "deleted";
  }
  await issueMissingReceipts(200);
  await prisma.$transaction([
    prisma.scannerResponse.deleteMany({ where: { leadId } }),
    prisma.funnelEvent.deleteMany({ where: { leadId } }),
    prisma.actionLog.deleteMany({ where: { leadId } }),
    prisma.practiceTest.deleteMany({ where: { leadId } }),
    prisma.iaDiagnostic.deleteMany({ where: { leadId } }),
    prisma.iaPlan.deleteMany({ where: { leadId } }),
    prisma.seatHold.deleteMany({ where: { leadId } }),
    prisma.personalSchedule.deleteMany({ where: { leadId } }),
    prisma.replayAccess.deleteMany({ where: { leadId } }),
    prisma.replayGrant.deleteMany({ where: { leadId } }),
    prisma.booking.deleteMany({ where: { leadId, serviceOrderId: null } }),
    prisma.registration.deleteMany({ where: { leadId, status: { not: "paid" } } }),
    prisma.serviceOrder.deleteMany({ where: { leadId, status: { not: "paid" } } }),
    prisma.lead.update({ where: { id: leadId }, data: { ...anonymizedIdentity(leadId), tags: undefined, anonymizedAt: lead.anonymizedAt ?? now, unsubscribedAt: now } }),
  ]);
  return "anonymized";
}

/** Prospects who never paid and show no activity for three years: proposed for deletion. */
export async function retentionCandidates(now = new Date()): Promise<Array<{ id: number; name: string; lastSeen: Date }>> {
  const cutoff = retentionCutoff(now);
  const rows = await prisma.lead.findMany({
    where: {
      anonymizedAt: null,
      updatedAt: { lt: cutoff },
      registrations: { none: { status: "paid" } },
      serviceOrders: { none: { status: "paid" } },
      receipts: { none: {} },
      bookings: { none: { startsAt: { gte: cutoff } } },
      actions: { none: { createdAt: { gte: cutoff } } },
    },
    select: { id: true, firstName: true, lastName: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });
  return rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), lastSeen: r.updatedAt }));
}

// ── Reminders: deadlines and data requests ──────────────────────────────────

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** J-15 and J-3 e-mails to Ben, each once (actions_log "admin_reminder"). */
export async function sendAdminReminders(now = new Date()): Promise<number> {
  const [deadlines, requests] = await Promise.all([
    prisma.adminDeadline.findMany({ where: { doneAt: null } }),
    prisma.privacyRequest.findMany({ where: { doneAt: null } }),
  ]);
  const due: Array<{ key: string; line: string }> = [];
  for (const d of deadlines) {
    const level = deadlineReminder(d.dueAt, now);
    if (level) due.push({ key: `deadline:${d.id}:${d.dueAt.toISOString().slice(0, 10)}:${level}`, line: `• ${d.title} : le ${DAY.format(d.dueAt)}` });
  }
  for (const r of requests) {
    const level = deadlineReminder(r.dueAt, now);
    if (level) due.push({ key: `privacy:${r.id}:${level}`, line: `• Demande « ${PRIVACY_LABEL[r.kind as PrivacyKind] ?? r.kind} » de ${r.email} : réponse avant le ${DAY.format(r.dueAt)}` });
  }
  const fresh: typeof due = [];
  for (const d of due) {
    const seen = await prisma.actionLog.findFirst({ where: { type: "admin_reminder", payload: { path: "$.key", equals: d.key } }, select: { id: true } });
    if (!seen) fresh.push(d);
  }
  if (!fresh.length) return 0;
  const sent = await sendEmail({
    to: env.ADMIN_EMAIL,
    subject: fresh.length > 1 ? `${fresh.length} échéances administratives approchent` : "Une échéance administrative approche",
    text: `${fresh.map((f) => f.line).join("\n")}\n\nTout est dans ${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/admin/administratif`,
  }).catch(() => ({ sent: false as const, reason: "error" }));
  if (!sent.sent) return 0;
  await prisma.actionLog.createMany({ data: fresh.map((f) => ({ type: "admin_reminder", leadId: null, payload: { key: f.key } })) });
  return fresh.length;
}

/** Marks a deadline done; a recurring one comes back at its next date. */
export async function completeDeadline(id: number, now = new Date()): Promise<void> {
  const d = await prisma.adminDeadline.findUnique({ where: { id } });
  if (!d || d.doneAt) return;
  const next = nextOccurrence(d.dueAt, d.recurrence as Recurrence);
  await prisma.$transaction([
    prisma.adminDeadline.update({ where: { id }, data: { doneAt: now } }),
    ...(next ? [prisma.adminDeadline.create({ data: { title: d.title, dueAt: next, recurrence: d.recurrence, note: d.note } })] : []),
  ]);
}

/** Everything we hold on one person, for an access request (RGPD art. 15). */
export async function leadDataExport(leadId: number): Promise<Record<string, unknown> | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { scannerResponses: true, bookings: true, registrations: true, serviceOrders: true, funnelEvents: true, seatHolds: true, iaDiagnostics: true, iaPlans: true, receipts: true, privacyRequests: true },
  });
  if (!lead) return null;
  // The unsubscribe token is a credential, not data about the person.
  return { exportedAt: new Date().toISOString(), ...lead, unsubscribeToken: undefined };
}
