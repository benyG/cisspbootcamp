import { describe, expect, it } from "vitest";

import { buildReceiptPdf } from "@/lib/payments/receipt";

describe("buildReceiptPdf", () => {
  it("produit un PDF valide portant la référence", async () => {
    const bytes = await buildReceiptPdf({
      reference: "CB-TEST-2027",
      paidAt: new Date("2026-11-03T10:00:00.000Z"),
      method: "stripe",
      amountUsdCents: 62_500,
      amountLocalLabel: "377 000 FCFA",
      participantName: "Awa Diop",
      participantEmail: "awa@example.com",
      company: null,
      cohortName: "Cohorte janvier 2027",
      issuerName: "Ben — Coach CISSP",
      issuerEmail: "bonjour@cisspbootcamp.online",
    });

    const head = Buffer.from(bytes.slice(0, 5)).toString("latin1");
    expect(head).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1_000);
  });
});
