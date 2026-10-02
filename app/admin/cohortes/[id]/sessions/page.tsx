import { Video } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SendRemaining, SessionComposer } from "@/components/admin/sessions/SessionComposer";
import { SESSION_TIMEZONE, isWeekendDay, sessionDefaults, sessionSlot } from "@/lib/cohort-sessions";
import { cohortPlan, sessionParticipants } from "@/lib/cohort-sessions-send";

export const dynamic = "force-dynamic";
// Sending every remaining day creates up to 15 Google events.
export const maxDuration = 300;

const clock = (d: Date) => d.toLocaleTimeString("fr-FR", { timeZone: SESSION_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Live sessions of a cohort as Google Meet invitations (Ben, 02/10). */
export default async function CohortSessionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jour?: string }> }) {
  const { id } = await params;
  const { jour } = await searchParams;
  const plan = await cohortPlan(Number(id));
  if (!plan) notFound();
  const { cohort, days, planUrl } = plan;

  if (cohort.program !== "cissp") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <Link href={`/admin/cohortes/${cohort.id}`} className="text-sm text-muted">← {cohort.name}</Link>
        <h1 className="mt-3 text-2xl font-bold">Sessions en ligne</h1>
        <p className="mt-3 text-muted">Le calendrier des sessions vient du plan de lecture CISSP : il n&apos;existe pas encore pour la CC.</p>
      </main>
    );
  }

  const participants = await sessionParticipants(cohort.id);
  const now = new Date();
  const today = new Date().toISOString().slice(0, 10);
  const sentByDay = new Map(cohort.sessions.filter((s) => s.sentAt).map((s) => [s.day, s]));
  const teaching = days.filter((d) => !d.rest);
  const selected = teaching.find((d) => String(d.n) === jour) ?? teaching.find((d) => d.date >= today && !sentByDay.has(d.n)) ?? teaching.find((d) => d.date >= today) ?? teaching[0];
  const remaining = teaching.filter((d) => !sentByDay.has(d.n) && sessionSlot(d, sessionDefaults(d.date).start, 0).startsAt > now).length;
  const record = sentByDay.get(selected.n);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href={`/admin/cohortes/${cohort.id}`} className="text-sm text-muted">← {cohort.name}</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Video className="size-6 text-accent" aria-hidden />Sessions en ligne</h1>
      <p className="mt-1 text-sm text-muted">Les jours viennent du plan de lecture de la cohorte. Choisissez un jour, vérifiez, envoyez : l&apos;invitation Google Agenda avec le lien Meet part à chaque participant payé ({participants.length}), avec le contenu de la session.</p>

      <div className="mt-5 grid gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Jours de la cohorte" className="rounded-xl border border-line bg-white p-3">
          <ul className="grid gap-1">
            {days.map((d) => {
              const sent = sentByDay.get(d.n);
              const state = d.rest ? "Repos" : sent ? "Envoyée" : d.date === today ? "Aujourd’hui" : d.date < today ? "Passée" : "À préparer";
              const tone = d.rest ? "bg-amber-50 text-amber-800" : sent ? "bg-accent-soft text-accent-ink" : d.date === today ? "bg-ink text-white" : "bg-slate-100 text-muted";
              const row = (
                <span className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2">
                  <span className="text-base font-extrabold">J{d.n}</span>
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">{new Date(`${d.date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}{d.rest ? " · mercredi lecture" : sent ? ` · ${clock(sent.startsAt)}` : ` · ${d.hours % 1 ? `${Math.floor(d.hours)} h 30` : `${d.hours} h`}`}</span>
                    <span className="block truncate text-sm">{d.rest ? "Pas de session" : d.title}</span>
                  </span>
                  <span className={"rounded-full px-2 py-0.5 text-[11px] font-bold " + tone}>{state}</span>
                </span>
              );
              return (
                <li key={d.n}>
                  {d.rest ? <div className="rounded-lg px-2 py-1.5 opacity-70">{row}</div> : (
                    <Link href={`/admin/cohortes/${cohort.id}/sessions?jour=${d.n}`} aria-current={d.n === selected.n ? "true" : undefined} className={"block rounded-lg px-2 py-1.5 hover:bg-slate-50 " + (d.n === selected.n ? "border border-accent bg-accent-soft" : "border border-transparent")}>{row}</Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-dashed border-line pt-3"><SendRemaining cohortId={cohort.id} remaining={remaining} /></div>
        </nav>

        <section className="min-w-0 rounded-xl border border-line bg-white p-4">
          <h2 className="text-xl font-bold">J{selected.n} · {new Date(`${selected.date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}</h2>
          <p className="mt-1 font-semibold">{selected.title}</p>
          <p className="mt-1 mb-4 text-sm text-muted">{selected.goal}</p>
          <SessionComposer
            key={selected.n}
            cohortId={cohort.id}
            session={selected}
            participants={participants.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, country: p.country }))}
            sent={record ? { startsAt: record.startsAt.toISOString(), endsAt: record.endsAt.toISOString(), meetUrl: record.meetUrl, invitedCount: record.invitedCount, guestEmail: record.guestEmail, reminder: record.reminder, pause: record.pauseMinutes, start: clock(record.startsAt), sentAt: (record.sentAt ?? record.createdAt).toISOString() } : null}
            planUrl={planUrl}
            defaults={sessionDefaults(selected.date)}
            weekend={isWeekendDay(selected.date)}
          />
        </section>
      </div>
    </main>
  );
}
