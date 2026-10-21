import { describe, expect, it } from "vitest";

import { cisspProgramme, defaultSchedule, draftOffer, inclusions, offerLines, offerReference, offerSchema, usd, validUntil } from "@/lib/offer";

const today = new Date("2026-10-21T10:00:00Z");
const quote = { id: 7, organization: "Banque Exemple", contactName: "Aminata Koné", jobTitle: null, country: "CI", email: "a@x.test", certification: "both", format: "onsite", headcount: "6-10", need: "Huit personnes." };

describe("offre de service ExamBoot (Ben, 21/10)", () => {
  it("brouillon tiré de la demande : programme, format, effectif, besoin", () => {
    const o = draftOffer({ quote, countryLabel: () => "Côte d'Ivoire", paymentTerms: "50/50", today });
    expect(o).toMatchObject({ reference: "EB-2026-0007", issuedOn: "2026-10-21", validDays: 30, program: "both", format: "onsite", participants: 6, country: "Côte d'Ivoire", objectives: "Huit personnes.", paymentTerms: "50/50", priceUsd: 0 });
    expect(offerSchema.safeParse(o).success).toBe(true);
    const blank = draftOffer({ quote: null, countryLabel: (c) => c, paymentTerms: "", today });
    expect(blank).toMatchObject({ reference: "EB-20261021", program: "cissp", format: "online", organization: "" });
    expect(offerSchema.safeParse(blank).success).toBe(false);
    expect(offerReference(123, today)).toBe("EB-2026-0123");
  });

  it("prix : une ligne par programme, total en USD", () => {
    expect(offerLines({ program: "cissp", participants: 8, priceUsd: 1000, ccPriceUsd: 300 })).toEqual({ lines: [expect.objectContaining({ participants: 8, unitUsd: 1000, totalUsd: 8000 })], totalUsd: 8000 });
    expect(offerLines({ program: "both", participants: 5, priceUsd: 900, ccPriceUsd: 300 }).totalUsd).toBe(6000);
    expect(offerLines({ program: "cc", participants: 5, priceUsd: 900, ccPriceUsd: 300 }).lines).toHaveLength(1);
    expect(usd(8000)).toBe("8 000 USD");
  });

  it("validité, programme CISSP par domaine, inclus et non inclus", () => {
    expect(validUntil({ issuedOn: "2026-10-21", validDays: 30 }).toISOString().slice(0, 10)).toBe("2026-11-20");
    const prog = cisspProgramme();
    expect(prog).toHaveLength(8);
    expect(prog.every((d) => d.modules.length > 0 && d.hours > 0)).toBe(true);
    expect(prog.reduce((a, d) => a + d.hours, 0)).toBeLessThanOrEqual(40);
    const { yes, no } = inclusions({ program: "both", includeReplays: true, includeEvaluations: false }, ["Sessions live"]);
    expect(yes).toEqual(["Sessions live", expect.stringContaining("4 mois")]);
    expect(no).toHaveLength(2);
    expect(defaultSchedule("cissp")).toContain("40 h sur 15 jours");
  });
});
