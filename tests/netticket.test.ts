import { afterEach, describe, expect, it } from "vitest";

import { MOBILE_MONEY_ENABLED, MODALITY, NetticketNotConfiguredError, createMobilePayment, fallbackUrl, mobileMoneyAvailable, parseWebhook } from "@/lib/payments/netticket";
import { showMaxItTip } from "@/lib/payments/card-only";

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
  it("est coupé tant que Netticket ne fonctionne pas (16/11), même avec clé et ticket", () => {
    process.env.NETTICKET_API_KEY = "k";
    expect(MOBILE_MONEY_ENABLED).toBe(false);
    expect(mobileMoneyAvailable("CM", "TCK")).toBe(false);
    delete process.env.NETTICKET_API_KEY;
  });

  it("ne lance aucun paiement mobile ni page de secours", async () => {
    process.env.NETTICKET_API_KEY = "k";
    process.env.NETTICKET_FALLBACK_URL = "https://netticket.net/achat";
    await expect(createMobilePayment({ email: "a@b.c", phone: "677123456", ticketCode: "T", operator: "orange", name: "A" })).rejects.toBeInstanceOf(NetticketNotConfiguredError);
    expect(fallbackUrl("CB-AAAA-BBBB")).toBeNull();
    delete process.env.NETTICKET_API_KEY;
    delete process.env.NETTICKET_FALLBACK_URL;
  });
});

describe("MODALITY", () => {
  it("suit la documentation Netticket", () => {
    expect(MODALITY).toEqual({ mtn: 3, orange: 4 });
  });
});

describe("carte uniquement : astuce Max it", () => {
  it("s’affiche dans les pays où Orange Money est utilisé", () => {
    expect(showMaxItTip("CM")).toBe(true);
    expect(showMaxItTip("ci")).toBe(true);
    expect(showMaxItTip("FR")).toBe(false);
    expect(showMaxItTip(null)).toBe(false);
  });
});
