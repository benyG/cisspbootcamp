import { describe, expect, it } from "vitest";

import {
  ADMISSION_CLOSE_DAYS,
  type CohortCandidate,
  admissionClosesAt,
  availabilityQuestionLabel,
  formatAdmissionDeadline,
  isAdmissionOpen,
  buildGauge,
  formatCohortMonth,
  remainingSeats,
  selectRegistrationCohort,
} from "@/lib/cohorts";

const NOW = new Date("2026-10-01T00:00:00.000Z");

const cohort = (overrides: Partial<CohortCandidate> = {}): CohortCandidate => ({
  id: 1,
  name: "Cohorte janvier 2027",
  startsAt: new Date("2027-01-11T18:00:00.000Z"),
  capacity: 10,
  status: "open",
  confirmedCount: 0,
  ...overrides,
});

describe("remainingSeats", () => {
  it("compte les places restantes", () => {
    expect(remainingSeats(cohort({ confirmedCount: 4 }))).toBe(6);
  });

  it("ne descend jamais sous zéro en cas de surbooking", () => {
    expect(remainingSeats(cohort({ confirmedCount: 12 }))).toBe(0);
  });
});

describe("selectRegistrationCohort", () => {
  it("retient la cohorte ouverte la plus proche", () => {
    const janvier = cohort({ id: 1 });
    const mars = cohort({ id: 2, startsAt: new Date("2027-03-08T18:00:00.000Z") });

    expect(selectRegistrationCohort([mars, janvier], NOW)?.id).toBe(1);
  });

  it("bascule sur la suivante quand la première est pleine", () => {
    const pleine = cohort({ id: 1, confirmedCount: 10 });
    const suivante = cohort({
      id: 2,
      startsAt: new Date("2027-03-08T18:00:00.000Z"),
    });

    expect(selectRegistrationCohort([pleine, suivante], NOW)?.id).toBe(2);
  });

  it("ignore les cohortes non ouvertes", () => {
    const planned = cohort({ id: 1, status: "planned" });
    const running = cohort({ id: 2, status: "running" });

    expect(selectRegistrationCohort([planned, running], NOW)).toBeNull();
  });

  it("ignore une cohorte déjà commencée", () => {
    const passee = cohort({
      id: 1,
      startsAt: new Date("2026-09-01T18:00:00.000Z"),
    });

    expect(selectRegistrationCohort([passee], NOW)).toBeNull();
  });

  it("renvoie null quand rien n'est en vente, sans lever d'erreur", () => {
    expect(selectRegistrationCohort([], NOW)).toBeNull();
  });

  it("ferme les admissions 7 jours avant le démarrage et bascule sur la suivante", () => {
    const janvier = cohort({ id: 1 });
    const mars = cohort({ id: 2, startsAt: new Date("2027-03-08T18:00:00.000Z") });
    const sixJoursAvant = new Date("2027-01-05T18:00:00.000Z");

    expect(selectRegistrationCohort([janvier, mars], sixJoursAvant)?.id).toBe(2);
  });
});

describe("fenêtre d'admission", () => {
  const startsAt = new Date("2027-01-11T18:00:00.000Z");

  it("se ferme un nombre fixe de jours avant le démarrage", () => {
    expect(ADMISSION_CLOSE_DAYS).toBe(7);
    expect(admissionClosesAt(startsAt).toISOString()).toBe("2027-01-04T18:00:00.000Z");
  });

  it("est ouverte avant la date limite, fermée à partir d'elle", () => {
    expect(isAdmissionOpen(startsAt, new Date("2027-01-04T17:59:59.000Z"))).toBe(true);
    expect(isAdmissionOpen(startsAt, new Date("2027-01-04T18:00:00.000Z"))).toBe(false);
  });

  it("nomme le jour limite en français", () => {
    expect(formatAdmissionDeadline(startsAt)).toBe("4 janvier");
  });
});

describe("formatCohortMonth", () => {
  it("nomme le mois en français", () => {
    expect(formatCohortMonth(new Date("2027-01-11T18:00:00.000Z"))).toBe(
      "janvier 2027",
    );
  });

  it("ne décale pas le mois sur une date de début de mois", () => {
    expect(formatCohortMonth(new Date("2027-03-01T00:00:00.000Z"))).toBe(
      "mars 2027",
    );
  });
});

describe("availabilityQuestionLabel", () => {
  it("nomme la cohorte en vente", () => {
    expect(availabilityQuestionLabel(cohort())).toContain("janvier 2027");
  });

  it("reste posable quand aucune cohorte n'est ouverte", () => {
    const label = availabilityQuestionLabel(null);

    expect(label).toContain("annoncée");
    expect(label.length).toBeGreaterThan(0);
  });
});

describe("buildGauge", () => {
  it("compte les places restantes", () => {
    const gauge = buildGauge({ capacity: 10, confirmed: 3, preEngaged: 0 });

    expect(gauge.remaining).toBe(7);
    expect(gauge.confirmedPercent).toBe(30);
    expect(gauge.label).toBe("7 places restantes sur 10");
  });

  it("projette les pré-engagements sans dépasser la capacité", () => {
    const gauge = buildGauge({ capacity: 10, confirmed: 6, preEngaged: 9 });

    expect(gauge.projectedPercent).toBe(100);
    expect(gauge.remaining).toBe(4);
  });

  it("dit « Complet » quand tout est payé", () => {
    expect(buildGauge({ capacity: 10, confirmed: 10, preEngaged: 2 }).label).toBe("Complet");
  });

  it("accorde le singulier", () => {
    expect(buildGauge({ capacity: 10, confirmed: 9, preEngaged: 0 }).label).toBe("1 place restante sur 10");
  });

  it("ne casse pas sur une capacité nulle ou un surbooking", () => {
    expect(buildGauge({ capacity: 0, confirmed: 0, preEngaged: 0 }).confirmedPercent).toBe(0);
    expect(buildGauge({ capacity: 10, confirmed: 12, preEngaged: 0 }).remaining).toBe(0);
  });
});

describe("places tenues (docs/CONVERSION.md §2.4)", () => {
  it("une place tenue compte comme prise dans la jauge et dans les places restantes", () => {
    const gauge = buildGauge({ capacity: 10, confirmed: 3, held: 2, preEngaged: 1 });
    expect(gauge.remaining).toBe(5);
    expect(gauge.label).toBe("5 places restantes sur 10");
    expect(gauge.confirmedPercent).toBe(30);
    expect(gauge.takenPercent).toBe(50);
    expect(gauge.projectedPercent).toBe(60);
  });

  it("les places tenues ne dépassent jamais la capacité", () => {
    expect(buildGauge({ capacity: 10, confirmed: 9, held: 5, preEngaged: 0 }).remaining).toBe(0);
  });

  it("remainingSeats retire les places tenues d'une cohorte candidate", () => {
    expect(remainingSeats(cohort({ confirmedCount: 4, heldCount: 3 }))).toBe(3);
  });
});
