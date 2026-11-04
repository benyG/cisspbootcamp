import { describe, expect, it } from "vitest";

import { balanceAlert, balanceOpen, balanceReference, balanceReminderDue, firstDueUsd, paidSoFarUsd, seatReferenceOfBalance, twoPaymentPlan } from "@/lib/installments";

const DAY = 86_400_000;
const start = new Date("2027-01-23T15:00:00Z");
const seat = { amountUsd: 62_000, balanceUsd: 31_000, status: "paid", balancePaidAt: null as Date | null };

describe("paiement en deux fois (Ben, 04/11)", () => {
  it("coupe en deux versements égaux, le crédit sur le premier", () => {
    expect(twoPaymentPlan(31_000)).toEqual({ totalUsd: 62_000, firstUsd: 31_000, balanceUsd: 31_000 });
    expect(twoPaymentPlan(50_000, 15_000)).toEqual({ totalUsd: 85_000, firstUsd: 35_000, balanceUsd: 50_000 });
    expect(twoPaymentPlan(null)).toBeNull();
    expect(twoPaymentPlan(0)).toBeNull();
    // A credit that covers the first instalment: pay at once instead.
    expect(twoPaymentPlan(10_000, 15_000)).toBeNull();
  });

  it("reconnaît la référence du solde", () => {
    expect(balanceReference("CB-7K3M-9QXZ")).toBe("CB-7K3M-9QXZ-S");
    expect(seatReferenceOfBalance("CB-7K3M-9QXZ-S")).toBe("CB-7K3M-9QXZ");
    expect(seatReferenceOfBalance("CB-7K3M-9QXZ")).toBeNull();
  });

  it("sait ce qui est dû et ce qui est payé", () => {
    expect(firstDueUsd(seat)).toBe(31_000);
    expect(firstDueUsd({ amountUsd: 59_000, balanceUsd: 0 })).toBe(59_000);
    expect(balanceOpen(seat)).toBe(true);
    expect(paidSoFarUsd(seat)).toBe(31_000);
    expect(paidSoFarUsd({ ...seat, balancePaidAt: new Date() })).toBe(62_000);
    expect(balanceOpen({ ...seat, balancePaidAt: new Date() })).toBe(false);
    expect(balanceOpen({ ...seat, status: "pending" })).toBe(false);
    expect(paidSoFarUsd({ ...seat, status: "pending" })).toBe(0);
    expect(balanceOpen({ ...seat, balanceUsd: 0 })).toBe(false);
  });

  it("relance 7 jours puis 2 jours avant, une fois chacune", () => {
    const base = { ...seat, balanceReminders: 0, paidAt: new Date(start.getTime() - 30 * DAY), startsAt: start };
    expect(balanceReminderDue(base, new Date(start.getTime() - 8 * DAY))).toBeNull();
    expect(balanceReminderDue(base, new Date(start.getTime() - 7 * DAY))).toBe(0);
    expect(balanceReminderDue({ ...base, balanceReminders: 1 }, new Date(start.getTime() - 5 * DAY))).toBeNull();
    expect(balanceReminderDue({ ...base, balanceReminders: 1 }, new Date(start.getTime() - 2 * DAY))).toBe(1);
    expect(balanceReminderDue({ ...base, balanceReminders: 2 }, new Date(start.getTime() - DAY))).toBeNull();
    // Late: the first reminder still goes, then the second.
    expect(balanceReminderDue(base, new Date(start.getTime() - DAY))).toBe(0);
    // Never once it has begun, never once paid, never the day after paying.
    expect(balanceReminderDue(base, new Date(start.getTime() + 60_000))).toBeNull();
    expect(balanceReminderDue({ ...base, balancePaidAt: new Date() }, new Date(start.getTime() - 3 * DAY))).toBeNull();
    expect(balanceReminderDue({ ...base, paidAt: new Date(start.getTime() - 7 * DAY) }, new Date(start.getTime() - 6.5 * DAY))).toBeNull();
  });

  it("vous alerte la veille du premier jour si le solde reste dû", () => {
    expect(balanceAlert({ ...seat, startsAt: start }, new Date(start.getTime() - 2 * DAY))).toBe(false);
    expect(balanceAlert({ ...seat, startsAt: start }, new Date(start.getTime() - DAY))).toBe(true);
    expect(balanceAlert({ ...seat, startsAt: start }, new Date(start.getTime() + DAY))).toBe(true);
    expect(balanceAlert({ ...seat, balancePaidAt: new Date(), startsAt: start }, new Date(start.getTime() - DAY))).toBe(false);
  });
});
