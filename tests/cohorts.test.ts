import { describe, expect, it } from "vitest";

import {
  type CohortCandidate,
  availabilityQuestionLabel,
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
