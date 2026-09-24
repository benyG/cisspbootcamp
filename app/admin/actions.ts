"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { nextFollowupAt, postponedAt } from "@/lib/followups";
import { markRegistrationPaid } from "@/lib/registration";
import { holdSeat, releaseHold } from "@/lib/seat-holds";
import { sendAfterCallEmail } from "@/lib/followups-auto";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();

/** After the call (SPECS A3): the outcome drives the lead's next state. */
export async function markCallOutcome(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ bookingId: id, outcome: z.enum(["registered", "to_follow_up", "not_now", "not_qualified", "no_show"]) })
    .safeParse({ bookingId: formData.get("bookingId"), outcome: formData.get("outcome") });
  if (!parsed.success) return;
  const { bookingId, outcome } = parsed.data;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  const now = new Date();
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
  // The payment link leaves the same day, whatever Ben's longer message says later.
  if (booking.kind === "discovery" && (outcome === "registered" || outcome === "to_follow_up")) {
    await sendAfterCallEmail(booking.leadId, outcome);
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/leads/${booking.leadId}`);
}

/** "Envoyé": Ben pressed send in WhatsApp or his mailer; advance the sequence. */
export async function followupSent(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ leadId: id, channel: z.enum(["whatsapp", "email"]) }).safeParse({ leadId: formData.get("leadId"), channel: formData.get("channel") });
  if (!parsed.success) return;
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, include: { registrations: { where: { status: { in: ["pending", "pending_manual"] } }, take: 1 } } });
  if (!lead) return;

  const track = lead.registrations.length ? "unpaid" : lead.status === "called" ? "afterCall" : "scanner";
  const count = lead.followupCount + 1;
  const now = new Date();
  await prisma.$transaction([
    prisma.lead.update({ where: { id: lead.id }, data: { followupCount: count, nextFollowupAt: nextFollowupAt(track, count, now), status: lead.status === "new" ? "contacted" : lead.status } }),
    prisma.actionLog.create({ data: { leadId: lead.id, type: "followup_sent", channel: parsed.data.channel, payload: { track, count } } }),
  ]);
  revalidatePath("/admin");
  revalidatePath(`/admin/leads/${lead.id}`);
}

export async function followupPostpone(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId.data }, data: { nextFollowupAt: postponedAt(new Date()) } }),
    prisma.actionLog.create({ data: { leadId: leadId.data, type: "followup_postponed" } }),
  ]);
  revalidatePath("/admin");
}

/** Netticket fallback mode (SPECS A4): Ben saw the money, confirms by hand. */
export async function confirmManualPayment(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ registrationId: id, transactionId: z.string().trim().max(120).optional().or(z.literal("")) })
    .safeParse({ registrationId: formData.get("registrationId"), transactionId: formData.get("transactionId") });
  if (!parsed.success) return;
  const registration = await prisma.registration.findUnique({ where: { id: parsed.data.registrationId } });
  if (!registration) return;

  await markRegistrationPaid({
    reference: registration.reference,
    amountPaidUsdCents: registration.amountUsd,
    paidAt: new Date(),
    netticketTransactionId: parsed.data.transactionId || `manuel-${Date.now()}`,
  });
  await prisma.actionLog.create({ data: { leadId: registration.leadId, type: "payment_confirmed_manually", payload: { registrationId: registration.id } } });
  revalidatePath("/admin");
  revalidatePath("/admin/cohortes");
}

/** "Inviter à réserver": logged as a contact; the message itself goes via wa.me. */
export async function inviteToBook(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId.data }, data: { status: "contacted", nextFollowupAt: nextFollowupAt("scanner", 0, new Date()), followupCount: 0 } }),
    prisma.actionLog.create({ data: { leadId: leadId.data, type: "invited_to_book", channel: "whatsapp" } }),
  ]);
  revalidatePath("/admin");
}

/** "Tenir la place 48 h" from the lead sheet (docs/CONVERSION.md §2.4). */
export async function holdSeatAction(formData: FormData): Promise<void> {
  await auth();
  const leadId = id.parse(formData.get("leadId"));
  const result = await holdSeat(leadId);
  if (!result.ok) {
    await prisma.actionLog.create({ data: { leadId, type: "seat_hold_refused", payload: { error: result.error } } });
  }
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

export async function releaseHoldAction(formData: FormData): Promise<void> {
  await auth();
  const holdId = id.parse(formData.get("holdId"));
  const leadId = id.parse(formData.get("leadId"));
  await releaseHold(holdId, "manual");
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}
