import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const m = () => vi.fn();
  const model = () => ({ findUnique: m(), findMany: m(), findFirst: m(), count: m(), create: m(), createMany: m(), update: m(), updateMany: m(), delete: m(), deleteMany: m(), upsert: m() });
  const d = {
    receipt: model(), registration: model(), serviceOrder: model(), sequence: model(), lead: model(),
    scannerResponse: model(), funnelEvent: model(), actionLog: model(), practiceTest: model(), iaDiagnostic: model(), iaPlan: model(),
    seatHold: model(), personalSchedule: model(), replayAccess: model(), replayGrant: model(), booking: model(), enterpriseRequest: model(),
    $transaction: vi.fn(),
  };
  return d;
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/messaging/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true, id: null })) }));

import { eraseLead, issueReceipt } from "@/lib/admin-records-server";

const paidReg = { id: 9, status: "paid", paidAt: new Date("2026-11-02T10:00:00Z"), leadId: 5, reference: "CB-AAAA-BBBB", amountUsd: 100_000, balanceUsd: 40_000, balancePaidAt: null, balanceMethod: null, balanceNote: null, method: "stripe", paymentNote: null, lead: { firstName: "Awa", lastName: "Diallo", email: "awa@example.com", country: "SN" }, cohort: { name: "Janvier", program: "cissp" } };

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: typeof db) => unknown)(db) : Promise.all(arg as unknown[])));
});

describe("issueReceipt", () => {
  it("numbers the first payment next in the sequence, with the amount actually paid", async () => {
    db.receipt.findUnique.mockResolvedValue(null);
    db.registration.findUnique.mockResolvedValue(paidReg);
    db.sequence.upsert.mockResolvedValue({ name: "receipt", value: 7 });
    expect(await issueReceipt("registration", 9)).toEqual({ number: "REC-000007" });
    const data = db.receipt.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ number: "REC-000007", source: "reg:9", amountUsd: 60_000, buyerName: "Awa Diallo", leadId: 5 });
    expect(data.label).toContain("premier versement");
  });

  it("never issues twice for the same payment", async () => {
    db.receipt.findUnique.mockResolvedValue({ number: "REC-000003" });
    expect(await issueReceipt("registration", 9)).toEqual({ number: "REC-000003" });
    expect(db.sequence.upsert).not.toHaveBeenCalled();
  });

  it("issues nothing for an unpaid balance, and never throws", async () => {
    db.receipt.findUnique.mockResolvedValue(null);
    db.registration.findUnique.mockResolvedValue(paidReg);
    expect(await issueReceipt("balance", 9)).toBeNull();
    db.registration.findUnique.mockRejectedValue(new Error("db down"));
    expect(await issueReceipt("registration", 9)).toBeNull();
  });
});

describe("eraseLead", () => {
  it("deletes a prospect who never paid", async () => {
    db.lead.findUnique.mockResolvedValue({ id: 5, anonymizedAt: null });
    db.registration.count.mockResolvedValue(0);
    db.serviceOrder.count.mockResolvedValue(0);
    db.receipt.count.mockResolvedValue(0);
    expect(await eraseLead(5)).toBe("deleted");
    expect(db.lead.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(db.enterpriseRequest.deleteMany).toHaveBeenCalledWith({ where: { leadId: 5 } });
  });

  it("anonymises someone who paid: the seat and the receipts stay", async () => {
    db.lead.findUnique.mockResolvedValue({ id: 5, anonymizedAt: null });
    db.registration.count.mockResolvedValue(1);
    db.serviceOrder.count.mockResolvedValue(0);
    db.receipt.count.mockResolvedValue(1);
    db.receipt.findMany.mockResolvedValue([]);
    db.registration.findMany.mockResolvedValue([]);
    db.serviceOrder.findMany.mockResolvedValue([]);
    db.enterpriseRequest.findMany.mockResolvedValue([]);
    expect(await eraseLead(5)).toBe("anonymized");
    expect(db.enterpriseRequest.deleteMany).toHaveBeenCalledWith({ where: { leadId: 5, depositPaidAt: null } });
    expect(db.lead.delete).not.toHaveBeenCalled();
    expect(db.registration.deleteMany).toHaveBeenCalledWith({ where: { leadId: 5, status: { not: "paid" } } });
    const update = db.lead.update.mock.calls[0]![0];
    expect(update.data).toMatchObject({ email: "supprime-5@anonyme.invalid", whatsapp: null, consentAt: null });
    expect(update.data.anonymizedAt).toBeInstanceOf(Date);
    expect(update.data.unsubscribedAt).toBeInstanceOf(Date);
  });
});
