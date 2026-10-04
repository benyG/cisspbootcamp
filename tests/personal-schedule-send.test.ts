import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  personalSchedule: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  registration: { findMany: vi.fn(), findFirst: vi.fn() },
  siteSetting: { findUnique: vi.fn() },
  actionLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const calendar = vi.hoisted(() => ({ fetchBusy: vi.fn(), createSessionEvent: vi.fn(), setEventAttendees: vi.fn() }));
vi.mock("@/lib/calendar/google", () => calendar);
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));

import { windowDates } from "@/lib/personal-schedule";
import { confirmPersonalSchedule, proposePersonalSchedule, refusePersonalSchedule } from "@/lib/personal-schedule-send";

const TOKEN = "t".repeat(43);
const sentAt = new Date("2026-10-04T15:00:00Z");
const now = new Date("2026-10-04T16:00:00Z");
// Every weekend of the month, extended: enough for the 40 hours.
const weekends = windowDates(sentAt).filter((d) => [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()));
// From the next weekend: 10 h on the sending day (4 October, noon in Montréal) is already past.
const days = weekends.slice(1).map((date) => ({ date, start: 600, extend: true }));
const lead = { id: 3, firstName: "Awa", lastName: "Diop", email: "awa@x.test" };

describe("calendrier personnel, envois (Ben, 04/10)", () => {
  beforeEach(() => {
    for (const group of [db.personalSchedule, db.registration, db.siteSetting, db.actionLog, calendar]) for (const f of Object.values(group)) f.mockReset();
    mail.sendEmail.mockReset().mockResolvedValue({ sent: true, id: null });
    db.siteSetting.findUnique.mockResolvedValue(null);
    calendar.fetchBusy.mockResolvedValue([]);
  });

  it("la proposition est vérifiée, enregistrée sans les jours en trop, et Ben est prévenu", async () => {
    db.personalSchedule.findUnique.mockResolvedValue({ id: 9, token: TOKEN, status: "invited", sentAt, lead, cohort: { id: 7, name: "Cohorte Octobre 2026" } });
    expect(await proposePersonalSchedule(TOKEN, days, now)).toEqual({ ok: true, message: "Proposition envoyée." });
    const saved = db.personalSchedule.update.mock.calls[0][0].data;
    expect(saved.status).toBe("proposed");
    expect(saved.days.length).toBeLessThan(days.length);
    expect(mail.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ben@x.test", text: expect.stringContaining("/admin/cohortes/7/calendriers/9") }));
  });

  it("un créneau où Ben est pris entre-temps est refusé", async () => {
    db.personalSchedule.findUnique.mockResolvedValue({ id: 9, token: TOKEN, status: "invited", sentAt, lead, cohort: { id: 7, name: "C" } });
    calendar.fetchBusy.mockResolvedValue([{ start: new Date(`${days[0].date}T14:00:00Z`), end: new Date(`${days[0].date}T15:00:00Z`) }]);
    expect(await proposePersonalSchedule(TOKEN, days, now)).toMatchObject({ ok: false, error: expect.stringMatching(/plus disponible/) });
    expect(db.personalSchedule.update).not.toHaveBeenCalled();
  });

  it("à la confirmation : une invitation par session, le récapitulatif sans heures, et retrait des sessions collectives", async () => {
    const proposed = days.slice(0, 6);
    db.personalSchedule.findUnique.mockResolvedValue({
      id: 9, token: TOKEN, status: "proposed", cohortId: 7, leadId: 3, days: proposed, events: null, lead,
      cohort: { sessions: [{ day: 5, googleEventId: "group-5", sentAt: new Date(), startsAt: new Date("2026-10-08T19:00:00Z"), guestEmail: null }] },
    });
    calendar.createSessionEvent.mockImplementation(async () => ({ eventId: `e${calendar.createSessionEvent.mock.calls.length}`, meetUrl: "https://meet.google.com/x" }));
    db.registration.findMany.mockResolvedValue([{ lead }, { lead: { id: 4, firstName: "Kofi", lastName: "A", email: "kofi@x.test" } }]);
    db.personalSchedule.findMany.mockResolvedValue([{ leadId: 3 }]);
    const result = await confirmPersonalSchedule(9, now);
    expect(result).toMatchObject({ ok: true });
    expect(calendar.createSessionEvent).toHaveBeenCalledTimes(6);
    const first = calendar.createSessionEvent.mock.calls[0][0];
    expect(first).toMatchObject({ summary: "CISSP Bootcamp · J1", timeZone: "America/Toronto", attendees: [{ email: "awa@x.test", name: "Awa Diop" }] });
    expect(first.start.toISOString()).toBe(`${proposed[0].date}T14:00:00.000Z`); // 10 h in Montréal (summer time)
    expect(db.personalSchedule.update.mock.calls.at(-1)![0].data).toMatchObject({ status: "confirmed" });
    expect(calendar.setEventAttendees).toHaveBeenCalledWith("group-5", [{ email: "kofi@x.test", name: "Kofi A" }]);
    const recap = mail.sendEmail.mock.calls[0][0];
    expect(recap.to).toBe("awa@x.test");
    expect(recap.text).toContain("J1 · ");
    expect(recap.text).toContain(`/plan-de-lecture?calendrier=${TOKEN}`);
    expect(recap.text).not.toMatch(/\d+ h\b/);
  });

  it("une confirmation interrompue reprend sans recréer les invitations déjà faites", async () => {
    const proposed = days.slice(0, 6);
    db.personalSchedule.findUnique.mockResolvedValue({ id: 9, token: TOKEN, status: "proposed", cohortId: 7, leadId: 3, days: proposed, events: [{ n: 1, date: proposed[0].date, startsAt: "", endsAt: "", eventId: "e1", meetUrl: null }], lead, cohort: { sessions: [] } });
    calendar.createSessionEvent.mockResolvedValueOnce({ eventId: "e2", meetUrl: null }).mockRejectedValueOnce(new Error("quota"));
    const result = await confirmPersonalSchedule(9, now);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/2 sur 6/) });
    expect(db.personalSchedule.update.mock.calls[0][0].data.events.map((e: { eventId: string }) => e.eventId)).toEqual(["e1", "e2"]);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("le refus envoie le message et rouvre un nouveau mois", async () => {
    db.personalSchedule.findUnique.mockResolvedValue({ id: 9, token: TOKEN, status: "proposed", cohortId: 7, leadId: 3, lead });
    expect(await refusePersonalSchedule(9, "Le 17 octobre ne me convient pas.", now)).toMatchObject({ ok: true });
    expect(db.personalSchedule.update.mock.calls[0][0].data).toMatchObject({ status: "refused", refusalNote: "Le 17 octobre ne me convient pas.", sentAt: now });
    expect(mail.sendEmail.mock.calls[0][0].text).toContain(`/calendrier/${TOKEN}`);
  });
});

