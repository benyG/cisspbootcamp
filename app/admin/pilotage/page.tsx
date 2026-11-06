import { Gauge as GaugeIcon } from "lucide-react";
import Link from "next/link";

import { PilotChart } from "@/components/admin/pilotage/PilotChart";
import { type PilotState, closeDayFor, forecastSentence, stateLabel } from "@/lib/pilotage";
import { env } from "@/lib/env";
import { type PilotCohort, mondayReportInput, programFunnels } from "@/lib/pilotage-server";
import { PROGRAMS } from "@/lib/programs";

export const dynamic = "force-dynamic";

const STATE_STYLE: Record<PilotState, string> = {
  not_open: "bg-slate-100 text-muted",
  late: "bg-amber-50 text-amber-800",
  on_track: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
  ahead: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
  reached: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
  closed: "bg-red-50 text-red-800",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const DAY_MS = 86_400_000;

/**
 * Pilotage (lot 2, validated on the prototype 06/11): for each cohort still
 * to start, its goal, the target curve, the paid seats and the forecast,
 * then the funnel of its programme. Read in ten seconds: is it on track?
 */
export default async function PilotagePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const now = new Date();
  const { c } = await searchParams;
  const [{ cohorts, report }, funnels] = await Promise.all([mondayReportInput(now, env.NEXT_PUBLIC_APP_URL), programFunnels(new Date(now.getTime() - 30 * DAY_MS), now)]);
  const current = cohorts.find((x) => String(x.id) === c) ?? cohorts.find((x) => x.pilot.state !== "not_open") ?? cohorts[0];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><GaugeIcon className="size-6 shrink-0 text-accent" aria-hidden />Pilotage</h1>
      <p className="mt-1 text-sm text-muted">Chaque cohorte face à son objectif : la courbe cible va de l’ouverture de la campagne (J-60) à 100 % à la fermeture des admissions.</p>

      {!current ? (
        <p className="mt-6 rounded-xl border border-line bg-white p-4 text-muted">Aucune cohorte à venir. <Link href="/admin/cohortes" className="font-semibold text-ink underline">Créer une cohorte</Link> : son objectif se règle sur sa fiche.</p>
      ) : (
        <>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {cohorts.map((x) => <CohortCard key={x.id} cohort={x} active={x.id === current.id} />)}
          </ul>
          <Detail cohort={current} funnel={funnels[current.program]} now={now} />
        </>
      )}

      <details className="mt-6 rounded-xl border border-line bg-white p-4">
        <summary className="cursor-pointer font-bold">Rapport du lundi : aperçu</summary>
        <p className="mt-2 text-xs text-muted">Envoyé chaque lundi matin à {env.ADMIN_EMAIL}, une fois par semaine.</p>
        <p className="mt-3 text-sm font-semibold">{report.subject}</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-sans text-sm text-ink-2">{report.text}</pre>
      </details>
    </main>
  );
}

function CohortCard({ cohort, active }: { cohort: PilotCohort; active: boolean }) {
  const p = cohort.pilot;
  return (
    <li>
      <Link href={`/admin/pilotage?c=${cohort.id}`} aria-current={active ? "true" : undefined} className={"grid gap-2 rounded-xl border bg-white px-4 py-3 " + (active ? "border-ink shadow-[var(--shadow-card)]" : "border-line hover:border-slate-400")}>
        <span className="text-xs font-semibold text-muted">{PROGRAMS[cohort.program].name}</span>
        <span className="font-bold leading-tight">{cohort.name}</span>
        <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="tabular-nums text-muted">J{p.day} · {p.paid}/{p.goal} payées</span>
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + STATE_STYLE[p.state]}>{stateLabel(p)}</span>
        </span>
        <span className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: Math.min(p.goal, 40) }, (_, i) => <i key={i} className={"h-2 flex-1 rounded-sm " + (i < p.paid ? "bg-[var(--color-accent-bright)]" : i < p.expected ? "bg-[#cfe0f2]" : "bg-slate-100")} />)}
        </span>
      </Link>
    </li>
  );
}

