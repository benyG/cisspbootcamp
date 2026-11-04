import { NextRequest } from "next/server";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reg = vi.hoisted(() => ({
  markRegistrationPaid: vi.fn(async () => ({ ok: true, alreadyPaid: false })),
  markBalancePaid: vi.fn(async () => ({ ok: true, alreadyPaid: false })),
}));
vi.mock("@/lib/registration", () => reg);
const consulting = vi.hoisted(() => ({ isServiceReference: (r: string) => r.startsWith("CS-"), markServiceOrderPaid: vi.fn(async () => ({ ok: true, alreadyPaid: false })) }));
vi.mock("@/lib/consulting", () => consulting);

import { POST } from "@/app/api/webhooks/stripe/route";

const SECRET = "whsec_test_balance";

function request(reference: string, amount: number): NextRequest {
  const body = JSON.stringify({
    id: "evt_b", object: "event", type: "checkout.session.completed", created: 1_760_000_000, api_version: "2024-06-20", livemode: false, pending_webhooks: 0, request: null,
    data: { object: { id: "cs_bal", object: "checkout.session", payment_status: "paid", amount_total: amount, client_reference_id: reference, metadata: { reference } } },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  return new NextRequest("https://x.test/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": signature } });
}

describe("webhook Stripe, second versement (Ben, 04/11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  it("routes a -S reference to the balance of the seat", async () => {
    const response = await POST(request("CB-AAAA-BBBB-S", 31_000));
    expect(response.status).toBe(200);
    expect(reg.markBalancePaid).toHaveBeenCalledWith(expect.objectContaining({ reference: "CB-AAAA-BBBB", amountPaidUsdCents: 31_000, method: "stripe", stripeSessionId: "cs_bal" }));
    expect(reg.markRegistrationPaid).not.toHaveBeenCalled();
  });

  it("keeps seats and consulting orders where they were", async () => {
    await POST(request("CB-AAAA-BBBB", 31_000));
    expect(reg.markRegistrationPaid).toHaveBeenCalledWith(expect.objectContaining({ reference: "CB-AAAA-BBBB" }));
    await POST(request("CS-AAAA-BBBB", 9_000));
    expect(consulting.markServiceOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ reference: "CS-AAAA-BBBB" }));
    expect(reg.markBalancePaid).not.toHaveBeenCalled();
  });
});
