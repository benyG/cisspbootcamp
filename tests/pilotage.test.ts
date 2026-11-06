import { describe, expect, it } from "vitest";

import { chartSeries, closeDayFor, curveFor, dayFromStart, expectedShare, forecastSentence, pilot, stateLabel } from "@/lib/pilotage";

const start = new Date("2026-12-14T00:00:00Z");
const at = (j: number) => new Date(start.getTime() + j * 86_400_000 + 12 * 3_600_000);

describe("target curve", () => {
  it("ends at the admissions close: J-7 for certifications, J-1 for the Bâtisseur IA", () => {
    expect(closeDayFor("cissp")).toBe(-7);
    expect(closeDayFor("ia")).toBe(-1);
    expect(curveFor("cissp").at(-1)).toEqual([-7, 1]);
    expect(curveFor("ia").at(-1)).toEqual([-1, 1]);
  });

  it("is 0 before J-60, 20 % at J-45, 50 % at J-21, 100 % from the close", () => {
    expect(expectedShare(-70, "cissp")).toBe(0);
    expect(expectedShare(-60, "cissp")).toBe(0);
    expect(expectedShare(-45, "cissp")).toBeCloseTo(0.2);
    expect(expectedShare(-21, "cissp")).toBeCloseTo(0.5);
    expect(expectedShare(-14, "cissp")).toBeCloseTo(0.75);
    expect(expectedShare(-7, "cissp")).toBe(1);
    expect(expectedShare(3, "cissp")).toBe(1);
  });

  it("counts days on UTC calendar days", () => {
    expect(dayFromStart(start, new Date("2026-12-13T23:59:00Z"))).toBe(-1);
    expect(dayFromStart(start, new Date("2026-12-14T00:01:00Z"))).toBe(0);
  });
});

describe("pilot", () => {
  it("flags a cohort behind the curve, with the seats missing", () => {
    // J-38: 2.9 seats expected (rounded to 3), 2 paid.
    const p = pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-50), at(-41)] }, at(-38));
    expect(p.day).toBe(-38);
    expect(p.expected).toBe(3);
    expect(p.behind).toBe(1);
    expect(p.state).toBe("late");
    expect(stateLabel(p)).toBe("En retard de 1 place");
  });

  it("forecasts from the pace of the last three weeks, to the close", () => {
    // 5 paid, 3 of them in the last 21 days → 1/7 per day; 31 days to J-7 → +4.4 → 9.
    const p = pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-70), at(-62), at(-50), at(-45), at(-40)] }, at(-38));
    expect(p.paid).toBe(5);
    expect(p.weeklyPace).toBe(1);
    expect(p.forecast).toBe(9);
    expect(forecastSentence(p)).toBe("À ce rythme (1 inscription par semaine), la cohorte finirait à 9 sur 10 à la fermeture des admissions.");
  });

  it("never forecasts below what is paid, and says when the pace is too young", () => {
    const quiet = pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-70)] }, at(-20));
    expect(quiet.forecast).toBe(1);
    const young = pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [] }, at(-57));
    expect(young.forecast).toBeNull();
    expect(forecastSentence(young)).toContain("quand la campagne aura un rythme");
  });

  it("knows the campaign is not open, the goal reached, or the admissions closed", () => {
    expect(pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [] }, at(-90)).state).toBe("not_open");
    expect(pilot({ program: "ia", startsAt: start, goal: 2, paidAt: [at(-30), at(-20)] }, at(-10)).state).toBe("reached");
    const closed = pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-30)] }, at(-3));
    expect(closed.state).toBe("closed");
    expect(forecastSentence(closed)).toBe("Admissions fermées avec 1 place sur 10.");
  });

  it("is ahead when more seats are paid than the curve expects", () => {
    expect(pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-58), at(-55), at(-50)] }, at(-48)).state).toBe("ahead");
  });

  it("ignores payments dated after now", () => {
    expect(pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-30)] }, at(-40)).paid).toBe(0);
  });
});

describe("chart series", () => {
  it("draws the target to the goal and the paid seats as steps up to today", () => {
    const s = chartSeries({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-50), at(-41)] }, at(-38));
    expect(s.target).toEqual([[-60, 0], [-45, 2], [-21, 5], [-7, 10]]);
    expect(s.paid).toEqual([[-60, 0], [-50, 0], [-50, 1], [-41, 1], [-41, 2], [-38, 2]]);
    expect(s.today).toBe(-38);
  });
});
