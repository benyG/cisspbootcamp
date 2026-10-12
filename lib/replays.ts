/**
 * Session replays and labs (Ben, 12/10). Pure rules, shared by the admin,
 * the participant's page and the cron: how long access lasts, the
 * watermark, and the pieces of a Drive copy.
 */

/** Replays stay open this many months after the cohort's last day (or the participant's own last session). */
export const ACCESS_MONTHS = 4;
/** What Ben can reopen an expired access for, in months. */
export const REOPEN_MONTHS = [1, 2, 3] as const;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * End of access: 4 months after the later of the cohort's last day and the
 * participant's last personal session, at the end of that day (UTC).
 */
export function accessEndsAt(input: { cohortEndsAt: Date; personalLastDate?: string | null }): Date {
  const personal = input.personalLastDate ? new Date(`${input.personalLastDate}T00:00:00Z`) : null;
  const base = personal && personal > input.cohortEndsAt ? personal : input.cohortEndsAt;
  const end = addMonths(base, ACCESS_MONTHS);
  return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59));
}

export function isAccessOpen(expiresAt: Date, now: Date): boolean {
  return now.getTime() <= expiresAt.getTime();
}

/** Reopening never shortens an access: from today or from its current end, whichever is later. */
export function reopenedUntil(expiresAt: Date, months: number, now: Date): Date {
  const base = expiresAt > now ? expiresAt : now;
  return addMonths(base, months);
}

/** The watermark over the player: who is watching. */
export function watermarkText(lead: { firstName: string; lastName: string; email: string }): string {
  return `${`${lead.firstName} ${lead.lastName}`.trim()} · ${lead.email}`;
}

/**
 * Watermark spots, in percent of the player (Ben, 12/10: it must not
 * distract): the four margins, away from the centre, changed slowly.
 */
export const WATERMARK_SPOTS = [
  { top: 6, left: 4 },
  { top: 6, left: 58 },
  { top: 78, left: 58 },
  { top: 78, left: 4 },
] as const;
export const WATERMARK_MOVE_SECONDS = 90;

/** Pure: the next piece of a Drive → Cloudflare copy, or null when done. */
export function nextRange(offset: number, size: number, chunk: number): { from: number; to: number } | null {
  if (offset >= size) return null;
  return { from: offset, to: Math.min(size, offset + chunk) - 1 };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} Go`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

/** Labs: ZIP archives, up to this size. */
export const LAB_MAX_BYTES = 2 * 1024 ** 3;
export const LAB_CONTENT_TYPES = ["application/zip", "application/x-zip-compressed", "application/octet-stream"];
