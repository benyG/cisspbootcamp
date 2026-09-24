import { describe, expect, it } from "vitest";

import { CREDIT_WINDOW_DAYS, SERVICE_CATALOGUE, consultingCredit, formatDuration, isServiceCode, recommendedService, serviceDefinition } from "@/lib/services";

const NOW = new Date("2026-10-05T10:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("catalogue", () => {
  it("contient les quatre services validés, avec les deux paliers", () => {
    expect(SERVICE_CATALOGUE.map((s) => s.code)).toEqual(["bilan", "reconversion", "certif", "mentorat"]);
    for (const service of SERVICE_CATALOGUE) {
      expect(service.prices.africa).toBeGreaterThan(0);
      expect(service.prices.international).toBeGreaterThan(service.prices.africa);
    }
  });

  it("applique la grille décidée : 60/120 l'heure, 150/300 le pack, 99/199 le mentorat", () => {
    expect(serviceDefinition("bilan").prices).toEqual({ africa: 6_000, international: 12_000 });
    expect(serviceDefinition("certif").prices).toEqual({ africa: 6_000, international: 12_000 });
    expect(serviceDefinition("reconversion").prices).toEqual({ africa: 15_000, international: 30_000 });
    expect(serviceDefinition("mentorat").prices).toEqual({ africa: 9_900, international: 19_900 });
  });

  it("le mentorat n'est pas déductible du bootcamp, les séances à l'heure le sont", () => {
    expect(serviceDefinition("mentorat").creditable).toBe(false);
    expect(serviceDefinition("bilan").creditable).toBe(true);
    expect(serviceDefinition("reconversion").creditable).toBe(true);
  });

  it("reconnaît les codes", () => {
    expect(isServiceCode("bilan")).toBe(true);
    expect(isServiceCode("cv")).toBe(false);
    expect(isServiceCode(42)).toBe(false);
  });
});

describe("consultingCredit", () => {
  const hour = { amountUsd: 6_000, sessions: 1, sessionMinutes: 60, creditedRegistrationId: null };

  it("déduit l'heure payée dans les 90 jours", () => {
    expect(consultingCredit([{ id: 1, ...hour, paidAt: daysAgo(10) }], NOW)).toEqual({ orderId: 1, creditUsd: 6_000 });
  });

  it("ignore une commande trop ancienne ou déjà déduite", () => {
    expect(consultingCredit([{ id: 1, ...hour, paidAt: daysAgo(CREDIT_WINDOW_DAYS + 1) }], NOW)).toBeNull();
    expect(consultingCredit([{ id: 1, ...hour, paidAt: daysAgo(3), creditedRegistrationId: 7 }], NOW)).toBeNull();
    expect(consultingCredit([], NOW)).toBeNull();
  });

  it("ne déduit qu'une heure d'un pack de trois", () => {
    expect(consultingCredit([{ id: 2, amountUsd: 15_000, sessions: 3, sessionMinutes: 60, creditedRegistrationId: null, paidAt: daysAgo(1) }], NOW)).toEqual({ orderId: 2, creditUsd: 5_000 });
  });

  it("prend la commande la plus récente quand il y en a plusieurs", () => {
    const orders = [
      { id: 1, ...hour, paidAt: daysAgo(40) },
      { id: 2, ...hour, amountUsd: 12_000, paidAt: daysAgo(2) },
    ];
    expect(consultingCredit(orders, NOW)?.orderId).toBe(2);
  });
});

describe("recommendedService", () => {
  it("ne propose rien à un profil prêt", () => {
    expect(recommendedService("ready", { experience: "five_plus", professionalStatus: "employed" })).toBeNull();
  });

  it("propose le bilan en second à un profil sous conditions", () => {
    expect(recommendedService("conditional", { experience: "three_four", professionalStatus: "employed" })).toBe("bilan");
  });

  it("aiguille les « pas encore » selon l'expérience et la reconversion", () => {
    expect(recommendedService("not_yet", { experience: "one_two", professionalStatus: "employed" })).toBe("bilan");
    expect(recommendedService("not_yet", { experience: "none", professionalStatus: "student" })).toBe("reconversion");
    expect(recommendedService("not_yet", { experience: "three_four", professionalStatus: "career_change" })).toBe("reconversion");
  });
});

describe("formatDuration", () => {
  it("écrit les durées comme on les dit", () => {
    expect(formatDuration(1, 60)).toBe("1 h");
    expect(formatDuration(3, 60)).toBe("3 × 1 h");
    expect(formatDuration(2, 45)).toBe("2 × 45 min");
    expect(formatDuration(1, 90)).toBe("1 h 30");
  });
});

describe("recommendedProgram", () => {
  it("envoie vers la CC les profils sans expérience ou en reconversion, et personne d'autre", async () => {
    const { recommendedProgram } = await import("@/lib/programs");
    expect(recommendedProgram("not_yet", { experience: "none", professionalStatus: "student" })).toBe("cc");
    expect(recommendedProgram("not_yet", { experience: "three_four", professionalStatus: "career_change" })).toBe("cc");
    expect(recommendedProgram("not_yet", { experience: "one_two", professionalStatus: "employed" })).toBeNull();
    expect(recommendedProgram("conditional", { experience: "none", professionalStatus: "career_change" })).toBeNull();
    expect(recommendedProgram("ready", { experience: "five_plus", professionalStatus: "employed" })).toBeNull();
  });
});
