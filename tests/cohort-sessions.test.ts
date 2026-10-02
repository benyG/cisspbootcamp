import { describe, expect, it } from "vitest";

import { calendarMessage, isClock, reminderMessage, sessionDefaults, sessionDescription, sessionMessage, sessionSlot, sessionSubject, slotLabel, zonedInstant } from "@/lib/cohort-sessions";
import { buildSessions } from "@/lib/reading-plan/data";

const days = buildSessions("2026-10-03"); // Saturday start, Ben's October cohort
const j1 = days[0];
const j3 = days[2];

describe("horaires des sessions (Ben, 02/10)", () => {
  it("soirées à 19 h, week-ends à 9 h avec une heure de pause", () => {
    expect(sessionDefaults("2026-10-05")).toEqual({ start: "19:00", pause: 0 });
    expect(sessionDefaults("2026-10-03")).toEqual({ start: "09:00", pause: 60 });
  });

  it("calcule le créneau à l'heure de Dakar : 5 h 30 de cours + 1 h de pause", () => {
    const { startsAt, endsAt } = sessionSlot(j1, "09:00", 60);
    expect(startsAt.toISOString()).toBe("2026-10-03T09:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-10-03T15:30:00.000Z");
    expect(slotLabel(startsAt, endsAt)).toBe("samedi 3 octobre, de 9 h à 15 h 30");
    const evening = sessionSlot(j3, "19:00", 0);
    expect(slotLabel(evening.startsAt, evening.endsAt)).toBe("lundi 5 octobre, de 19 h à 21 h");
  });

  it("convertit n'importe quel fuseau, heure d'été comprise", () => {
    expect(zonedInstant("2026-10-05", "19:00", "Europe/Paris").toISOString()).toBe("2026-10-05T17:00:00.000Z");
    expect(zonedInstant("2026-12-05", "19:00", "Europe/Paris").toISOString()).toBe("2026-12-05T18:00:00.000Z");
    expect(zonedInstant("2026-10-05", "19:00", "Africa/Douala").toISOString()).toBe("2026-10-05T18:00:00.000Z");
  });

  it("valide l'heure saisie", () => {
    expect(isClock("19:00")).toBe(true);
    expect(isClock("24:00")).toBe(false);
    expect(isClock("7h")).toBe(false);
  });
});

describe("messages des sessions", () => {
  const { startsAt, endsAt } = sessionSlot(j3, "19:00", 0);
  const planUrl = "https://x.test/plan-de-lecture?debut=2026-10-03";

  it("le message de chacun : prénom, horaire, programme, lectures, Meet, plan", () => {
    const text = sessionMessage({ firstName: "Awa", session: j3, startsAt, endsAt, meetUrl: "https://meet.google.com/abc-defg-hij", planUrl });
    expect(text).toMatch(/^Bonjour Awa,/);
    expect(text).toContain("Notre session J3 a lieu le lundi 5 octobre, de 19 h à 21 h (heure de Dakar)");
    expect(text).toContain(`Au programme : ${j3.title}.`);
    expect(text).toContain("À avoir lu avant la session :");
    for (const r of j3.read) expect(text).toContain(`Chapitre ${r.ch}`);
    expect(text).toContain("Rejoindre la session : https://meet.google.com/abc-defg-hij");
    expect(text).toContain(`Votre plan de lecture : ${planUrl}`);
    expect(text.match(/Plan de lecture|plan de lecture :/g)?.length).toBe(1);
    expect(sessionSubject(j3, startsAt)).toBe("J3 · lundi 5 octobre, 19 h · CISSP Bootcamp");
  });

  it("la dernière session annonce l'examen blanc", () => {
    const last = days[days.length - 1];
    const slot = sessionSlot(last, "09:00", 60);
    expect(sessionDescription({ session: last, ...slot, meetUrl: null, planUrl })).toMatch(/examen blanc vous est envoyé une semaine après/);
  });

  it("rappel et calendrier complet", () => {
    expect(reminderMessage({ firstName: "Awa", session: j3, startsAt, endsAt, meetUrl: "https://meet.google.com/x" })).toContain("commence dans une heure : lundi 5 octobre, de 19 h à 21 h");
    const cal = calendarMessage({ firstName: "Awa", items: [{ session: j3, startsAt, endsAt, meetUrl: "https://meet.google.com/x" }], planUrl });
    expect(cal).toContain("J3 · lundi 5 octobre, de 19 h à 21 h");
    expect(cal).toContain("Lien : https://meet.google.com/x");
  });
});
