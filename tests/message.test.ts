import { describe, expect, it } from "vitest";

import { analyseProfile } from "@/lib/analysis";
import type { CohortCandidate } from "@/lib/cohorts";
import { draftCoachMessage } from "@/lib/scanner/message";
import { CISSP_DOMAINS, type ScannerAnswers } from "@/lib/scoring";

const BASE: ScannerAnswers = {
  country: "SN",
  professionalStatus: "employed",
  experience: "three_four",
  domains: CISSP_DOMAINS.slice(0, 4),
  hasFourYearDegree: true,
  certifications: [],
  englishReading: 3,
  examAttempt: "none",
  examGoal: "six_to_twelve",
  budget: "employer",
  cohortAvailability: "yes",
};

const COHORT: CohortCandidate = {
  id: 1,
  name: "Cohorte janvier 2027",
  startsAt: new Date("2027-01-11T18:00:00.000Z"),
  capacity: 10,
  status: "open",
  confirmedCount: 3,
};

const draft = (answers: ScannerAnswers, cohort: CohortCandidate | null = COHORT) =>
  draftCoachMessage({
    firstName: "Awa",
    answers,
    analysis: analyseProfile(answers),
    cohort,
  });

describe("draftCoachMessage", () => {
  it("parle à la première personne et s'adresse au prénom", () => {
    const message = draft(BASE);

    expect(message).toMatch(/^Bonjour Awa,/);
    expect(message).toContain("J'ai regardé votre profil");
    expect(message).toMatch(/Ben\nCoach CISSP$/);
  });

  it("oppose le délai seul au délai accompagné", () => {
    const message = draft(BASE);

    expect(message).toContain("Seul,");
    expect(message).toContain("Accompagné, en 3 à 4 mois");
  });

  it("nomme la cohorte en vente pour un profil prêt", () => {
    expect(draft(BASE)).toContain("cohorte de janvier 2027");
  });

  it("ne pousse pas de cohorte à un profil pas encore éligible", () => {
    const tooEarly = draft({
      ...BASE,
      professionalStatus: "student",
      experience: "none",
    });

    expect(tooEarly).not.toContain("cohorte de janvier");
    expect(tooEarly).toContain("séance de conseil");
  });

  it("reste cohérent sans cohorte ouverte", () => {
    const message = draft(BASE, null);

    expect(message).not.toContain("cohorte de");
    expect(message).toContain("15 minutes ensemble");
  });

  it("signale un objectif de date trop serré sans le décourager", () => {
    const message = draft({
      ...BASE,
      examGoal: "under_three_months",
      englishReading: 1,
      domains: [],
    });

    expect(message).toContain("plus serré");
    expect(message).toContain("jouable");
  });

  it("ne promet jamais la réussite", () => {
    for (const answers of [
      BASE,
      { ...BASE, experience: "five_plus" as const },
      { ...BASE, experience: "none" as const },
    ]) {
      expect(draft(answers)).not.toMatch(/vous réussirez|garanti/i);
    }
  });
});
