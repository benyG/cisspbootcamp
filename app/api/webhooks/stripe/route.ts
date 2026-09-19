import { NextResponse, type NextRequest } from "next/server";

import { confirmationFromEvent, parseWebhook } from "@/lib/payments/stripe";
import { markRegistrationPaid } from "@/lib/registration";

export const dynamic = "force-dynamic";

/**
 * Stripe → us. The raw body is needed for signature verification, so this
 * route reads text, never JSON. A bad signature is a 400 (Stripe retries an
 * hour later); an unknown reference is logged and acknowledged so Stripe
 * stops retrying something we will never match.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();

  let event;
  try {
    event = parseWebhook(raw, request.headers.get("stripe-signature"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "signature invalide";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const confirmation = confirmationFromEvent(event);
  if (!confirmation) return NextResponse.json({ received: true, ignored: event.type });

  const result = await markRegistrationPaid({
    reference: confirmation.reference,
    amountPaidUsdCents: confirmation.amountPaidUsdCents,
    paidAt: confirmation.paidAt,
    stripeSessionId: confirmation.stripeSessionId,
  });

  if (!result.ok) {
    console.error("[stripe webhook]", result.error);
    return NextResponse.json({ received: true, error: result.error });
  }

  return NextResponse.json({ received: true, alreadyPaid: result.alreadyPaid });
}
