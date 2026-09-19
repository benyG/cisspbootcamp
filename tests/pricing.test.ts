import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIER_CODE,
  formatUsdCents,
  isQuoteOnly,
  resolveTierCode,
} from "@/lib/pricing";

const TIERS = [
  { code: "africa", countries: ["SN", "CM", "CI", "BF"] },
  { code: "international", countries: ["FR", "BE", "CA"] },
  { code: "enterprise", countries: [] },
];

describe("resolveTierCode", () => {
  it("associe un pays africain au palier Afrique", () => {
    expect(resolveTierCode("SN", TIERS)).toBe("africa");
    expect(resolveTierCode("CM", TIERS)).toBe("africa");
  });

  it("associe un pays européen ou canadien au palier international", () => {
    expect(resolveTierCode("FR", TIERS)).toBe("international");
    expect(resolveTierCode("CA", TIERS)).toBe("international");
  });

  it("ignore la casse et les espaces", () => {
    expect(resolveTierCode(" sn ", TIERS)).toBe("africa");
  });

  it("retombe sur l'international pour un pays inconnu", () => {
    expect(resolveTierCode("JP", TIERS)).toBe(DEFAULT_TIER_CODE);
  });

  it("retombe sur l'international pour une entrée absente ou malformée", () => {
    expect(resolveTierCode(null, TIERS)).toBe(DEFAULT_TIER_CODE);
    expect(resolveTierCode(undefined, TIERS)).toBe(DEFAULT_TIER_CODE);
    expect(resolveTierCode("", TIERS)).toBe(DEFAULT_TIER_CODE);
    expect(resolveTierCode("SEN", TIERS)).toBe(DEFAULT_TIER_CODE);
  });

  it("ne choisit jamais un palier sans pays par défaut", () => {
    expect(resolveTierCode("XX", TIERS)).not.toBe("enterprise");
  });
});

describe("formatUsdCents", () => {
  it("affiche les prix ronds sans décimales", () => {
    expect(formatUsdCents(62_500)).toBe("625 USD");
    expect(formatUsdCents(120_000)).toBe("1 200 USD".replace(" ", " "));
  });

  it("affiche les décimales quand il y en a", () => {
    expect(formatUsdCents(62_550)).toContain("625,50");
  });

  it("gère zéro", () => {
    expect(formatUsdCents(0)).toBe("0 USD");
  });
});

describe("isQuoteOnly", () => {
  it("ne concerne que le palier entreprise", () => {
    expect(isQuoteOnly("enterprise")).toBe(true);
    expect(isQuoteOnly("africa")).toBe(false);
  });
});
