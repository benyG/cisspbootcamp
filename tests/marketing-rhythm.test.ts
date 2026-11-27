import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/examboot/client", () => ({ examBootEnabled: () => false }));

import { DEFAULT_EDITORIAL } from "@/lib/marketing/editorial";
import { chooseSubject } from "@/lib/marketing/rhythm";

describe("subject of the week", () => {
  it("takes the pillar furthest behind its share, the offer last, and rotates its examples", () => {
    const recent = [{ pillar: "decouverte", angle: "decouverte", destination: "test" }, { pillar: "carriere", angle: "carriere", destination: "conseil" }];
    const s = chooseSubject("cert", recent, 0);
    expect(["tendances", "certification"]).toContain(s.pillar);
    expect(s.pillar).not.toBe("offre");
    expect(chooseSubject("cert", recent, 1).topic).not.toBe(s.topic);
  });

  it("leads to the training page", () => {
    const all = ["carriere", "tendances", "certification", "bootcamp", "offre"].map((p) => ({ pillar: p, angle: p, destination: "cohorte" }));
    expect(chooseSubject("cert", all, 0)).toMatchObject({ pillar: "decouverte", destination: "cohorte" });
  });

  it("never proposes a pillar Ben switched off", () => {
    const line = structuredClone(DEFAULT_EDITORIAL.cert);
    line.pillars.decouverte!.weight = 0;
    const all = ["carriere", "tendances", "certification", "bootcamp", "offre"].map((p) => ({ pillar: p, angle: p, destination: "scanner" }));
    expect(chooseSubject("cert", all, 0, line).pillar).not.toBe("decouverte");
  });

  it("speaks to the Bâtisseur IA audience with its own pillars", () => {
    expect(chooseSubject("ia", [], 0).pillar).toBe("ia_decouverte");
  });
});
