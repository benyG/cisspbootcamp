import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SESSION_TIMEZONE, clockIn } from "@/lib/cohort-sessions";
import { prisma } from "@/lib/db";
import { PERSONAL_ZONE, mockExamDate, personalSessions, slotOf } from "@/lib/personal-schedule";
import { type StoredEvent, personalPlanUrl, storedDays } from "@/lib/personal-schedule-send";

import { confirmPersonalAction, refusePersonalAction } from "../actions";

export const dynamic = "force-dynamic";

const long = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const hrs = (h: number) => (h % 1 ? `${Math.floor(h)} h 30` : `${h} h`);
const STATUS: Record<string, string> = { invited: "Lien envoyé, pas encore de proposition", proposed: "Proposition à confirmer", confirmed: "Confirmé", refused: "Refusé, en attente d'une nouvelle proposition" };

/** One personal calendar (Ben, 04/10): the proposal, then confirm (invitations) or refuse with a message. */
export default async function PersonalSchedulePage({ params, searchParams }: { params: Promise<{ id: string; scheduleId: string }>; searchParams: Promise<{ envoi?: string; erreur?: string }> }) {
  const { id, scheduleId } = await params;
  const { envoi, erreur } = await searchParams;
  const schedule = await prisma.personalSchedule.findFirst({ where: { id: Number(scheduleId) || 0, cohortId: Number(id) || 0 }, include: { lead: true, cohort: true } });
  if (!schedule) notFound();
  const days = storedDays(schedule.days);
  const sessions = personalSessions(days);
  const mock = mockExamDate(sessions);
  const events = new Map((Array.isArray(schedule.events) ? (schedule.events as StoredEvent[]) : []).map((e) => [e.n, e]));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <Link href={`/admin/cohortes/${schedule.cohortId}`} className="text-sm text-muted">← {schedule.cohort.name}</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><CalendarDays className="size-6 text-accent" aria-hidden />Calendrier personnel · {schedule.lead.firstName} {schedule.lead.lastName}</h1>
      <p className="mt-1 text-sm text-muted">{STATUS[schedule.status] ?? schedule.status}{schedule.proposedAt ? ` · proposé le ${schedule.proposedAt.toLocaleDateString("fr-FR")}` : ""}{schedule.confirmedAt ? ` · confirmé le ${schedule.confirmedAt.toLocaleDateString("fr-FR")}` : ""}</p>
      {envoi && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{envoi}</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}
      {schedule.status === "refused" && schedule.refusalNote && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Votre message : {schedule.refusalNote}</p>}

      {sessions.length > 0 ? (
        <section className="mt-5 rounded-xl border border-line bg-white p-4">
          <p className="text-sm">{sessions.length} sessions, du {long(sessions[0].date)} au {long(sessions[sessions.length - 1].date)}{mock ? ` · examen blanc le ${long(mock)}` : ""}. Les jours où vous étiez pris dans Google Agenda étaient fermés à la personne.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-[.06em] text-muted uppercase"><tr><th className="py-2 pr-3">Jour</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Montréal</th><th className="py-2 pr-3">Dakar</th><th className="py-2">Au programme</th></tr></thead>
              <tbody>
                {sessions.map((s) => {
                  const day = days.find((d) => d.date === s.date)!;
                  const { startsAt, endsAt } = slotOf(day);
                  const event = events.get(s.n);
                  return (
                    <tr key={s.n} className="border-t border-line align-top">
                      <td className="py-2 pr-3 font-bold">J{s.n}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{long(s.date)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{clockIn(startsAt, PERSONAL_ZONE)}–{clockIn(endsAt, PERSONAL_ZONE)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{clockIn(startsAt, SESSION_TIMEZONE)}–{clockIn(endsAt, SESSION_TIMEZONE)}</td>
                      <td className="py-2">{s.title} <span className="text-muted">· {hrs(s.hours)}{day.extend ? " · prolongé" : ""}</span>{event?.meetUrl && <a href={event.meetUrl} target="_blank" rel="noopener" className="ml-1 font-mono text-xs underline">{event.meetUrl.replace("https://", "")}</a>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm"><a href={personalPlanUrl(schedule.token)} target="_blank" rel="noopener" className="underline">Son plan de lecture, à ses dates</a></p>
        </section>
      ) : (
        <p className="mt-5 rounded-xl border border-line bg-white p-4 text-sm text-muted">Pas encore de proposition.</p>
      )}

      {schedule.status === "proposed" && (
        <section className="mt-5 grid gap-4 rounded-xl border border-line bg-white p-4 text-sm">
          <form action={confirmPersonalAction} className="grid gap-2">
            <input type="hidden" name="cohortId" value={schedule.cohortId} />
            <input type="hidden" name="scheduleId" value={schedule.id} />
            <p>À la confirmation : une invitation Google Agenda avec lien Meet par session, pour {schedule.lead.firstName} uniquement ; un e-mail récapitulatif (jours et contenus, sans heures) avec son plan de lecture ; et {schedule.lead.firstName} quitte les invitations collectives à venir de la cohorte, sans perdre sa place. Ensuite, plus de replanification.</p>
            <div><button className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white">Confirmer et envoyer les {sessions.length} invitations</button></div>
          </form>
          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer font-semibold">Refuser, avec un message</summary>
            <form action={refusePersonalAction} className="mt-2 grid gap-2">
              <input type="hidden" name="cohortId" value={schedule.cohortId} />
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <label className="flex flex-col gap-1">Ce qui ne va pas (envoyé à {schedule.lead.firstName}, avec le lien pour refaire une proposition sur un nouveau mois)
                <textarea name="note" required minLength={5} maxLength={1000} rows={3} className="rounded-lg border border-line px-3 py-2 text-base" /></label>
              <div><button className="rounded-lg border border-line bg-white px-4 py-2 font-semibold">Refuser et envoyer le message</button></div>
            </form>
          </details>
        </section>
      )}
    </main>
  );
}
