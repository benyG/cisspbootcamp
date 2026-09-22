import { describe, expect, it } from "vitest";

import { analyseProfile } from "@/lib/analysis";
import { buildPrompt, draftSalesMessage } from "@/lib/scanner/ai-message";
import { CISSP_DOMAINS, type ScannerAnswers } from "@/lib/scoring";

const ANSWERS: ScannerAnswers = {
  country: "SN",
  professionalStatus: "employed",
  experience: "three_four",
  domains: CISSP_DOMAINS.slice(0, 4),
  hasFourYearDegree: true,
  certifications: ["cisa"],
  englishReading: 3,
  examAttempt: "none",
  examGoal: "three_to_six",
  budget: "employer",
  cohortAvailability: "yes",
};

const input = {
  firstName: "Awa",
  jobTitle: "Analyste SOC",
  goals: "Passer le CISSP avant mon entretien annuel.",
  answers: ANSWERS,
  analysis: analyseProfile(ANSWERS),
  cohort: { id: 1, name: "Cohorte janvier 2027", startsAt: new Date("2027-01-11T18:00:00Z"), capacity: 10, status: "open", confirmedCount: 3 },
  priceLabel: "625 USD",
};

describe("buildPrompt", () => {
  it("transmet le diagnostic comme des faits, pas comme une question", () => {
    const prompt = buildPrompt(input);

    expect(prompt).toContain("DIAGNOSTIC (règles, fait foi)");
    expect(prompt).toContain("Verdict : ready");
    expect(prompt).toContain("accompagné : 3 à 4 mois");
    expect(prompt).toContain("7 places restantes sur 10");
  });

  it("cite les objectifs écrits par la personne", () => {
    expect(buildPrompt(input)).toContain("« Passer le CISSP avant mon entretien annuel. »");
  });

  it("nomme les domaines non couverts", () => {
    expect(buildPrompt(input)).toContain("Domaines non couverts : Gestion des identités");
  });
});

describe("draftSalesMessage", () => {
  it("retombe sur le gabarit sans clé API, sans appel réseau", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await draftSalesMessage(input);
      expect(result.source).toBe("template");
      expect(result.text).toMatch(/^Bonjour Awa,/);
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
