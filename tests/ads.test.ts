import { describe, expect, it } from "vitest";

import { AD_MIN_SPEND_CENTS, adCampaignSchema, adCode, adLink, adMetrics, adTotals, verdictText } from "@/lib/ads";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("paid campaigns", () => {
  it("codes the campaign name into utm_campaign", () => {
    expect(adCode("Relance décembre, Côte d’Ivoire !", Buffer.from([0x3f, 0x9a]))).toBe("pub-relance-decembre-cote-d-ivoire-3f9a");
    expect(adCode("!!!", Buffer.from([0, 1]))).toBe("pub-0001");
    expect(adCode("x".repeat(80), Buffer.from([1, 2])).length).toBeLessThanOrEqual(48);
  });

  it("builds the tracked link, the IA pages on their own domain", () => {
    expect(adLink("https://x.test/", { channel: "facebook", destination: "scanner", code: "pub-a-0001" }, null)).toBe("https://x.test/scanner?utm_source=facebook&utm_medium=paid&utm_campaign=pub-a-0001");
    expect(adLink("https://x.test", { channel: "linkedin", destination: "ia", code: "pub-b-0002" }, "batisseur-ia.com")).toBe("https://batisseur-ia.com/diagnostic?utm_source=linkedin&utm_medium=paid&utm_campaign=pub-b-0002");
    expect(adLink("https://x.test", { channel: "other", destination: "ia", code: "c" }, null)).toBe("https://x.test/ia/diagnostic?utm_source=pub&utm_medium=paid&utm_campaign=c");
  });

  it("computes costs from real counts only", () => {
    const m = adMetrics({ spentCents: 30_000, visits: 600, leads: 20, paid: 2, revenueCents: 2 * 120_000 });
    expect(m.costPerVisitCents).toBe(50);
    expect(m.costPerLeadCents).toBe(1_500);
    expect(m.costPerSignupCents).toBe(15_000);
    expect(m.returnRatio).toBe(8);
    expect(m.verdict).toBe("good");
    expect(nbsp(verdictText(m))).toBe("Rentable : une place coûte 150 USD de pub, 13 % du prix payé.");
    const none = adMetrics({ spentCents: 0, visits: 0, leads: 0, paid: 0, revenueCents: 0 });
    expect([none.costPerLeadCents, none.costPerSignupCents, none.returnRatio]).toEqual([null, null, null]);
    expect(verdictText(none)).toBe("Pas encore de dépense saisie.");
  });

  it("judges against what the seats paid: good, watch, too expensive, no signup, too early", () => {
    const at = (spentCents: number, paid: number) => adMetrics({ spentCents, visits: 100, leads: 10, paid, revenueCents: paid * 100_000 }).verdict;
    expect(at(15_000, 1)).toBe("good");
    expect(at(30_000, 1)).toBe("watch");
    expect(at(40_000, 1)).toBe("high");
    expect(at(AD_MIN_SPEND_CENTS, 0)).toBe("no_signup");
    expect(at(AD_MIN_SPEND_CENTS - 1, 0)).toBe("too_early");
    expect(nbsp(verdictText(adMetrics({ spentCents: 8_000, visits: 50, leads: 3, paid: 0, revenueCents: 0 })))).toBe("80 USD dépensés, aucune place payée pour l’instant (3 prospects à relancer).");
    expect(verdictText(adMetrics({ spentCents: 40_000, visits: 1, leads: 1, paid: 1, revenueCents: 100_000 }))).toContain("Changez le visuel");
  });

  it("adds campaigns up and validates the form", () => {
    expect(adTotals([{ spentCents: 1, visits: 2, leads: 3, paid: 1, revenueCents: 5 }, { spentCents: 1, visits: 0, leads: 1, paid: 0, revenueCents: 0 }])).toEqual({ spentCents: 2, visits: 2, leads: 4, paid: 1, revenueCents: 5 });
    expect(adCampaignSchema.parse({ name: " Relance ", channel: "facebook", destination: "scanner", cohortId: "", budgetUsd: "300" })).toEqual({ name: "Relance", channel: "facebook", destination: "scanner", cohortId: null, budgetUsd: 300 });
    expect(adCampaignSchema.safeParse({ name: "R", channel: "x", destination: "scanner" }).success).toBe(false);
  });
});
