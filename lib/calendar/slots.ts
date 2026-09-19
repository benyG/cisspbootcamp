/**
 * Discovery-call slots — SPECS A3.
 *
 * Pure: takes the coach's weekly availability, the busy intervals read from
 * Google Calendar, and "now"; returns bookable 15-minute starts. Recomputed on
 * every display, never cached beyond 60 s (CLAUDE.md).
 */

export const SLOT_MINUTES = 15;
export const BUFFER_MINUTES = 5;
export const MIN_NOTICE_HOURS = 12;
export const MAX_DAYS_AHEAD = 14;

/** Weekly availability, in the coach's own timezone. */
export type AvailabilityRule = {
  /** 0 = Sunday … 6 = Saturday, as Date#getDay. */
  weekday: number;
  /** "HH:MM", inclusive start. */
  start: string;
  /** "HH:MM", exclusive end. */
  end: string;
};

export type Interval = { start: Date; end: Date };

export type SlotInput = {
  rules: readonly AvailabilityRule[];
  /** IANA zone the rules are expressed in, e.g. "Africa/Douala". */
  coachTimeZone: string;
  busy: readonly Interval[];
  now: Date;
};

/**
 * All bookable starts between now + notice and now + horizon, in UTC.
 * A slot needs its 15 minutes plus the buffer on both sides to be free.
 */
export function computeSlots(input: SlotInput): Date[] {
  const { rules, coachTimeZone, busy, now } = input;
  const earliest = addMinutes(now, MIN_NOTICE_HOURS * 60);
  const latest = addMinutes(now, MAX_DAYS_AHEAD * 24 * 60);
  const slots: Date[] = [];

  // Walk each calendar day of the horizon in the coach's zone.
  for (let day = startOfDayInZone(now, coachTimeZone); day < latest; day = addMinutes(day, 24 * 60)) {
    const weekday = weekdayInZone(day, coachTimeZone);

    for (const rule of rules.filter((candidate) => candidate.weekday === weekday)) {
      const windowStart = atTimeInZone(day, rule.start, coachTimeZone);
      const windowEnd = atTimeInZone(day, rule.end, coachTimeZone);

      for (
        let start = windowStart;
        addMinutes(start, SLOT_MINUTES) <= windowEnd;
        start = addMinutes(start, SLOT_MINUTES)
      ) {
        if (start < earliest || start >= latest) continue;

        const guarded: Interval = {
          start: addMinutes(start, -BUFFER_MINUTES),
          end: addMinutes(start, SLOT_MINUTES + BUFFER_MINUTES),
        };
        if (busy.some((interval) => overlaps(guarded, interval))) continue;

        slots.push(start);
      }
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Group UTC slots by the prospect's local calendar day, for display. */
export function groupSlotsByDay(
  slots: readonly Date[],
  timeZone: string,
): Array<{ day: string; slots: Date[] }> {
  const groups = new Map<string, Date[]>();
  const keyFormat = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  for (const slot of slots) {
    const key = keyFormat.format(slot);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }

  return Array.from(groups, ([day, daySlots]) => ({ day, slots: daySlots }));
}

export function formatSlotTime(slot: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(slot);
}

// --- Timezone arithmetic without a library ------------------------------
//
// Intl gives us the wall-clock parts of an instant in any zone; from those we
// derive the zone's UTC offset at that instant and build instants for
// arbitrary wall-clock times. DST transitions are handled by re-reading the
// offset at the target instant.

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

/** Offset (ms) such that `utc + offset` gives the zone's wall clock. */
function offsetInZone(date: Date, timeZone: string): number {
  const wall = partsInZone(date, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - date.getTime();
}

function startOfDayInZone(date: Date, timeZone: string): Date {
  const wall = partsInZone(date, timeZone);
  const guess = new Date(Date.UTC(wall.year, wall.month - 1, wall.day, 0, 0, 0));
  return new Date(guess.getTime() - offsetInZone(guess, timeZone));
}

function weekdayInZone(date: Date, timeZone: string): number {
  return partsInZone(date, timeZone).weekday;
}

function atTimeInZone(dayStart: Date, hhmm: string, timeZone: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const wall = partsInZone(dayStart, timeZone);
  const guess = new Date(Date.UTC(wall.year, wall.month - 1, wall.day, hours, minutes, 0));
  return new Date(guess.getTime() - offsetInZone(guess, timeZone));
}
