import Stripe from "stripe";

/**
 * Stripe Checkout for card payments — SPECS A4.
 *
 * Two rules from CLAUDE.md are enforced here and nowhere else:
 *   - a registration becomes `paid` only from a webhook whose signature we
 *     verified; the browser's return URL proves nothing;
 *   - amounts are integers in the currency's minor unit, USD as reference.
 */

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();
  return (client ??= new Stripe(key));
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY manquante");
    this.name = "StripeNotConfiguredError";
  }
}

export type CheckoutInput = {
  reference: string;
  registrationId: number;
  amountUsdCents: number;
  productName: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

/** One-off card payment; the registration reference rides along as metadata. */
export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail,
    client_reference_id: input.reference,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountUsdCents,
          product_data: { name: input.productName, description: input.description },
        },
      },
    ],
    metadata: { reference: input.reference, registrationId: String(input.registrationId) },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // Card only for now; Stripe's local methods can be enabled later from the dashboard.
    payment_method_types: ["card"],
  });

  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return { id: session.id, url: session.url };
}

/**
 * Verifies the webhook signature and returns the event. Throws on a bad or
 * missing signature — the route turns that into a 400 and Stripe retries.
 */
export function parseWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquante");
  if (!signature) throw new Error("En-tête stripe-signature absent");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

/**
 * What a completed Checkout tells us, reduced to the fields the registration
 * layer needs. Pure: given an event, decide whether it is a payment we should
 * honour and for which reference.
 */
export type PaymentConfirmation = {
  reference: string;
  stripeSessionId: string;
  amountPaidUsdCents: number;
  paidAt: Date;
};

export function confirmationFromEvent(event: Stripe.Event): PaymentConfirmation | null {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return null;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return null;

  const reference = session.metadata?.reference ?? session.client_reference_id;
  if (!reference) return null;

  return {
    reference,
    stripeSessionId: session.id,
    amountPaidUsdCents: session.amount_total ?? 0,
    paidAt: new Date(event.created * 1000),
  };
}
