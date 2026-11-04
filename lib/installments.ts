/**
 * Payment in two instalments (Ben, 04/11), for every programme whose price
 * row carries an instalment amount (Admin › Tarifs; empty = not offered).
 *
 * - The first payment takes the seat: the registration becomes `paid`, as
 *   for a payment at once. Its amount is the instalment, less any
 *   consulting credit.
 * - The second, the balance, is due before the first day. The person gets a
 *   payment link by e-mail, and reminders BALANCE_REMINDER_DAYS before.
 * - Unpaid on the eve of the first day: Ben is told in the action queue and
 *   decides. The seat is never taken back automatically.
 *
 * Pure: everything here is tested.
 */

/** Reminders, in days before the first day; one e-mail each. */
export const BALANCE_REMINDER_DAYS = [7, 2] as const;
/** Ben's alert, in days before the first day. */
export const BALANCE_ALERT_DAYS = 1;
/** No reminder in the first day after the first payment: the confirmation already says it. */
const QUIET_AFTER_PAYMENT_MS = 24 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

/** The balance has its own payment reference: the seat's, plus this suffix. */
export const BALANCE_SUFFIX = "-S";

export function balanceReference(reference: string): string {
  return `${reference}${BALANCE_SUFFIX}`;
}

/** The seat's reference behind a balance reference, or null for any other reference. */
export function seatReferenceOfBalance(reference: string): string | null {
  return reference.endsWith(BALANCE_SUFFIX) ? reference.slice(0, -BALANCE_SUFFIX.length) : null;
}

export type TwoPaymentPlan = { totalUsd: number; firstUsd: number; balanceUsd: number };

/**
 * The plan for a price row: two equal instalments, the credit off the first.
 * Null when no instalment is set, or when a credit would leave nothing to
 * pay now (a payment at once is simpler then).
 */
export function twoPaymentPlan(installmentUsd: number | null | undefined, creditUsd = 0): TwoPaymentPlan | null {
  if (!installmentUsd || installmentUsd <= 0) return null;
  const firstUsd = installmentUsd - Math.max(0, creditUsd);
  if (firstUsd <= 0) return null;
  return { totalUsd: firstUsd + installmentUsd, firstUsd, balanceUsd: installmentUsd };
}

type Money = { amountUsd: number; balanceUsd: number };

/** What the first (or only) payment must bring. */
export function firstDueUsd(r: Money): number {
  return r.amountUsd - r.balanceUsd;
}

type Seat = Money & { status: string; balancePaidAt: Date | null };

/** A seat taken with a balance still to pay. */
export function balanceOpen(r: Seat): boolean {
  return r.status === "paid" && r.balanceUsd > 0 && r.balancePaidAt === null;
}

/** What has been paid so far. */
export function paidSoFarUsd(r: Seat): number {
  if (r.status !== "paid") return 0;
  return r.balancePaidAt || r.balanceUsd === 0 ? r.amountUsd : firstDueUsd(r);
}

/**
 * Which reminder to send now, or null: the first when the first day is at
 * most 7 days away, the second at most 2 days away; one at a time, never
 * in the day after the first payment, never once the first day has begun.
 */
export function balanceReminderDue(input: Seat & { balanceReminders: number; paidAt: Date | null; startsAt: Date }, now: Date): number | null {
  if (!balanceOpen(input)) return null;
  if (input.paidAt && now.getTime() - input.paidAt.getTime() < QUIET_AFTER_PAYMENT_MS) return null;
  const left = input.startsAt.getTime() - now.getTime();
  if (left <= 0) return null;
  const next = input.balanceReminders;
  if (next >= BALANCE_REMINDER_DAYS.length) return null;
  return left <= BALANCE_REMINDER_DAYS[next] * DAY_MS ? next : null;
}

/** Ben's alert: balance still open on the eve of the first day, or after it began. */
export function balanceAlert(input: Seat & { startsAt: Date }, now: Date): boolean {
  return balanceOpen(input) && input.startsAt.getTime() - now.getTime() <= BALANCE_ALERT_DAYS * DAY_MS;
}
