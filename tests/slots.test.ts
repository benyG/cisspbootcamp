import { describe, expect, it } from "vitest";

import {
  type AvailabilityRule,
  BUFFER_MINUTES,
  MAX_DAYS_AHEAD,
  MIN_NOTICE_HOURS,
  SLOT_MINUTES,
  addMinutes,
  computeSlots,
  consultingShape,
  dropWeeksAtCap,
  formatSlotTime,
  groupSlotsByDay,
} from "@/lib/calendar/slots";

// Douala is UTC+1 all year — no DST, so expectations stay legible.
const ZONE = "Africa/Douala";

/** Monday 2026-10-05, 08:00 in Douala (07:00 UTC). */
const NOW = new Date("2026-10-05T07:00:00.000Z");

/** Weekdays, 18:00–19:00 Douala: four 15-minute slots per evening. */
const WEEKDAYS: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start: "18:00",
  end: "19:00",
}));

const slots = (overrides: Partial<Parameters<typeof computeSlots>[0]> = {}) =>
  computeSlots({ rules: WEEKDAYS, coachTimeZone: ZONE, busy: [], now: NOW, ...overrides });

describe("computeSlots", () => {
  it("découpe chaque plage en créneaux de 15 minutes", () => {
    const tuesday = slots().filter((slot) => slot.toISOString().startsWith("2026-10-06"));

    expect(tuesday.map((slot) => slot.toISOString())).toEqual([
      "2026-10-06T17:00:00.000Z",
      "2026-10-06T17:15:00.000Z",
      "2026-10-06T17:30:00.000Z",
      "2026-10-06T17:45:00.000Z",
    ]);
  });

  it("respecte le préavis minimum", () => {
    // 08:00 Douala + 12 h = 20:00 : les créneaux du soir même sont trop tôt.
    const late = slots({ now: new Date("2026-10-05T07:00:00.000Z") });
    const sameEvening = late.filter((slot) => slot < new Date("2026-10-05T19:00:00.000Z"));

    // 18:00–19:00 Douala est avant 20:00, donc exclu ; aucun créneau lundi.
    expect(sameEvening).toHaveLength(0);
  });

  it("ne dépasse pas l'horizon", () => {
    const horizon = addMinutes(NOW, MAX_DAYS_AHEAD * 24 * 60);
    for (const slot of slots()) {
      expect(slot.getTime()).toBeLessThan(horizon.getTime());
      expect(slot.getTime()).toBeGreaterThanOrEqual(
        addMinutes(NOW, MIN_NOTICE_HOURS * 60).getTime(),
      );
    }
  });

  it("ignore les jours sans règle", () => {
    const weekend = slots().filter((slot) => [0, 6].includes(slot.getUTCDay()));
    expect(weekend).toHaveLength(0);
  });

  it("retire un créneau occupé, tampon compris", () => {
    // Tuesday 18:15–18:30 Douala busy = 17:15–17:30 UTC.
    const busy = [{ start: new Date("2026-10-06T17:15:00.000Z"), end: new Date("2026-10-06T17:30:00.000Z") }];
    const tuesday = slots({ busy })
      .filter((slot) => slot.toISOString().startsWith("2026-10-06"))
      .map((slot) => slot.toISOString());

    // 18:00 finishes at 18:15 + 5 min buffer → touches 18:15, removed.
    // 18:15 is busy. 18:30 starts 5 min after 18:30 − buffer → touches, removed.
    // 18:45 is free.
    expect(tuesday).toEqual(["2026-10-06T17:45:00.000Z"]);
  });

  it("garde un créneau qui ne touche pas l'occupation, tampon compris", () => {
    // Busy 18:20:01–18:24 would only overlap 18:15 (ends 18:30+5) and 18:30 (starts 18:25).
    const busy = [{ start: new Date("2026-10-06T17:50:00.000Z"), end: new Date("2026-10-06T17:55:00.000Z") }];
    const tuesday = slots({ busy })
      .filter((slot) => slot.toISOString().startsWith("2026-10-06"))
      .map((slot) => slot.toISOString());

    // 18:45 runs to 19:00 + buffer 19:05 → overlaps 18:50–18:55. Removed.
    // 18:30 runs to 18:45 + buffer 18:50 → touches 18:50 exactly: not overlapping (exclusive end).
    expect(tuesday).toEqual([
      "2026-10-06T17:00:00.000Z",
      "2026-10-06T17:15:00.000Z",
      "2026-10-06T17:30:00.000Z",
    ]);
  });

  it("rend les créneaux triés", () => {
    const all = slots({
      rules: [
        { weekday: 2, start: "18:00", end: "18:30" },
        { weekday: 2, start: "09:00", end: "09:30" },
      ],
    });
    for (let i = 1; i < all.length; i++) {
      expect(all[i].getTime()).toBeGreaterThan(all[i - 1].getTime());
    }
  });

  it("gère une zone avec heure d'été sans décaler l'heure murale", () => {
    // Paris: 2026-10-25 switches from UTC+2 to UTC+1. 18:00 Paris must stay 18:00.
    const rules = [{ weekday: 1, start: "18:00", end: "18:15" }]; // Mondays only
    const paris = computeSlots({
      rules,
      coachTimeZone: "Europe/Paris",
      busy: [],
      now: new Date("2026-10-18T06:00:00.000Z"),
    });

    expect(paris.map((slot) => formatSlotTime(slot, "Europe/Paris"))).toEqual(["18:00", "18:00"]);
    // Before the switch: 16:00 UTC. After: 17:00 UTC.
    expect(paris.map((slot) => slot.toISOString())).toEqual([
      "2026-10-19T16:00:00.000Z",
      "2026-10-26T17:00:00.000Z",
    ]);
  });
});

