import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  registration: { findMany: vi.fn(async () => [] as unknown[]) },
  actionLog: { findMany: vi.fn<(args: { where: { type: unknown } }) => Promise<unknown[]>>(async () => []), create: vi.fn(async () => ({})) },
  siteSetting: { findUnique: vi.fn(async () => null as unknown), upsert: vi.fn(async () => ({})) },
  linkedinCredential: { findUnique: vi.fn(async () => null as unknown) },
  lead: { count: vi.fn(async () => 0) },
  cohort: { findMany: vi.fn(async () => [] as unknown[]) },
  marketingPost: { findMany: vi.fn(async () => []) },
  $queryRaw: vi.fn(async () => []),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn<(input: { to: string; subject: string; text: string; fromName?: string }) => Promise<{ sent: boolean; id: null; reason?: string }>>(async () => ({ sent: true, id: null })) }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));
const calendar = vi.hoisted(() => ({ calendarHealth: vi.fn(async () => "ok" as string) }));
vi.mock("@/lib/calendar/google", () => calendar);

import { catchUpPack, healthProblems, lateAlertDue, mayContact, resolveModes, underPressure, unfinishedCallDue, unfinishedDue } from "@/lib/playbooks/rules";
import { planHealth, planLate, planUnfinished, resumeUrl, runPlaybooks } from "@/lib/playbooks/server";

