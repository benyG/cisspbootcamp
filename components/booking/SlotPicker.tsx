"use client";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { BookResult } from "@/lib/booking";
import { formatSlotTime, groupSlotsByDay } from "@/lib/calendar/slots";

type Props = {
  /** ISO strings — Dates do not survive the server/client boundary intact. */
  slots: string[];
  coachTimeZone: string;
  /** Called with the chosen slot; the caller binds it to the right action. */
  onBook: (input: { start: string; timezone: string; contact?: Contact }) => Promise<BookResult>;
  /** Ask for name/e-mail/consent first (direct-link access). */
  askContact?: boolean;
  submitLabel?: string;
};

export type Contact = { firstName: string; lastName: string; email: string; consent: boolean };

/**
 * Slots in the prospect's own timezone, detected in the browser and shown
 * explicitly (SPECS A3). Chosen slot is re-validated server-side on submit.
 */
export function SlotPicker({ slots, coachTimeZone, onBook, askContact, submitLabel }: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(coachTimeZone);
  const [chosen, setChosen] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>({ firstName: "", lastName: "", email: "", consent: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || coachTimeZone);
    } catch {
      /* keep the coach's zone */
    }
  }, [coachTimeZone]);

  const days = useMemo(
    () => groupSlotsByDay(slots.map((iso) => new Date(iso)), timezone),
    [slots, timezone],
  );

  const submit = () => {
    if (!chosen) return;
    setError(null);
    startTransition(async () => {
      const result = await onBook({ start: chosen, timezone, contact: askContact ? contact : undefined });
      if (result.ok) router.push(`/rdv/confirme?t=${result.rescheduleToken}`);
      else setError(result.error);
    });
  };

  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        Aucun créneau libre dans les 14 prochains jours. Réessayez dans quelques jours, ou
        écrivez directement à Ben.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--color-muted)]">
        Heures affichées dans votre fuseau : <strong>{timezone}</strong>
      </p>

      <div className="flex flex-col gap-5">
        {days.map((day) => (
          <section key={day.day}>
            <h2 className="mb-2 font-semibold capitalize">{day.day}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {day.slots.map((slot) => {
                const iso = slot.toISOString();
                const selected = chosen === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setChosen(iso)}
                    aria-pressed={selected}
                    className={[
                      "rounded-lg border px-2 py-2.5 text-sm font-medium",
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                        : "border-slate-300 bg-white hover:border-[var(--color-accent)]",
                    ].join(" ")}
                  >
                    {formatSlotTime(slot, timezone)}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {askContact && chosen && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Prénom" autoComplete="given-name" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} className={input} />
            <input placeholder="Nom" autoComplete="family-name" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} className={input} />
          </div>
          <input type="email" placeholder="E-mail" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={input} />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={contact.consent} onChange={(e) => setContact({ ...contact, consent: e.target.checked })} className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" />
            <span>
              J&apos;accepte que Ben utilise ces informations pour organiser cet appel et me recontacter au sujet du bootcamp.{" "}
              <Link href="/confidentialite" className="underline" target="_blank">Politique de confidentialité</Link>
            </span>
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        disabled={!chosen || pending}
        onClick={submit}
        className="rounded-lg bg-[var(--color-accent)] px-5 py-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Réservation…" : submitLabel ?? "Confirmer ce créneau"}
      </button>
    </div>
  );
}

const input = "w-full rounded-lg border border-slate-300 px-3 py-3 text-base";
