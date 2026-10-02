"use client";

import { CalendarCheck, Send, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { moveSessionAction, resendSessionAction, sendRemainingAction, sendSessionAction } from "@/app/admin/cohortes/[id]/sessions/actions";
import { SESSION_TIMEZONE_LABEL, sessionMessage, sessionSlot, sessionSubject, slotLabel } from "@/lib/cohort-sessions";
import type { Session } from "@/lib/reading-plan/data";

type Participant = { id: number; firstName: string; lastName: string; country: string };
type Sent = { startsAt: string; endsAt: string; meetUrl: string | null; invitedCount: number; guestEmail: string | null; reminder: boolean; pause: number; start: string; sentAt: string };

/**
 * One day of the cohort (Ben, 02/10): hours, guests, the message as each
 * participant will read it, then send with a confirmation. Once sent: move
 * the session or re-send the link.
 */
export function SessionComposer({ cohortId, session, participants, sent, planUrl, defaults, weekend }: { cohortId: number; session: Session; participants: Participant[]; sent: Sent | null; planUrl: string; defaults: { start: string; pause: number }; weekend: boolean }) {
  const router = useRouter();
  const [start, setStart] = useState(sent?.start ?? defaults.start);
  const [pause, setPause] = useState(sent?.pause ?? defaults.pause);
  const [guest, setGuest] = useState("");
  const [reminder, setReminder] = useState(true);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();

  const slot = sessionSlot(session, /^\d\d:\d\d$/.test(start) ? start : defaults.start, pause);
  const invited = participants.filter((p) => !excluded.includes(p.id));
  const count = invited.length + (guest.includes("@") ? 1 : 0);
  const first = invited[0]?.firstName ?? "Prénom";

  const act = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    run(async () => {
      const r = await fn();
      setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      setConfirming(false);
      if (r.ok) router.refresh();
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">Début ({SESSION_TIMEZONE_LABEL})
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={input} /></label>
        {weekend && (
          <label className="flex flex-col gap-1 text-sm font-medium">Pause
            <select value={pause} onChange={(e) => setPause(Number(e.target.value))} className={input}>{[0, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m ? `${m} min` : "aucune"}</option>)}</select></label>
        )}
        <p className="self-end text-sm text-muted">{slotLabel(slot.startsAt, slot.endsAt)}<br />{session.hours % 1 ? `${Math.floor(session.hours)} h 30` : `${session.hours} h`} de cours{pause ? `, pause ${pause} min` : ""}</p>
      </div>

      {sent ? (
        <div className="rounded-lg bg-accent-soft p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-accent-ink"><CalendarCheck className="size-4" aria-hidden />Invitation envoyée le {new Date(sent.sentAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à {sent.invitedCount} personne{sent.invitedCount > 1 ? "s" : ""}</p>
          <p className="mt-1">{slotLabel(new Date(sent.startsAt), new Date(sent.endsAt))}{sent.reminder ? " · rappel 1 h avant" : ""}{sent.guestEmail ? ` · invité : ${sent.guestEmail}` : ""}</p>
          {sent.meetUrl && <p className="mt-1 flex items-center gap-1.5"><Video className="size-4" aria-hidden /><a href={sent.meetUrl} target="_blank" rel="noopener" className="font-mono underline">{sent.meetUrl.replace("https://", "")}</a></p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => moveSessionAction({ cohortId, day: session.n, start, pause }))} className={ghost}>Déplacer à l&apos;heure ci-dessus</button>
            <button type="button" disabled={pending} onClick={() => act(() => resendSessionAction({ cohortId, day: session.n }))} className={ghost}>Renvoyer le lien</button>
          </div>
          <p className="mt-2 text-xs text-muted">Déplacer : Google Agenda prévient chaque invité, le lien Meet ne change pas. Renvoyer : l&apos;e-mail repart, et les inscrits arrivés depuis sont ajoutés à l&apos;invitation.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="rounded-lg border border-line p-3 text-sm">
              <legend className="px-1 text-xs font-extrabold tracking-[.06em] text-muted uppercase">Invités · {count} + vous</legend>
              {participants.length === 0 ? <p className="text-muted">Aucun participant payé pour l&apos;instant.</p> : (
                <ul className="grid gap-1.5">
                  {participants.map((p) => (
                    <li key={p.id}><label className="flex items-center gap-2"><input type="checkbox" checked={!excluded.includes(p.id)} onChange={(e) => setExcluded((x) => (e.target.checked ? x.filter((i) => i !== p.id) : [...x, p.id]))} />{p.firstName} {p.lastName}<span className="ml-auto text-xs text-muted">{p.country}</span></label></li>
                  ))}
                </ul>
              )}
              <label className="mt-3 flex flex-col gap-1 font-medium">Ajouter un invité (co-animateur…)
                <input type="email" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="adresse e-mail" className={input} /></label>
              <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />Rappel par e-mail 1 h avant, avec le lien</label>
            </fieldset>
            <div className="rounded-lg border border-line p-3 text-sm">
              <p className="text-xs font-extrabold tracking-[.06em] text-muted uppercase">Dans leur agenda</p>
              <p className="mt-2 font-semibold">CISSP Bootcamp · J{session.n}</p>
              <p className="text-muted">{slotLabel(slot.startsAt, slot.endsAt)} ({SESSION_TIMEZONE_LABEL}), affiché à l&apos;heure locale de chacun</p>
              <p className="mt-1 text-muted">Lien Google Meet créé à l&apos;envoi · les invités ne voient pas la liste des autres</p>
            </div>
          </div>

          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="text-xs font-extrabold tracking-[.06em] text-muted uppercase">Le message, au prénom de chacun</p>
            <p className="mt-2 font-semibold">{sessionSubject(session, slot.startsAt)}</p>
            <p className="mt-1 whitespace-pre-line rounded bg-slate-50 p-3">{sessionMessage({ firstName: first, session, startsAt: slot.startsAt, endsAt: slot.endsAt, meetUrl: "https://meet.google.com/… (créé à l’envoi)", planUrl })}</p>
          </div>

          {confirming ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Envoyer l&apos;invitation J{session.n} à {count} personne{count > 1 ? "s" : ""} ?</p>
              <p>Google Agenda crée l&apos;événement et le lien Meet ; chacun reçoit l&apos;invitation et ce message.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => act(() => sendSessionAction({ cohortId, day: session.n, start, pause, guestEmail: guest.trim(), reminder, excludeLeadIds: excluded }))} className={primary}><Send className="size-4" aria-hidden />{pending ? "Envoi…" : "Oui, envoyer"}</button>
                <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={ghost}>Annuler</button>
              </div>
            </div>
          ) : (
            <div><button type="button" disabled={count === 0} onClick={() => setConfirming(true)} className={primary}><Send className="size-4" aria-hidden />Envoyer l&apos;invitation à {count} personne{count > 1 ? "s" : ""}</button></div>
          )}
        </>
      )}
      {result && <p className={"rounded-lg px-3 py-2 text-sm " + (result.ok ? "bg-accent-soft text-accent-ink" : "bg-red-50 text-red-800")}>{result.text}</p>}
    </div>
  );
}

/** Every remaining day at once, default hours, one recap e-mail per participant. */
export function SendRemaining({ cohortId, remaining }: { cohortId: number; remaining: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();
  if (remaining === 0) return <p className="text-xs text-muted">Toutes les sessions à venir sont envoyées.</p>;
  return (
    <div className="grid gap-2 text-sm">
      {confirming ? (
        <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
          <p>Envoyer les {remaining} sessions restantes avec les horaires par défaut ? Chaque participant reçoit les invitations et un e-mail avec tout le calendrier.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(async () => { const r = await sendRemainingAction({ cohortId }); setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error }); setConfirming(false); if (r.ok) router.refresh(); })} className={primary}>{pending ? "Envoi… (1 à 2 min)" : "Oui, tout envoyer"}</button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={ghost}>Annuler</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={ghost}>Envoyer les {remaining} sessions restantes</button>
      )}
      {result && <p className={result.ok ? "text-accent-ink" : "text-red-800"}>{result.text}</p>}
    </div>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base font-normal";
const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold";
const primary = "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white";
