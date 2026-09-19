import { describe, expect, it } from "vitest";

import {
  BASE_PREPARATION_WEEKS,
  MINIMUM_PREPARATION_WEEKS,
  WEEKS_LOW_ENGLISH,
  WEEKS_PREVIOUS_ATTEMPT,
  WEEKS_SENIOR_EXPERIENCE,
  analyseProfile,
  buildAxes,
  estimateTimeline,
  isGoalTight,
  recommend,
} from "@/lib/analysis";
import { CISSP_DOMAINS, type ScannerAnswers } from "@/lib/scoring";

/** Eligible, comfortable, five domains covered: the baseline profile. */
const BASE: ScannerAnswers = {
  country: "SN",
  professionalStatus: "employed",
  experience: "three_four",
  domains: CISSP_DOMAINS.slice(0, 5),
  hasFourYearDegree: true,
  certifications: [],
  englishReading: 4,
  examAttempt: "none",
  examGoal: "six_to_twelve",
  budget: "to_discuss",
  cohortAvailability: "unsure",
};

const answers = (overrides: Partial<ScannerAnswers>): ScannerAnswers => ({
  ...BASE,
  ...overrides,
});

describe("estimateTimeline", () => {
  it("part de la base pour un profil à l'aise", () => {
    expect(estimateTimeline(BASE).minWeeks).toBe(BASE_PREPARATION_WEEKS);
  });

  it("allonge le délai quand l'anglais est faible", () => {
    expect(estimateTimeline(answers({ englishReading: 1 })).minWeeks).toBe(
      BASE_PREPARATION_WEEKS + WEEKS_LOW_ENGLISH,
    );
  });

  it("raccourcit le délai après une tentative échouée", () => {
    expect(estimateTimeline(answers({ examAttempt: "failed" })).minWeeks).toBe(
      BASE_PREPARATION_WEEKS + WEEKS_PREVIOUS_ATTEMPT,
    );
  });

  it("raccourcit le délai pour un profil très expérimenté", () => {
    expect(estimateTimeline(answers({ experience: "five_plus" })).minWeeks).toBe(
      BASE_PREPARATION_WEEKS + WEEKS_SENIOR_EXPERIENCE,
    );
  });

  it("ne facture pas les trois premiers domaines non couverts", () => {
    const cinqDomaines = estimateTimeline(BASE).minWeeks;
    const sixDomaines = estimateTimeline(
      answers({ domains: CISSP_DOMAINS.slice(0, 6) }),
    ).minWeeks;

    expect(sixDomaines).toBe(cinqDomaines);
  });

  it("plafonne le surcoût des domaines non couverts", () => {
    const aucunDomaine = estimateTimeline(answers({ domains: [] }));
    const unDomaine = estimateTimeline(
      answers({ domains: CISSP_DOMAINS.slice(0, 1) }),
    );

    expect(aucunDomaine.minWeeks).toBe(unDomaine.minWeeks);
  });

  it("ne descend jamais sous le plancher", () => {
    const rapide = estimateTimeline(
      answers({
        experience: "five_plus",
        examAttempt: "failed",
        englishReading: 5,
        domains: [...CISSP_DOMAINS],
      }),
    );

    expect(rapide.minWeeks).toBeGreaterThanOrEqual(MINIMUM_PREPARATION_WEEKS);
  });

  it("annonce toujours une fourchette, jamais un chiffre sec", () => {
    const timeline = estimateTimeline(BASE);

    expect(timeline.maxMonths).toBeGreaterThan(timeline.minMonths);
    expect(timeline.label).toMatch(/^\d+ à \d+ mois$/);
  });
});

describe("isGoalTight", () => {
  it("signale un objectif de 3 mois hors d'atteinte", () => {
    const tendu = answers({ examGoal: "under_three_months", englishReading: 1 });
    expect(isGoalTight(tendu, estimateTimeline(tendu))).toBe(true);
  });

  it("ne signale rien quand aucune échéance n'est fixée", () => {
    expect(isGoalTight(BASE, estimateTimeline(BASE))).toBe(false);
  });
});

describe("buildAxes", () => {
  it("expose quatre axes, tous bornés à 0–100", () => {
    const axes = buildAxes(BASE);

    expect(axes).toHaveLength(4);
    for (const axis of axes) {
      expect(axis.score).toBeGreaterThanOrEqual(0);
      expect(axis.score).toBeLessThanOrEqual(100);
      expect(axis.detail).not.toHaveLength(0);
    }
  });

  it("crédite l'année de dérogation sur le prérequis ISC²", () => {
    const avec = buildAxes(answers({ hasFourYearDegree: true }))[0].score;
    const sans = buildAxes(answers({ hasFourYearDegree: false }))[0].score;

    expect(avec).toBeGreaterThan(sans);
  });

  it("plafonne le prérequis à 100 pour un profil très expérimenté", () => {
    const axe = buildAxes(
      answers({ experience: "five_plus", hasFourYearDegree: true }),
    )[0];

    expect(axe.score).toBe(100);
  });

  it("chiffre la couverture des domaines", () => {
    expect(buildAxes(answers({ domains: [...CISSP_DOMAINS] }))[1]).toMatchObject({
      score: 100,
      detail: "8 domaines sur 8",
    });
  });
});

describe("recommend", () => {
  it("associe un verdict à chaque recommandation", () => {
    expect(recommend("ready")).toBe("now");
    expect(recommend("conditional")).toBe("with_condition");
    expect(recommend("not_yet")).toBe("build_first");
  });
});

describe("analyseProfile", () => {
  it("assemble verdict, axes, délai et chaleur", () => {
    const analysis = analyseProfile(BASE);

    expect(analysis.readiness).toBe("ready");
    expect(analysis.axes).toHaveLength(4);
    expect(analysis.timeline.label).toContain("mois");
    expect(analysis.headline).not.toHaveLength(0);
  });

  it("n'écarte jamais personne, même sans aucun prérequis", () => {
    const analysis = analyseProfile(
      answers({ professionalStatus: "student", experience: "none" }),
    );

    expect(analysis.readiness).toBe("not_yet");
    expect(analysis.recommendation).toBe("build_first");
    expect(analysis.headline).toContain("accompagne");
  });

  it("calcule la chaleur commerciale séparément des axes montrés", () => {
    const analysis = analyseProfile(
      answers({ budget: "yes", cohortAvailability: "yes" }),
    );

    expect(analysis.heatScore).toBeGreaterThan(0);
    expect(analysis.axes.map((axis) => axis.key)).not.toContain("heat");
  });
});
