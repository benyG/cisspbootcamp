import { describe, expect, it } from "vitest";

import { calendarMessage, convertClock, isClock, isSessionOutdated, isSessionZone, reissuedMessage, reminderMessage, sessionDefaults, sessionDescription, sessionMessage, sessionSlot, sessionSubject, slotLabel, zonedInstant } from "@/lib/cohort-sessions";
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
    expect(text).toContain("Notre session J3 a lieu le lundi 5 octobre. L’heure figure dans l’invitation Google Agenda");
    // Ben, 03/10: no clock time in the e-mails, the invitation carries it.
    expect(text).not.toMatch(/\d+ h/);
    expect(text).toContain(`Au programme : ${j3.title}.`);
    expect(text).toContain("À avoir lu avant la session :");
    for (const r of j3.read) expect(text).toContain(`Chapitre ${r.ch}`);
    expect(text).toContain("Rejoindre la session : https://meet.google.com/abc-defg-hij");
    expect(text).toContain(`Votre plan de lecture : ${planUrl}`);
    expect(text.match(/Plan de lecture|plan de lecture :/g)?.length).toBe(1);
    expect(sessionSubject(j3)).toBe("J3 · lundi 5 octobre · CISSP Bootcamp");
  });

  it("la dernière session annonce l'examen blanc", () => {
    const last = days[days.length - 1];
    const slot = sessionSlot(last, "09:00", 60);
    expect(sessionDescription({ session: last, ...slot, meetUrl: null, planUrl })).toMatch(/examen blanc vous est envoyé une semaine après/);
  });

  it("rappel et calendrier complet", () => {
    expect(reminderMessage({ firstName: "Awa", session: j3, startsAt, endsAt, meetUrl: "https://meet.google.com/x" })).toContain("Notre session J3 commence dans une heure.");
    const cal = calendarMessage({ firstName: "Awa", items: [{ session: j3, startsAt, endsAt, meetUrl: "https://meet.google.com/x" }], planUrl });
    expect(cal).toContain("J3 · lundi 5 octobre\n");
    expect(cal).not.toMatch(/\d+ h/);
    expect(cal).toContain("Lien : https://meet.google.com/x");
  });
});

describe("nouvelle invitation après un changement de date (Ben, 03/10)", () => {
  it("repère une invitation qui n'est plus au jour du plan", () => {
    const sent = { startsAt: new Date("2026-10-03T14:00:00Z"), timezone: "Africa/Dakar" };
    expect(isSessionOutdated(sent, "2026-10-03")).toBe(false);
    expect(isSessionOutdated(sent, "2026-10-04")).toBe(true);
    // Late evening in Dakar stays on the same day.
    expect(isSessionOutdated({ startsAt: new Date("2026-10-05T19:00:00Z"), timezone: "Africa/Dakar" }, "2026-10-05")).toBe(false);
  });

  it("l'e-mail annonce que l'ancienne invitation est annulée", () => {
    const text = reissuedMessage("Bonjour Awa,\n\nNotre session J1 a lieu…", { n: 1 } as never);
    expect(text.split("\n")[2]).toMatch(/L’invitation précédente pour J1 est annulée/);
    expect(text.startsWith("Bonjour Awa,\n\n")).toBe(true);
    expect(text).toMatch(/Notre session J1 a lieu…$/);
  });
});

describe("heures saisies à Dakar ou à Montréal (Ben, 03/10)", () => {
  it("le même instant, quelle que soit la ville de saisie", () => {
    const dakar = sessionSlot(j1, "14:00", 30, "Africa/Dakar");
    const montreal = sessionSlot(j1, "10:00", 30, "America/Toronto");
    expect(montreal.startsAt.toISOString()).toBe(dakar.startsAt.toISOString());
    expect(montreal.startsAt.toISOString()).toBe("2026-10-03T14:00:00.000Z");
  });

  it("change de ville sans changer l'instant, heure d'été comprise", () => {
    expect(convertClock("2026-10-05", "19:00", "Africa/Dakar", "America/Toronto")).toBe("15:00");
    expect(convertClock("2026-10-05", "15:00", "America/Toronto", "Africa/Dakar")).toBe("19:00");
    // After the switch to winter time in Montréal (1 November), the gap is 5 hours.
    expect(convertClock("2026-11-09", "19:00", "Africa/Dakar", "America/Toronto")).toBe("14:00");
  });

  it("n'accepte que Dakar et Montréal", () => {
    expect(isSessionZone("Africa/Dakar")).toBe(true);
    expect(isSessionZone("America/Toronto")).toBe(true);
    expect(isSessionZone("Europe/Paris")).toBe(false);
  });
});
