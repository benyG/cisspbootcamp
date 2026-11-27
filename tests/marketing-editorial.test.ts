import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { DEFAULT_EDITORIAL, activePillars, editorialForModel, editorialSchema, readEditorial } from "@/lib/marketing/editorial";
import { destinationsFor, pillarsFor } from "@/lib/marketing/plan";

describe("ligne éditoriale (Ben, 27/11)", () => {
  it("pré-remplit chaque pilier, avec une destination de son public", () => {
    for (const kind of ["cert", "ia"] as const) {
      const line = DEFAULT_EDITORIAL[kind];
      expect(Object.keys(line.pillars)).toEqual(Object.keys(pillarsFor(kind)));
      for (const p of Object.values(line.pillars)) {
        expect(p.intent.length).toBeGreaterThan(20);
        expect(Object.keys(destinationsFor(kind))).toContain(p.destination);
      }
      expect(editorialSchema(kind).safeParse(line).success).toBe(true);
    }
  });

  it("vise la curiosité, pas la méthode de la formation", () => {
    expect(DEFAULT_EDITORIAL.cert.avoid).toContain("méthodologie de la formation");
    expect(DEFAULT_EDITORIAL.cert.models).toContain("C'est quoi, au juste, la GIA ?");
    expect(DEFAULT_EDITORIAL.ia.tone).not.toMatch(/\bBen\b/);
    expect(DEFAULT_EDITORIAL.ia.models).not.toMatch(/\bBen\b/);
  });

  it("calcule la part de chaque pilier actif et ignore ceux à 0", () => {
    const line = structuredClone(DEFAULT_EDITORIAL.cert);
    line.pillars.tendances!.weight = 0;
    const active = activePillars(line);
    expect(active.map((p) => p.key)).not.toContain("tendances");
    expect(active[0]!.key).toBe("decouverte");
    expect(active.reduce((a, p) => a + p.share, 0)).toBeGreaterThanOrEqual(99);
  });

  it("donne la ligne au modèle avant tout le reste, sans les piliers désactivés", () => {
    const line = structuredClone(DEFAULT_EDITORIAL.cert);
    line.pillars.bootcamp!.weight = 0;
    const text = editorialForModel(line);
    expect(text.startsWith("LIGNE ÉDITORIALE")).toBe(true);
    expect(text).toContain("decouverte « Le saviez-vous ? »");
    expect(text).not.toContain("bootcamp « Pourquoi un bootcamp »");
    expect(text).toContain("À éviter absolument");
  });

  it("refuse une ligne invalide et retombe sur les valeurs proposées", () => {
    const line = structuredClone(DEFAULT_EDITORIAL.cert);
    for (const p of Object.values(line.pillars)) p.weight = 0;
    expect(editorialSchema("cert").safeParse(line).success).toBe(false);
    const wrongAudience = structuredClone(DEFAULT_EDITORIAL.cert);
    wrongAudience.pillars.offre!.destination = "ia_inscription";
    expect(editorialSchema("cert").safeParse(wrongAudience).success).toBe(false);
    expect(readEditorial("cert", null)).toBe(DEFAULT_EDITORIAL.cert);
    expect(readEditorial("cert", { pillars: {} })).toBe(DEFAULT_EDITORIAL.cert);
  });
});
