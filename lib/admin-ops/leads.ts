import type { LeadStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { nextFollowupAt, postponedAt } from "@/lib/followups";
import { sendAfterCallEmail } from "@/lib/followups-auto";

/**
 * What the admin does to a lead, once, for both the admin forms and the MCP
 * plug (docs/MCP.md). No session check here: the callers own that.
 */

export type OpResult = { ok: true; message: string } | { ok: false; error: string };

export type LeadPatch = { status?: LeadStatus; notes?: string | null; tags?: string[]; nextFollowupAt?: Date | null };

/** Only the fields given change. "Inscrit" follows a paid seat; the field alone never makes someone a participant. */
export async function updateLeadFields(leadId: number, patch: LeadPatch): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { ok: false, error: `Aucun prospect n°${leadId}.` };
  const refuseRegistered = patch.status === "registered" && (await prisma.registration.count({ where: { leadId, status: "paid" } })) === 0;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(patch.status && !refuseRegistered ? { status: patch.status } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.nextFollowupAt !== undefined ? { nextFollowupAt: patch.nextFollowupAt } : {}),
    },
  });
  return { ok: true, message: refuseRegistered ? "Fiche mise à jour, mais le statut « inscrit » n’a pas été mis : aucune place payée." : "Fiche mise à jour." };
}

/** A dated line added under the existing notes. */
export async function appendLeadNote(leadId: number, note: string, now = new Date()): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { notes: true } });
  if (!lead) return { ok: false, error: `Aucun prospect n°${leadId}.` };
  const line = `[${now.toISOString().slice(0, 10)}] ${note.trim()}`;
  await prisma.lead.update({ where: { id: leadId }, data: { notes: lead.notes ? `${lead.notes}\n${line}` : line } });
  return { ok: true, message: "Note ajoutée." };
}

export async function markLeadLost(leadId: number): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { ok: false, error: `Aucun prospect n°${leadId}.` };
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { status: "lost", nextFollowupAt: null } }),
    prisma.actionLog.create({ data: { leadId, type: "marked_lost" } }),
  ]);
  return { ok: true, message: "Prospect marqué perdu ; plus de relance." };
}

export async function postponeFollowup(leadId: number, now = new Date()): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { ok: false, error: `Aucun prospect n°${leadId}.` };
  const at = postponedAt(now);
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { nextFollowupAt: at } }),
    prisma.actionLog.create({ data: { leadId, type: "followup_postponed" } }),
  ]);
  return { ok: true, message: `Relance reportée au ${at.toISOString().slice(0, 10)}.` };
}

/** Restarts the after-call follow-up sequence. */
export async function restartFollowup(leadId: number, now = new Date()): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { ok: false, error: `Aucun prospect n°${leadId}.` };
  await prisma.lead.update({ where: { id: leadId }, data: { nextFollowupAt: nextFollowupAt("afterCall", 0, now), followupCount: 0 } });
  return { ok: true, message: "Relances relancées depuis le début." };
}

/** "Envoyé": Ben sent the follow-up himself (WhatsApp or his mailer); the sequence moves on. */
export async function recordFollowupSent(leadId: number, channel: "whatsapp" | "email", now = new Date()): Promise<OpResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { registrations: { where: { status: { in: ["pending", "pending_manual"] } }, take: 1 } } });
  if (!lead) return { ok: false, error: `Aucun prospect n°${leadId}.` };
  const track = lead.registrations.length ? "unpaid" : lead.status === "called" ? "afterCall" : "scanner";
  const count = lead.followupCount + 1;
  const next = nextFollowupAt(track, count, now);
  await prisma.$transaction([
    prisma.lead.update({ where: { id: lead.id }, data: { followupCount: count, nextFollowupAt: next, status: lead.status === "new" ? "contacted" : lead.status } }),
    prisma.actionLog.create({ data: { leadId: lead.id, type: "followup_sent", channel, payload: { track, count } } }),
  ]);
  return { ok: true, message: next ? `Relance notée. Prochaine le ${next.toISOString().slice(0, 10)}.` : "Relance notée. Fin de la séquence." };
}

/** An unfinished checkout Ben handled (called, wrote, or gave up): it leaves the queue. */
export async function markUnfinishedHandled(registrationId: number): Promise<OpResult> {
  const r = await prisma.registration.findUnique({ where: { id: registrationId }, select: { leadId: true, status: true } });
  if (!r) return { ok: false, error: `Aucune inscription n°${registrationId}.` };
  await prisma.actionLog.create({ data: { type: "playbook_unfinished_done", leadId: r.leadId, payload: { registrationId } } });
  return { ok: true, message: "Inscription inachevée retirée de la file." };
}

export const CALL_OUTCOMES = ["registered", "to_follow_up", "not_now", "not_qualified", "no_show"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

/**
 * After the call (SPECS A3): the outcome drives the lead's next state. For a
 * discovery call that ends in "registered" or "to_follow_up", the after-call
 * e-mail with the payment link leaves the same day, as from the admin.
 */
export async function recordCallOutcome(bookingId: number, outcome: CallOutcome, now = new Date()): Promise<OpResult & { leadId?: number }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: `Aucun rendez-vous n°${bookingId}.` };
  const leadUpdate =
    outcome === "registered" ? { status: "called" as const, nextFollowupAt: nextFollowupAt("unpaid", 0, now), followupCount: 0 }
    : outcome === "to_follow_up" ? { status: "called" as const, nextFollowupAt: nextFollowupAt("afterCall", 0, now), followupCount: 0 }
    : outcome === "not_now" ? { status: "nurture" as const, nextFollowupAt: new Date(now.getTime() + 90 * 86_400_000), followupCount: 0 }
    : outcome === "not_qualified" ? { status: "lost" as const, nextFollowupAt: null }
    : { status: "contacted" as const, nextFollowupAt: nextFollowupAt("scanner", 0, now), followupCount: 0 }; // no_show → back to the scanner track

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: outcome === "no_show" ? "no_show" : "done", outcome } }),
    prisma.lead.update({ where: { id: booking.leadId }, data: leadUpdate }),
    prisma.actionLog.create({ data: { leadId: booking.leadId, type: "call_outcome", payload: { bookingId, outcome } } }),
  ]);
  const emails = booking.kind === "discovery" && (outcome === "registered" || outcome === "to_follow_up");
  if (emails) await sendAfterCallEmail(booking.leadId, outcome);
  return { ok: true, leadId: booking.leadId, message: `Résultat enregistré.${emails ? " L’e-mail d’après-appel est parti." : ""}` };
}
