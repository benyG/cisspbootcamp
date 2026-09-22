/**
 * Follow-up rules — SPECS A6, "règles de relance V1 (simples, fixes)".
 *
 *   after the scanner, no call booked   → J+2, then J+7
 *   after a call marked "à relancer"    → J+3
 *   seat reserved, not paid             → J+1, then J+3
 *
 * Pure: given what just happened and how many follow-ups already went out,
 * return when the next one is due, or null when the sequence is over and the
 * lead should be parked.
 */

const DAY = 24 * 60 * 60_000;

export const FOLLOWUP_DAYS = {
  scanner: [2, 7],
  afterCall: [3],
  unpaid: [1, 3],
} as const;

export type FollowupTrack = keyof typeof FOLLOWUP_DAYS;

/** Leads at or above this heat, with no call, go to the "hot" queue. */
export const HOT_LEAD_THRESHOLD = 60;

/** A pending sales message older than this is flagged. */
export const REVIEW_SLA_HOURS = 24;

export function nextFollowupAt(track: FollowupTrack, sentSoFar: number, from: Date): Date | null {
  const days = FOLLOWUP_DAYS[track][sentSoFar];
  if (days === undefined) return null;
  return new Date(from.getTime() + days * DAY);
}

/** "Reporter": push a due follow-up by a fixed two days. */
export const POSTPONE_DAYS = 2;

export function postponedAt(from: Date): Date {
  return new Date(from.getTime() + POSTPONE_DAYS * DAY);
}

export function hoursSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 3_600_000);
}
