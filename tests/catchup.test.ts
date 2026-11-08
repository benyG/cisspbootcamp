import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cohort: { findUnique: vi.fn<(args?: unknown) => Promise<unknown>>(async () => null) },
  lead: { findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(async () => []), count: vi.fn(async () => 0) },
  registration: { count: vi.fn(async () => 0) },
  actionLog: { findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(async () => []), create: vi.fn(async () => ({})) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn<(input: unknown) => Promise<{ sent: boolean; id: null; reason?: string }>>(async () => ({ sent: true, id: null })) }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));
vi.mock("@/lib/calendar/google", () => ({ calendarHealth: vi.fn(async () => "ok") }));

import { CATCHUP_TYPE, planCatchUp, sendCatchUp } from "@/lib/playbooks/catchup";
import { AUTO_MESSAGE_TYPES } from "@/lib/playbooks/rules";

const DAY = 86_400_000;
const now = new Date("2026-11-10T06:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * DAY);
const cohort = (over: Record<string, unknown> = {}) => ({ id: 3, program: "cissp", name: "Cohorte de janvier", startsAt: inDays(30), capacity: 10, status: "open", campaign: null, _count: { registrations: 2, seatHolds: 1 }, ...over });
const lead = (over: Record<string, unknown> = {}) => ({ id: 5, firstName: "Awa", email: "awa@x.test", consentAt: inDays(-30), unsubscribedAt: null, unsubscribeToken: "u".repeat(24), readiness: "ready", scannerResponses: [{ resultToken: "tok123456789" }], iaDiagnostics: [], registrations: [], ...over });
const byType = (rows: Record<string, unknown[]>) => async (args?: unknown) => rows[String((args as { where: { type: unknown } }).where.type)] ?? [];

describe("Rattrapage en un clic", () => {
  beforeEach(() => { vi.clearAllMocks(); db.actionLog.findMany.mockResolvedValue([]); db.lead.findMany.mockResolvedValue([]); });

  it("counts toward the pressure cap", () => {
    expect(AUTO_MESSAGE_TYPES).toContain(CATCHUP_TYPE);
  });

  it("prepares one e-mail per consenting prospect with the real seats left and deadline", async () => {
    db.cohort.findUnique.mockResolvedValue(cohort({ campaign: { promo: { early: { percent: 15, until: "2026-11-30" } } } }));
    db.lead.findMany.mockResolvedValue([lead(), lead({ id: 6, consentAt: null }), lead({ id: 7, readiness: "not_yet" }), lead({ id: 8 })]);
    db.actionLog.findMany.mockImplementation(byType({ [CATCHUP_TYPE]: [{ leadId: 8, payload: { cohortId: 3 } }] }));
    db.registration.count.mockResolvedValue(1);
    db.lead.count.mockResolvedValue(4);
    const plan = (await planCatchUp(3, now))!;
    expect(plan.blocked).toBeNull();
    expect(plan.seatsLeft).toBe(7);
    expect(plan.steps.map((s) => s.log)).toEqual([{ type: CATCHUP_TYPE, leadId: 5, payload: { cohortId: 3 } }]);
    const email = plan.steps[0]!.email;
    expect(email.subject).toBe("Il reste 7 places · CISSP Bootcamp");
    expect(email.text).toContain("Les inscriptions ferment le");
    expect(email.text).toContain("-15 % en payant par carte, jusqu’au 30 novembre");
    expect(email.text).toContain("https://x.test/inscription?t=tok123456789");
    expect(email.text).toContain("/desinscription/");
    expect(email.text).not.toMatch(/\d{1,2}\s?h\s?\d{0,2}\b/);
    expect([plan.unfinished, plan.alumni, plan.alreadySent]).toEqual([1, 4, 1]);
  });

  it("never writes to someone written to in the last 4 days", async () => {
    db.cohort.findUnique.mockResolvedValue(cohort());
    db.lead.findMany.mockResolvedValue([lead()]);
    db.actionLog.findMany.mockImplementation(async (args?: unknown) => (typeof (args as { where: { type: unknown } }).where.type === "object" ? [{ leadId: 5, createdAt: inDays(-2) }] : []));
    expect((await planCatchUp(3, now))!.steps).toEqual([]);
  });

  it("is blocked when registrations are closed, the cohort is full or admissions have closed", async () => {
    db.cohort.findUnique.mockResolvedValue(cohort({ status: "planned" }));
    expect((await planCatchUp(3, now))!.blocked).toContain("pas ouvertes");
    db.cohort.findUnique.mockResolvedValue(cohort({ _count: { registrations: 10, seatHolds: 0 } }));
    expect((await planCatchUp(3, now))!.blocked).toBe("Plus de place libre.");
    db.cohort.findUnique.mockResolvedValue(cohort({ startsAt: inDays(5) }));
    expect((await planCatchUp(3, now))!.blocked).toBe("Les admissions sont fermées.");
    expect(db.lead.findMany).not.toHaveBeenCalled();
  });

  it("signs the Bâtisseur IA as the team and links the IA registration", async () => {
    db.cohort.findUnique.mockResolvedValue(cohort({ program: "ia", startsAt: inDays(10) }));
    db.lead.findMany.mockResolvedValue([lead({ readiness: null, scannerResponses: [], iaDiagnostics: [{ token: "iatok" }] })]);
    const email = (await planCatchUp(3, now))!.steps[0]!.email;
    expect(email.text).toContain("/ia/inscription?entree=3&t=iatok");
    expect(email.text).not.toMatch(/\bBen\b/);
    expect(email.fromName).toBe("Bâtisseur IA · ExamBoot");
  });

  it("sends on the click and logs only what left", async () => {
    db.cohort.findUnique.mockResolvedValue(cohort());
    db.lead.findMany.mockResolvedValue([lead(), lead({ id: 6, email: "b@x.test" })]);
    mail.sendEmail.mockResolvedValueOnce({ sent: true, id: null }).mockResolvedValueOnce({ sent: false, id: null, reason: "down" });
    expect(await sendCatchUp(3, now)).toEqual({ sent: 1, failed: 1, remaining: 1 });
    expect(db.actionLog.create).toHaveBeenCalledTimes(1);
    expect(db.actionLog.create).toHaveBeenCalledWith({ data: { type: CATCHUP_TYPE, leadId: 5, channel: "email", payload: { cohortId: 3 } } });
    db.cohort.findUnique.mockResolvedValue(null);
    expect(await sendCatchUp(3, now)).toEqual({ error: "Cohorte introuvable." });
  });
});
