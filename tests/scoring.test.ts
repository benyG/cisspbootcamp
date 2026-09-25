import { describe, expect, it } from "vitest";

import {
  CISSP_DOMAINS,
  HEAT_POINTS,
  HOT_LEAD_THRESHOLD,
  type ScannerAnswers,
  answersSchema,
  assessReadiness,
  computeHeatScore,
  isHotLead,
  scoreScanner,
} from "@/lib/scoring";

/** Neutral baseline: scores 0 and is not eligible. Tests move one axis at a time. */
const BASE: ScannerAnswers = {
  country: "SN",
  professionalStatus: "career_change",
  experience: "none",
  domains: [],
  hasFourYearDegree: false,
  certifications: [],
  englishReading: 3,
  examAttempt: "none",
  examGoal: "undefined",
  budget: "no",
  cohortAvailability: "unsure",
};

const answers = (overrides: Partial<ScannerAnswers>): ScannerAnswers => ({
  ...BASE,
  ...overrides,
});

describe("assessReadiness — éligibilité ISC²", () => {
  it("5 ans ou plus : éligible", () => {
    expect(assessReadiness(answers({ experience: "five_plus" }))).toBe("ready");
  });

  it("3–4 ans avec un diplôme de quatre ans : éligible", () => {
    expect(
      assessReadiness(
        answers({ experience: "three_four", hasFourYearDegree: true }),
      ),
    ).toBe("ready");
  });

  it("3–4 ans avec une certification qualifiante : éligible", () => {
    expect(
      assessReadiness(
        answers({ experience: "three_four", certifications: ["cisa"] }),
      ),
    ).toBe("ready");
  });

  it("3–4 ans sans diplôme ni certification : sous conditions", () => {
    expect(
      assessReadiness(answers({ experience: "three_four" })),
    ).toBe("conditional");
  });

  it("une certification non vérifiable ne donne pas la dérogation", () => {
    expect(
      assessReadiness(
        answers({ experience: "three_four", certifications: ["other"] }),
      ),
    ).toBe("conditional");
  });

  it("moins de 3 ans : pas encore, même avec dérogation", () => {
    expect(
      assessReadiness(
        answers({ experience: "one_two", hasFourYearDegree: true }),
      ),
    ).toBe("not_yet");
    expect(
      assessReadiness(answers({ experience: "none", hasFourYearDegree: true })),
    ).toBe("not_yet");
  });

  it("étudiant : pas encore, quelle que soit l'expérience déclarée", () => {
    expect(
      assessReadiness(
        answers({
          professionalStatus: "student",
          experience: "five_plus",
          hasFourYearDegree: true,
        }),
      ),
    ).toBe("not_yet");
  });
});

describe("computeHeatScore — chaleur commerciale", () => {
  it("profil sans aucun signal : 0", () => {
    expect(computeHeatScore(BASE)).toBe(0);
  });

  it("applique chaque point du barème", () => {
    expect(computeHeatScore(answers({ budget: "yes" }))).toBe(
      HEAT_POINTS.budgetYes,
    );
    expect(computeHeatScore(answers({ budget: "employer" }))).toBe(
      HEAT_POINTS.budgetEmployer,
    );
    expect(computeHeatScore(answers({ cohortAvailability: "yes" }))).toBe(
      HEAT_POINTS.nextCohort,
    );
    expect(computeHeatScore(answers({ professionalStatus: "employed" }))).toBe(
      HEAT_POINTS.employed,
    );
    expect(computeHeatScore(answers({ examAttempt: "failed" }))).toBe(
      HEAT_POINTS.previousFailure,
    );
  });

  it("compte l'objectif d'examen sous six mois, dans les deux tranches", () => {
    expect(computeHeatScore(answers({ examGoal: "under_three_months" }))).toBe(
      HEAT_POINTS.examWithinSixMonths,
    );
    expect(computeHeatScore(answers({ examGoal: "three_to_six" }))).toBe(
      HEAT_POINTS.examWithinSixMonths,
    );
  });

  it("ne compte pas un objectif au-delà de six mois", () => {
    expect(computeHeatScore(answers({ examGoal: "six_to_twelve" }))).toBe(0);
    expect(computeHeatScore(answers({ examGoal: "undefined" }))).toBe(0);
  });

  it("budget et financement employeur ne se cumulent pas", () => {
    const score = computeHeatScore(answers({ budget: "employer" }));
    expect(score).toBe(HEAT_POINTS.budgetEmployer);
    expect(score).toBeLessThan(
      HEAT_POINTS.budgetYes + HEAT_POINTS.budgetEmployer,
    );
  });

  it("ne donne aucun point à un budget refusé ou à discuter", () => {
    expect(computeHeatScore(answers({ budget: "no" }))).toBe(0);
    expect(computeHeatScore(answers({ budget: "to_discuss" }))).toBe(0);
  });

  it("cumule les signaux et reste dans 0–100", () => {
    const hottest = computeHeatScore(
      answers({
        budget: "yes",
        cohortAvailability: "yes",
        examGoal: "under_three_months",
        professionalStatus: "employed",
        examAttempt: "failed",
      }),
    );

    expect(hottest).toBe(
      HEAT_POINTS.budgetYes +
        HEAT_POINTS.nextCohort +
        HEAT_POINTS.examWithinSixMonths +
        HEAT_POINTS.employed +
        HEAT_POINTS.previousFailure,
    );
    expect(hottest).toBeLessThanOrEqual(100);
    expect(isHotLead(hottest)).toBe(true);
  });

  it("le seuil de lead chaud est inclusif", () => {
    expect(isHotLead(HOT_LEAD_THRESHOLD)).toBe(true);
    expect(isHotLead(HOT_LEAD_THRESHOLD - 1)).toBe(false);
  });
});