function Detail({ cohort, funnel, now }: { cohort: PilotCohort; funnel: Array<{ title: string; count: number }>; now: Date }) {
  const p = cohort.pilot;
  const close = new Date(cohort.startsAt.getTime() + closeDayFor(cohort.program) * DAY_MS);
  const steps = [...funnel, { title: "Inscriptions en cours (non payées)", count: cohort.pendingRecent + cohort.held }, { title: "Places payées", count: p.paid }];
  const max = Math.max(1, ...steps.map((s) => s.count));

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{PROGRAMS[cohort.program].name} — {cohort.name}</h2>
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + STATE_STYLE[p.state]}>{stateLabel(p)}</span>
        </div>
        <p className="mt-1 text-sm text-muted">Démarrage le {dateFmt.format(cohort.startsAt)} · admissions jusqu’au {dateFmt.format(close)} · capacité {cohort.capacity}{p.goal !== cohort.capacity ? ` · objectif ${p.goal}` : ""}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile value={`${p.paid}`} sub={`/${p.goal}`} label="places payées" />
          <Tile value={p.state === "not_open" ? "—" : String(p.expected)} label="attendues à ce jour" warn={p.behind > 0} />
          <Tile value={p.forecast === null ? "—" : String(p.forecast)} label="prévision à la clôture" />
          <Tile value={`J${p.day}`} label="avant le démarrage" />
        </div>

        <div className="mt-4 overflow-x-auto"><PilotChart input={cohort.input} pilot={p} now={now} /></div>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span><i className="mr-1.5 inline-block h-[3px] w-4 rounded bg-[#2f6fb5] align-middle" />Courbe cible</span>
          <span><i className="mr-1.5 inline-block h-[3px] w-4 rounded bg-[var(--color-accent)] align-middle" />Places payées</span>
          <span><i className="mr-1.5 inline-block h-[3px] w-4 rounded bg-[var(--color-accent)] align-middle opacity-50" />Prévision à ce rythme</span>
        </p>
        <p className="mt-3 text-sm text-ink-2">{forecastSentence(p)}</p>
      </section>

      <div className="grid content-start gap-5">
        <section className="rounded-xl border border-line bg-white p-4">
          <h2 className="font-bold">Tunnel</h2>
          <p className="mt-0.5 text-xs text-muted">Visites et étapes du programme sur 30 jours (visiteurs distincts), puis cette cohorte.</p>
          <ol className="mt-3 grid gap-2">
            {steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 text-sm">
                <span className="relative h-6 overflow-hidden rounded bg-slate-100">
                  <span className={"absolute inset-y-0 left-0 rounded " + (i === steps.length - 1 ? "bg-[var(--color-accent)]" : "bg-[var(--color-ink-2)]")} style={{ width: `${Math.max(1.5, (s.count / max) * 100)}%`, opacity: s.count ? 1 : 0.3 }} />
                  <span className={"absolute inset-y-0 left-2 flex items-center truncate text-xs font-medium " + (s.count / max > 0.55 ? "text-white" : "text-ink")}>{s.title}</span>
                </span>
                <b className="text-right tabular-nums">{s.count.toLocaleString("fr-FR")}</b>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-line bg-white p-4">
          <h2 className="font-bold">D’où viennent les inscrits</h2>
          {cohort.sources.length ? (
            <ul className="mt-2 grid gap-1 text-sm">{cohort.sources.map((s) => <li key={s.source} className="flex justify-between"><span>{s.source}</span><b className="tabular-nums">{s.count}</b></li>)}</ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Pas encore de place payée sur cette cohorte.</p>
          )}
          <p className="mt-3 text-xs text-muted">Le détail publication par publication est dans <Link href="/admin/marketing" className="underline">Marketing</Link> ; les étapes du site dans <Link href="/admin/tunnel" className="underline">Tunnel</Link>.</p>
        </section>
      </div>
    </div>
  );
}

function Tile({ value, sub, label, warn }: { value: string; sub?: string; label: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <div className={"display text-2xl font-black tabular-nums " + (warn ? "text-amber-700" : "")}>{value}{sub && <span className="text-base font-semibold text-muted">{sub}</span>}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