describe("constantes", () => {
  it("correspondent à la spec A3", () => {
    expect(SLOT_MINUTES).toBe(15);
    expect(BUFFER_MINUTES).toBe(5);
    expect(MIN_NOTICE_HOURS).toBe(12);
    expect(MAX_DAYS_AHEAD).toBe(14);
  });
});

describe("groupSlotsByDay / formatSlotTime", () => {
  it("regroupe par jour local du prospect et affiche l'heure locale", () => {
    const utc = [
      new Date("2026-10-06T17:00:00.000Z"),
      new Date("2026-10-06T17:15:00.000Z"),
      new Date("2026-10-07T17:00:00.000Z"),
    ];
    const grouped = groupSlotsByDay(utc, "America/Montreal"); // UTC−4 in October

    expect(grouped).toHaveLength(2);
    expect(grouped[0].day).toMatch(/mardi 6 octobre/);
    expect(grouped[0].slots).toHaveLength(2);
    expect(formatSlotTime(utc[0], "America/Montreal")).toBe("13:00");
    expect(formatSlotTime(utc[0], "Africa/Douala")).toBe("18:00");
  });
});

describe("créneaux de conseil", () => {
  /** Wednesday 18:00–20:00 Douala, the window Ben set for consulting. */
  const WEDNESDAY: AvailabilityRule[] = [{ weekday: 3, start: "18:00", end: "20:00" }];

  it("propose des séances de 60 minutes toutes les 30 minutes dans la plage", () => {
    const wednesday = computeSlots({ rules: WEDNESDAY, coachTimeZone: ZONE, busy: [], now: NOW, shape: consultingShape(60) })
      .filter((slot) => slot.toISOString().startsWith("2026-10-07"));
    expect(wednesday.map((slot) => slot.toISOString())).toEqual([
      "2026-10-07T17:00:00.000Z",
      "2026-10-07T17:30:00.000Z",
      "2026-10-07T18:00:00.000Z",
    ]);
  });

  it("une séance de 90 minutes ne peut commencer qu'à 18:00 ou 18:30", () => {
    const wednesday = computeSlots({ rules: WEDNESDAY, coachTimeZone: ZONE, busy: [], now: NOW, shape: consultingShape(90) })
      .filter((slot) => slot.toISOString().startsWith("2026-10-07"));
    expect(wednesday.map((slot) => slot.toISOString())).toEqual(["2026-10-07T17:00:00.000Z", "2026-10-07T17:30:00.000Z"]);
  });

  it("regarde cinq semaines devant, et exige 24 h de préavis", () => {
    const shape = consultingShape(60);
    const slots = computeSlots({ rules: WEDNESDAY, coachTimeZone: ZONE, busy: [], now: NOW, shape });
    const days = new Set(slots.map((slot) => slot.toISOString().slice(0, 10)));
    expect(days.size).toBe(5);
    expect(slots[0].getTime() - NOW.getTime()).toBeGreaterThanOrEqual(shape.minNoticeHours * 3_600_000);
  });

  it("un appel de découverte déjà pris bloque la séance qui le chevauche", () => {
    const busy = [{ start: new Date("2026-10-07T17:30:00.000Z"), end: new Date("2026-10-07T17:45:00.000Z") }];
    const wednesday = computeSlots({ rules: WEDNESDAY, coachTimeZone: ZONE, busy, now: NOW, shape: consultingShape(60) })
      .filter((slot) => slot.toISOString().startsWith("2026-10-07"));
    expect(wednesday.map((slot) => slot.toISOString())).toEqual(["2026-10-07T18:00:00.000Z"]);
  });
});

describe("dropWeeksAtCap (plafond de contacts gratuits)", () => {
  it("retire les créneaux des semaines qui ont déjà cinq appels, garde les autres", () => {
    const all = slots();
    const firstWeek = all.filter((slot) => slot < new Date("2026-10-12T00:00:00.000Z"));
    const booked = firstWeek.slice(0, 5);
    const kept = dropWeeksAtCap(all, booked, 5, ZONE);
    expect(kept.some((slot) => slot < new Date("2026-10-12T00:00:00.000Z"))).toBe(false);
    expect(kept.some((slot) => slot >= new Date("2026-10-12T00:00:00.000Z"))).toBe(true);
  });

  it("quatre appels ne ferment rien", () => {
    const all = slots();
    expect(dropWeeksAtCap(all, all.slice(0, 4), 5, ZONE)).toEqual(all);
  });
});
