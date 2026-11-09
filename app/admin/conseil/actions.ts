"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { confirmServiceOrder, remindSessionBookingCore } from "@/lib/admin-ops/sensitive";
import { prisma } from "@/lib/db";
import { isServiceCode } from "@/lib/services";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();

/** Switch a service on or off, and set its prices and Netticket codes per tier. */
export async function updateService(formData: FormData): Promise<void> {
  await requireAdmin();
  const code = formData.get("code");
  if (!isServiceCode(code)) return;
  const active = formData.get("active") === "on";
  await prisma.service.update({ where: { code }, data: { active } });

  const tiers = await prisma.pricingTier.findMany({ select: { code: true } });
  for (const tier of tiers) {
    const amount = z.coerce.number().int().min(0).max(1_000_000).safeParse(formData.get(`price_${tier.code}`));
    if (!amount.success) continue;
    const ticket = z.string().trim().max(64).safeParse(formData.get(`ticket_${tier.code}`) ?? "");
    await prisma.servicePrice.upsert({
      where: { serviceCode_tier: { serviceCode: code, tier: tier.code } },
      create: { serviceCode: code, tier: tier.code, amountUsd: amount.data * 100, netticketTicketCode: ticket.success && ticket.data ? ticket.data : null },
      update: { amountUsd: amount.data * 100, netticketTicketCode: ticket.success && ticket.data ? ticket.data : null },
    });
  }
  revalidatePath("/admin/conseil");
  revalidatePath("/conseil");
  revalidatePath("/");
}

/** Netticket fallback mode: Ben saw the money, confirms the order by hand. */
export async function confirmServicePayment(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ orderId: id, transactionId: z.string().trim().max(120).optional().or(z.literal("")) }).safeParse({ orderId: formData.get("orderId"), transactionId: formData.get("transactionId") });
  if (!parsed.success) return;
  await confirmServiceOrder(parsed.data.orderId, parsed.data.transactionId || null);
  revalidatePath("/admin");
  revalidatePath("/admin/conseil");
}

/** Re-sends the booking link to a client who paid but has not booked. */
export async function remindSessionBooking(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderId = id.safeParse(formData.get("orderId"));
  if (!orderId.success) return;
  await remindSessionBookingCore(orderId.data);
  revalidatePath("/admin");
  revalidatePath("/admin/conseil");
}

/** After a consulting session: done, or the client did not show. */
export async function markSessionOutcome(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ bookingId: id, outcome: z.enum(["done", "no_show"]) }).safeParse({ bookingId: formData.get("bookingId"), outcome: formData.get("outcome") });
  if (!parsed.success) return;
  const booking = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || booking.kind !== "consulting") return;
  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: parsed.data.outcome } }),
    prisma.actionLog.create({ data: { leadId: booking.leadId, type: "session_outcome", payload: { bookingId: booking.id, outcome: parsed.data.outcome } } }),
  ]);
  revalidatePath("/admin");
  revalidatePath(`/admin/leads/${booking.leadId}`);
}
