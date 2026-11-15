import { z } from "zod";

/**
 * Lot B · Administratif, the pure part: receipt numbers, the accountant's
 * CSV, deadlines and their reminders, data requests, retention and the
 * business identity printed on receipts. No database here
 * (lib/admin-records-server.ts reads and writes).
 *
 * Not legal advice: the mentions and the retention periods are settings Ben
 * checks with his accountant for his country.
 */

// ── Receipt numbers ─────────────────────────────────────────────────────────

export const RECEIPT_SEQUENCE = "receipt";

/** REC-000001: continuous, never reused, never skipped. */
export function formatReceiptNumber(n: number): string {
  return `REC-${String(n).padStart(6, "0")}`;
}

export type ReceiptKind = "registration" | "balance" | "service";

/** One receipt per payment: the first payment, the balance, a consulting order. */
export function receiptSource(kind: ReceiptKind, id: number): string {
  return `${kind === "registration" ? "reg" : kind === "balance" ? "bal" : "svc"}:${id}`;
}

// ── The accountant's export ─────────────────────────────────────────────────

export type ReceiptRow = {
  number: string;
  paidAt: Date;
  buyerName: string;
  buyerEmail: string;
  buyerCountry: string;
  label: string;
  method: "stripe" | "netticket" | "manual";
  paymentNote: string | null;
  reference: string;
  amountUsd: number;
};

export const METHOD_LABEL = { stripe: "Carte (Stripe)", netticket: "Mobile money (Netticket)", manual: "Règlement direct" } as const;

/** "2026-11" → the month's bounds, UTC. Null for anything else. */
export function monthBounds(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return { from: new Date(Date.UTC(y, mo, 1)), to: new Date(Date.UTC(y, mo + 1, 1)) };
}

const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const amount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/**
 * The month's receipts for the accountant: semicolons and decimal commas
 * (French spreadsheets), a BOM so accents open right, one total line.
 */
export function accountantCsv(rows: readonly ReceiptRow[]): string {
  const head = ["Numéro", "Date", "Client", "E-mail", "Pays", "Désignation", "Moyen de paiement", "Référence", "Montant USD"];
  const lines = [...rows]
    .sort((a, b) => a.number.localeCompare(b.number))
    .map((r) => [r.number, r.paidAt.toISOString().slice(0, 10), r.buyerName, r.buyerEmail, r.buyerCountry, r.label, METHOD_LABEL[r.method] + (r.paymentNote ? ` (${r.paymentNote})` : ""), r.reference, amount(r.amountUsd)].map(cell).join(";"));
  const total = rows.reduce((n, r) => n + r.amountUsd, 0);
  return "﻿" + [head.join(";"), ...lines, ["", "", "", "", "", "", "", "Total", amount(total)].join(";")].join("\r\n") + "\r\n";
}

// ── Deadlines ───────────────────────────────────────────────────────────────

export const RECURRENCES = ["none", "monthly", "quarterly", "yearly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const RECURRENCE_LABEL: Record<Recurrence, string> = { none: "Une fois", monthly: "Chaque mois", quarterly: "Chaque trimestre", yearly: "Chaque année" };

/** The next due date of a recurring deadline, the same day of month (clamped). */
export function nextOccurrence(due: Date, recurrence: Recurrence): Date | null {
  const months = recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : recurrence === "yearly" ? 12 : 0;
  if (!months) return null;
  const y = due.getUTCFullYear();
  const m = due.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(due.getUTCDate(), last), due.getUTCHours(), due.getUTCMinutes()));
}

const DAY_MS = 86_400_000;

/** Whole days left before `due` (negative once past). */
export function daysLeft(due: Date, now: Date): number {
  return Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
}

/** The reminder due now for a deadline: 15 days before, 3 days before, or none. */
export function deadlineReminder(due: Date, now: Date): 15 | 3 | null {
  const d = daysLeft(due, now);
  if (d < 0) return null;
  if (d <= 3) return 3;
  if (d <= 15) return 15;
  return null;
}

// ── Data requests ───────────────────────────────────────────────────────────

export const PRIVACY_KINDS = ["access", "rectification", "deletion", "opposition"] as const;
export type PrivacyKind = (typeof PRIVACY_KINDS)[number];
export const PRIVACY_LABEL: Record<PrivacyKind, string> = { access: "Accès (copie des données)", rectification: "Rectification", deletion: "Suppression", opposition: "Opposition aux messages" };

/** One month to answer, as the RGPD sets (art. 12). */
export const PRIVACY_ANSWER_DAYS = 30;
export function privacyDueAt(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + PRIVACY_ANSWER_DAYS * DAY_MS);
}

// ── Retention ───────────────────────────────────────────────────────────────

/** A prospect who never paid is kept three years after their last activity. */
export const RETENTION_YEARS = 3;
export function retentionCutoff(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - RETENTION_YEARS, now.getUTCMonth(), now.getUTCDate()));
}

/** What an anonymised lead becomes: the identity erased, the e-mail made unique and unreachable. */
export function anonymizedIdentity(leadId: number) {
  return { firstName: "Personne", lastName: "supprimée", email: `supprime-${leadId}@anonyme.invalid`, whatsapp: null, jobTitle: null, goals: null, notes: null, tags: undefined, source: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, consentAt: null, nextFollowupAt: null };
}

// ── Business identity (receipts, register) ──────────────────────────────────

export const BUSINESS_KEY = "business";

const text = (max: number) => z.string().trim().max(max).catch("");
export const businessSchema = z.object({
  legalName: text(160),
  address: text(300),
  country: text(60),
  registration: text(120),
  taxId: text(80),
  email: text(180),
  mentions: text(600),
});
export type Business = z.infer<typeof businessSchema>;

export const DEFAULT_MENTIONS = "Ce reçu atteste du paiement de la formation. Il ne constitue pas une facture avec TVA.";

export function resolveBusiness(raw: unknown): Business {
  const parsed = businessSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  const empty = { legalName: "", address: "", country: "", registration: "", taxId: "", email: "", mentions: "" };
  return parsed.success ? { ...empty, ...parsed.data } : empty;
}

/** True once the identity a receipt needs is filled in. */
export function businessComplete(b: Business): boolean {
  return Boolean(b.legalName && b.address && b.country);
}
