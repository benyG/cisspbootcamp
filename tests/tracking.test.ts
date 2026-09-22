import { describe, expect, it } from "vitest";

import { CLIENT_EVENTS, buildDropoff, buildFunnel, completionRate, isEventName, worstDrop } from "@/lib/tracking/events";

describe("buildFunnel", () => {
  it("calcule le taux depuis l'étape précédente et la variation hebdomadaire", () => {
    const rows = buildFunnel({ landing_view: 200, scanner_start: 80, scanner_submit: 40, paid: 2 }, { landing_view: 100, scanner_start: 50, scanner_submit: 40 });
    expect(rows[0]).toMatchObject({ name: "landing_view", count: 200, rateFromPrevious: null, deltaPercent: 100 });
    expect(rows[1]).toMatchObject({ name: "scanner_start", count: 80, rateFromPrevious: 40, deltaPercent: 60 });
    expect(rows[2]).toMatchObject({ name: "scanner_submit", count: 40, rateFromPrevious: 50, deltaPercent: 0 });
  });

  it("ne divise jamais par zéro", () => {
    const rows = buildFunnel({}, {});
    expect(rows.every((r) => r.count === 0 && r.rateFromPrevious === null && r.deltaPercent === null)).toBe(true);
  });
});

describe("buildDropoff et worstDrop", () => {
  it("exprime chaque question en part des personnes ayant commencé", () => {
    const rows = buildDropoff(new Map([[1, 50], [2, 45], [3, 20], [4, 18]]), 4);
    expect(rows.map((r) => r.share)).toEqual([100, 90, 40, 36]);
    expect(worstDrop(rows)).toEqual({ step: 2, lostPercent: 50 });
  });

  it("reste stable sans aucune donnée", () => {
    const rows = buildDropoff(new Map(), 11);
    expect(rows).toHaveLength(11);
    expect(worstDrop(rows)).toBeNull();
    expect(completionRate(0, 0)).toBeNull();
  });
});

describe("événements autorisés depuis le navigateur", () => {
  it("refuse au navigateur les événements qui prouvent un paiement ou une réservation", () => {
    expect(CLIENT_EVENTS).not.toContain("paid");
    expect(CLIENT_EVENTS).not.toContain("booking_done");
    expect(CLIENT_EVENTS).not.toContain("scanner_submit");
    expect(isEventName("paid")).toBe(true);
    expect(isEventName("n'importe quoi")).toBe(false);
  });
});
