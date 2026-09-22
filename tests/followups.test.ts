import { describe, expect, it } from "vitest";

import { FOLLOWUP_DAYS, hoursSince, nextFollowupAt, postponedAt } from "@/lib/followups";

const T0 = new Date("2026-10-05T10:00:00.000Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

describe("nextFollowupAt", () => {
  it("après le scanner : J+2 puis J+7, puis plus rien", () => {
    expect(nextFollowupAt("scanner", 0, T0)).toEqual(days(2));
    expect(nextFollowupAt("scanner", 1, T0)).toEqual(days(7));
    expect(nextFollowupAt("scanner", 2, T0)).toBeNull();
  });

  it("après un appel « à relancer » : J+3 une seule fois", () => {
    expect(nextFollowupAt("afterCall", 0, T0)).toEqual(days(3));
    expect(nextFollowupAt("afterCall", 1, T0)).toBeNull();
  });

  it("place réservée non payée : J+1 puis J+3", () => {
    expect(nextFollowupAt("unpaid", 0, T0)).toEqual(days(1));
    expect(nextFollowupAt("unpaid", 1, T0)).toEqual(days(3));
    expect(nextFollowupAt("unpaid", 2, T0)).toBeNull();
  });

  it("les délais sont ceux de la spec A6", () => {
    expect(FOLLOWUP_DAYS).toEqual({ scanner: [2, 7], afterCall: [3], unpaid: [1, 3] });
  });
});

describe("postponedAt / hoursSince", () => {
  it("reporte de deux jours", () => {
    expect(postponedAt(T0)).toEqual(days(2));
  });

  it("compte des heures entières", () => {
    expect(hoursSince(T0, new Date(T0.getTime() + 25.9 * 3_600_000))).toBe(25);
  });
});
