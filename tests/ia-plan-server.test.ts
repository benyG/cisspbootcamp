import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    iaDay: { findMany: vi.fn() },
    iaSeat: { findMany: vi.fn(), create: vi.fn() },
    actionLog: { create: vi.fn() },
    $queryRaw: vi.fn(async () => []),
  };
  return {
    tx,
    iaPlan: { findUnique: vi.fn(), update: vi.fn() },
    actionLog: { create: vi.fn(async () => ({})) },
    iaSeat: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    iaDay: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    registration: { count: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
const google = vi.hoisted(() => ({ createSessionEvent: vi.fn(), setEventAttendees: vi.fn() }));
vi.mock("@/lib/calendar/google", () => google);
const mail = vi.hoisted(() => ({ sendEmail: vi.fn<(input: { to: string; subject: string; text: string }) => Promise<{ sent: boolean; id: null }>>(async () => ({ sent: true, id: null })) }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));

import { pickJournees, saveBrief, sendIaReminders, syncDayInvites } from "@/lib/ia-plan-server";

const TOKEN = "t".repeat(43);
const now = new Date("2027-01-10T12:00:00Z");
const row = (id: number, date: string, journee: number, seats = 0, extra: Record<string, unknown> = {}) => ({ id, date, journee, capacity: 12, closed: false, start: "10:00", _count: { seats }, ...extra });
const lead = { id: 5, email: "awa@x.test", firstName: "Awa", lastName: "Diop" };

describe("Bâtisseur IA, calendrier du participant (Ben, 03/11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.iaPlan.findUnique.mockResolvedValue({ id: 1, leadId: 5, cohortId: 7, token: TOKEN, lead });
    db.registration.count.mockResolvedValue(1);
    db.tx.iaSeat.findMany.mockResolvedValue([{ journee: 1, day: { date: "2027-01-23" } }]);
    db.tx.iaDay.findMany.mockImplementation(async (args: { select?: unknown }) =>
      args.select ? [{ id: 2 }, { id: 3 }] : [row(2, "2027-01-24", 2), row(3, "2027-01-30", 3)],
    );
    db.iaDay.findUnique.mockResolvedValue(null);
  });

  it("takes the picked seats under a lock, then e-mails the dates without clock times", async () => {
    const r = await pickJournees(TOKEN, { 2: "2027-01-24", 3: "2027-01-30" }, now);
    expect(r).toEqual({ ok: true, message: "2 journées réservées." });
    expect(db.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.tx.iaSeat.create.mock.calls.map((c) => c[0].data)).toEqual([
      { leadId: 5, cohortId: 7, journee: 2, dayId: 2 },
      { leadId: 5, cohortId: 7, journee: 3, dayId: 3 },
    ]);
    const message = mail.sendEmail.mock.calls[0][0];
    expect(message.text).toContain("J2, dimanche 24 janvier");
    expect(message.text).toContain(`https://x.test/ia/calendrier/${TOKEN}`);
    expect(message.text).not.toMatch(/\b\d{1,2}:\d{2}\b|\b\d{1,2} h\b/);
  });

  it("refuses a full date, an unpaid entry or an unknown link, and takes nothing", async () => {
    db.tx.iaDay.findMany.mockImplementation(async (args: { select?: unknown }) => (args.select ? [{ id: 2 }] : [row(2, "2027-01-24", 2, 12)]));
    expect(await pickJournees(TOKEN, { 2: "2027-01-24" }, now)).toEqual({ ok: false, error: "La J2 du dimanche 24 janvier n’est plus disponible." });
    db.registration.count.mockResolvedValue(0);
    expect((await pickJournees(TOKEN, { 2: "2027-01-24" }, now)).ok).toBe(false);
    expect(await pickJournees("../x", { 2: "2027-01-24" }, now)).toEqual({ ok: false, error: "Lien invalide." });
    expect(db.tx.iaSeat.create).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("keeps the seats when the agenda is down: the invitation waits for the cron", async () => {
    db.iaDay.findUnique.mockResolvedValue({ id: 2, date: "2027-01-24", journee: 2, start: "10:00", eventId: null, seats: [{ id: 50, invitedAt: null, lead }] });
    google.createSessionEvent.mockRejectedValue(new Error("invalid_grant"));
    const r = await pickJournees(TOKEN, { 2: "2027-01-24" }, now);
    expect(r.ok).toBe(true);
    expect(db.iaSeat.updateMany).not.toHaveBeenCalled();
  });

  it("creates one event per date with every participant, then only updates its guests", async () => {
    db.iaDay.findUnique.mockResolvedValueOnce({ id: 2, date: "2027-01-24", journee: 2, start: "10:00", eventId: null, seats: [{ id: 50, invitedAt: null, lead }] });
    google.createSessionEvent.mockResolvedValue({ eventId: "ev1", meetUrl: "https://meet.google.com/abc" });
    expect(await syncDayInvites(2, now)).toBe(1);
    const created = google.createSessionEvent.mock.calls[0][0];
    expect(created).toMatchObject({ summary: "Bâtisseur IA · J2 · Le cœur métier et vos données", timeZone: "America/Toronto", attendees: [{ email: "awa@x.test", name: "Awa Diop" }] });
    expect(created.start.toISOString()).toBe("2027-01-24T15:00:00.000Z");
    expect(db.iaDay.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { eventId: "ev1", meetUrl: "https://meet.google.com/abc" } });
    expect(db.iaSeat.updateMany).toHaveBeenCalledWith({ where: { id: { in: [50] } }, data: { invitedAt: now } });

    db.iaDay.findUnique.mockResolvedValueOnce({ id: 2, date: "2027-01-24", journee: 2, start: "10:00", eventId: "ev1", seats: [{ id: 50, invitedAt: now, lead }, { id: 51, invitedAt: null, lead: { ...lead, email: "kofi@x.test", firstName: "Kofi", lastName: "" } }] });
    expect(await syncDayInvites(2, now)).toBe(1);
    expect(google.setEventAttendees).toHaveBeenCalledWith("ev1", [{ email: "awa@x.test", name: "Awa Diop" }, { email: "kofi@x.test", name: "Kofi" }]);
    expect(google.createSessionEvent).toHaveBeenCalledTimes(1);
  });

  it("reminds once, the day before, with the Meet link and no clock time", async () => {
    const reminderNow = new Date("2027-01-23T05:30:00Z"); // J2 on Sunday 24, 15:00 UTC: 33 h later
    db.iaSeat.findMany.mockResolvedValue([{ id: 50, leadId: 5, cohortId: 7, journee: 2, remindedAt: null, day: { date: "2027-01-24", start: "10:00", meetUrl: "https://meet.google.com/abc" }, lead }]);
    db.iaPlan.findUnique.mockResolvedValue({ token: TOKEN });
    expect(await sendIaReminders(reminderNow)).toBe(1);
    const message = mail.sendEmail.mock.calls[0][0];
    expect(message.subject).toBe("Demain : J2 du Bâtisseur IA");
    expect(message.text).toContain("https://meet.google.com/abc");
    expect(message.text).not.toMatch(/\b\d{1,2}:\d{2}\b|\b\d{1,2} h\b/);
    expect(db.iaSeat.update).toHaveBeenCalledWith({ where: { id: 50 }, data: { remindedAt: reminderNow } });
  });

  it("does not remind a journée more than 36 h away", async () => {
    db.iaSeat.findMany.mockResolvedValue([{ id: 50, leadId: 5, cohortId: 7, journee: 2, remindedAt: null, day: { date: "2027-01-24", start: "10:00", meetUrl: null }, lead }]);
    expect(await sendIaReminders(new Date("2027-01-23T02:00:00Z"))).toBe(0);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("points J1 participants to the preparation guide in the reminder", async () => {
    const reminderNow = new Date("2027-01-22T05:30:00Z");
    db.iaSeat.findMany.mockResolvedValue([{ id: 49, leadId: 5, cohortId: 7, journee: 1, remindedAt: null, day: { date: "2027-01-23", start: "10:00", meetUrl: null }, lead }]);
    db.iaPlan.findUnique.mockResolvedValue({ token: TOKEN });
    expect(await sendIaReminders(reminderNow)).toBe(1);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("https://x.test/ia/guide");
  });

  it("saves the project sheet and tells Ben, first time and on change", async () => {
    const brief = { business: "Cabinet de formation", users: "Mon équipe", tasks: "Relances et devis", data: "Excel", inspiration: "", domain: "", payments: "both" };
    db.iaPlan.findUnique.mockResolvedValue({ id: 1, leadId: 5, cohortId: 7, briefAt: null, lead, cohort: { name: "Entrée du samedi 23 janvier 2027" } });
    expect(await saveBrief(TOKEN, brief, now)).toEqual({ ok: true, message: "Fiche envoyée. Vous pouvez la modifier jusqu’à la J1." });
    expect(db.iaPlan.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { brief, briefAt: now } });
    const toBen = mail.sendEmail.mock.calls[0][0];
    expect(toBen.to).toBe("ben@x.test");
    expect(toBen.subject).toContain("Fiche projet reçue");
    expect(toBen.text).toContain("Encaissement : Carte et mobile money");

    db.iaPlan.findUnique.mockResolvedValue({ id: 1, leadId: 5, cohortId: 7, briefAt: now, lead, cohort: { name: "x" } });
    expect((await saveBrief(TOKEN, brief, now)).ok).toBe(true);
    expect(mail.sendEmail.mock.calls[1][0].subject).toContain("mise à jour");
  });

  it("refuses an incomplete sheet or an unknown link", async () => {
    expect(await saveBrief(TOKEN, { business: "x" }, now)).toMatchObject({ ok: false });
    db.iaPlan.findUnique.mockResolvedValue(null);
    expect(await saveBrief(TOKEN, { business: "Cabinet", users: "Moi", tasks: "Devis", data: "Excel", payments: "none" }, now)).toEqual({ ok: false, error: "Lien invalide." });
    expect(db.iaPlan.update).not.toHaveBeenCalled();
  });
});
