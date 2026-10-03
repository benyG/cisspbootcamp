import { describe, expect, it } from "vitest";

import { automaticCohortStatus, cohortHasStarted } from "@/lib/cohorts";
import { readingPlanUrl } from "@/lib/reading-plan/page";

const cohort = (over: Partial<{ status: string; paid: number; capacity: number }> = {}) => ({
  status: "open",
  startsAt: new Date("2026-10-04T00:00:00Z"),
  endsAt: new Date("2026-10-18T00:00:00Z"),
  capacity: 5,
  paid: 2,
  ...over,
});
const at = (iso: string) => new Date(iso);

describe("statut automatique des cohortes (Ben, 03/10)", () => {
  it("passe « En cours » le premier jour, à minuit", () => {
    expect(automaticCohortStatus(cohort(), at("2026-10-03T23:59:00Z"))).toBe("open");
    expect(automaticCohortStatus(cohort(), at("2026-10-04T00:00:00Z"))).toBe("running");
    expect(automaticCohortStatus(cohort({ status: "planned" }), at("2026-10-10T12:00:00Z"))).toBe("running");
    expect(automaticCohortStatus(cohort({ status: "full", paid: 5 }), at("2026-10-05T12:00:00Z"))).toBe("running");
  });

  it("passe « Terminée » une fois le dernier jour fini", () => {
    expect(automaticCohortStatus(cohort({ status: "running" }), at("2026-10-18T20:00:00Z"))).toBe("running");
    expect(automaticCohortStatus(cohort({ status: "running" }), at("2026-10-19T00:00:00Z"))).toBe("done");
  });

  it("passe « Complète » quand la capacité est payée, et rouvre si une place se libère avant le début", () => {
    expect(automaticCohortStatus(cohort({ paid: 5 }), at("2026-10-01T12:00:00Z"))).toBe("full");
    expect(automaticCohortStatus(cohort({ status: "full", paid: 4 }), at("2026-10-01T12:00:00Z"))).toBe("open");
    expect(automaticCohortStatus(cohort({ status: "planned", paid: 5 }), at("2026-10-01T12:00:00Z"))).toBe("planned");
  });

  it("une cohorte commencée est verrouillée", () => {
    expect(cohortHasStarted(cohort(), at("2026-10-03T12:00:00Z"))).toBe(false);
    expect(cohortHasStarted(cohort(), at("2026-10-04T00:00:00Z"))).toBe(true);
    expect(cohortHasStarted(cohort({ status: "running" }), at("2026-10-01T00:00:00Z"))).toBe(true);
  });

  it("le lien du plan de lecture porte la cohorte, pour suivre une date déplacée", () => {
    expect(readingPlanUrl("https://x.test", new Date("2026-10-04T00:00:00Z"), 7)).toBe("https://x.test/plan-de-lecture?debut=2026-10-04&cohorte=7");
  });
});
