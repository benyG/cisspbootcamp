import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIMITS,
  TOTAL_HOURS,
  checkProposal,
  clockLabel,
  dayMinutes,
  mockExamDate,
  personalSessions,
  placedHours,
  slotOf,
  startOptions,
  windowDates,
} from "@/lib/personal-schedule";

const window = windowDates(new Date("2026-10-04T15:00:00Z"));
const opts = (date: string, extend = false) => startOptions(date, extend, DEFAULT_LIMITS);

describe("calendrier personnel (Ben, 04/10)", () => {
  it("un mois à partir du jour d'envoi, en heure de Montréal", () => {
    expect(window[0]).toBe("2026-10-04");
    expect(window[window.length - 1]).toBe("2026-11-03");
    // 01:00 UTC on 5 October is still 4 October in Montréal.
    expect(windowDates(new Date("2026-10-05T01:00:00Z"))[0]).toBe("2026-10-04");
  });

  it("semaine : 2 h, à partir de 16 h ; mercredi compris", () => {
    expect(opts("2026-10-07")[0]).toBe(16 * 60);
    expect(opts("2026-10-07").at(-1)).toBe(20 * 60); // ends by 22 h
    expect(dayMinutes("2026-10-07", false)).toBe(120);
    expect(opts("2026-10-07", true)).toEqual([]); // no extension on weekdays
  });

  it("week-end : 5 h 30 + 30 min de pause, à partir de 10 h ; prolongé, 7 h pause comprise", () => {
    expect(opts("2026-10-10")[0]).toBe(10 * 60);
    expect(dayMinutes("2026-10-10", false)).toBe(6 * 60);
    expect(dayMinutes("2026-10-10", true)).toBe(7 * 60);
    expect(opts("2026-10-10").at(-1)).toBe(13 * 60); // 13 h + 6 h = 19 h
    expect(opts("2026-10-10", true).at(-1)).toBe(12 * 60);
  });

  it("respecte l'heure de fin réglée par Ben", () => {
    expect(startOptions("2026-10-07", false, { latestEndWeekday: 19 * 60, latestEndWeekend: 18 * 60 })).toEqual([16 * 60, 16 * 60 + 30, 17 * 60]);
  });

  it("ferme les créneaux où Ben est pris, et ceux déjà passés", () => {
    const busy = [{ start: new Date("2026-10-07T21:00:00Z"), end: new Date("2026-10-07T22:00:00Z") }]; // 17 h–18 h Montréal
    expect(startOptions("2026-10-07", false, DEFAULT_LIMITS, busy)).toEqual([18 * 60, 18 * 60 + 30, 19 * 60, 19 * 60 + 30, 20 * 60]);
    expect(startOptions("2026-10-07", false, DEFAULT_LIMITS, [], new Date("2026-10-07T23:10:00Z"))).toEqual([19 * 60 + 30, 20 * 60]);
  });

  it("l'instant tient compte de l'heure d'été de Montréal", () => {
    expect(slotOf({ date: "2026-10-07", start: 16 * 60, extend: false }).startsAt.toISOString()).toBe("2026-10-07T20:00:00.000Z");
    expect(slotOf({ date: "2026-11-02", start: 16 * 60, extend: false }).startsAt.toISOString()).toBe("2026-11-02T21:00:00.000Z");
    expect(clockLabel(16 * 60 + 30)).toBe("16 h 30");
  });

  it("place les 40 h dans l'ordre des dates, J1 au premier jour", () => {
    const sessions = personalSessions([
      { date: "2026-10-11", start: 600, extend: true },
      { date: "2026-10-10", start: 600, extend: false },
    ]);
    expect(sessions.map((s) => [s.n, s.date, s.hours])).toEqual([[1, "2026-10-10", 5.5], [2, "2026-10-11", 6.5]]);
    expect(sessions[0].title).toMatch(/^Gouvernance/);
  });

  it("refuse tant que les 40 h ne tiennent pas ; laisse de côté les jours en trop", () => {
    const weekends = window.filter((d) => [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()));
    const few = weekends.slice(0, 6).map((date) => ({ date, start: 600, extend: false }));
    expect(checkProposal(few, { window, limits: DEFAULT_LIMITS })).toMatchObject({ ok: false, error: expect.stringMatching(/Il manque/) });
    const all = weekends.map((date) => ({ date, start: 600, extend: true }));
    const ok = checkProposal(all, { window, limits: DEFAULT_LIMITS });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(placedHours(ok.sessions)).toBe(TOTAL_HOURS);
      expect(ok.days.length).toBe(ok.sessions.length);
      expect(ok.days.length).toBeLessThan(all.length);
      expect(mockExamDate(ok.sessions)).toBe(new Date(Date.parse(`${ok.sessions.at(-1)!.date}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10));
    }
  });

  it("refuse un jour hors période, en double ou à une heure non permise", () => {
    expect(checkProposal([{ date: "2026-12-01", start: 960, extend: false }], { window, limits: DEFAULT_LIMITS })).toMatchObject({ ok: false, error: expect.stringMatching(/hors de la période/) });
    expect(checkProposal([{ date: "2026-10-07", start: 900, extend: false }], { window, limits: DEFAULT_LIMITS })).toMatchObject({ ok: false, error: expect.stringMatching(/plus disponible/) });
    expect(checkProposal([{ date: "2026-10-07", start: 960, extend: false }, { date: "2026-10-07", start: 990, extend: false }], { window, limits: DEFAULT_LIMITS })).toMatchObject({ ok: false, error: expect.stringMatching(/deux fois/) });
  });
});
