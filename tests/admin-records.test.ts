import { describe, expect, it } from "vitest";

import {
  accountantCsv,
  anonymizedIdentity,
  businessComplete,
  daysLeft,
  deadlineReminder,
  formatReceiptNumber,
  monthBounds,
  nextOccurrence,
  privacyDueAt,
  receiptSource,
  resolveBusiness,
  retentionCutoff,
} from "@/lib/admin-records";

const row = (over: Partial<Parameters<typeof accountantCsv>[0][number]> = {}) => ({
  number: "REC-000002",
  paidAt: new Date("2026-11-03T10:00:00Z"),
  buyerName: "Awa Diallo",
  buyerEmail: "awa@example.com",
  buyerCountry: "SN",
  label: "CISSP Bootcamp — Janvier",
  method: "stripe" as const,
  paymentNote: null,
  reference: "CB-AAAA-BBBB",
  amountUsd: 120_050,
  ...over,
});

describe("receipt numbers", () => {
  it("are continuous and padded", () => {
    expect(formatReceiptNumber(1)).toBe("REC-000001");
    expect(formatReceiptNumber(1234567)).toBe("REC-1234567");
  });
  it("one source per payment", () => {
    expect(receiptSource("registration", 4)).toBe("reg:4");
    expect(receiptSource("balance", 4)).toBe("bal:4");
    expect(receiptSource("service", 4)).toBe("svc:4");
  });
});

describe("accountantCsv", () => {
  it("sorts by number, uses semicolons and decimal commas, totals", () => {
    const csv = accountantCsv([row(), row({ number: "REC-000001", amountUsd: 5000, method: "manual", paymentNote: "virement" })]);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toContain("Numéro;Date;Client");
    expect(lines[1]).toMatch(/^REC-000001;2026-11-03;/);
    expect(lines[1]).toContain("Règlement direct (virement)");
    expect(lines[2]).toMatch(/;1200,50$/);
    expect(lines[3]).toBe(";;;;;;;Total;1250,50");
  });
  it("quotes cells holding separators", () => {
    expect(accountantCsv([row({ buyerName: 'Kofi "K"; Mensah' })])).toContain('"Kofi ""K""; Mensah"');
  });
  it("reads only valid months", () => {
    expect(monthBounds("2026-12")).toEqual({ from: new Date("2026-12-01T00:00:00Z"), to: new Date("2027-01-01T00:00:00Z") });
    expect(monthBounds("2026-13")).toBeNull();
    expect(monthBounds("nope")).toBeNull();
  });
});

describe("deadlines", () => {
  const now = new Date("2026-11-15T09:00:00Z");
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);
  it("reminds at J-15 and J-3 only", () => {
    expect(deadlineReminder(inDays(20), now)).toBeNull();
    expect(deadlineReminder(inDays(15), now)).toBe(15);
    expect(deadlineReminder(inDays(4), now)).toBe(15);
    expect(deadlineReminder(inDays(3), now)).toBe(3);
    expect(deadlineReminder(inDays(0), now)).toBe(3);
    expect(deadlineReminder(inDays(-1), now)).toBeNull();
    expect(daysLeft(inDays(-2), now)).toBe(-2);
  });
  it("comes back on its next date, end of month clamped", () => {
    expect(nextOccurrence(new Date("2026-01-31T09:00:00Z"), "monthly")?.toISOString()).toBe("2026-02-28T09:00:00.000Z");
    expect(nextOccurrence(new Date("2026-11-15T09:00:00Z"), "quarterly")?.toISOString()).toBe("2027-02-15T09:00:00.000Z");
    expect(nextOccurrence(new Date("2026-03-01T09:00:00Z"), "yearly")?.toISOString()).toBe("2027-03-01T09:00:00.000Z");
    expect(nextOccurrence(new Date("2026-03-01T09:00:00Z"), "none")).toBeNull();
  });
});

describe("data and retention", () => {
  it("gives a month to answer a request", () => {
    expect(privacyDueAt(new Date("2026-11-01T00:00:00Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
  it("keeps prospects three years", () => {
    expect(retentionCutoff(new Date("2026-11-15T12:00:00Z")).toISOString()).toBe("2023-11-15T00:00:00.000Z");
  });
  it("anonymises into a unique, unreachable identity", () => {
    const a = anonymizedIdentity(42);
    expect(a.email).toBe("supprime-42@anonyme.invalid");
    expect(a.whatsapp).toBeNull();
    expect(a.consentAt).toBeNull();
    expect(a.notes).toBeNull();
  });
});

describe("business identity", () => {
  it("repairs what is stored and tells when it is complete", () => {
    expect(resolveBusiness(null).legalName).toBe("");
    const b = resolveBusiness({ legalName: "  ExamBoot SARL ", address: "Abidjan", country: "Côte d’Ivoire", taxId: 12 });
    expect(b.legalName).toBe("ExamBoot SARL");
    expect(b.taxId).toBe("");
    expect(businessComplete(b)).toBe(true);
    expect(businessComplete(resolveBusiness({ legalName: "X" }))).toBe(false);
  });
});