describe("rappel 1 h avant une session personnelle (Ben, 04/10)", () => {
  it("part une fois, dans l'heure qui précède, avec le lien Meet et sans horaire", async () => {
    const { sendPersonalReminders } = await import("@/lib/personal-schedule-send");
    mail.sendEmail.mockReset().mockResolvedValue({ sent: true, id: null });
    db.personalSchedule.update.mockReset();
    const proposed = days.slice(0, 6);
    const at = new Date(`${proposed[1].date}T13:20:00Z`); // 40 min before J2 (10 h Montréal = 14:00Z)
    db.personalSchedule.findMany.mockReset().mockResolvedValue([{
      id: 9, days: proposed, lead: { firstName: "Awa", email: "awa@x.test", unsubscribedAt: null },
      events: [
        { n: 1, date: proposed[0].date, startsAt: `${proposed[0].date}T14:00:00.000Z`, endsAt: "", eventId: "e1", meetUrl: "https://meet.google.com/a", remindedAt: "x" },
        { n: 2, date: proposed[1].date, startsAt: `${proposed[1].date}T14:00:00.000Z`, endsAt: `${proposed[1].date}T21:00:00.000Z`, eventId: "e2", meetUrl: "https://meet.google.com/b" },
        { n: 3, date: proposed[2].date, startsAt: `${proposed[2].date}T14:00:00.000Z`, endsAt: "", eventId: "e3", meetUrl: null },
      ],
    }]);
    expect(await sendPersonalReminders(at)).toBe(1);
    const email = mail.sendEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: "awa@x.test", subject: "Dans une heure : J2 · CISSP Bootcamp" });
    expect(email.text).toContain("https://meet.google.com/b");
    const saved = db.personalSchedule.update.mock.calls[0][0].data.events;
    expect(saved[1].remindedAt).toBe(at.toISOString());
    expect(saved[2].remindedAt).toBeUndefined();
  });
});