const DAY = 86_400_000;
const now = new Date("2026-11-10T06:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);

describe("rules", () => {
  it("defaults: alerts on, the prospect e-mail in trial until Ben reads it", () => {
    expect(resolveModes(null)).toEqual({ health: "on", unfinished: "trial", late: "on" });
    expect(resolveModes({ unfinished: "on", late: "nope" })).toEqual({ health: "on", unfinished: "trial", late: "on" });
    expect(resolveModes({ unfinished: "on" })).toEqual({ health: "on", unfinished: "on", late: "on" });
  });

  it("caps automatic messages at one every 4 days, and needs consent", () => {
    expect(underPressure(ago(3), now)).toBe(true);
    expect(underPressure(ago(4), now)).toBe(false);
    expect(underPressure(null, now)).toBe(false);
    expect(mayContact({ consentAt: ago(10), unsubscribedAt: null })).toBe(true);
    expect(mayContact({ consentAt: null, unsubscribedAt: null })).toBe(false);
    expect(mayContact({ consentAt: ago(10), unsubscribedAt: ago(1) })).toBe(false);
  });

  it("follows a checkout up between 24 h and 7 days, and calls 3 days after the e-mail", () => {
    expect(unfinishedDue(new Date(now.getTime() - 23 * 3_600_000), now)).toBe(false);
    expect(unfinishedDue(ago(1), now)).toBe(true);
    expect(unfinishedDue(ago(8), now)).toBe(false);
    expect(unfinishedCallDue(ago(2), now)).toBe(false);
    expect(unfinishedCallDue(ago(3), now)).toBe(true);
  });

  it("reports the calendar, e-mail and LinkedIn problems with their fix", () => {
    const problems = healthProblems({ calendar: "revoked", emailConfigured: false, linkedinExpiresAt: new Date(now.getTime() + 3 * DAY) }, now, "https://x.test/");
    expect(problems.map((p) => p.code)).toEqual(["calendar", "email", "linkedin"]);
    expect(problems[0]!.fix).toBe("https://x.test/admin/parametres/google");
    expect(healthProblems({ calendar: "ok", emailConfigured: true, linkedinExpiresAt: new Date(now.getTime() + 30 * DAY) }, now, "https://x.test")).toEqual([]);
  });

  it("re-alerts a late cohort weekly, or as soon as it falls further behind", () => {
    expect(lateAlertDue(null, 1, now)).toBe(true);
    expect(lateAlertDue(null, 0, now)).toBe(false);
    expect(lateAlertDue({ at: ago(2), behind: 1 }, 1, now)).toBe(false);
    expect(lateAlertDue({ at: ago(2), behind: 1 }, 2, now)).toBe(true);
    expect(lateAlertDue({ at: ago(7), behind: 1 }, 1, now)).toBe(true);
  });

  it("builds the catch-up pack from real counts only", () => {
    const pack = catchUpPack({ toFollowUp: 9, alumni: 0, unfinished: 1 });
    expect(pack[0]).toContain("la personne qui a commencé son paiement");
    expect(pack[1]).toContain("les 9 prospects consentants");
    expect(pack.some((p) => p.includes("anciens"))).toBe(false);
  });
});

const reg = (over: Record<string, unknown> = {}) => ({
  id: 11, createdAt: ago(2), reference: "CB-1",
  cohort: { id: 3, name: "Cohorte de décembre", program: "cissp", startsAt: new Date("2026-12-14T00:00:00Z") },
  lead: { id: 5, firstName: "Koffi", email: "koffi@x.test", consentAt: ago(10), unsubscribedAt: null, unsubscribeToken: "u".repeat(24), scannerResponses: [{ resultToken: "tok123456789" }], iaDiagnostics: [], registrations: [] },
  ...over,
});

describe("Inscription non finalisée", () => {
  beforeEach(() => { vi.clearAllMocks(); db.actionLog.findMany.mockResolvedValue([]); });

  it("e-mails once, with the resume link and the real deadline, signed by Ben for the CISSP", async () => {
    db.registration.findMany.mockResolvedValue([reg(), reg({ id: 10 })]);
    const steps = await planUnfinished(now);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.email.to).toBe("koffi@x.test");
    expect(steps[0]!.email.text).toContain("https://x.test/inscription?t=tok123456789");
    expect(steps[0]!.email.text).toContain("ferment le 7 décembre");
    expect(steps[0]!.email.text).toMatch(/\nBen\n/);
    expect(steps[0]!.email.text).toContain("/desinscription/");
    expect(steps[0]!.log).toEqual({ type: "playbook_unfinished", leadId: 5, payload: { cohortId: 3, registrationId: 11, reference: "CB-1" } });
  });

  it("signs the Bâtisseur IA as ExamBoot and links the IA registration", async () => {
    db.registration.findMany.mockResolvedValue([reg({ cohort: { id: 8, name: "Entrée du 9 janvier", program: "ia", startsAt: new Date("2027-01-09T00:00:00Z") }, lead: { ...reg().lead, scannerResponses: [], iaDiagnostics: [{ token: "iatok" }] } })]);
    const [step] = await planUnfinished(now);
    expect(step!.email.text).toContain("/ia/inscription?entree=8&t=iatok");
    expect(step!.email.text).toContain("L’équipe Bâtisseur IA");
    expect(step!.email.text).not.toMatch(/\bBen\b/);
    expect(step!.email.fromName).toBe("Bâtisseur IA · ExamBoot");
  });

  it("skips: already e-mailed, too soon, under pressure, admissions closed, already paid", async () => {
    db.registration.findMany.mockResolvedValue([reg()]);
    db.actionLog.findMany.mockImplementation(async (args: { where: { type: unknown } }) => (args.where.type === "playbook_unfinished" ? [{ leadId: 5, payload: { cohortId: 3 } }] : []));
    expect(await planUnfinished(now)).toEqual([]);

    db.actionLog.findMany.mockImplementation(async (args: { where: { type: unknown } }) => (args.where.type === "playbook_unfinished" ? [] : [{ leadId: 5, createdAt: ago(1) }]));
    expect(await planUnfinished(now)).toEqual([]);

    db.actionLog.findMany.mockResolvedValue([]);
    db.registration.findMany.mockResolvedValue([reg({ createdAt: new Date(now.getTime() - 5 * 3_600_000) })]);
    expect(await planUnfinished(now)).toEqual([]);
    db.registration.findMany.mockResolvedValue([reg({ cohort: { ...reg().cohort, startsAt: new Date(now.getTime() + 5 * DAY) } })]);
    expect(await planUnfinished(now)).toEqual([]);
    db.registration.findMany.mockResolvedValue([reg({ lead: { ...reg().lead, registrations: [{ cohort: { program: "cissp" } }] } })]);
    expect(await planUnfinished(now)).toEqual([]);
  });

  it("builds resume links per programme", () => {
    expect(resumeUrl("cissp", 3, { scanner: null, ia: null }, "https://x.test")).toBeNull();
    expect(resumeUrl("cc", 4, { scanner: "abc", ia: null }, "https://x.test/")).toBe("https://x.test/demarrer/inscription?t=abc");
  });
});

