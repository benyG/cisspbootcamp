import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  pricingTier: { findMany: vi.fn() },
  lead: { upsert: vi.fn() },
  iaDiagnostic: { create: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test/", ADMIN_EMAIL: "ben@x.test" } }));

import { diagnosticByToken, submitIaDiagnostic } from "@/lib/ia-diagnostic-server";

const answers = { activity: "solo", tasks: ["devis", "relance"], hours: "5", tools: "whatsapp", ease: "2" };
const contact = { firstName: "Awa", email: " Awa@X.test ", country: "CI", whatsapp: "", consent: true, website: "" };
const now = new Date("2026-11-03T12:00:00Z");

describe("diagnostic IA, enregistrement (Ben, 03/11)", () => {
  beforeEach(() => {
    for (const group of [db.pricingTier, db.lead, db.iaDiagnostic]) for (const f of Object.values(group)) f.mockReset();
    mail.sendEmail.mockReset().mockResolvedValue({ sent: true, id: null });
    db.pricingTier.findMany.mockResolvedValue([{ code: "africa", countries: ["CI", "SN"] }, { code: "international", countries: [] }]);
    db.lead.upsert.mockResolvedValue({ id: 5, firstName: "Awa", unsubscribeToken: "u".repeat(43) });
  });

  it("records the lead with dated consent, the answers and the result, then e-mails both sides", async () => {
    const r = await submitIaDiagnostic({ answers, contact }, now);
    expect(r.ok).toBe(true);
    const upsert = db.lead.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ email: "awa@x.test" });
    expect(upsert.create).toMatchObject({ firstName: "Awa", lastName: "", country: "CI", tier: "africa", consentAt: now, source: "ia_diagnostic" });
    expect(upsert.update).toEqual({ whatsapp: undefined, country: "CI", tier: "africa", consentAt: now, unsubscribedAt: null });
    const saved = db.iaDiagnostic.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({ leadId: 5, answers });
    expect(saved.result.priorities.map((p: { code: string }) => p.code)).toEqual(["relance", "devis"]);
    expect(r.ok && saved.token).toBe(r.ok ? r.token : null);

    const [toLead, toBen] = mail.sendEmail.mock.calls.map((c) => c[0]);
    expect(toLead.to).toBe("awa@x.test");
    expect(toLead.text).toContain(`https://x.test/ia/diagnostic/resultat/${saved.token}`);
    expect(toLead.text).toContain(`https://x.test/desinscription/${"u".repeat(43)}`);
    expect(toLead.text).toContain("séance d’accueil");
    // No clock time in e-mails (Ben): durations only.
    expect(toLead.text).not.toMatch(/\b\d{1,2}:\d{2}\b|\b(à|de) \d{1,2} ?h\b/);
    expect(toBen.to).toBe("ben@x.test");
    expect(toBen.text).toContain("https://x.test/admin/leads/5");
  });

  it("keeps the first-touch campaign on a new lead, so the studio counts it (Ben, 04/11)", async () => {
    await submitIaDiagnostic({ answers, contact, utm: { source: "tiktok", medium: "social", campaign: "cohorte-9", content: "tt-abc123" } }, now);
    const upsert = db.lead.upsert.mock.calls[0][0];
    expect(upsert.create).toMatchObject({ utmSource: "tiktok", utmMedium: "social", utmCampaign: "cohorte-9", utmContent: "tt-abc123" });
    expect(upsert.update).not.toHaveProperty("utmContent");
    // A malformed campaign never blocks the result.
    db.lead.upsert.mockClear();
    expect((await submitIaDiagnostic({ answers, contact, utm: { content: "x".repeat(500) } }, now)).ok).toBe(true);
    expect(db.lead.upsert.mock.calls[0][0].create.utmContent).toBeNull();
  });

  it("refuses without consent, with a robot field, or with incomplete answers", async () => {
    expect(await submitIaDiagnostic({ answers, contact: { ...contact, consent: false } }, now)).toEqual({ ok: false, error: "Votre accord est nécessaire pour recevoir votre résultat." });
    expect(await submitIaDiagnostic({ answers, contact: { ...contact, website: "spam" } }, now)).toMatchObject({ ok: false });
    expect(await submitIaDiagnostic({ answers: { ...answers, tasks: [] }, contact }, now)).toEqual({ ok: false, error: "Cochez au moins une tâche." });
    expect(await submitIaDiagnostic({ answers, contact: { ...contact, country: "XX" } }, now)).toMatchObject({ ok: false });
    expect(db.lead.upsert).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("keeps the result when an e-mail fails", async () => {
    mail.sendEmail.mockRejectedValue(new Error("down"));
    expect((await submitIaDiagnostic({ answers, contact }, now)).ok).toBe(true);
  });

  it("reads a result back from its token only", async () => {
    expect(await diagnosticByToken("../etc")).toBeNull();
    db.iaDiagnostic.findUnique.mockResolvedValue({ id: 1, createdAt: now, answers, lead: { firstName: "Awa", country: "CI", tier: "africa" } });
    const d = await diagnosticByToken("t".repeat(43));
    expect(d?.result.ready).toBe(false);
    expect(d?.result.priorities[0].code).toBe("relance");
    db.iaDiagnostic.findUnique.mockResolvedValue({ id: 1, createdAt: now, answers: { broken: true }, lead: {} });
    expect(await diagnosticByToken("t".repeat(43))).toBeNull();
  });
});
