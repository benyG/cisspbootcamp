import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { domainChoices, domainNumber, dueAtFromDay, parseRecipient, parseWebhookEvent, reminderDue, scoreBand, splitQuestions } from "@/lib/evaluations";

const db = vi.hoisted(() => ({
  cohort: { findUnique: vi.fn() },
  registration: { findMany: vi.fn() },
  personalSchedule: { findMany: vi.fn() },
  evaluation: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  evaluationRecipient: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  actionLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://www.cisspbootcamp.online" } }));
vi.mock("@/lib/calendar/google", () => ({ accessToken: vi.fn(), fetchBusy: vi.fn(), createSessionEvent: vi.fn(), setEventAttendees: vi.fn() }));
vi.mock("@/lib/stream", () => ({ streamEnabled: () => false }));
const v1 = vi.hoisted(() => ({ cisspDomains: vi.fn(), createDomainTest: vi.fn(), readTest: vi.fn() }));
vi.mock("@/lib/examboot/v1", () => v1);
vi.mock("@/lib/examboot/client", async (orig) => ({ ...(await orig<typeof import("@/lib/examboot/client")>()), examBootEnabled: () => true }));

import { createEvaluation, handleWebhook, inviteEmail, questionPlan, validSignature } from "@/lib/evaluations-server";

const CATALOG = [
  { id: 82, name: "Asset Security", questions: 145 },
  { id: 81, name: "Security and Risk Management", questions: 210 },
  { id: 83, name: "Security Architecture and Engineering", questions: 3 },
  { id: 84, name: "Communication and Network Security", questions: 150 },
  { id: 85, name: "Identity and Access Management (IAM)", questions: 150 },
  { id: 86, name: "Security Assessment and Testing", questions: 150 },
  { id: 87, name: "Security Operations", questions: 150 },
  { id: 88, name: "Software Development Security", questions: 150 },
];

describe("évaluations : règles (Ben, 14/10)", () => {
  it("reconnaît les 8 domaines CISSP par leur nom anglais et les range dans l'ordre", () => {
    expect(CATALOG.map((d) => domainNumber(d.name))).toEqual([2, 1, 3, 4, 5, 6, 7, 8]);
    const choices = domainChoices(CATALOG);
    expect(choices.map((d) => d.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(choices[0]).toMatchObject({ id: 81, label: "Sécurité et gestion des risques", weight: 16, cap: 210 });
    expect(domainChoices([{ id: 9, name: "Bonus", questions: 4 }])[0]).toMatchObject({ n: null, label: "Bonus" });
  });

  it("répartit au plus juste selon les poids, sans dépasser ce qu'un domaine contient", () => {
    expect(splitQuestions(5, [1, 1])).toEqual([3, 2]);
    expect(splitQuestions(25, [16, 10])).toEqual([15, 10]);
    expect(splitQuestions(100, [16, 10, 13, 13, 13, 12, 13, 10]).reduce((a, b) => a + b)).toBe(100);
    expect(splitQuestions(20, [1, 1, 1], [3, 100, 100])).toEqual([3, 9, 8]);
    expect(splitQuestions(50, [1, 1], [5, 5])).toEqual([5, 5]);
    expect(splitQuestions(0, [1, 1])).toEqual([0, 0]);
  });

  it("plan de questions : à la main, plafonné ; domaine plein → le reste ailleurs", () => {
    const choices = domainChoices(CATALOG);
    expect(questionPlan(choices, { split: "hand", total: 0, domainIds: [81, 83], perDomain: { 81: 7, 83: 9 } }).map((d) => [d.id, d.questions])).toEqual([[81, 7], [83, 3]]);
    expect(questionPlan(choices, { split: "equal", total: 10, domainIds: [83, 87], perDomain: {} }).map((d) => d.questions)).toEqual([3, 7]);
  });

  it("couleurs, relance et date limite", () => {
    expect([scoreBand(70), scoreBand(69), scoreBand(55), scoreBand(54), scoreBand(null)]).toEqual(["good", "fair", "fair", "low", "none"]);
    const dueAt = new Date("2026-10-25T23:59:00Z");
    expect(reminderDue({ dueAt, remind: true, remindedAt: null }, new Date("2026-10-22T23:00:00Z"))).toBe(false);
    expect(reminderDue({ dueAt, remind: true, remindedAt: null }, new Date("2026-10-24T08:00:00Z"))).toBe(true);
    expect(reminderDue({ dueAt, remind: true, remindedAt: new Date() }, new Date("2026-10-24T08:00:00Z"))).toBe(false);
    expect(reminderDue({ dueAt, remind: false, remindedAt: null }, new Date("2026-10-24T08:00:00Z"))).toBe(false);
    expect(reminderDue({ dueAt, remind: true, remindedAt: null }, new Date("2026-10-26T08:00:00Z"))).toBe(false);
    expect(dueAtFromDay("2026-10-25")?.toISOString()).toBe("2026-10-25T23:59:00.000Z");
    expect(dueAtFromDay("25/10/2026")).toBeNull();
  });

  it("vérifie la signature HMAC-SHA256 du webhook (hex, sha256=, base64)", () => {
    const body = '{"event":"test.completed"}';
    const mac = createHmac("sha256", "s3cret").update(body).digest();
    expect(validSignature(body, mac.toString("hex"), "s3cret")).toBe(true);
    expect(validSignature(body, `sha256=${mac.toString("hex")}`, "s3cret")).toBe(true);
    expect(validSignature(body, mac.toString("base64"), "s3cret")).toBe(true);
    expect(validSignature(body, mac.toString("hex"), "autre")).toBe(false);
    expect(validSignature(body, null, "s3cret")).toBe(false);
    expect(validSignature(body, mac.toString("hex"), "")).toBe(false);
  });

  it("lit un destinataire et l'alerte « test terminé »", () => {
    expect(parseRecipient({ id: 901, email: "Ada@X.test", status: "sent", result: null })).toMatchObject({ externalId: 901, email: "ada@x.test", status: "sent", percent: null });
    const done = parseRecipient({ id: 901, email: "ada@x.test", status: "completed", completed_at: "2026-10-15T09:12:40+00:00", result: { percent: 60, correct: 3, domains: [{ id: 81, name: "SRM", questions: 3, correct: 3, percent: 100 }] } });
    expect(done).toMatchObject({ status: "completed", percent: 60, correct: 3, domains: [{ id: 81, percent: 100 }] });
    expect(parseRecipient({ id: 0, email: "x" })).toBeNull();
    const event = parseWebhookEvent({ event: "test.completed", payload: { test: "Test_1", recipient: { id: 901, email: "ada@x.test" }, score: 60, correct: 3, domains: [], completed_at: "2026-10-15T09:12:40+00:00" } });
    expect(event).toMatchObject({ test: "Test_1", result: { externalId: 901, status: "completed", percent: 60 } });
    expect(parseWebhookEvent({ event: "other", payload: {} })).toBeNull();
  });

  it("e-mail : domaines nommés, pas d'heure, lien personnel et désinscription", () => {
    const m = inviteEmail({ firstName: "Awa", unsubscribeToken: "u1", link: "https://examboot.net/t/abc", reminder: false, evaluation: { title: "Point d'étape", kind: "test", questions: 25, timer: 0, dueAt: new Date("2026-10-25T23:59:00Z"), message: "Sans notes.", domains: [{ n: 1, name: "Sécurité et gestion des risques" }, { n: 2, name: "Sécurité des actifs" }] } });
    expect(m.subject).toBe("Point d'étape · à faire avant le 25 octobre");
    expect(m.text).toContain("un test de 25 questions sur les domaines 1 (Sécurité et gestion des risques) et 2 (Sécurité des actifs)");
    expect(m.text).toContain("« Sans notes. »");
    expect(m.text).toContain("https://examboot.net/t/abc");
    expect(m.text).toContain("/desinscription/u1");
    expect(m.text).not.toMatch(/\d{1,2} ?h\d{0,2}\b/);
    const exam = inviteEmail({ firstName: "Awa", unsubscribeToken: "u1", link: "l", reminder: true, evaluation: { title: "Blanc", kind: "exam", questions: 100, timer: 150, dueAt: new Date("2026-10-25T23:59:00Z"), message: null, domains: CATALOG.map((d, i) => ({ n: i + 1, name: d.name })) } });
    expect(exam.subject).toBe("Rappel : Blanc · à faire avant le 25 octobre");
    expect(exam.text).toContain("un examen blanc de 100 questions sur les 8 domaines");
  });
});

describe("évaluations : création et scores", () => {
  const awa = { id: 3, firstName: "Awa", lastName: "Diop", email: "Awa@X.test" };
  const kofi = { id: 4, firstName: "Kofi", lastName: "Mensah", email: "kofi@x.test" };
  beforeEach(() => {
    for (const group of Object.values(db)) for (const f of Object.values(group)) f.mockReset();
    for (const f of Object.values(v1)) f.mockReset();
    mail.sendEmail.mockReset().mockResolvedValue({ sent: true, id: null });
    db.cohort.findUnique.mockResolvedValue({ id: 7, name: "Cohorte Novembre 2026", program: "cissp" });
    db.registration.findMany.mockResolvedValue([{ lead: awa }, { lead: kofi }]);
    db.personalSchedule.findMany.mockResolvedValue([]);
    v1.cisspDomains.mockResolvedValue(CATALOG);
  });

  const input = { cohortId: 7, title: "Point d'étape", kind: "test" as const, split: "weight" as const, total: 25, domainIds: [81, 82], perDomain: {}, timer: 0, dueAt: new Date("2026-10-25T23:59:00Z"), remind: true, message: "", leadIds: [3] };

  it("crée le test ExamBoot sans e-mail ExamBoot, garde le lien de chacun, envoie notre e-mail", async () => {
    v1.createDomainTest.mockResolvedValue({ code: "Test_1", recipients: [{ id: 901, email: "awa@x.test", link: "https://examboot.net/t/abc" }] });
    db.evaluation.create.mockResolvedValue({ id: 12 });
    db.evaluationRecipient.findMany.mockResolvedValue([{ id: 50 }]);
    db.evaluationRecipient.findUnique.mockResolvedValue({ id: 50, evaluationId: 12, status: "created", link: "https://examboot.net/t/abc", lead: { id: 3, firstName: "Awa", email: "Awa@X.test", unsubscribeToken: "u3", unsubscribedAt: null }, evaluation: { title: "Point d'étape", kind: "test", questions: 25, timer: 0, dueAt: input.dueAt, message: null, domains: [] } });
    const r = await createEvaluation(input, new Date("2026-10-14T00:00:00Z"));
    expect(r).toMatchObject({ ok: true, id: 12, message: expect.stringMatching(/1 e-mail\(s\) sur 1/) });
    const sent = v1.createDomainTest.mock.calls[0][0];
    expect(sent).toMatchObject({ type: "test", domains: [{ id: 81, questions: 15 }, { id: 82, questions: 10 }], recipients: [{ email: "Awa@X.test", name: "Awa Diop" }] });
    expect(sent.timer).toBeUndefined();
    expect(db.evaluation.create.mock.calls[0][0].data).toMatchObject({ code: "Test_1", questions: 25, recipients: { create: [{ leadId: 3, externalId: 901, link: "https://examboot.net/t/abc" }] } });
    expect(mail.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "Awa@X.test" }));
    expect(db.evaluationRecipient.update).toHaveBeenCalledWith({ where: { id: 50 }, data: expect.objectContaining({ status: "sent" }) });
  });

  it("refuse une date passée, une cohorte CC, ou personne de choisi, sans appeler ExamBoot", async () => {
    const now = new Date("2026-10-14T00:00:00Z");
    expect(await createEvaluation({ ...input, dueAt: new Date("2026-10-01T00:00:00Z") }, now)).toMatchObject({ ok: false });
    expect(await createEvaluation({ ...input, leadIds: [99] }, now)).toMatchObject({ ok: false, error: expect.stringMatching(/au moins une personne/) });
    db.cohort.findUnique.mockResolvedValue({ id: 8, name: "CC", program: "cc" });
    expect(await createEvaluation(input, now)).toMatchObject({ ok: false, error: expect.stringMatching(/CISSP/) });
    expect(v1.createDomainTest).not.toHaveBeenCalled();
  });

  it("webhook : signature exigée, score enregistré une seule fois", async () => {
    process.env.EXAMBOOT_WEBHOOK_SECRET = "s3cret";
    const body = JSON.stringify({ event: "test.completed", payload: { test: "Test_1", recipient: { id: 901, email: "awa@x.test" }, score: 60, correct: 15, domains: [{ id: 81, name: "SRM", questions: 15, correct: 10, percent: 67 }], completed_at: "2026-10-15T09:12:40+00:00" } });
    const sig = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect((await handleWebhook(body, "bad")).status).toBe(401);
    db.evaluationRecipient.findFirst.mockResolvedValue({ id: 50, leadId: 3, status: "sent", evaluationId: 12 });
    expect(await handleWebhook(body, sig)).toEqual({ status: 200, body: { received: true, recorded: true } });
    expect(db.evaluationRecipient.findFirst.mock.calls[0][0].where).toEqual({ externalId: 901, evaluation: { code: "Test_1" } });
    expect(db.evaluationRecipient.update.mock.calls[0][0].data).toMatchObject({ status: "completed", percent: 60, correct: 15 });
    db.evaluationRecipient.findFirst.mockResolvedValue({ id: 50, leadId: 3, status: "completed", evaluationId: 12 });
    expect((await handleWebhook(body, sig)).body).toMatchObject({ recorded: false });
  });
});
