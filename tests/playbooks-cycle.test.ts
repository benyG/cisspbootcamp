import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cohort: { findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(async () => []) },
  lead: { findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(async () => []) },
  iaDiagnostic: { findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(async () => []) },
  actionLog: { findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(async () => []), findFirst: vi.fn(async () => null as unknown) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/messaging/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));
vi.mock("@/lib/calendar/google", () => ({ calendarHealth: vi.fn(async () => "ok") }));

import { planFull, planHot, planLastCall, planOpening, planWrapup } from "@/lib/playbooks/cycle";
import { lastCallDue, openingDue, programOfReadiness } from "@/lib/playbooks/rules";

const DAY = 86_400_000;
const now = new Date("2026-11-10T06:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * DAY);
const cohort = (over: Record<string, unknown> = {}) => ({ id: 3, program: "cissp", name: "Cohorte de janvier", startsAt: inDays(55), endsAt: inDays(70), capacity: 10, status: "open", _count: { registrations: 2, seatHolds: 0 }, ...over });
const lead = (over: Record<string, unknown> = {}) => ({ id: 5, firstName: "Awa", email: "awa@x.test", consentAt: inDays(-30), unsubscribedAt: null, unsubscribeToken: "u".repeat(24), readiness: "ready", scannerResponses: [{ resultToken: "tok123456789" }], iaDiagnostics: [], registrations: [], ...over });

describe("windows", () => {
  it("opens from J-60 to J-50, calls last from 4 days before the close, maps readiness to a programme", () => {
    expect(openingDue(-61)).toBe(false);
    expect(openingDue(-55)).toBe(true);
    expect(openingDue(-49)).toBe(false);
    expect(lastCallDue(-11, -7)).toBe(true);
    expect(lastCallDue(-7, -7)).toBe(false);
    expect(lastCallDue(-12, -7)).toBe(false);
    expect(programOfReadiness("conditional")).toBe("cissp");
    expect(programOfReadiness("not_yet")).toBe("cc");
    expect(programOfReadiness(null)).toBeNull();
  });
});

describe("Ouverture", () => {
  beforeEach(() => { vi.clearAllMocks(); db.actionLog.findMany.mockResolvedValue([]); });

  it("reminds Ben to open the registrations of a planned cohort at J-60", async () => {
    db.cohort.findMany.mockResolvedValue([cohort({ status: "planned" })]);
    const [step] = await planOpening(now);
    expect(step!.email.to).toBe("ben@x.test");
    expect(step!.email.text).toContain("https://x.test/admin/cohortes/3");
    expect(db.lead.findMany).not.toHaveBeenCalled();
  });

  it("writes to consenting prospects of the programme only, once per cohort", async () => {
    db.cohort.findMany.mockResolvedValue([cohort()]);
    db.lead.findMany.mockResolvedValue([lead(), lead({ id: 6, readiness: "not_yet" }), lead({ id: 7, consentAt: null }), lead({ id: 8, registrations: [{ status: "paid", cohortId: 1, cohort: { program: "cissp" } }] }), lead({ id: 9 })]);
    db.actionLog.findMany.mockImplementation(async (args?: unknown) => ((args as { where: { type: unknown } }).where.type === "playbook_opening" ? [{ leadId: 9, payload: { cohortId: 3 } }] : []));
    const steps = await planOpening(now);
    expect(steps.map((s) => s.log.leadId)).toEqual([5]);
    expect(steps[0]!.email.subject).toBe("Les inscriptions sont ouvertes · CISSP Bootcamp");
    expect(steps[0]!.email.text).toContain("https://x.test/inscription?t=tok123456789");
    expect(steps[0]!.email.text).toContain("ferment le");
    expect(steps[0]!.email.text).toContain("/desinscription/");
  });

  it("does nothing outside the window or for a full cohort", async () => {
    db.cohort.findMany.mockResolvedValue([cohort({ startsAt: inDays(40) }), cohort({ id: 4, _count: { registrations: 10, seatHolds: 0 } })]);
    expect(await planOpening(now)).toEqual([]);
  });
});

describe("Prospect chaud (Bâtisseur IA)", () => {
  beforeEach(() => { vi.clearAllMocks(); db.actionLog.findMany.mockResolvedValue([]); });

  it("follows a 3-day-old diagnostic up with its first automation, signed ExamBoot", async () => {
    db.cohort.findMany.mockResolvedValue([cohort({ id: 8, program: "ia", name: "Entrée du 9 janvier", startsAt: inDays(60) })]);
    db.lead.findMany.mockResolvedValue([lead({ readiness: null, scannerResponses: [], iaDiagnostics: [{ token: "iatok" }] })]);
    db.iaDiagnostic.findMany.mockResolvedValue([{ leadId: 5, createdAt: inDays(-3), result: { priorities: [{ title: "Relancer vos prospects" }] } }]);
    const [step] = await planHot(now);
    expect(step!.email.text).toContain("« Relancer vos prospects »");
    expect(step!.email.text).toContain("/ia/inscription?entree=8&t=iatok");
    expect(step!.email.text).toContain("L’équipe Bâtisseur IA");
    expect(step!.email.text).not.toMatch(/\bBen\b/);
  });

  it("waits two days, and leaves a started checkout to the other playbook", async () => {
    db.cohort.findMany.mockResolvedValue([cohort({ id: 8, program: "ia", startsAt: inDays(60) })]);
    db.lead.findMany.mockResolvedValue([lead({ iaDiagnostics: [{ token: "t" }] })]);
    db.iaDiagnostic.findMany.mockResolvedValue([{ leadId: 5, createdAt: inDays(-1), result: {} }]);
    expect(await planHot(now)).toEqual([]);
    db.lead.findMany.mockResolvedValue([lead({ iaDiagnostics: [{ token: "t" }], registrations: [{ status: "pending", cohortId: 8, cohort: { program: "ia" } }] })]);
    db.iaDiagnostic.findMany.mockResolvedValue([{ leadId: 5, createdAt: inDays(-3), result: {} }]);
    expect(await planHot(now)).toEqual([]);
  });
});

describe("Dernier appel, Cohorte pleine, Fin de cohorte", () => {
  beforeEach(() => { vi.clearAllMocks(); db.actionLog.findMany.mockResolvedValue([]); });

  it("gives the real deadline and the seats left", async () => {
    db.cohort.findMany.mockResolvedValue([cohort({ startsAt: inDays(10), _count: { registrations: 7, seatHolds: 1 } })]);
    db.lead.findMany.mockResolvedValue([lead()]);
    const [step] = await planLastCall(now);
    expect(step!.email.text).toContain("Il reste 2 places.");
    expect(step!.email.subject).toMatch(/^Les inscriptions ferment le 13 novembre/);
  });

  it("tells Ben once when a cohort is full, with the next one", async () => {
    db.cohort.findMany.mockResolvedValue([cohort({ _count: { registrations: 10, seatHolds: 0 } }), cohort({ id: 4, name: "Cohorte de mars", startsAt: inDays(120), status: "planned" })]);
    const [step] = await planFull(now);
    expect(step!.email.text).toContain("La suivante : CISSP Bootcamp — Cohorte de mars");
    db.actionLog.findMany.mockResolvedValue([{ payload: { cohortId: 3 } }]);
    expect(await planFull(now)).toEqual([]);
  });

  it("prepares the testimonial and referral messages a week after the end", async () => {
    db.cohort.findMany.mockResolvedValue([{ id: 2, program: "cissp", name: "Cohorte d’octobre", registrations: [{ lead: { firstName: "Koffi", lastName: "A.", whatsapp: "+228 90 00 00 00" } }, { lead: { firstName: "Mariam", lastName: "D.", whatsapp: null } }] }]);
    const [step] = await planWrapup(now);
    expect(step!.email.to).toBe("ben@x.test");
    expect(step!.email.text).toContain("https://wa.me/22890000000?text=");
    expect(step!.email.text).toContain("Mariam D. (pas de WhatsApp : par e-mail)");
    expect(decodeURIComponent(step!.email.text)).toContain("sans votre accord écrit");
  });
});
