import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ quoteRequest: { create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://www.cisspbootcamp.online", ADMIN_EMAIL: "ben@x.test" } }));

import { quoteSchema, quoteSummary, submitQuote } from "@/lib/quotes";

const valid = {
  organization: "Banque Exemple", country: "CI", contactName: "Aminata Koné", jobTitle: "Responsable formation", email: "A.Kone@Exemple.ci", phone: "+225 07 00 00 00",
  certification: "cissp", format: "online", headcount: "6-10", timing: "6m", need: "Équipe de 8 personnes.", consent: true, website: "",
};

describe("devis entreprises (Ben, 21/10)", () => {
  beforeEach(() => {
    db.quoteRequest.create.mockReset().mockResolvedValue({ id: 5 });
    mail.sendEmail.mockReset().mockResolvedValue({ sent: true, id: null });
  });

  it("valide la demande : consentement exigé, pays connu, e-mail normalisé", () => {
    expect(quoteSchema.safeParse(valid).success).toBe(true);
    expect(quoteSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...valid, country: "XX" }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...valid, headcount: "1-2" }).success).toBe(false);
    expect(quoteSchema.parse({ ...valid, phone: "", jobTitle: "" })).toMatchObject({ email: "a.kone@exemple.ci", phone: null, jobTitle: null });
  });

  it("résumé lisible", () => {
    expect(quoteSummary({ certification: "cissp", format: "online", headcount: "6-10", timing: "6m" })).toBe("CISSP · en ligne · 6 à 10 personnes · 3 à 6 mois");
  });

  it("enregistre avec l'heure du consentement, prévient Ben et confirme au demandeur", async () => {
    const now = new Date("2026-10-21T10:00:00Z");
    expect(await submitQuote(valid, now)).toEqual({ ok: true });
    const data = db.quoteRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organization: "Banque Exemple", email: "a.kone@exemple.ci", consentAt: now });
    expect(data).not.toHaveProperty("consent");
    expect(data).not.toHaveProperty("website");
    const [toBen, toClient] = mail.sendEmail.mock.calls.map((c) => c[0]);
    expect(toBen).toMatchObject({ to: "ben@x.test", subject: expect.stringContaining("Banque Exemple") });
    expect(toBen.text).toContain("/admin/devis?id=5");
    expect(toClient).toMatchObject({ to: "a.kone@exemple.ci" });
    expect(toClient.text).toContain("48 h ouvrées");
    expect(toClient.text).not.toMatch(/\d{1,2} ?h ?\d{2}/);
  });

  it("refuse sans consentement et ignore en silence un robot (champ piège rempli)", async () => {
    expect(await submitQuote({ ...valid, consent: false })).toMatchObject({ ok: false, field: "consent" });
    expect(await submitQuote({ ...valid, website: "http://spam.test" })).toEqual({ ok: true });
    expect(db.quoteRequest.create).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});
