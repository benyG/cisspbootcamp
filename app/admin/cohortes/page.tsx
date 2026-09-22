import Link from "next/link";

import { CohortGauge } from "@/components/cohorts/CohortGauge";
import { COHORT_STATUS_LABEL as STATUS_LABEL, formatAdmissionDeadline, formatCohortMonth } from "@/lib/cohorts";
import { listCohortsWithGauge } from "@/lib/cohorts-admin";

import { createCohort } from "./actions";

export const dynamic = "force-dynamic";

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const cohorts = await listCohortsWithGauge();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-[var(--color-muted)]">← Administration</Link>
      <h1 className="mt-3 text-2xl font-bold">Cohortes</h1>
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      <ul className="mt-6 flex flex-col gap-3">
        {cohorts.map((cohort) => (
          <li key={cohort.id}>
            <Link href={`/admin/cohortes/${cohort.id}`} className="block rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{cohort.name}</p>
                <span className="text-xs text-[var(--color-muted)]">{STATUS_LABEL[cohort.status]}</span>
              </div>
              <p className="text-sm text-[var(--color-muted)]">
                {formatCohortMonth(cohort.startsAt)} · admissions jusqu’au {formatAdmissionDeadline(cohort.startsAt)} · {cohort.gauge.confirmed} payée{cohort.gauge.confirmed > 1 ? "s" : ""}
                {cohort.gauge.held > 0 && ` · ${cohort.gauge.held} tenue${cohort.gauge.held > 1 ? "s" : ""}`}
                {cohort.gauge.preEngaged > 0 && ` · ${cohort.gauge.preEngaged} pré-engagé${cohort.gauge.preEngaged > 1 ? "s" : ""}`}
              </p>
              <div className="mt-3"><CohortGauge gauge={cohort.gauge} /></div>
            </Link>
          </li>
        ))}
        {cohorts.length === 0 && <li className="text-[var(--color-muted)]">Aucune cohorte. Créez la première ci-dessous.</li>}
      </ul>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Nouvelle cohorte</h2>
        <form action={createCohort} className="mt-3 grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="font-medium">Nom</span>
            <input name="name" required placeholder="Cohorte février 2027" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Début</span>
            <input name="startsAt" type="date" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Fin</span>
            <input name="endsAt" type="date" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Capacité</span>
            <input name="capacity" type="number" min={1} max={100} defaultValue={10} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Statut</span>
            <select name="status" defaultValue="planned" className={input}>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="col-span-2 flex justify-end">
            <button type="submit" className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white">Créer</button>
          </div>
        </form>
      </section>
    </main>
  );
}

const input = "rounded-lg border border-slate-300 px-3 py-2 text-base";
