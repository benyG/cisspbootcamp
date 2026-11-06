import { describe, expect, it } from "vitest";

import { bestPromo, codeProblem, launchPercent, normalizeCode, referralCode } from "@/lib/promo";

const now = new Date("2026-12-20T10:00:00Z");
const row = (over: Record<string, unknown> = {}) => ({ code: "ABIDJAN-TECH", kind: "partner", label: "Abidjan Tech", percent: 10, program: null, validUntil: null, maxUses: null, active: true, referrerLeadId: null, ...over });

describe("promo rules (Ben, 06/11: percentage, card only, referral discount for the newcomer)", () => {
  it("normalises codes", () => {
    expect(normalizeCode("  abidjan-tech ")).toBe("ABIDJAN-TECH");
    expect(normalizeCode("ab")).toBeNull();
    expect(normalizeCode("code promo")).toBe("CODEPROMO");
    expect(normalizeCode("x'; drop")).toBeNull();
  });

  it("keeps the launch price until the end of its last day", () => {
    expect(launchPercent({ percent: 15, until: "2026-12-20" }, now)).toBe(15);
    expect(launchPercent({ percent: 15, until: "2026-12-19" }, now)).toBe(0);
    expect(launchPercent({ percent: 80, until: "2026-12-31" }, now)).toBe(50);
    expect(launchPercent(null, now)).toBe(0);
  });

  it("refuses a code that is inactive, for another programme, expired, used up, or the referrer's own", () => {
    const base = { program: "cissp", leadId: 5, usedCount: 0 };
    expect(codeProblem(row(), base, now)).toBeNull();
    expect(codeProblem(null, base, now)).toContain("n’existe pas");
    expect(codeProblem(row({ active: false }), base, now)).toContain("n’existe pas");
    expect(codeProblem(row({ program: "ia" }), base, now)).toContain("cette formation");
    expect(codeProblem(row({ validUntil: new Date("2026-12-01T00:00:00Z") }), base, now)).toContain("expiré");
    expect(codeProblem(row({ maxUses: 3 }), { ...base, usedCount: 3 }, now)).toContain("nombre de fois");
    expect(codeProblem(row({ kind: "referral", referrerLeadId: 5 }), base, now)).toContain("personnes que vous recommandez");
  });

  it("applies the better of launch and code, rounded to the dollar, then the consulting credit", () => {
    expect(bestPromo({ listUsdCents: 59_000, creditUsdCents: 0, launch: 0, code: null })).toBeNull();
    const launch = bestPromo({ listUsdCents: 59_000, creditUsdCents: 0, launch: 15, code: { code: "AMI-1234", percent: 10, kind: "referral" } })!;
    expect(launch).toMatchObject({ source: "launch", percent: 15, code: null, discountUsdCents: 8_900, amountUsdCents: 50_100, label: "Tarif de lancement" });
    const code = bestPromo({ listUsdCents: 59_000, creditUsdCents: 10_000, launch: 5, code: { code: "AMI-1234", percent: 10, kind: "referral" } })!;
    expect(code).toMatchObject({ source: "code", code: "AMI-1234", discountUsdCents: 5_900, amountUsdCents: 43_100, label: "Code AMI-1234 (parrainage)" });
  });

  it("builds readable referral codes", () => {
    let i = 0;
    const seq = () => [0, 0.5, 0.99, 0.2][i++ % 4]!;
    expect(referralCode("Aïcha", seq)).toMatch(/^AICHA-[A-Z2-9]{4}$/);
    expect(referralCode("", seq)).toMatch(/^AMI-/);
  });
});
