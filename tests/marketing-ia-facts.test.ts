import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { factsForModel } from "@/lib/marketing/data";
import { paceFor } from "@/lib/marketing/plan";

describe("faits donnés au studio pour une entrée IA (Ben, 04/11)", () => {
  it("parle d'entrepreneurs et de Claude Code, jamais d'examen ni de test", () => {
    const startsAt = new Date("2027-01-23T15:00:00Z");
    const closes = new Date("2027-01-16T15:00:00Z");
    const facts = factsForModel({
      id: 9, program: "ia", name: "Entrée du samedi 23 janvier 2027", startsAt, endsAt: new Date("2027-03-20T15:00:00Z"), capacity: 12, paid: 3, held: 1,
      admissionClosesAt: closes, pace: paceFor(8, closes, new Date("2027-01-01T12:00:00Z")), prices: { africa: "590 $", international: "1 190 $" },
    });
    expect(facts).toContain("J1 a lieu le 23 janvier 2027");
    expect(facts).toContain("8 encore libres");
    expect(facts).toContain("590 $");
    expect(facts).toContain("Claude Code");
    expect(facts).toContain("abonnement Claude");
    expect(facts).not.toMatch(/CISSP|ISC²|examen|test d'entraînement/);
  });
});
