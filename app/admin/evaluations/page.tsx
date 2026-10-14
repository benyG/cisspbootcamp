import { ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";

import { type CohortPeople, EvaluationForm } from "@/components/admin/evaluations/EvaluationForm";
import { ResendButton } from "@/components/admin/evaluations/ResendButton";
import { prisma } from "@/lib/db";
import { KINDS, SCORE_FAIR, SCORE_GOOD, scoreBand } from "@/lib/evaluations";
import { loadDomains } from "@/lib/evaluations-server";
import { cohortParticipants } from "@/lib/replays-server";

export const dynamic = "force-dynamic";
/** Creating an evaluation waits on ExamBoot, then sends one e-mail per person. */
export const maxDuration = 60;

const STATUS: Record<string, [string, string]> = {
  created: ["E-mail non parti", "bg-red-50 text-red-800"],
  sent: ["Envoyé", "bg-paper text-muted"],
  started: ["En cours", "bg-amber-50 text-amber-900"],
  completed: ["Terminé", "bg-accent-soft text-accent-ink"],
};
const BAND = { good: "bg-accent-soft text-accent-ink", fair: "bg-amber-50 text-amber-900", low: "bg-red-50 text-red-800", none: "text-muted" } as const;
const day = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
type Dom = { n: number | null; id: number; name: string; questions: number };
type DomScore = { id: number; percent: number };
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/**
 * Evaluations (Ben, 14/10): tests and mock exams built on ExamBoot from
 * chosen CISSP domains, sent to a cohort's participants, scores followed
 * domain by domain.
 */
export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<{ id?: string; nouvelle?: string; ok?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const evaluations = await prisma.evaluation.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { cohort: { select: { name: true } }, recipients: { select: { status: true, percent: true } } } });
  const creating = sp.nouvelle !== undefined || evaluations.length === 0;
  const selectedId = Number(sp.id) || (creating ? 0 : evaluations[0]?.id ?? 0);
  const detail = selectedId ? await loadDetail(selectedId) : null;

  let form: React.ReactNode = null;
  if (creating) {
    const [catalog, cohorts] = await Promise.all([
      loadDomains(),
      prisma.cohort.findMany({ where: { program: "cissp" }, orderBy: { startsAt: "desc" }, take: 12, select: { id: true, name: true } }),
    ]);
    const withPeople: CohortPeople[] = (await Promise.all(cohorts.map(async (c) => ({ id: c.id, name: c.name, people: (await cohortParticipants(c.id)).map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), note: p.personalLastDate ? "calendrier personnel" : "" })) })))).filter((c) => c.people.length > 0);
    const due = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    form = catalog.ok ? <EvaluationForm domains={catalog.domains} cohorts={withPeople} defaultDue={due} /> : <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{catalog.error}</p>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck className="size-6 text-accent" aria-hidden />Évaluations</h1>
        {!creating && <Link href="/admin/evaluations?nouvelle" className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"><Plus className="size-4" aria-hidden />Nouvelle évaluation</Link>}
      </div>
      <p className="mt-1 text-sm text-muted">Composez un test ou un examen blanc ExamBoot sur les domaines de votre choix, envoyez-le aux inscrits d&apos;une cohorte, suivez les scores domaine par domaine.</p>
      {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sp.ok}</p>}
      {sp.erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.erreur}</p>}

      {creating && <div className="mt-5">{form}</div>}

      {evaluations.length > 0 && (
        <div className={`mt-6 grid gap-4 ${detail ? "lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]" : ""}`}>
          <nav aria-label="Évaluations envoyées" className="grid content-start gap-2">
            <h2 className="text-sm font-semibold text-muted">Envoyées</h2>
            {evaluations.map((e) => {
              const done = e.recipients.filter((r) => r.status === "completed");
              const mean = avg(done.map((r) => r.percent ?? 0));
              const current = e.id === detail?.id;
              return (
                <Link key={e.id} href={`/admin/evaluations?id=${e.id}`} aria-current={current ? "page" : undefined} className={`grid gap-0.5 rounded-xl border bg-white px-3 py-2 text-sm ${current ? "border-accent bg-accent-soft" : "border-line hover:border-accent"}`}>
                  <b className="truncate">{e.title}</b>
                  <span className="text-xs text-muted">{KINDS[e.kind as keyof typeof KINDS] ?? e.kind} · {e.questions} q. · {e.cohort.name} · avant le {day(e.dueAt)}</span>
                  <span className="text-xs font-semibold">{done.length}/{e.recipients.length} terminé{done.length > 1 ? "s" : ""}{mean !== null ? ` · moyenne ${mean} %` : ""}</span>
                </Link>
              );
            })}
          </nav>
          {detail && <Detail e={detail} />}
        </div>
      )}
    </main>
  );
}

