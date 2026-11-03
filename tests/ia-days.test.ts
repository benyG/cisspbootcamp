import { describe, expect, it } from "vitest";

import { type IaDay, candidates, checkPicks, isWeekendDate, journeeSlot, longDate, nextJournee, rotateJournees, weekendDates } from "@/lib/ia-days";

const day = (id: number, date: string, journee: number, extra: Partial<IaDay> = {}): IaDay => ({ id, date, journee, capacity: 12, seats: 0, closed: false, start: "10:00", ...extra });
const now = new Date("2027-01-10T12:00:00Z");
// Saturdays and Sundays from 23 January 2027, J1..J5 in rotation.
const DAYS: IaDay[] = [
  day(1, "2027-01-23", 1), day(2, "2027-01-24", 2), day(3, "2027-01-30", 3), day(4, "2027-01-31", 4), day(5, "2027-02-06", 5),
  day(6, "2027-02-07", 1), day(7, "2027-02-13", 2), day(8, "2027-02-14", 3), day(9, "2027-02-20", 4), day(10, "2027-02-21", 5),
];

describe("weekend dates", () => {
  it("recognises Saturdays and Sundays only", () => {
    expect(isWeekendDate("2027-01-23")).toBe(true);
    expect(isWeekendDate("2027-01-24")).toBe(true);
    expect(isWeekendDate("2027-01-25")).toBe(false);
    expect(isWeekendDate("23/01/2027")).toBe(false);
  });

  it("lists the weekend days of a range", () => {
    expect(weekendDates("2027-01-22", "2027-02-01")).toEqual(["2027-01-23", "2027-01-24", "2027-01-30", "2027-01-31"]);
    expect(weekendDates("2027-02-01", "2027-01-01")).toEqual([]);
    expect(weekendDates("x", "y")).toEqual([]);
  });

  it("formats a long French date", () => {
    expect(longDate("2027-01-23")).toBe("samedi 23 janvier 2027");
  });
});

describe("journée slot", () => {
  it("runs 10 h to 16 h Montréal, 5 h of teaching plus 1 h of pause", () => {
    const winter = journeeSlot("2027-01-23");
    expect(winter.startsAt.toISOString()).toBe("2027-01-23T15:00:00.000Z");
    expect(winter.endsAt.toISOString()).toBe("2027-01-23T21:00:00.000Z");
    // Summer time: Montréal is UTC-4.
    expect(journeeSlot("2027-06-05", "09:30").startsAt.toISOString()).toBe("2027-06-05T13:30:00.000Z");
  });
});

describe("rotation", () => {
  it("starts at J1 and continues over open dates", () => {
    expect(rotateJournees([], ["2027-01-24", "2027-01-23", "2027-01-30"])).toEqual([
      { date: "2027-01-23", journee: 1 }, { date: "2027-01-24", journee: 2 }, { date: "2027-01-30", journee: 3 },
    ]);
  });

  it("wraps after J5, skips dates already open and ignores closed ones", () => {
    const existing = [{ date: "2027-01-23", journee: 4, closed: false }, { date: "2027-01-24", journee: 5, closed: false }, { date: "2027-01-30", journee: 1, closed: true }];
    expect(rotateJournees(existing, ["2027-01-24", "2027-01-30", "2027-01-31"])).toEqual([{ date: "2027-01-31", journee: 1 }]);
  });
});

describe("picks", () => {
  it("offers the next journée after the previous one", () => {
    expect(nextJournee({ 1: "2027-01-23" })).toBe(2);
    expect(nextJournee({ 1: "a", 2: "b", 3: "c", 4: "d", 5: "e" })).toBeNull();
    expect(candidates(DAYS, { 1: "2027-01-23" }, 2, now).map((d) => d.date)).toEqual(["2027-01-24", "2027-02-13"]);
    expect(candidates(DAYS, { 1: "2027-02-07" }, 2, now).map((d) => d.date)).toEqual(["2027-02-13"]);
  });

  it("hides full, closed and too-close dates", () => {
    const days = [day(1, "2027-01-23", 2, { seats: 12 }), day(2, "2027-01-24", 2, { closed: true }), day(3, "2027-01-30", 2), day(4, "2027-02-06", 2)];
    expect(candidates(days, {}, 2, now).map((d) => d.date)).toEqual(["2027-01-30", "2027-02-06"]);
    // Less than 24 h before the start (15:00 UTC on 30 January).
    expect(candidates(days, {}, 2, new Date("2027-01-29T16:00:00Z")).map((d) => d.date)).toEqual(["2027-02-06"]);
  });

  it("accepts journées in order", () => {
    const r = checkPicks(DAYS, { 1: "2027-01-23" }, { 2: "2027-01-24", 3: "2027-01-30", 4: "2027-02-20", 5: "2027-02-21" }, now);
    expect(r.ok && r.added.map((a) => a.day.id)).toEqual([2, 3, 9, 10]);
  });

  it("refuses a date that does not carry the journée, a skipped journée or a wrong order", () => {
    expect(checkPicks(DAYS, { 1: "2027-01-23" }, { 2: "2027-01-30" }, now)).toEqual({ ok: false, error: "Cette date ne porte pas la J2." });
    expect(checkPicks(DAYS, { 1: "2027-01-23" }, { 3: "2027-01-30" }, now)).toEqual({ ok: false, error: "Choisissez d’abord la J2." });
    expect(checkPicks(DAYS, { 1: "2027-02-07" }, { 2: "2027-01-24" }, now)).toMatchObject({ ok: false });
    expect(checkPicks(DAYS, { 1: "2027-01-23" }, {}, now)).toMatchObject({ ok: false });
    expect(checkPicks(DAYS, { 1: "2027-01-23" }, { 7: "2027-01-24" }, now)).toEqual({ ok: false, error: "Journée inconnue." });
  });

  it("never moves a journée already held, but accepts it repeated", () => {
    expect(checkPicks(DAYS, { 1: "2027-01-23", 2: "2027-01-24" }, { 2: "2027-02-13" }, now)).toMatchObject({ ok: false });
    const r = checkPicks(DAYS, { 1: "2027-01-23", 2: "2027-01-24" }, { 2: "2027-01-24", 3: "2027-01-30" }, now);
    expect(r.ok && r.added.map((a) => a.journee)).toEqual([3]);
  });

  it("refuses a full date", () => {
    const days = DAYS.map((d) => (d.id === 2 ? { ...d, seats: 12 } : d));
    expect(checkPicks(days, { 1: "2027-01-23" }, { 2: "2027-01-24" }, now)).toEqual({ ok: false, error: "La J2 du dimanche 24 janvier n’est plus disponible." });
  });
});
