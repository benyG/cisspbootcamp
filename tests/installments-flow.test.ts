import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    registration: { update: vi.fn(), create: vi.fn(), count: vi.fn(async () => 1), deleteMany: vi.fn() },
    lead: { update: vi.fn() },
    serviceOrder: { findFirst: vi.fn(), update: vi.fn() },
    seatHold: { updateMany: vi.fn() },
    iaDay: { findUnique: vi.fn(async () => null) },
    iaSeat: { upsert: vi.fn() },
    iaPlan: { upsert: vi.fn() },
    actionLog: { create: vi.fn() },
    cohort: { findUnique: vi.fn(async () => ({ id: 2, capacity: 12, status: "open" })), update: vi.fn() },
  };
  return {
    tx,
    lead: { findUnique: vi.fn(), update: vi.fn() },
    pricingTier: { findMany: vi.fn() },
    programPrice: { findUnique: vi.fn() },
    serviceOrder: { findMany: vi.fn(async () => []) },
    cohort: { findMany: vi.fn(), findUnique: vi.fn() },
    exchangeRate: { findMany: vi.fn(async () => [{ currency: "XOF", perUsd: 600 }]) },
    registration: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    actionLog: { create: vi.fn() },
    iaPlan: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => Promise<unknown>)(tx))),
  };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/tracking/server", () => ({ recordEvent: vi.fn(async () => undefined) }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn<(input: { to: string; subject: string; text: string }) => Promise<{ sent: boolean; id: null }>>(async () => ({ sent: true, id: null })) }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));
vi.mock("@/lib/ia-plan-server", () => ({ inviteEntry: vi.fn(async () => undefined), iaPlanUrl: (t: string) => `https://x.test/ia/calendrier/${t}` }));

import { balanceReminderEmail } from "@/lib/balance-reminders";
import { buildOffer, markBalancePaid, markRegistrationPaid, startRegistration } from "@/lib/registration";

const now = new Date("2026-12-01T12:00:00Z");
const entry = { id: 2, program: "ia", name: "Entrée du samedi 23 janvier 2027", startsAt: new Date("2027-01-23T15:00:00Z"), endsAt: new Date("2027-04-01T00:00:00Z"), capacity: 12, status: "open", _count: { registrations: 0, seatHolds: 0 } };
const lead = { id: 5, firstName: "Awa", lastName: "Diop", email: "awa@x.test", country: "SN", unsubscribeToken: "u".repeat(20) };
const seat = { id: 9, reference: "CB-AAAA-BBBB", leadId: 5, cohortId: 2, method: "stripe", tier: "africa", amountUsd: 62_000, balanceUsd: 31_000, creditUsd: 0, stripeSessionId: null, netticketTransactionId: null, balanceStripeSessionId: null, balanceNetticketTransactionId: null, lead, cohort: entry };
const clock = /\b\d{1,2}:\d{2}\b|\b\d{1,2} ?h ?\d{0,2}\b/;

