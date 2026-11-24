import { describe, expect, it } from "vitest";

import { DEFAULT_OFFER, draftProposal, durationLabel, isDepositReference, priceLabel, proposalTimeline, proposalTotals, requestSchema, resolveOffer, splitName, zoneOfTier } from "@/lib/enterprise";

const pkg = (code: string) => DEFAULT_OFFER.packages.find((p) => p.code === code)!;

describe("catalogue", () => {
  it("keeps the five steps validated with Ben, in order", () => {
    expect(DEFAULT_OFFER.packages.map((p) => p.code)).toEqual(["diagnostic", "roadmap", "pilot", "deploy", "autopilot"]);
    expect(resolveOffer(null)).toBe(DEFAULT_OFFER);
    expect(resolveOffer({ packages: [], options: [] })).toBe(DEFAULT_OFFER);
  });
  it("prices by zone and labels starting and monthly prices", () => {
    expect(zoneOfTier("africa")).toBe("africa");
    expect(zoneOfTier("international")).toBe("intl");
    expect(zoneOfTier(null)).toBe("intl");
    expect(priceLabel(pkg("diagnostic"), "africa")).toBe("1 500 USD");
    expect(priceLabel(pkg("deploy"), "intl")).toBe("dès 20 000 USD");
    expect(priceLabel(pkg("autopilot"), "africa")).toBe("800 USD / mois");
  });
});

describe("request form", () => {
  const base = { organization: "Kofi Distribution", country: "ci", contactName: "Awa Koné", email: "AWA@kofi.ci", size: "10-50", functions: ["service"], consent: "on" };
  it("accepts a complete request and normalises it", () => {
    const r = requestSchema.parse(base);
    expect(r.country).toBe("CI");
    expect(r.email).toBe("awa@kofi.ci");
    expect(r.jobTitle).toBeNull();
  });
  it("requires an explicit consent", () => {
    expect(requestSchema.safeParse({ ...base, consent: undefined }).success).toBe(false);
  });
  it("splits a name for the lead", () => {
    expect(splitName("Awa Koné Traoré")).toEqual({ firstName: "Awa", lastName: "Koné Traoré" });
    expect(splitName("Awa")).toEqual({ firstName: "Awa", lastName: "" });
  });
});

describe("proposal", () => {
  it("drafts the Pilot and the subscription at the zone's prices, from the client's words", () => {
    const p = draftProposal({ contactName: "Awa Koné", jobTitle: "DG", need: "Trop de WhatsApp.", functions: ["service", "documents"], zone: "africa" }, DEFAULT_OFFER);
    expect(p.lines).toEqual([{ code: "pilot", priceUsd: 400_000 }, { code: "autopilot", priceUsd: 80_000 }]);
    expect(p.heard).toEqual(["Trop de WhatsApp."]);
    expect(p.processes.map((x) => [x.name, x.after])).toEqual([["Service client", "auto"], ["Factures et documents", "assist"], ["Prix et remises", "manual"]]);
  });
  it("asks half of the one-off part as deposit, or the first month alone", () => {
    expect(proposalTotals({ lines: [{ code: "pilot", priceUsd: 400_000 }, { code: "autopilot", priceUsd: 80_000 }] }, DEFAULT_OFFER)).toEqual({ onceUsd: 400_000, monthlyUsd: 80_000, depositUsd: 200_000, balanceUsd: 200_000 });
    expect(proposalTotals({ lines: [{ code: "autopilot", priceUsd: 80_000 }] }, DEFAULT_OFFER)).toEqual({ onceUsd: 0, monthlyUsd: 80_000, depositUsd: 80_000, balanceUsd: 0 });
  });
  it("lays the steps out in weeks, in catalogue order", () => {
    const t = proposalTimeline({ lines: [{ code: "autopilot", priceUsd: 1 }, { code: "pilot", priceUsd: 1 }, { code: "diagnostic", priceUsd: 1 }] }, DEFAULT_OFFER);
    expect(t.steps.map((s) => [s.pkg.code, s.when])).toEqual([["diagnostic", "Semaines 1 à 2"], ["pilot", "Semaines 3 à 6"], ["autopilot", "Ensuite, chaque mois"]]);
    expect(t.weeks).toBe(6);
    expect(durationLabel(6, true)).toBe("1 mois, puis un suivi mensuel");
    expect(durationLabel(4, false)).toBe("4 semaines");
  });
  it("routes deposit references", () => {
    expect(isDepositReference("CE-AB12-CD34")).toBe(true);
    expect(isDepositReference("CB-AB12-CD34")).toBe(false);
  });
});

