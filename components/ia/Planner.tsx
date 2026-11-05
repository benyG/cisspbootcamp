"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { pickJourneesAction } from "@/app/(public)/ia/calendrier/[token]/actions";
import { IA_JOURNEES, IA_ZONE, type IaDay, JOURNEES, type Picks, candidates, journeeSlot, shortDate } from "@/lib/ia-days";

const clock = (d: Date, timeZone: string) => d.toLocaleTimeString("fr-FR", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).replace(":", " h ").replace(" h 00", " h");

/**
 * Picks J2 to J6 in order (Ben, 03/11): each journée offers the open dates
 * after the previous one; held journées are shown and never change.
 */
export function Planner({ token, days, held, heldStarts, nowIso }: { token: string; days: IaDay[]; held: Picks; heldStarts: Record<string, string>; nowIso: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  // Montréal on the server and at hydration, then the visitor's own zone.
  const [zone, setZone] = useState(IA_ZONE);
  useEffect(() => {
    try { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || IA_ZONE); } catch { /* keep Montréal */ }
  }, []);
  const [picks, setPicks] = useState<Picks>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const merged: Picks = { ...held, ...picks };

  function choose(n: number, date: string) {
    // Later choices are kept only while they still follow, without a gap.
    const next: Picks = { ...picks, [n]: date };
    let last = date, broken = false;
    for (let k = n + 1; k <= IA_JOURNEES; k++) {
      if (!next[k]) { broken = true; continue; }
      if (broken || next[k]! <= last) { delete next[k]; broken = true; } else last = next[k]!;
    }
    setPicks(next);
    setError(null);
  }

  function confirm() {
    setError(null);
    start(async () => {
      try {
        const result = await pickJourneesAction({ token, picks: Object.fromEntries(Object.entries(picks).filter(([, d]) => d)) });
        if (result.ok) { setDone(result.message); setPicks({}); } else setError(result.error);
      } catch {
        setError("La connexion a échoué. Vérifiez votre réseau et réessayez.");
      }
    });
  }

  const hours = (date: string, startClock: string) => {
    const { startsAt, endsAt } = journeeSlot(date, startClock);
    const mine = `${clock(startsAt, zone)}–${clock(endsAt, zone)}`;
    return zone === IA_ZONE ? `${mine} (heure de Montréal)` : `${mine} chez vous · ${clock(startsAt, IA_ZONE)}–${clock(endsAt, IA_ZONE)} à Montréal`;
  };
  const chosenCount = Object.keys(picks).length;

  return (
    <div className="grid gap-3">
      {JOURNEES.map((j) => {
        const heldDate = held[j.n];
        if (heldDate) {
          return (
            <section key={j.n} className="rounded-[18px] border border-accent bg-accent-soft p-4 text-accent-ink">
              <p className="text-[.78rem] font-extrabold tracking-[.08em] uppercase">J{j.n} · réservée</p>
              <p className="mt-1 font-bold first-letter:uppercase">{shortDate(heldDate)}</p>
              <p className="text-[.88rem]">{j.title} · {hours(heldDate, heldStarts[heldDate] ?? "10:00")}</p>
            </section>
          );
        }
        const previous = Array.from({ length: j.n - 1 }, (_, i) => merged[i + 1]).every(Boolean);
        // Only earlier journées bound the choice: a later pick that no longer follows is dropped by choose().
        const prior: Picks = Object.fromEntries(Object.entries(merged).filter(([k]) => Number(k) < j.n));
        const options = previous ? candidates(days, prior, j.n, now) : [];
        return (
          <section key={j.n} className="rounded-[18px] border border-line bg-white p-4">
            <p className="text-[.78rem] font-extrabold tracking-[.08em] text-accent uppercase">J{j.n}</p>
            <p className="font-bold">{j.title}</p>
            {!previous ? (
              <p className="mt-1 text-[.9rem] text-muted">Choisissez d’abord la J{j.n - 1}.</p>
            ) : options.length === 0 ? (
              <p className="mt-1 text-[.9rem] text-muted">Pas encore de date ouverte après votre J{j.n - 1}. Revenez sur ce lien : Ben ouvre de nouveaux week-ends régulièrement.</p>
            ) : (
              <div className="mt-2 grid gap-2">
                {options.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-2.5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input type="radio" name={`j${j.n}`} checked={picks[j.n] === d.date} onChange={() => choose(j.n, d.date)} className="mt-1 size-4 shrink-0 accent-accent" />
                    <span><b className="block first-letter:uppercase">{shortDate(d.date)}</b><span className="text-[.85rem] text-muted">{hours(d.date, d.start)} · {d.capacity - d.seats} place{d.capacity - d.seats > 1 ? "s" : ""}</span></span>
                  </label>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[.92rem] text-red-800">{error}</p>}
      {done && <p role="status" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[.92rem] text-accent-ink">{done} Les invitations arrivent dans votre agenda.</p>}
      {chosenCount > 0 && (
        <div className="grid gap-2 rounded-[18px] border border-ink bg-white p-4">
          <p className="text-[.9rem]">Une fois confirmées, ces journées ne changent plus. Vous pourrez choisir les suivantes plus tard sur ce même lien.</p>
          <button type="button" disabled={pending} onClick={confirm} className="rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white disabled:opacity-60">
            {pending ? "Réservation…" : `Confirmer ${chosenCount > 1 ? `mes ${chosenCount} journées` : "ma journée"}`}
          </button>
        </div>
      )}
    </div>
  );
}