describe("paiement en deux fois, parcours (Ben, 04/11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.lead.findUnique.mockResolvedValue(lead);
    db.pricingTier.findMany.mockResolvedValue([{ code: "africa", amountUsd: 0, countries: ["SN"], netticketTicketCode: null, installmentUsd: null, netticketInstallmentCode: null }]);
    db.programPrice.findUnique.mockResolvedValue({ amountUsd: 59_000, netticketTicketCode: "IA-AFR", installmentUsd: 31_000, netticketInstallmentCode: "IA-AFR-2X" });
    db.cohort.findMany.mockResolvedValue([entry]);
    db.registration.findFirst.mockResolvedValue(null);
    db.registration.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 9, ...data }));
  });

  it("propose 2 × 310 USD quand le tarif a un versement", async () => {
    const { offer } = await buildOffer(5, now, "ia", 2);
    expect(offer?.amountUsdCents).toBe(59_000);
    expect(offer?.twoPayments).toMatchObject({ totalUsd: 62_000, firstUsd: 31_000, balanceUsd: 31_000, netticketTicketCode: "IA-AFR-2X" });
    db.programPrice.findUnique.mockResolvedValue({ amountUsd: 59_000, netticketTicketCode: "IA-AFR", installmentUsd: null, netticketInstallmentCode: null });
    expect((await buildOffer(5, now, "ia", 2)).offer?.twoPayments).toBeNull();
  });

  it("ouvre l'inscription au total, et ne fait payer que le premier versement", async () => {
    const started = await startRegistration({ leadId: 5, method: "netticket", program: "ia", cohortId: 2, twoPayments: true });
    expect(db.registration.create.mock.calls[0][0].data).toMatchObject({ amountUsd: 62_000, balanceUsd: 31_000, amountLocal: null });
    expect(started.registration && started.checkout).toEqual({ amountUsd: 31_000, netticketTicketCode: "IA-AFR-2X" });

    const once = await startRegistration({ leadId: 5, method: "stripe", program: "ia", cohortId: 2 });
    expect(db.registration.create.mock.calls[1][0].data).toMatchObject({ amountUsd: 59_000, balanceUsd: 0 });
    expect(once.registration && once.checkout).toEqual({ amountUsd: 59_000, netticketTicketCode: "IA-AFR" });
  });

  it("refuse les deux fois quand le tarif ne les propose plus", async () => {
    db.programPrice.findUnique.mockResolvedValue({ amountUsd: 59_000, netticketTicketCode: "IA-AFR", installmentUsd: null, netticketInstallmentCode: null });
    expect(await startRegistration({ leadId: 5, method: "stripe", program: "ia", cohortId: 2, twoPayments: true })).toEqual({ registration: null, reason: "no_two_payments" });
    expect(db.registration.create).not.toHaveBeenCalled();
  });

  it("réserve la place au premier versement et envoie le lien du solde", async () => {
    db.registration.findUnique.mockResolvedValue({ ...seat, status: "pending" });
    expect(await markRegistrationPaid({ reference: seat.reference, amountPaidUsdCents: 20_000, paidAt: now })).toMatchObject({ ok: false });
    expect(await markRegistrationPaid({ reference: seat.reference, amountPaidUsdCents: 31_000, paidAt: now })).toEqual({ ok: true, alreadyPaid: false });
    expect(db.tx.registration.update.mock.calls[0][0].data.status).toBe("paid");
    const email = mail.sendEmail.mock.calls[0][0];
    expect(email.text).toContain("premier versement de 310 USD");
    expect(email.text).toContain("Le second versement, 310 USD, est à régler avant le premier jour, le samedi 23 janvier");
    expect(email.text).toContain("https://x.test/inscription/solde/CB-AAAA-BBBB");
    expect(email.text).not.toMatch(clock);
  });

  it("encaisse le solde une seule fois, au bon montant", async () => {
    db.registration.findUnique.mockResolvedValue({ ...seat, status: "paid", balancePaidAt: null });
    expect(await markBalancePaid({ reference: seat.reference, amountPaidUsdCents: 30_000, paidAt: now, method: "stripe" })).toMatchObject({ ok: false });
    expect(db.registration.updateMany).not.toHaveBeenCalled();

    db.registration.updateMany.mockResolvedValue({ count: 1 });
    expect(await markBalancePaid({ reference: seat.reference, amountPaidUsdCents: 31_000, paidAt: now, method: "stripe", stripeSessionId: "cs_2" })).toEqual({ ok: true, alreadyPaid: false });
    expect(db.registration.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 9, balancePaidAt: null }, data: { balancePaidAt: now, balanceMethod: "stripe", balanceStripeSessionId: "cs_2" } });
    expect(mail.sendEmail.mock.calls[0][0].subject).toContain("Solde reçu");
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("entièrement réglée (620 USD)");

    // A second confirmation (webhook retry, cron) changes nothing.
    db.registration.updateMany.mockResolvedValue({ count: 0 });
    expect(await markBalancePaid({ reference: seat.reference, amountPaidUsdCents: 31_000, paidAt: now, method: "netticket" })).toEqual({ ok: true, alreadyPaid: true });
    db.registration.findUnique.mockResolvedValue({ ...seat, status: "paid", balancePaidAt: now });
    expect(await markBalancePaid({ reference: seat.reference, amountPaidUsdCents: 31_000, paidAt: now, method: "stripe" })).toEqual({ ok: true, alreadyPaid: true });
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("refuse un solde sur une place non payée ou payée en une fois", async () => {
    db.registration.findUnique.mockResolvedValue({ ...seat, status: "pending", balancePaidAt: null });
    expect(await markBalancePaid({ reference: seat.reference, amountPaidUsdCents: 31_000, paidAt: now, method: "stripe" })).toMatchObject({ ok: false });
    db.registration.findUnique.mockResolvedValue({ ...seat, status: "paid", balanceUsd: 0, balancePaidAt: null });
    expect(await markBalancePaid({ reference: seat.reference, amountPaidUsdCents: 31_000, paidAt: now, method: "stripe" })).toMatchObject({ ok: false });
  });

  it("écrit des rappels sans heure, avec le lien et la désinscription", () => {
    const email = balanceReminderEmail({ firstName: "Awa", programName: "Bâtisseur IA", cohortName: entry.name, balanceUsd: 31_000, startsAt: entry.startsAt, reference: seat.reference, unsubscribeToken: lead.unsubscribeToken, last: true });
    expect(email.subject).toContain("Dernier rappel");
    expect(email.text).toContain("310 USD, est à régler avant le premier jour, le samedi 23 janvier");
    expect(email.text).toContain("https://x.test/inscription/solde/CB-AAAA-BBBB");
    expect(email.text).toContain(`https://x.test/desinscription/${lead.unsubscribeToken}`);
    expect(email.text).not.toMatch(clock);
  });
});
