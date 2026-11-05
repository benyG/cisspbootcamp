import { Bot } from "lucide-react";
import Link from "next/link";

import { IA_DEFAULT_CAPACITY, IA_DEFAULT_START, IA_ZONE, JOURNEES, journeeSlot, longDate } from "@/lib/ia-days";
import { cisspWeekendDates, loadIaDays } from "@/lib/ia-days-server";

import { deleteDayAction, inviteDayAction, openDatesAction, updateDayAction } from "./actions";

export const dynamic = "force-dynamic";

const clock = (d: Date, timeZone: string) => d.toLocaleTimeString("fr-FR", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).replace(":", " h ").replace(" h 00", " h");
function hours(date: string, start: string): string {
  const { startsAt, endsAt } = journeeSlot(date, start);
  return `${clock(startsAt, IA_ZONE)}–${clock(endsAt, IA_ZONE)} Montréal · ${clock(startsAt, "Africa/Douala")}–${clock(endsAt, "Africa/Douala")} Douala`;
}

/**
 * Bâtisseur IA (Ben, 03/11): the weekend dates, each carrying one journée.
 * Opening a J1 date opens the cohort participants register in.
 */
export default async function IaDaysPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [days, cissp] = await Promise.all([loadIaDays(), cisspWeekendDates(now)]);
  const upcoming = days.filter((d) => d.date >= today);
  const past = days.length - upcoming.length;
  const in8weeks = new Date(now.getTime() + 56 * 86_400_000).toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Bot className="size-6 text-accent" aria-hidden />Bâtisseur IA · journées</h1>
      <p className="mt-1 text-sm text-muted">Chaque samedi ou dimanche ouvert porte une journée, de J1 à J6, en rotation. Une date J1 ouvre une entrée : c&apos;est la cohorte où l&apos;on s&apos;inscrit et paie. Les participants choisissent ensuite leurs J2 à J6 parmi les dates suivantes.</p>
      {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sp.ok}</p>}
      {sp.erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.erreur}</p>}

      <form action={openDatesAction} className="mt-5 grid gap-3 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Ouvrir des week-ends</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Du</span><input type="date" name="from" required min={today} defaultValue={today} className={input} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Au</span><input type="date" name="to" required min={today} defaultValue={in8weeks} className={input} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Jours</span>
            <select name="which" defaultValue="both" className={input}><option value="both">Samedis et dimanches</option><option value="saturday">Samedis</option><option value="sunday">Dimanches</option></select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Début (Montréal)</span><input type="time" name="start" required defaultValue={IA_DEFAULT_START} step={1800} className={input} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Places</span><input type="number" name="capacity" required min={1} max={50} defaultValue={IA_DEFAULT_CAPACITY} className={input} /></label>
        </div>
        <p className="text-xs text-muted">Les dates déjà ouvertes sont ignorées ; la rotation reprend après la dernière date ouverte. Une journée : 5 h de formation et 1 h de pause. Les week-ends d&apos;une cohorte CISSP sont signalés ci-dessous : supprimez-les si besoin.</p>
        <div className="flex justify-end"><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Ouvrir</button></div>
      </form>

      <section className="mt-7">
        <h2 className="font-semibold">Dates à venir <span className="font-normal text-muted">({upcoming.length})</span></h2>
        {upcoming.length === 0 && <p className="mt-2 text-sm text-muted">Aucune date ouverte.</p>}
        <ul className="mt-3 grid gap-2">
          {upcoming.map((d) => (
            <li key={d.id} className={`rounded-xl border bg-white ${d.closed ? "border-dashed border-line opacity-70" : "border-line"}`}>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${d.journee === 1 ? "bg-ink text-white" : "bg-accent-soft text-accent-ink"}`}>J{d.journee}</span>
                  <span className="font-semibold first-letter:uppercase">{longDate(d.date)}</span>
                  <span className="text-muted">{d.seats}/{d.capacity} places</span>
                  {d.closed && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">fermée</span>}
                  {cissp.has(d.date) && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">week-end CISSP</span>}
                  <span className="w-full text-xs text-muted">{JOURNEES[d.journee - 1]?.title} · {hours(d.date, d.start)}</span>
                </summary>
                <div className="grid gap-3 border-t border-line p-3">
                  {d.cohortId && <p className="text-sm">Entrée : <Link href={`/admin/cohortes/${d.cohortId}`} className="font-semibold underline">{d.cohortName}</Link> · {d.paid} inscription{d.paid > 1 ? "s" : ""} payée{d.paid > 1 ? "s" : ""}</p>}
                  {d.people.length > 0 && (
                    <div className="text-sm">
                      <p className="font-semibold">Participants</p>
                      <ul className="mt-1 grid gap-1">
                        {d.people.map((p) => (
                          <li key={p.leadId} className="flex flex-wrap items-center gap-x-2">
                            <Link href={`/admin/leads/${p.leadId}`} className="underline">{p.name || "Sans nom"}</Link>
                            {!p.invited && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">invitation en attente</span>}
                            {d.journee === 1 && <span className={`rounded px-1.5 py-0.5 text-xs ${p.brief ? "bg-accent-soft text-accent-ink" : "bg-slate-100 text-muted"}`}>{p.brief ? "fiche projet reçue" : "fiche projet à venir"}</span>}
                            {d.journee === 1 && p.planToken && <a href={`/ia/calendrier/${p.planToken}`} target="_blank" rel="noopener" className="text-xs text-muted underline">son calendrier</a>}
                          </li>
                        ))}
                      </ul>
                      <form action={inviteDayAction} className="mt-2">
                        <input type="hidden" name="id" value={d.id} />
                        <button className="text-xs font-semibold underline">{d.meetUrl ? "Mettre à jour l’invitation Google" : "Envoyer l’invitation Google"}</button>
                      </form>
                    </div>
                  )}
                  <form action={updateDayAction} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
                    <input type="hidden" name="id" value={d.id} />
                    <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Journée</span>
                      <select name="journee" defaultValue={d.journee} className={input}>{JOURNEES.map((j) => <option key={j.n} value={j.n}>J{j.n} · {j.title}</option>)}</select></label>
                    <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Début</span><input type="time" name="start" required defaultValue={d.start} step={1800} className={input} /></label>
                    <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Places</span><input type="number" name="capacity" required min={1} max={50} defaultValue={d.capacity} className={input} /></label>
                    <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" name="closed" defaultChecked={d.closed} className="size-4" />Fermée</label>
                    <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Enregistrer</button>
                  </form>
                  {d.seats === 0 && d.paid === 0 && (
                    <form action={deleteDayAction} className="flex justify-end">
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-sm font-semibold text-red-700 underline">Supprimer cette date</button>
                    </form>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
        {past > 0 && <p className="mt-3 text-xs text-muted">{past} date{past > 1 ? "s" : ""} passée{past > 1 ? "s" : ""}, conservée{past > 1 ? "s" : ""} avec leurs participants.</p>}
      </section>
    </main>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base";