describe("IA privée et souveraine", () => {
  const sov = (code: string) => DEFAULT_OFFER.sovereign.find((p) => p.code === code)!;

  it("keeps Ben's prices for the three sovereign offers", () => {
    expect(DEFAULT_OFFER.sovereign.map((p) => p.code)).toEqual(["sov_study", "sov_deploy", "sov_care"]);
    expect(priceLabel(sov("sov_study"), "africa")).toBe("2 500 USD");
    expect(priceLabel(sov("sov_study"), "intl")).toBe("5 000 USD");
    expect(priceLabel(sov("sov_deploy"), "africa")).toBe("dès 15 000 USD");
    expect(priceLabel(sov("sov_deploy"), "intl")).toBe("dès 30 000 USD");
    expect(priceLabel(sov("sov_care"), "africa")).toBe("1 200 USD / mois");
    expect(priceLabel(sov("sov_care"), "intl")).toBe("2 500 USD / mois");
  });

  it("completes a catalogue saved before the sovereign offers existed", () => {
    const old = { packages: DEFAULT_OFFER.packages, options: [] };
    const offer = resolveOffer(old);
    expect(offer.packages).toEqual(DEFAULT_OFFER.packages);
    expect(offer.sovereign.map((p) => p.code)).toEqual(["sov_study", "sov_deploy", "sov_care"]);
    expect(offer.showSovereign).toBe(true);
  });

  it("reads the « données sur site » box, unticked by default", () => {
    const base = { organization: "Clinique Awa", country: "ci", contactName: "Awa Koné", email: "awa@example.test", size: "10-50", consent: "on" };
    expect(requestSchema.parse(base).dataOnSite).toBe(false);
    expect(requestSchema.parse({ ...base, dataOnSite: "on" }).dataOnSite).toBe(true);
  });

  it("drafts a hybrid proposal starting with the study when data must stay in-house", () => {
    const p = draftProposal({ contactName: "Awa Koné", jobTitle: null, need: null, functions: ["documents"], zone: "africa", dataOnSite: true }, DEFAULT_OFFER);
    expect(p.hosting).toBe("hybrid");
    expect(p.lines).toEqual([{ code: "sov_study", priceUsd: 250_000 }, { code: "pilot", priceUsd: 400_000 }]);
    expect(p.processes.every((r) => r.local)).toBe(true);
    const cloud = draftProposal({ contactName: "Awa Koné", jobTitle: null, need: null, functions: [], zone: "africa" }, DEFAULT_OFFER);
    expect(cloud.hosting).toBe("cloud");
    expect(cloud.hardwareUsd).toBe(0);
  });

  it("puts the study first, the subscriptions last, and keeps hardware out of the money we collect", () => {
    const p = { lines: [{ code: "sov_care" as const, priceUsd: 120_000 }, { code: "sov_deploy" as const, priceUsd: 1_500_000 }, { code: "sov_study" as const, priceUsd: 250_000 }], hardwareUsd: 4_000_000 };
    const { steps, weeks } = proposalTimeline(p, DEFAULT_OFFER);
    expect(steps.map((s) => [s.pkg.code, s.when])).toEqual([["sov_study", "Semaines 1 à 3"], ["sov_deploy", "Semaines 4 à 11"], ["sov_care", "Ensuite, chaque mois"]]);
    expect(weeks).toBe(11);
    expect(proposalTotals(p, DEFAULT_OFFER)).toEqual({ onceUsd: 1_750_000, monthlyUsd: 120_000, depositUsd: 875_000, balanceUsd: 875_000 });
  });
});
