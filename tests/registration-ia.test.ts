import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    registration: { update: vi.fn(), create: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    lead: { update: vi.fn() },
    serviceOrder: { findFirst: vi.fn(), update: vi.fn() },
    seatHold: { updateMany: vi.fn() },
    iaDay: { findUnique: vi.fn() },
    iaSeat: { upsert: vi.fn() },
    actionLog: { create: vi.fn() },
    cohort: { findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    lead: { findUnique: vi.fn() },
    pricingTier: { findMany: vi.fn() },
    programPrice: { findUnique: vi.fn() },
    cohort: { findMany: vi.fn(), findUnique: vi.fn() },
    exchangeRate: { findMany: vi.fn() },
    registration: { findUnique: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/tracking/server", () => ({ recordEvent: vi.fn(async () => undefined) }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn<(input: { to: string; subject: string; text: string }) => Promise<{ sent: boolean; id: null }>>(async () => ({ sent: true, id: null })) }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));

import { buildOffer, markRegistrationPaid, registerByAdmin } from "@/lib/registration";

const now = new Date("2026-12-01T12:00:00Z");
const cohort = (id: number, startsAt: string, paid = 0, capacity = 12) => ({ id, program: "ia", name: `Entrée ${id}`, startsAt: new Date(startsAt), endsAt: new Date("2027-04-01T00:00:00Z"), capacity, status: "open", _count: { registrations: paid, seatHolds: 0 } });
const lead = { id: 5, firstName: "Awa", lastName: "", email: "awa@x.test", country: "SN", unsubscribeToken: "u" };

describe("Bâtisseur IA, inscription (Ben, 03/11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.lead.findUnique.mockResolvedValue(lead);
    db.pricingTier.findMany.mockResolvedValue([{ code: "africa", amountUsd: 0, countries: ["SN"], netticketTicketCode: null }]);
    db.programPrice.findUnique.mockResolvedValue({ amountUsd: 39_000, netticketTicketCode: "IA-AFR" });
    db.exchangeRate.findMany.mockResolvedValue([{ currency: "XOF", perUsd: 600 }]);
    db.cohort.findMany.mockResolvedValue([cohort(1, "2027-01-23T15:00:00Z"), cohort(2, "2027-02-06T15:00:00Z"), cohort(3, "2027-02-20T15:00:00Z", 12)]);
  });

  it("sells the entry the person picked, at the IA price", async () => {
    const r = await buildOffer(5, now, "ia", 2);
    expect(r.offer?.cohort.id).toBe(2);
    expect(r.offer?.amountUsdCents).toBe(39_000);
    expect(r.offer?.netticketTicketCode).toBe("IA-AFR");
  });

  it("defaults to the next entry and refuses a full or unknown one", async () => {
    expect((await buildOffer(5, now, "ia")).offer?.cohort.id).toBe(1);
    expect(await buildOffer(5, now, "ia", 3)).toEqual({ offer: null, reason: "no_cohort" });
    expect(await buildOffer(5, now, "ia", 99)).toEqual({ offer: null, reason: "no_cohort" });
  });

  it("takes the J1 seat when the payment is confirmed, once", async () => {
    db.registration.findUnique.mockResolvedValue({ id: 9, reference: "CB-AAAA-BBBB", status: "pending", amountUsd: 39_000, creditUsd: 0, leadId: 5, cohortId: 2, method: "stripe", stripeSessionId: null, netticketTransactionId: null, lead, cohort: cohort(2, "2027-02-06T15:00:00Z") });
    db.tx.iaDay.findUnique.mockResolvedValue({ id: 40 });
    db.tx.registration.count.mockResolvedValue(1);
    db.tx.cohort.findUnique.mockResolvedValue({ id: 2, capacity: 12, status: "open" });
    expect(await markRegistrationPaid({ reference: "CB-AAAA-BBBB", amountPaidUsdCents: 39_000, paidAt: now })).toEqual({ ok: true, alreadyPaid: false });
    expect(db.tx.iaDay.findUnique).toHaveBeenCalledWith({ where: { cohortId: 2 }, select: { id: true } });
    expect(db.tx.iaSeat.upsert).toHaveBeenCalledWith({
      where: { leadId_cohortId_journee: { leadId: 5, cohortId: 2, journee: 1 } },
      create: { leadId: 5, cohortId: 2, journee: 1, dayId: 40 },
      update: {},
    });
    const confirmation = mail.sendEmail.mock.calls[0][0];
    expect(confirmation.text).toContain("Votre J1 est réservée");
    expect(confirmation.text).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it("takes no IA seat for another programme", async () => {
    db.registration.findUnique.mockResolvedValue({ id: 9, reference: "CB-AAAA-CCCC", status: "pending", amountUsd: 14_900, creditUsd: 0, leadId: 5, cohortId: 7, method: "stripe", lead, cohort: { ...cohort(7, "2027-01-10T15:00:00Z"), program: "cc" } });
    db.cohort.findMany.mockResolvedValue([{ ...cohort(7, "2027-01-10T15:00:00Z"), program: "cc" }]);
    db.tx.registration.count.mockResolvedValue(1);
    db.tx.cohort.findUnique.mockResolvedValue({ id: 7, capacity: 15, status: "open" });
    await markRegistrationPaid({ reference: "CB-AAAA-CCCC", amountPaidUsdCents: 14_900, paidAt: now });
    expect(db.tx.iaSeat.upsert).not.toHaveBeenCalled();
  });

  it("gives the J1 seat to a participant Ben registers by hand", async () => {
    db.lead.findUnique.mockResolvedValue({ ...lead, pricingTier: { code: "africa" } });
    db.cohort.findUnique.mockResolvedValue({ id: 1, program: "ia", name: "Entrée 1", status: "open", capacity: 12, startsAt: new Date("2027-01-23T15:00:00Z") });
    db.registration.count.mockResolvedValue(0);
    db.tx.registration.create.mockResolvedValue({ id: 11 });
    db.tx.registration.count.mockResolvedValue(1);
    db.tx.iaDay.findUnique.mockResolvedValue({ id: 30 });
    const r = await registerByAdmin({ leadId: 5, cohortId: 1, amountUsdCents: 39_000, paymentNote: "virement", notify: false });
    expect(r.ok).toBe(true);
    expect(db.tx.iaSeat.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { leadId: 5, cohortId: 1, journee: 1, dayId: 30 } }));
  });
});
