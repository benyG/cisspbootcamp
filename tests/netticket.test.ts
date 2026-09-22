import { afterEach, describe, expect, it } from "vitest";

import { MODALITY, mobileMoneyAvailable, parseWebhook } from "@/lib/payments/netticket";

const SECRET = "hash-partage";
const payload = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ event: "charge.completed", data: { id: "123456", status: "successful", tx_ref: "n_123456789", amount: 100, charged_amount: 100, currency: "xaf", ...over } });

afterEach(() => {
  delete process.env.NETTICKET_WEBHOOK_SECRET;
  delete process.env.NETTICKET_API_KEY;
});

describe("parseWebhook", () => {
  it("accepte le hash partagé exact", () => {
    process.env.NETTICKET_WEBHOOK_SECRET = SECRET;
    expect(parseWebhook(payload(), SECRET)).toEqual({ id: "123456", status: "successful", txRef: "n_123456789", amount: 100, currency: "XAF" });
  });

  it("rejette un hash différent, absent, ou non configuré", () => {
    process.env.NETTICKET_WEBHOOK_SECRET = SECRET;
    expect(parseWebhook(payload(), "autre")).toBeNull();
    expect(parseWebhook(payload(), null)).toBeNull();
    delete process.env.NETTICKET_WEBHOOK_SECRET;
    expect(parseWebhook(payload(), SECRET)).toBeNull();
  });

  it("rejette un corps malformé ou un statut inconnu", () => {
    process.env.NETTICKET_WEBHOOK_SECRET = SECRET;
    expect(parseWebhook("{pas du json", SECRET)).toBeNull();
    expect(parseWebhook(payload({ status: "weird" }), SECRET)).toBeNull();
    expect(parseWebhook(JSON.stringify({ data: {} }), SECRET)).toBeNull();
  });

  it("préfère le montant réellement débité", () => {
    process.env.NETTICKET_WEBHOOK_SECRET = SECRET;
    expect(parseWebhook(payload({ amount: 100, charged_amount: 98 }), SECRET)?.amount).toBe(98);
  });
});

describe("mobileMoneyAvailable", () => {
  it("exige la clé, un code de ticket et un pays de la zone XAF", () => {
    process.env.NETTICKET_API_KEY = "k";
    expect(mobileMoneyAvailable("CM", "TCK")).toBe(true);
    expect(mobileMoneyAvailable("SN", "TCK")).toBe(false);
    expect(mobileMoneyAvailable("CM", null)).toBe(false);
    delete process.env.NETTICKET_API_KEY;
    expect(mobileMoneyAvailable("CM", "TCK")).toBe(false);
  });
});

describe("MODALITY", () => {
  it("suit la documentation Netticket", () => {
    expect(MODALITY).toEqual({ mtn: 3, orange: 4 });
  });
});
