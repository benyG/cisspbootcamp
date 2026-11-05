import { describe, expect, it } from "vitest";

import { brandKit, brandedImagePrompt, brandedVideoPrompt } from "@/lib/marketing/brand";
import { IA_PILLARS, PILLARS, destinationsFor, editorialBalance, formatRule, iaRecommendations, marketingKind, paceFor, pillarOf, pillarsFor, trackedLink } from "@/lib/marketing/plan";

const NOW = new Date("2026-12-01T12:00:00Z");

describe("marketing Bâtisseur IA, deux publics (Ben, 04/11)", () => {
  it("sépare les certifications et le Bâtisseur IA", () => {
    expect(marketingKind("ia")).toBe("ia");
    expect(marketingKind("cissp")).toBe("cert");
    expect(marketingKind("cc")).toBe("cert");
    expect(pillarsFor("ia")).toBe(IA_PILLARS);
    expect(pillarsFor("cert")).toBe(PILLARS);
    expect(Object.keys(destinationsFor("ia"))).toEqual(["ia_diagnostic", "ia_page", "ia_inscription"]);
    expect(Object.keys(destinationsFor("cert"))).not.toContain("ia_diagnostic");
  });

  it("chaque pilier IA mène à une destination IA", () => {
    const destinations = Object.keys(destinationsFor("ia"));
    for (const p of Object.values(IA_PILLARS)) expect(destinations).toContain(p.destination);
    expect(IA_PILLARS.offre.destination).toBe("ia_inscription");
  });

  it("trace les liens vers les pages IA", () => {
    expect(trackedLink("https://x.test", "tiktok", 9, "tt-abc123", "ia_diagnostic")).toBe("https://x.test/ia/diagnostic?utm_source=tiktok&utm_medium=social&utm_campaign=cohorte-9&utm_content=tt-abc123");
    expect(trackedLink("https://x.test", "linkedin", 9, "li-abc123", "ia_inscription")).toContain("https://x.test/ia/inscription?");
  });

  it("adapte les formats qui parlent aux candidats", () => {
    expect(formatRule("cas", "ia")).toContain("entrepreneur");
    expect(formatRule("cas", "cert")).not.toContain("entrepreneur");
    expect(formatRule("standard", "ia")).toBe(formatRule("standard", "cert"));
  });

  it("équilibre éditorial sur les piliers IA", () => {
    const posts = [{ pillar: "offre", angle: "offre", destination: "ia_inscription" }, { pillar: "offre", angle: "offre", destination: "ia_inscription" }, { pillar: "cas_usage", angle: "cas_usage", destination: "ia_diagnostic" }];
    const b = editorialBalance(posts, "ia");
    expect(Object.keys(b.byPillar)).toEqual(Object.keys(IA_PILLARS));
    expect(b.byPillar.offre).toBe(2);
    expect(b.byDestination.ia_inscription).toBe(2);
    expect(b.advice).toContain("place à la valeur");
    expect(b.advice).toContain(IA_PILLARS.construire.label);
    expect(editorialBalance([], "ia").advice).toContain("cas d'usage");
    // An old post without a pillar counts as selling.
    expect(pillarOf({ pillar: null, angle: "x", destination: "ia_page" }, "ia")).toBe("offre");
  });

  it("dit quoi faire aujourd'hui pour une entrée IA", () => {
    const pace = paceFor(8, new Date("2026-12-05T12:00:00Z"), NOW);
    const todo = iaRecommendations({ pace, diagnosticsLast7Days: 0, diagnosedUnpaid: 2, daysSinceLastPost: null });
    expect(todo).toHaveLength(3);
    expect(todo[0]).toContain("2 personnes ont fait le diagnostic");
    expect(todo.join(" ")).not.toMatch(/test|analyse de profil|CISSP/);
    expect(iaRecommendations({ pace: paceFor(0, NOW, NOW), diagnosticsLast7Days: 3, diagnosedUnpaid: 0, daysSinceLastPost: 1 })[0]).toContain("complète");
  });

  it("habille les visuels IA : entrepreneurs, pas de robot, un point par journée", () => {
    expect(brandKit("ia")).toMatchObject({ dots: 6, signature: "Bâtisseur IA" });
    expect(brandKit()).toMatchObject({ dots: 15, signature: "CISSP Bootcamp" });
    const image = brandedImagePrompt("A tailor checks orders on her phone", "ia");
    expect(image).toContain("entrepreneurs");
    expect(image).toContain("robots");
    expect(image).not.toContain("cybersecurity");
    expect(brandedVideoPrompt("[Push in] A shop owner", "ia")).toContain("entrepreneurs");
    expect(brandedImagePrompt("A CISO")).toContain("cybersecurity");
  });
});
