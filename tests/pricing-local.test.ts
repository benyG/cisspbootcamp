import { describe, expect, it } from "vitest";

import { CFA_PER_EUR, convertUsdCents, formatLocal, localCurrencyFor } from "@/lib/pricing";

const RATES = { EUR: 0.92, CAD: 1.36, XAF: 0.92 * CFA_PER_EUR };

describe("localCurrencyFor", () => {
  it("distingue XAF et XOF", () => {
    expect(localCurrencyFor("CM")).toBe("XAF");
    expect(localCurrencyFor("SN")).toBe("XOF");
  });

  it("retombe sur USD pour un pays inconnu", () => {
    expect(localCurrencyFor("ZZ")).toBe("USD");
    expect(localCurrencyFor(null)).toBe("USD");
  });
});

describe("convertUsdCents", () => {
  it("laisse l'USD inchangé", () => {
    expect(convertUsdCents(62_500, "USD", RATES)).toBe(62_500);
  });

  it("convertit en centimes pour une devise à décimales", () => {
    // 625 USD × 0.92 = 575 EUR = 57 500 centimes
    expect(convertUsdCents(62_500, "EUR", RATES)).toBe(57_500);
  });

  it("convertit en unités entières pour le FCFA", () => {
    const xaf = convertUsdCents(62_500, "XAF", RATES);
    expect(xaf).toBe(Math.round(625 * 0.92 * CFA_PER_EUR));
    expect(Number.isInteger(xaf)).toBe(true);
  });

  it("dérive le XOF de l'euro quand le taux direct manque", () => {
    expect(convertUsdCents(62_500, "XOF", { EUR: 0.92 })).toBe(
      Math.round(625 * 0.92 * CFA_PER_EUR),
    );
  });

  it("renvoie null plutôt qu'un chiffre faux sans taux", () => {
    expect(convertUsdCents(62_500, "CAD", {})).toBeNull();
    expect(convertUsdCents(62_500, "XAF", {})).toBeNull();
  });
});

describe("formatLocal", () => {
  it("arrondit le FCFA au millier", () => {
    expect(formatLocal(377_175, "XAF")).toMatch(/^377[\s\u202f\u00a0]000 FCFA$/);
  });

  it("arrondit l'euro à la dizaine", () => {
    expect(formatLocal(57_500, "EUR")).toMatch(/^580 €$/);
  });

  it("nomme le dollar canadien", () => {
    expect(formatLocal(85_000, "CAD")).toMatch(/\$CA$/);
  });
});
