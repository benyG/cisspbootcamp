import { describe, expect, it } from "vitest";

import { DEFAULT_TEST_THRESHOLD, type LeadJourney, defaultDestination, newPostCode, paceFor, publishableTestStats, recommendations, segmentOf, trackedLink, withLink } from "@/lib/marketing/plan";

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

  it("mène au test ou à l'analyse, avec le même marquage", () => {
    expect(trackedLink("https://x.test", "tiktok", 3, "tt-abc123", "test")).toBe("https://x.test/test?utm_source=tiktok&utm_medium=social&utm_campaign=cohorte-3&utm_content=tt-abc123");
    expect(defaultDestination("test")).toBe("test");
    expect(defaultDestination("places")).toBe("scanner");
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

describe("segments des relances (Ben, 29/09)", () => {
  const base: LeadJourney = { hadCall: false, testPercent: null, heatScore: 30, readiness: "ready", goalIsTight: false };
  const seg = (j: Partial<LeadJourney>, t = DEFAULT_TEST_THRESHOLD) => segmentOf({ ...base, ...j }, t, 60);

  it("l'appel passe avant tout", () => {
    expect(seg({ hadCall: true, testPercent: 20, readiness: "not_yet" })).toBe("called");
  });

  it("le score du test départage, selon le seuil réglable", () => {
    expect(DEFAULT_TEST_THRESHOLD).toBe(60);
    expect(seg({ testPercent: 60 })).toBe("test_high");
    expect(seg({ testPercent: 40 })).toBe("test_low");
    expect(seg({ testPercent: 60 }, 80)).toBe("test_low");
  });

  it("sans test : chauds, Associate, délai serré, pas encore prêts", () => {
    expect(seg({ heatScore: 75 })).toBe("hot");
    expect(seg({ readiness: "conditional" })).toBe("associate");
    expect(seg({ goalIsTight: true, heatScore: 90 })).toBe("conseil");
    expect(seg({ readiness: "not_yet", testPercent: 80 })).toBe("cc");
    expect(seg({})).toBeNull();
  });
});

describe("chiffres réels du test", () => {
  it("jamais de chiffre sous 30 résultats", () => {
    expect(publishableTestStats(Array(29).fill(80), 60)).toBeNull();
  });

  it("moyenne et part au-dessus du seuil, arrondies", () => {
    const percents = [...Array(20).fill(40), ...Array(10).fill(80)];
    expect(publishableTestStats(percents, 60)).toEqual({ count: 30, averagePercent: 53, threshold: 60, atOrAbove: 33 });
  });

  it("propose un post « Testez-vous » quand personne n'a fait le test", () => {
    const r = recommendations({ pace: paceFor(4, new Date("2026-12-20T12:00:00Z"), NOW), hotUnpaid: 0, callsWithoutSeat: 0, daysSinceLastPost: 1, scansLast7Days: 5, tests30: 0 });
    expect(r.join(" ")).toMatch(/Testez-vous/);
  });
});
