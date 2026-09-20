import Link from "next/link";

import { CohortGauge } from "@/components/cohorts/CohortGauge";
import { formatCohortMonth } from "@/lib/cohorts";
import { publicCohortSummary } from "@/lib/cohorts-admin";

export const dynamic = "force-dynamic";

/**
 * Holding page. The real landing (SPECS A1) is built at step 7; the cohort
 * gauge below is the one it will reuse — real seats, real scarcity.
 */
export default async function HomePage() {
  const cohort = await publicCohortSummary().catch(() => null);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-5 py-16">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
        Coach CISSP
      </p>
      <h1 className="text-3xl font-bold text-balance sm:text-4xl">
        Le bootcamp CISSP en français arrive bientôt.
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        40 heures d&apos;accompagnement sur 15 jours, un diagnostic honnête de votre
        profil, et un coach certifié CISSP jusqu&apos;au jour de l&apos;examen.
      </p>

      {cohort && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="font-semibold">{cohort.name}</p>
          <p className="text-sm text-[var(--color-muted)]">Démarre en {formatCohortMonth(cohort.startsAt)}</p>
          <div className="mt-3"><CohortGauge gauge={cohort.gauge} /></div>
        </section>
      )}

      <Link
        href="/scanner"
        className="rounded-lg bg-[var(--color-accent)] px-5 py-4 text-center text-lg font-semibold text-white"
      >
        Évaluer mon profil
      </Link>
    </main>
  );
}
