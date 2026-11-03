import { describe, expect, it } from "vitest";

import { BRIEF_FIELDS, briefLines } from "@/lib/ia-brief";
import { briefSchema, storedBrief } from "@/lib/ia-brief-schema";

const full = { business: "Cabinet de formation, 3 personnes, Douala", users: "Moi et mes deux formateurs", tasks: "Relances, devis, paiements", data: "Excel et WhatsApp", inspiration: "", domain: "mon-cabinet.com", payments: "mobile" };

describe("fiche projet Bâtisseur IA (Ben, 04/11)", () => {
  it("accepts a complete sheet and trims it", () => {
    const parsed = briefSchema.safeParse({ ...full, business: `  ${full.business}  ` });
    expect(parsed.success && parsed.data.business).toBe(full.business);
  });

  it("requires the four core answers and the payment choice, not the optional ones", () => {
    expect(briefSchema.safeParse({ ...full, tasks: "" }).success).toBe(false);
    expect(briefSchema.safeParse({ ...full, payments: "cash" }).success).toBe(false);
    const { inspiration: _i, domain: _d, ...core } = full;
    void _i; void _d;
    const parsed = briefSchema.safeParse(core);
    expect(parsed.success && parsed.data.domain).toBe("");
  });

  it("caps every field", () => {
    for (const f of BRIEF_FIELDS) expect(briefSchema.safeParse({ ...full, [f.key]: "x".repeat(f.max + 1) }).success).toBe(false);
  });

  it("reads a stored sheet back, or nothing", () => {
    expect(storedBrief(full)?.payments).toBe("mobile");
    expect(storedBrief(null)).toBeNull();
    expect(storedBrief({ business: "x" })).toBeNull();
  });

  it("sums the sheet up for Ben, skipping empty answers", () => {
    const lines = briefLines(storedBrief(full)!);
    expect(lines[0]).toBe("Activité : Cabinet de formation, 3 personnes, Douala");
    expect(lines).toContain("Encaissement : Mobile money");
    expect(lines.some((l) => l.startsWith("Inspiration"))).toBe(false);
  });
});
