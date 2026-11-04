import { NextResponse, type NextRequest } from "next/server";

import { markServiceOrderPaid } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { checkTransaction, parseWebhook } from "@/lib/payments/netticket";
import { firstDueUsd } from "@/lib/installments";
import { markBalancePaid, markRegistrationPaid } from "@/lib/registration";

export const dynamic = "force-dynamic";

/**
 * Netticket → us. The `verif-hash` header is a shared secret, so a valid
 * header only earns the notification a server-side re-check; the re-check
 * is what marks the seat paid (docs/NETTICKET.md, constat 1).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const event = parseWebhook(raw, request.headers.get("verif-hash"));
  if (!event) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The transaction belongs to a seat, to the second instalment of a seat, or to a consulting order.
  const registration = await prisma.registration.findFirst({ where: { netticketTransactionId: event.id } });
  const balanceOf = registration ? null : await prisma.registration.findFirst({ where: { balanceNetticketTransactionId: event.id } });
  const order = registration || balanceOf ? null : await prisma.serviceOrder.findFirst({ where: { netticketTransactionId: event.id } });
  const target = registration ?? balanceOf ?? order;
  if (!target) {
    console.warn(`[netticket webhook] transaction inconnue ${event.id} (${event.txRef})`);
    return NextResponse.json({ received: true, unknown: true });
  }

  if (event.status !== "successful") {
    await prisma.actionLog.create({ data: { leadId: target.leadId, type: "netticket_status", payload: { status: event.status, transactionId: event.id } } });
    return NextResponse.json({ received: true, status: event.status });
  }

  const verified = await checkTransaction(event.id);
  if (verified !== "successful") {
    await prisma.actionLog.create({ data: { leadId: target.leadId, type: "netticket_webhook_unverified", payload: { transactionId: event.id, verified } } });
    return NextResponse.json({ received: true, verified });
  }

  if (balanceOf) {
    const result = await markBalancePaid({ reference: balanceOf.reference, amountPaidUsdCents: balanceOf.balanceUsd, paidAt: new Date(), method: "netticket", netticketTransactionId: event.id });
    return NextResponse.json({ received: true, ...result });
  }
  if (registration) {
    const result = await markRegistrationPaid({ reference: registration.reference, amountPaidUsdCents: firstDueUsd(registration), paidAt: new Date(), netticketTransactionId: event.id });
    return NextResponse.json({ received: true, ...result });
  }
  const result = await markServiceOrderPaid({
    reference: target.reference,
    // Netticket prices the ticket in XAF; the USD amount is ours by construction of the tier.
    amountPaidUsdCents: target.amountUsd,
    paidAt: new Date(),
    netticketTransactionId: event.id,
  });
  return NextResponse.json({ received: true, ...result });
}
