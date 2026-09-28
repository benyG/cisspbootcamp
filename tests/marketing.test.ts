import { describe, expect, it } from "vitest";

import { newPostCode, paceFor, recommendations, trackedLink, withLink } from "@/lib/marketing/plan";

const NOW = new Date("2026-12-01T12:00:00Z");

describe("rythme d'inscription", () => {
  it("dit combien d'inscriptions il faut, et à quel rythme", () => {
    expect(paceFor(4, new Date("2026-12-13T12:00:00Z"), NOW).label).toBe("4 places en 12 jours : une inscription tous les 3 jours.");
    expect(paceFor(6, new Date("2026-12-04T12:00:00Z"), NOW).label).toBe("6 places en 3 jours : 2 inscriptions par jour.");
    expect(paceFor(0, new Date("2026-12-13T12:00:00Z"), NOW).label).toBe("Cohorte complète.");
    expect(paceFor(2, new Date("2026-11-30T12:00:00Z"), NOW).daysLeft).toBe(0);
  });
});

describe("liens suivis", () => {
  it("marque le canal, la cohorte et le contenu", () => {
    const link = trackedLink("https://x.test", "linkedin", 3, "li-abc123");
    expect(link).toBe("https://x.test/scanner?utm_source=linkedin&utm_medium=social&utm_campaign=cohorte-3&utm_content=li-abc123");
  });

  it("un code court, préfixé par le canal", () => {
    expect(newPostCode("tiktok", Buffer.from([1, 2, 3, 4]))).toBe("tt-010203");
  });

  it("remplace [LIEN], ou ajoute le lien à la fin", () => {
    expect(withLink("Voir [LIEN] ici", "https://l")).toBe("Voir https://l ici");
    expect(withLink("Sans lien", "https://l")).toBe("Sans lien\n\nhttps://l");
  });
});

describe("recommandations du jour", () => {
  const base = { pace: paceFor(4, new Date("2026-12-20T12:00:00Z"), NOW), hotUnpaid: 0, callsWithoutSeat: 0, daysSinceLastPost: 1, scansLast7Days: 5 };

  it("met les appels sans inscription en premier, trois lignes au plus", () => {
    const r = recommendations({ ...base, callsWithoutSeat: 2, hotUnpaid: 5, daysSinceLastPost: null, scansLast7Days: 0 });
    expect(r).toHaveLength(3);
    expect(r[0]).toMatch(/2 personnes ont eu l'appel/);
  });

  it("pousse l'urgence la dernière semaine", () => {
    const r = recommendations({ ...base, pace: paceFor(3, new Date("2026-12-05T12:00:00Z"), NOW) });
    expect(r.join(" ")).toMatch(/Clôture dans 4 jours/);
  });

  it("une cohorte pleine n'a qu'une consigne", () => {
    expect(recommendations({ ...base, pace: paceFor(0, new Date("2026-12-20T12:00:00Z"), NOW) })).toEqual(["La cohorte est complète : préparez la suivante."]);
  });
});
