"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { BookResult } from "@/lib/booking";
import { formatSlotTime } from "@/lib/calendar/slots";
import { track } from "@/lib/tracking/client";

type Props = {
  /** ISO strings, soonest first. */
  slots: string[];
  coachTimeZone: string;
  moreHref: string;
  onBook: (input: { start: string; timezone: string }) => Promise<BookResult>;
};

/**
 * The next few slots right on the result page (brainstorm of 24/09): one
 * tap books the call, no extra screen. Times in the visitor's own zone;
 * the chosen slot is re-validated server-side, as everywhere.
 */
export function QuickSlots({ slots, coachTimeZone, moreHref, onBook }: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(coachTimeZone);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || coachTimeZone);
    } catch {
      /* keep the coach's zone */
    }
  }, [coachTimeZone]);

  const options = useMemo(() => {
    const dayFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: timezone, weekday: "short", day: "numeric", month: "short" });
    return slots.slice(0, 4).map((iso) => {
      const date = new Date(iso);
      return { iso, day: dayFormat.format(date), time: formatSlotTime(date, timezone) };
    });
  }, [slots, timezone]);

  const book = (iso: string) => {
    setChosen(iso);
    setError(null);
    track("book_click", { label: "resultat-slot" });
    start(async () => {
      const result = await onBook({ start: iso, timezone });
      if (result.ok) router.push(`/rdv/confirme?t=${result.rescheduleToken}`);
      else {
        setError(result.error);
        setChosen(null);
      }
    });
  };

  if (options.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-[.78rem] font-extrabold tracking-[.06em] text-accent uppercase">Prochains créneaux · heure de {timezone}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => (
          <button
            key={o.iso}
            type="button"
            disabled={pending}
            onClick={() => book(o.iso)}
            className={"rounded-[14px] border px-3 py-3 text-left disabled:opacity-60 " + (chosen === o.iso ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}
          >
            <span className="block text-[.78rem] capitalize opacity-80">{o.day}</span>
            <span className="display block text-[1.15rem] font-black">{o.time}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <p className="mt-2 text-[.86rem] text-muted">{pending ? "Réservation en cours…" : <>Un tap suffit, l’invitation arrive par e-mail. <Link href={moreHref} className="underline underline-offset-4">Voir d’autres créneaux</Link></>}</p>
    </div>
  );
}