describe("scoreScanner", () => {
  it("explique toujours le verdict", () => {
    const result = scoreScanner(answers({ experience: "five_plus" }));

    expect(result.readiness).toBe("ready");
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toContain("ISC²");
  });

  it("signale la certification à faire vérifier dans l'explication", () => {
    const result = scoreScanner(
      answers({ experience: "three_four", certifications: ["other"] }),
    );

    expect(result.readiness).toBe("conditional");
    expect(result.reasons.join(" ")).toContain("dérogation");
  });

  it("compte les domaines couverts sans doublon", () => {
    const result = scoreScanner(
      answers({
        domains: [
          CISSP_DOMAINS[0],
          CISSP_DOMAINS[1],
          CISSP_DOMAINS[1],
        ],
      }),
    );

    expect(result.coveredDomains).toBe(2);
  });

  it("prévient qu'un anglais basique allonge la préparation", () => {
    const result = scoreScanner(answers({ englishReading: 1 }));

    expect(result.reasons.join(" ")).toContain("anglais");
  });

  it("dit franchement au certifié que le bootcamp ne lui sert à rien", () => {
    const result = scoreScanner(
      answers({ experience: "five_plus", examAttempt: "passed" }),
    );

    expect(result.reasons.join(" ")).toContain("ne vous apportera rien");
  });
});

describe("answersSchema", () => {
  it("accepte un jeu de réponses complet", () => {
    expect(answersSchema.safeParse(BASE).success).toBe(true);
  });

  it("refuse un pays hors ISO 3166-1 alpha-2", () => {
    expect(answersSchema.safeParse({ ...BASE, country: "SEN" }).success).toBe(
      false,
    );
  });

  it("refuse une valeur inconnue", () => {
    expect(
      answersSchema.safeParse({ ...BASE, experience: "dix_ans" }).success,
    ).toBe(false);
    expect(
      answersSchema.safeParse({ ...BASE, domains: ["cryptographie"] }).success,
    ).toBe(false);
    expect(
      answersSchema.safeParse({ ...BASE, englishReading: 6 }).success,
    ).toBe(false);
    expect(
      answersSchema.safeParse({ ...BASE, englishReading: 2.5 }).success,
    ).toBe(false);
  });

  it("refuse un questionnaire incomplet", () => {
    const incomplete: Record<string, unknown> = { ...BASE };
    delete incomplete.budget;
    expect(answersSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe("les raisons ne ferment jamais la porte (Ben, 25/09)", async () => {
  const { buildReasons, answersSchema } = await import("@/lib/scoring");
  const base = answersSchema.parse({
    country: "SN", professionalStatus: "employed", experience: "one_two", domains: ["network_security"], hasFourYearDegree: false,
    certifications: [], englishReading: 3, examAttempt: "none", examGoal: "six_to_twelve", budget: "to_discuss", cohortAvailability: "unsure",
  });
  it("parle d'Associate of ISC² et de la CC à un profil junior", () => {
    const text = buildReasons(base, "not_yet").join(" ");
    expect(text).toContain("Associate of ISC²");
    expect(text).toContain("certification CC");
    expect(text).not.toMatch(/n'y êtes pas encore|viendra plus tard|pas prêt/i);
  });
  it("idem pour un étudiant", () => {
    const text = buildReasons({ ...base, professionalStatus: "student", experience: "none" }, "not_yet").join(" ");
    expect(text).toContain("Associate of ISC²");
    expect(text).not.toMatch(/viendra plus tard/i);
  });
});