function Detail({ e }: { e: NonNullable<Awaited<ReturnType<typeof loadDetail>>> }) {
  const doms = (Array.isArray(e.domains) ? e.domains : []) as Dom[];
  const done = e.recipients.filter((r) => r.status === "completed");
  const mean = avg(done.map((r) => r.percent ?? 0));
  const scoreOf = (r: (typeof e.recipients)[number], id: number) => ((Array.isArray(r.domains) ? r.domains : []) as DomScore[]).find((d) => d.id === id)?.percent ?? null;
  const domMeans = doms.map((d) => avg(done.map((r) => scoreOf(r, d.id)).filter((v): v is number => v !== null)));
  const known = domMeans.filter((v): v is number => v !== null);
  const weakest = known.length ? domMeans.indexOf(Math.min(...known)) : -1;
  const late = e.recipients.filter((r) => r.status !== "completed").length;
  const label = (d: Dom) => (d.n ? `D${d.n}` : d.name.slice(0, 12));
  return (
    <section className="grid min-w-0 content-start gap-4 rounded-xl border border-line bg-white p-4 text-sm">
      <div>
        <span className="text-xs font-bold tracking-[.08em] text-accent-ink uppercase">{KINDS[e.kind as keyof typeof KINDS] ?? e.kind} · {e.questions} questions{e.timer ? ` · ${e.timer} min` : ""} · avant le {day(e.dueAt)}</span>
        <h2 className="mt-1 text-xl font-bold">{e.title}</h2>
        <p className="text-muted">{e.cohort.name} · {doms.map((d) => `${label(d)} ${d.questions} q.`).join(" · ")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Kpi label="Terminés" value={`${done.length}/${e.recipients.length}`} />
        <Kpi label="Score moyen" value={mean !== null ? `${mean} %` : "—"} />
        <Kpi label="Domaine le plus faible" value={weakest >= 0 ? label(doms[weakest]) : "—"} sub={weakest >= 0 ? `${domMeans[weakest]} % en moyenne` : undefined} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left tabular-nums">
          <thead className="text-xs tracking-[.06em] text-muted uppercase">
            <tr><th className="px-3 py-2">Inscrit</th><th className="px-3 py-2">État</th><th className="px-3 py-2 text-center">Score</th>{doms.map((d) => <th key={d.id} className="px-3 py-2 text-center" title={d.name}>{label(d)}</th>)}<th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {e.recipients.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2 whitespace-nowrap"><Link href={`/admin/leads/${r.lead.id}`} className="hover:underline">{r.lead.firstName} {r.lead.lastName}</Link></td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${STATUS[r.status]?.[1] ?? ""}`}>{STATUS[r.status]?.[0] ?? r.status}</span></td>
                <td className="px-3 py-2 text-center"><Cell v={r.percent} suffix=" %" /></td>
                {doms.map((d) => <td key={d.id} className="px-3 py-2 text-center"><Cell v={r.status === "completed" ? scoreOf(r, d.id) : null} /></td>)}
                <td className="px-3 py-2">{r.status !== "completed" && <ResendButton recipientId={r.id} />}</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold"><td className="px-3 py-2">Moyenne</td><td /><td className="px-3 py-2 text-center"><Cell v={mean} suffix=" %" /></td>{domMeans.map((v, i) => <td key={doms[i].id} className="px-3 py-2 text-center"><Cell v={v} /></td>)}<td /></tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Vert à partir de {SCORE_GOOD} %, orange de {SCORE_FAIR} à {SCORE_GOOD - 1} %, rouge en dessous. Les scores arrivent dès qu&apos;une personne termine.{late > 0 && e.remind && !e.remindedAt ? ` ${late} personne${late > 1 ? "s" : ""} n'${late > 1 ? "ont" : "a"} pas encore terminé : la relance part 2 jours avant la date.` : ""}{e.remindedAt ? ` Relance envoyée le ${day(e.remindedAt)}.` : ""}</p>
    </section>
  );
}

async function loadDetail(id: number) {
  return prisma.evaluation.findUnique({ where: { id }, include: { cohort: { select: { name: true } }, recipients: { include: { lead: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { id: "asc" } } } });
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="grid min-w-32 flex-1 rounded-xl border border-line px-3 py-2"><span className="text-xs text-muted">{label}</span><b className="text-xl tabular-nums">{value}</b>{sub && <span className="text-xs text-muted">{sub}</span>}</div>;
}

function Cell({ v, suffix = "" }: { v: number | null; suffix?: string }) {
  return <span className={`inline-block min-w-11 rounded-md px-1.5 py-0.5 font-bold ${BAND[scoreBand(v)]}`}>{v === null ? "·" : `${v}${suffix}`}</span>;
}
