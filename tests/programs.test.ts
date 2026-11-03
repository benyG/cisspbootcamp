import { describe, expect, it } from "vitest";

import { PRICED_PROGRAMS, PROGRAM_CODES, PROGRAM_PRICES, PROGRAMS, isProgramCode } from "@/lib/programs";

describe("programs", () => {
  it("defines every programme under its own code", () => {
    for (const code of PROGRAM_CODES) expect(PROGRAMS[code].code).toBe(code);
  });

  it("recognises Bâtisseur IA", () => {
    expect(isProgramCode("ia")).toBe(true);
    expect(isProgramCode("autre")).toBe(false);
    expect(PROGRAMS.ia).toMatchObject({ name: "Bâtisseur IA", shortName: "IA", hours: 25, days: 5, defaultCapacity: 12 });
  });

  it("prices every non-CISSP programme for both tiers, in cents", () => {
    expect([...PRICED_PROGRAMS].sort()).toEqual(PROGRAM_CODES.filter((c) => c !== "cissp").sort());
    for (const p of PRICED_PROGRAMS) {
      expect(PROGRAM_PRICES[p].africa).toBeGreaterThan(0);
      expect(PROGRAM_PRICES[p].international).toBeGreaterThan(PROGRAM_PRICES[p].africa);
    }
    expect(PROGRAM_PRICES.ia).toEqual({ africa: 59_000, international: 119_000 });
  });

  it("keeps IA copy free of exam wording and promised gains", () => {
    const copy = [PROGRAMS.ia.productLine, PROGRAMS.ia.examNote, PROGRAMS.ia.receiptExamNote].join(" ");
    expect(copy).not.toMatch(/examen|garanti/i);
  });
});
