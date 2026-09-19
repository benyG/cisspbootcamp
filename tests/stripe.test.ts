import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { confirmationFromEvent, parseWebhook } from "@/lib/payments/stripe";

const SECRET = "whsec_test_secret";

/** A real Stripe event envelope, signed the way Stripe signs it. */
function signedEvent(payload: object): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  return { body, signature };
}

const completed = (overrides: Partial<Stripe.Checkout.Session> = {}) => ({
  id: "evt_1",
  object: "event",
  type: "checkout.session.completed",
  created: 1_760_000_000,
  api_version: "2024-06-20",
  livemode: false,
  pending_webhooks: 0,
  request: null,
  data: {
    object: {
      id: "cs_test_123",
      object: "checkout.session",
      payment_status: "paid",
      amount_total: 62_500,
      client_reference_id: "CB-AAAA-BBBB",
      metadata: { reference: "CB-AAAA-BBBB", registrationId: "7" },
      ...overrides,
    },
  },
});

describe("parseWebhook", () => {
  it("accepte une signature valide", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const { body, signature } = signedEvent(completed());

    const event = parseWebhook(body, signature);
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejette une signature forgée", () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const { body } = signedEvent(completed());

    expect(() => parseWebhook(body, "t=1,v1=deadbeef")).toThrow();
  });

  it("rejette un corps modifié après signature", () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const { body, signature } = signedEvent(completed());
    const tampered = body.replace("62500", "1");

    expect(() => parseWebhook(tampered, signature)).toThrow();
  });

  it("rejette l'absence de signature", () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    expect(() => parseWebhook("{}", null)).toThrow(/stripe-signature/);
  });
});

describe("confirmationFromEvent", () => {
  it("extrait la référence, la session et le montant d'un paiement réussi", () => {
    const confirmation = confirmationFromEvent(completed() as unknown as Stripe.Event);

    expect(confirmation).toEqual({
      reference: "CB-AAAA-BBBB",
      stripeSessionId: "cs_test_123",
      amountPaidUsdCents: 62_500,
      paidAt: new Date(1_760_000_000 * 1000),
    });
  });

  it("ignore une session non payée", () => {
    const event = completed({ payment_status: "unpaid" }) as unknown as Stripe.Event;
    expect(confirmationFromEvent(event)).toBeNull();
  });

  it("ignore les autres types d'événements", () => {
    const event = { ...completed(), type: "payment_intent.created" } as unknown as Stripe.Event;
    expect(confirmationFromEvent(event)).toBeNull();
  });

  it("retombe sur client_reference_id sans métadonnées", () => {
    const event = completed({ metadata: {} }) as unknown as Stripe.Event;
    expect(confirmationFromEvent(event)?.reference).toBe("CB-AAAA-BBBB");
  });

  it("refuse un paiement sans référence", () => {
    const event = completed({ metadata: {}, client_reference_id: null }) as unknown as Stripe.Event;
    expect(confirmationFromEvent(event)).toBeNull();
  });
});