describe("Santé technique and En retard sur la courbe", () => {
  beforeEach(() => { vi.clearAllMocks(); db.actionLog.findMany.mockResolvedValue([]); delete process.env.RESEND_API_KEY; });

  it("alerts the admin once per day per problem", async () => {
    process.env.RESEND_API_KEY = "re_x";
    calendar.calendarHealth.mockResolvedValueOnce("revoked");
    const [step] = await planHealth(now);
    expect(step!.email.to).toBe("ben@x.test");
    expect(step!.email.subject).toBe("Alerte : Google a déconnecté votre agenda");
    calendar.calendarHealth.mockResolvedValueOnce("revoked");
    db.actionLog.findMany.mockResolvedValueOnce([{ payload: { codes: ["calendar"] } }]);
    expect(await planHealth(now)).toEqual([]);
  });

  it("alerts on a late cohort with its catch-up pack", async () => {
    db.cohort.findMany.mockResolvedValue([{ id: 3, program: "cissp", name: "Cohorte de décembre", startsAt: new Date("2026-12-14T00:00:00Z"), capacity: 10, targetSeats: null, registrations: [{ status: "paid", paidAt: ago(15), createdAt: ago(15), lead: { utmSource: null, source: null } }], seatHolds: [] }]);
    db.lead.count.mockResolvedValueOnce(9).mockResolvedValueOnce(4);
    const [step] = await planLate(now);
    expect(step!.email.subject).toBe("Cohorte en retard : CISSP Bootcamp — Cohorte de décembre (2 places)");
    expect(step!.email.text).toContain("les 9 prospects consentants");
    expect(step!.email.text).toContain("aux 4 anciens participants");
    expect(step!.log.payload).toMatchObject({ cohortId: 3, behind: 2 });
  });
});

describe("runner", () => {
  // Health stays quiet here: the calendar is fine and e-mail is configured.
  beforeEach(() => { vi.clearAllMocks(); process.env.RESEND_API_KEY = "re_x"; db.actionLog.findMany.mockResolvedValue([]); db.cohort.findMany.mockResolvedValue([]); });

  it("runs only what is on; a trial playbook sends nothing", async () => {
    db.registration.findMany.mockResolvedValue([reg()]);
    db.siteSetting.findUnique.mockResolvedValue(null);
    const out = await runPlaybooks(now);
    expect(out.unfinished).toBe("trial");
    expect(mail.sendEmail).not.toHaveBeenCalled();

    db.siteSetting.findUnique.mockResolvedValue({ key: "playbooks", value: { unfinished: "on" } });
    expect((await runPlaybooks(now)).unfinished).toBe(1);
    expect(db.actionLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "playbook_unfinished", leadId: 5, channel: "email" }) });
  });

  it("logs nothing when the e-mail fails, so the next run tries again", async () => {
    db.registration.findMany.mockResolvedValue([reg()]);
    db.siteSetting.findUnique.mockResolvedValue({ key: "playbooks", value: { unfinished: "on" } });
    mail.sendEmail.mockResolvedValueOnce({ sent: false, id: null, reason: "down" });
    expect((await runPlaybooks(now)).unfinished).toBe(0);
    expect(db.actionLog.create).not.toHaveBeenCalled();
  });
});
