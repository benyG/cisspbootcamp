import { GraduationCap, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CohortGauge } from "@/components/cohorts/CohortGauge";
import { COHORT_STATUS_LABEL as STATUS_LABEL, buildGauge } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { PROGRAMS } from "@/lib/programs";
import { formatUsdCents } from "@/lib/pricing";

import { deleteCohort, updateCohort } from "../actions";

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
  const peopleInside = new Set([
    ...cohort.registrations.map((r) => r.lead.id),
    ...(await prisma.seatHold.findMany({ where: { cohortId: cohort.id, releasedAt: null, expiresAt: { gt: new Date() } }, select: { leadId: true } })).map((h) => h.leadId),
  ]).size;
  const destinations = await prisma.cohort.findMany({
    where: { program: cohort.program, status: { not: "done" }, id: { not: cohort.id } },
    orderBy: { startsAt: "asc" },
    select: { id: true, name: true, startsAt: true, capacity: true, _count: { select: { registrations: { where: { status: "paid" } } } } },
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin/cohortes" className="text-sm text-[var(--color-muted)]">← Cohortes</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><GraduationCap className="size-6 shrink-0 text-accent" aria-hidden />{cohort.name}</h1>
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

      <details className="mt-10 rounded-xl border border-red-200 bg-white p-4 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-red-800"><Trash2 className="size-4" aria-hidden />Supprimer cette cohorte</summary>
        <form action={deleteCohort} className="mt-3 grid gap-3">
          <input type="hidden" name="id" value={cohort.id} />
          {peopleInside === 0 ? (
            <p className="text-muted">Personne n&apos;est inscrit ni en attente dans cette cohorte : elle peut être supprimée directement.</p>
          ) : destinations.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{peopleInside} personne{peopleInside > 1 ? "s" : ""} dans cette cohorte (payées, en attente ou place tenue). Créez d&apos;abord la cohorte {PROGRAMS[cohort.program].name} qui les accueillera, puis revenez ici.</p>
          ) : (
            <>
              <p className="text-ink-2">{peopleInside} personne{peopleInside > 1 ? "s" : ""} dans cette cohorte ({paid.length} payée{paid.length > 1 ? "s" : ""}, les autres en attente ou avec une place tenue). Elles passent toutes dans la cohorte choisie, avec leur paiement et leur référence. Aucun e-mail ne part : prévenez-les vous-même avant.</p>
              <label className="flex flex-col gap-1"><span className="font-medium">Déplacer les personnes vers</span>
                <select name="targetId" required className={input}>
                  {destinations.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.startsAt.toLocaleDateString("fr-FR", { timeZone: "UTC" })} · {d._count.registrations}/{d.capacity} payées</option>)}
                </select></label>
            </>
          )}
          {(peopleInside === 0 || destinations.length > 0) && (
            <>
              <label className="flex items-start gap-2"><input type="checkbox" name="confirm" required className="mt-1" /> {peopleInside === 0 ? "Je confirme la suppression de cette cohorte." : "J’ai prévenu les personnes concernées de leur changement de cohorte, et je confirme la suppression."}</label>
              <div className="flex justify-end"><button className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white">{peopleInside === 0 ? "Supprimer la cohorte" : "Déplacer et supprimer"}</button></div>
            </>
          )}
        </form>
      </details>
    </main>
  );
}

const input = "rounded-lg border border-slate-300 px-3 py-2 text-base";
