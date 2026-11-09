"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CALL_OUTCOMES, markUnfinishedHandled, postponeFollowup, recordCallOutcome, recordFollowupSent } from "@/lib/admin-ops/leads";
import { nextFollowupAt } from "@/lib/followups";
import { firstDueUsd } from "@/lib/installments";
import { markBalancePaid, markRegistrationPaid } from "@/lib/registration";
import { holdSeat, releaseHold } from "@/lib/seat-holds";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();

/** After the call (SPECS A3): the outcome drives the lead's next state. */
export async function markCallOutcome(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ bookingId: id, outcome: z.enum(CALL_OUTCOMES) })
    .safeParse({ bookingId: formData.get("bookingId"), outcome: formData.get("outcome") });
  if (!parsed.success) return;
  const result = await recordCallOutcome(parsed.data.bookingId, parsed.data.outcome);
  revalidatePath("/admin");
  if (result.ok && result.leadId) revalidatePath(`/admin/leads/${result.leadId}`);
}

/** "Envoyé": Ben pressed send in WhatsApp or his mailer; advance the sequence. */
export async function followupSent(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ leadId: id, channel: z.enum(["whatsapp", "email"]) }).safeParse({ leadId: formData.get("leadId"), channel: formData.get("channel") });
  if (!parsed.success) return;
  await recordFollowupSent(parsed.data.leadId, parsed.data.channel);
  revalidatePath("/admin");
  revalidatePath(`/admin/leads/${parsed.data.leadId}`);
}

export async function followupPostpone(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await postponeFollowup(leadId.data);
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
    amountPaidUsdCents: firstDueUsd(registration),
    paidAt: new Date(),
    netticketTransactionId: parsed.data.transactionId || `manuel-${Date.now()}`,
  });
  await prisma.actionLog.create({ data: { leadId: registration.leadId, type: "payment_confirmed_manually", payload: { registrationId: registration.id } } });
  revalidatePath("/admin");
  revalidatePath("/admin/cohortes");
}

/**
 * A second instalment that reached Ben outside the app (transfer, cash,
 * Netticket's purchase page): his manual confirmation (CLAUDE.md, Paiement).
 */
export async function confirmBalancePayment(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ registrationId: id, note: z.string().trim().max(200).optional().or(z.literal("")) })
    .safeParse({ registrationId: formData.get("registrationId"), note: formData.get("note") ?? "" });
  if (!parsed.success) return;
  const registration = await prisma.registration.findUnique({ where: { id: parsed.data.registrationId } });
  if (!registration || registration.balanceUsd <= 0 || registration.balancePaidAt) return;
  const result = await markBalancePaid({ reference: registration.reference, amountPaidUsdCents: registration.balanceUsd, paidAt: new Date(), method: "manual", note: parsed.data.note || "confirmé par Ben" });
  if (result.ok && !result.alreadyPaid) await prisma.actionLog.create({ data: { leadId: registration.leadId, type: "balance_confirmed_manually", payload: { registrationId: registration.id } } });
  revalidatePath("/admin");
  revalidatePath(`/admin/leads/${registration.leadId}`);
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

/** Ben handled an unfinished checkout (called, wrote, or gave up): it leaves the queue. */
export async function unfinishedHandled(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
  await markUnfinishedHandled(id.parse(formData.get("registrationId")));
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
