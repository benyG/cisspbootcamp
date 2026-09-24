import Link from "next/link";
import { notFound } from "next/navigation";

import { CohortGauge } from "@/components/cohorts/CohortGauge";
import { COHORT_STATUS_LABEL as STATUS_LABEL, buildGauge } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { PROGRAMS } from "@/lib/programs";
import { formatUsdCents } from "@/lib/pricing";

import { updateCohort } from "../actions";

export const dynamic = "force-dynamic";

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

export default async function CohortPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { id } = await params;
  const { ok, erreur } = await searchParams;
  const cohort = await prisma.cohort.findUnique({
    where: { id: Number(id) },
    include: {
      registrations: {
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { id: true, firstName: true, lastName: true, email: true, country: true } } },
      },
    },
  });
  if (!cohort) notFound();

  const paid = cohort.registrations.filter((r) => r.status === "paid");
  const pending = cohort.registrations.filter((r) => r.status !== "paid" && r.status !== "refunded");
  const held = await prisma.seatHold.count({ where: { cohortId: cohort.id, releasedAt: null, expiresAt: { gt: new Date() } } });
  const gauge = buildGauge({ capacity: cohort.capacity, confirmed: paid.length, preEngaged: 0, held });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin/cohortes" className="text-sm text-[var(--color-muted)]">← Cohortes</Link>
      <h1 className="mt-3 text-2xl font-bold">{cohort.name}</h1>
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Enregistré.</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      <div className="mt-4"><CohortGauge gauge={gauge} /></div>

      <form action={updateCohort} className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="id" value={cohort.id} />
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium">Programme</span>
          <select name="program" defaultValue={cohort.program} className={input}>
            {Object.values(PROGRAMS).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium">Nom</span>
          <input name="name" defaultValue={cohort.name} required className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Début</span>
          <input name="startsAt" type="date" defaultValue={toInputDate(cohort.startsAt)} required className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fin</span>
          <input name="endsAt" type="date" defaultValue={toInputDate(cohort.endsAt)} required className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Capacité</span>
          <input name="capacity" type="number" min={1} max={100} defaultValue={cohort.capacity} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Statut</span>
          <select name="status" defaultValue={cohort.status} className={input}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="col-span-2 flex justify-end">
          <button type="submit" className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white">Enregistrer</button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="font-semibold">Inscrits ({paid.length})</h2>
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {paid.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <Link href={`/admin/leads/${r.lead.id}`} className="font-medium underline-offset-2 hover:underline">
                {r.lead.firstName} {r.lead.lastName} <span className="text-[var(--color-muted)]">· {r.lead.country}</span>
              </Link>
              <span className="text-[var(--color-muted)]">{formatUsdCents(r.amountUsd)} · {r.method} · {r.paidAt?.toLocaleDateString("fr-FR")}</span>
            </li>
          ))}
          {paid.length === 0 && <li className="px-4 py-3 text-sm text-[var(--color-muted)]">Aucune place payée pour l&apos;instant.</li>}
        </ul>
      </section>

      {pending.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">En attente de paiement ({pending.length})</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{r.lead.firstName} {r.lead.lastName}</span>
                <span className="text-[var(--color-muted)]">{r.reference} · {r.status === "pending_manual" ? "à confirmer" : "en cours"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const input = "rounded-lg border border-slate-300 px-3 py-2 text-base";
