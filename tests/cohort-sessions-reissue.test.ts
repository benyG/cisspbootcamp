import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cohort: { findUnique: vi.fn() },
  registration: { findMany: vi.fn() },
  cohortSession: { upsert: vi.fn() },
  actionLog: { createMany: vi.fn() },
  personalSchedule: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const calendar = vi.hoisted(() => ({ fetchBusy: vi.fn(), createSessionEvent: vi.fn(), cancelCallEvent: vi.fn(), moveCallEvent: vi.fn(), setEventAttendees: vi.fn() }));
vi.mock("@/lib/calendar/google", () => calendar);
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test" } }));

import { reissueCohortSession } from "@/lib/cohort-sessions-send";

describe("nouvelle invitation d'une session (Ben, 03/10)", () => {
  beforeEach(() => {
    for (const f of [...Object.values(calendar), mail.sendEmail, db.cohort.findUnique, db.registration.findMany, db.cohortSession.upsert, db.actionLog.createMany]) f.mockReset();
    // Start moved from Saturday 3 to Sunday 4 October; J1 was sent for the 3rd.
    db.cohort.findUnique.mockResolvedValue({
      id: 7,
      startsAt: new Date("2026-10-04T00:00:00Z"),
      sessions: [{ id: 1, day: 1, sentAt: new Date(), googleEventId: "old-event", guestEmail: null, reminder: true, startsAt: new Date("2026-10-03T14:00:00Z"), timezone: "Africa/Dakar" }],
    });
    db.registration.findMany.mockResolvedValue([{ lead: { id: 3, firstName: "Awa", lastName: "Diop", email: "awa@x.test", country: "SN", unsubscribedAt: null } }]);
    db.cohortSession.upsert.mockResolvedValue({ id: 1 });
    db.personalSchedule.findMany.mockResolvedValue([]);
    mail.sendEmail.mockResolvedValue({ sent: true });
  });

  it("crée la nouvelle au jour du plan, prévient, puis annule l'ancienne", async () => {
    const order: string[] = [];
    calendar.createSessionEvent.mockImplementation(async () => { order.push("create"); return { eventId: "new-event", meetUrl: "https://meet.google.com/new" }; });
    calendar.cancelCallEvent.mockImplementation(async () => { order.push("cancel"); });
    const result = await reissueCohortSession({ cohortId: 7, day: 1, start: "14:00", pause: 30 });
    expect(result).toMatchObject({ ok: true, message: expect.stringMatching(/ancienne est annulée/) });
    expect(order).toEqual(["create", "cancel"]);
    expect(calendar.cancelCallEvent).toHaveBeenCalledWith("old-event");
    expect(calendar.createSessionEvent.mock.calls[0][0].start.toISOString()).toBe("2026-10-04T14:00:00.000Z");
    expect(db.cohortSession.upsert.mock.calls[0][0].update).toMatchObject({ googleEventId: "new-event", meetUrl: "https://meet.google.com/new" });
    const email = mail.sendEmail.mock.calls[0][0];
    expect(email.subject).toBe("Nouvelle invitation · J1 · dimanche 4 octobre · CISSP Bootcamp");
    expect(email.text).toMatch(/invitation précédente pour J1 est annulée/);
  });

  it("si Google refuse la nouvelle, l'ancienne reste intacte", async () => {
    calendar.createSessionEvent.mockRejectedValue(new Error("403"));
    expect(await reissueCohortSession({ cohortId: 7, day: 1, start: "14:00", pause: 30 })).toMatchObject({ ok: false, error: expect.stringMatching(/ancienne est intacte/) });
    expect(calendar.cancelCallEvent).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("une ancienne déjà supprimée à la main n'est pas une erreur", async () => {
    calendar.createSessionEvent.mockResolvedValue({ eventId: "new-event", meetUrl: null });
    calendar.cancelCallEvent.mockRejectedValue(new Error("Google Calendar DELETE /x → 410: gone"));
    expect(await reissueCohortSession({ cohortId: 7, day: 1, start: "14:00", pause: 30 })).toMatchObject({ ok: true, message: expect.stringMatching(/ancienne est annulée/) });
  });
});
