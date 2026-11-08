import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/examboot/client", () => ({ examBootEnabled: () => false }));

import { chooseSubject } from "@/lib/marketing/rhythm";

describe("subject of the week", () => {
  it("takes the least used pillar, the offer last, and rotates its examples", () => {
    const recent = [{ pillar: "methode", angle: "methode", destination: "test" }, { pillar: "carriere", angle: "carriere", destination: "conseil" }];
    const s = chooseSubject("cert", recent, 0);
    expect(["candidat", "certification", "eligibilite"]).toContain(s.pillar);
    expect(s.pillar).not.toBe("offre");
    expect(chooseSubject("cert", recent, 1).topic).not.toBe(s.topic);
  });

  it("falls back to the profile analysis when the practice test is off", () => {
    const all = ["carriere", "certification", "eligibilite", "candidat", "offre"].flatMap((p) => [{ pillar: p, angle: p, destination: "scanner" }]);
    expect(chooseSubject("cert", all, 0)).toMatchObject({ pillar: "methode", destination: "scanner" });
  });

  it("speaks to the Bâtisseur IA audience with its own pillars", () => {
    expect(chooseSubject("ia", [], 0).pillar).toBe("autonome");
  });
});
