import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cohort: { findUnique: vi.fn() },
  cohortReplay: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  registration: { findMany: vi.fn() },
  personalSchedule: { findMany: vi.fn() },
  replayAccess: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  replayGrant: { create: vi.fn() },
  actionLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://www.cisspbootcamp.online", ADMIN_EMAIL: "ben@x.test" } }));
vi.mock("@/lib/calendar/google", () => ({ accessToken: vi.fn(), fetchBusy: vi.fn(), createSessionEvent: vi.fn(), setEventAttendees: vi.fn() }));
const stream = vi.hoisted(() => ({ streamEnabled: vi.fn(() => true), playbackToken: vi.fn(), createUpload: vi.fn(), deleteVideo: vi.fn(), getVideo: vi.fn(), secureVideo: vi.fn(), sendChunk: vi.fn(), uploadOffset: vi.fn(), TUS_CHUNK_BYTES: 50 * 1024 * 1024 }));
vi.mock("@/lib/stream", () => stream);

import { playbackFor, publishReplay, requestReopen } from "@/lib/replays-server";

const cohort = { id: 7, name: "Cohorte Octobre 2026", startsAt: new Date("2026-10-04T00:00:00Z"), endsAt: new Date("2026-10-18T00:00:00Z") };
const awa = { id: 3, firstName: "Awa", lastName: "Diop", email: "awa@x.test" };
const kofi = { id: 4, firstName: "Kofi", lastName: "Mensah", email: "kofi@x.test" };

describe("replays : publication, lecture, demandes (Ben, 12/10)", () => {
  beforeEach(() => {
    for (const group of Object.values(db)) for (const f of Object.values(group)) f.mockReset();
    mail.sendEmail.mockReset().mockResolvedValue({ sent: true, id: null });
    stream.playbackToken.mockReset();
    db.cohort.findUnique.mockResolvedValue(cohort);
    db.registration.findMany.mockResolvedValue([{ lead: awa }, { lead: kofi }]);
    db.personalSchedule.findMany.mockResolvedValue([]);
    db.replayAccess.findUnique.mockResolvedValue(null);
    db.replayAccess.create.mockImplementation(async ({ data }) => ({ id: data.leadId * 10, ...data, token: `t${data.leadId}` }));
  });

  it("publie pour une sélection : un espace par personne, 4 mois d'accès, un e-mail sans heure", async () => {
    db.cohortReplay.findUnique.mockResolvedValue({ id: 11, videoStatus: "ready", labPathname: "replays/labs/7/J3.zip", publishedAt: null, grants: [] });
    const r = await publishReplay(7, 3, [3]);
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/1 personne/) });
    expect(db.replayGrant.create).toHaveBeenCalledTimes(1);
    expect(db.replayGrant.create).toHaveBeenCalledWith({ data: { replayId: 11, leadId: 3 } });
    expect(db.replayAccess.create.mock.calls[0][0].data.expiresAt.toISOString()).toBe("2027-02-18T23:59:59.000Z");
    const email = mail.sendEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: "awa@x.test", subject: "J3 disponible : le replay et le lab · CISSP Bootcamp" });
    expect(email.text).toContain("https://www.cisspbootcamp.online/replays/t3");
    expect(email.text).not.toMatch(/\d+ h\b/);
  });

  it("republier n'écrit qu'aux nouvelles personnes", async () => {
    db.cohortReplay.findUnique.mockResolvedValue({ id: 11, videoStatus: "ready", labPathname: null, publishedAt: new Date(), grants: [{ leadId: 3 }] });
    expect(await publishReplay(7, 3, "all")).toMatchObject({ ok: true });
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].to).toBe("kofi@x.test");
  });

  it("refuse de publier une vidéo encore en traitement", async () => {
    db.cohortReplay.findUnique.mockResolvedValue({ id: 11, videoStatus: "processing", labPathname: "x.zip", publishedAt: null, grants: [] });
    expect(await publishReplay(7, 3, "all")).toMatchObject({ ok: false, error: expect.stringMatching(/pas encore prête/) });
    expect(db.replayGrant.create).not.toHaveBeenCalled();
  });

  it("lecture : jeton seulement si l'accès est ouvert et le jour publié pour la personne", async () => {
    const access = { id: 30, cohortId: 7, leadId: 3, expiresAt: new Date("2027-02-18T23:59:59Z") };
    db.cohortReplay.findFirst.mockResolvedValue({ streamUid: "uid1" });
    stream.playbackToken.mockResolvedValue("signed");
    expect(await playbackFor(access, 3, new Date("2026-11-01T00:00:00Z"))).toBe("signed");
    expect(db.cohortReplay.findFirst.mock.calls[0][0].where).toMatchObject({ cohortId: 7, day: 3, videoStatus: "ready", grants: { some: { leadId: 3 } } });
    expect(db.actionLog.create).toHaveBeenCalledWith({ data: { leadId: 3, type: "replay_viewed", payload: { cohortId: 7, day: 3 } } });
    expect(await playbackFor(access, 3, new Date("2027-03-01T00:00:00Z"))).toBeNull();
    db.actionLog.create.mockReset();
    await playbackFor(access, 3, new Date("2026-11-01T00:00:00Z"), { log: false });
    expect(db.actionLog.create).not.toHaveBeenCalled();
  });

  it("une demande de réouverture n'est possible qu'une fois l'accès terminé, et prévient Ben", async () => {
    db.replayAccess.findUnique.mockResolvedValue({ id: 30, cohortId: 7, leadId: 3, token: "t".repeat(43), expiresAt: new Date("2027-02-18T23:59:59Z"), requestedAt: null, lead: awa, cohort });
    expect(await requestReopen("t".repeat(43), "Examen reporté au 15 mars.", new Date("2027-01-10T00:00:00Z"))).toMatchObject({ ok: false, error: expect.stringMatching(/encore ouvert/) });
    expect(await requestReopen("t".repeat(43), "Examen reporté au 15 mars.", new Date("2027-03-01T00:00:00Z"))).toMatchObject({ ok: true });
    expect(mail.sendEmail.mock.calls[0][0]).toMatchObject({ to: "ben@x.test", text: expect.stringContaining("/admin/cohortes/7/replays") });
  });
});
