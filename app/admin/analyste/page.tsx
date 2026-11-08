import { LineChart } from "lucide-react";
import Link from "next/link";

import { CONFIDENCE, type Confidence, MIN_SAMPLE, MIN_SPEND_CENTS, OUTCOME, type Outcome, analystWeekKey, readDecisions } from "@/lib/analyst/rules";
import { analystReport } from "@/lib/analyst/server";
import type { Snapshot } from "@/lib/analyst/snapshot";
import { prisma } from "@/lib/db";

import { decideBet, runAnalysisNow } from "./actions";

export const dynamic = "force-dynamic";
// "Lancer l'analyse" calls the AI, as the Studio does.
export const maxDuration = 300;

const CONF_STYLE: Record<Confidence, string> = { solid: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]", likely: "bg-sky-50 text-sky-800", small: "bg-amber-50 text-amber-800" };
const OUT_STYLE: Record<Outcome, string> = { worked: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]", no_effect: "bg-red-50 text-red-800", too_early: "bg-sky-50 text-sky-800" };
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const weekLabel = (key: string) => dayFmt.format(new Date(`${key}T12:00:00Z`));

/**
 * The analyst of the week (Ben, 08/11, from the validated prototype): what
 * the figures say, three ranked orientations with their figures, last
 * week's check, what it read. It proposes; Ben keeps or drops.
 */
export default async function AnalystPage({ searchParams }: { searchParams: Promise<{ s?: string; ok?: string; erreur?: string }> }) {
  const { s, ok, erreur } = await searchParams;
  const weeks = await prisma.analystReport.findMany({ orderBy: { weekKey: "desc" }, take: 8, select: { weekKey: true } });
  const weekKey = s && weeks.some((w) => w.weekKey === s) ? s : weeks[0]?.weekKey;
  const report = weekKey ? await analystReport(weekKey) : null;
  const decisions = readDecisions(report?.decisions);
  const snap = report?.snapshot as Snapshot | undefined;
  const cohort = snap?.cohortes.find((c) => c.attenduesACeJour !== null) ?? snap?.cohortes[0];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin/pilotage" className="text-sm text-muted">← Pilotage</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><LineChart className="size-6 shrink-0 text-accent" aria-hidden />Analyste</h1>
      <p className="mt-1 text-sm text-muted">Chaque dimanche, il lit les chiffres de la semaine et propose 3 orientations au plus. Il propose, vous décidez : « Retenir » met l’orientation dans votre file d’actions.</p>
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      {weeks.length > 1 && (
        <nav className="mt-4 flex flex-wrap gap-1.5 text-sm" aria-label="Semaines">
          {weeks.map((w) => <Link key={w.weekKey} href={`/admin/analyste?s=${w.weekKey}`} aria-current={w.weekKey === weekKey ? "page" : undefined} className={"rounded-full border px-3 py-1 " + (w.weekKey === weekKey ? "border-ink bg-ink text-white" : "border-line bg-white")}>{w.weekKey.split("-").reverse().slice(0, 2).join("/")}</Link>)}
        </nav>
      )}

      {!report ? (
        <section className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
          <p>Pas encore d’analyse. La première arrive dimanche, pour le rapport du lundi ; vous pouvez aussi la lancer maintenant.</p>
        </section>
      ) : (
        <>
          <section className="mt-5 rounded-xl border border-line border-l-4 border-l-[var(--color-accent)] bg-white p-4">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Semaine du {weekLabel(report.weekKey)}</p>
            <p className="mt-2 text-[1.05rem]">{report.output.diagnosis}</p>
            {snap && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cohort && <Tile value={`${cohort.placesPayees}/${cohort.objectif}`} label={`places payées · ${cohort.cohorte}`} note={cohort.etat} warn={cohort.etat.startsWith("En retard")} />}
                <Tile value={String(snap.certificationsTunnel.visites.semaine)} label="visites CISSP et CC en 7 jours" note={trend(snap.certificationsTunnel.visites.evolution)} />
                <Tile value={String(snap.prospects.nouveauxCetteSemaine)} label="nouveaux prospects" note={trend(snap.prospects.evolution)} />
                <Tile value={String(snap.certificationsTunnel.appelsReserves.semaine)} label="appels réservés" note={`${snap.certificationsTunnel.appelsReserves.avant} la semaine d’avant`} />
              </div>
            )}
          </section>

          <h2 className="mt-6 text-lg font-bold">{report.output.bets.length ? `${report.output.bets.length} orientation${report.output.bets.length > 1 ? "s" : ""}, par ordre d’effet` : "Aucune orientation cette semaine"}</h2>
          <ol className="mt-2 grid gap-3">
            {report.output.bets.map((b, i) => {
              const rank = i + 1;
              const d = decisions[String(rank)]?.status;
              return (
                <li key={rank} id={`o${rank}`} className={"grid gap-3 rounded-xl border bg-white p-4 " + (d === "kept" ? "border-[var(--color-accent)]" : d === "dropped" ? "border-line opacity-60" : "border-line")}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-bold text-white">{rank}</span>
                    <div className="min-w-0">
                      <h3 className="font-bold leading-snug">{b.title}</h3>
                      <span className={"mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase " + CONF_STYLE[b.confidence]}>{CONFIDENCE[b.confidence]}</span>
                    </div>
                  </div>
                  <ul className="grid gap-1 text-sm">
                    {b.facts.map((f) => <li key={f.label} className="flex justify-between gap-3 border-b border-dashed border-line pb-1"><span>{f.label}</span><b className="tabular-nums whitespace-nowrap">{f.value}</b></li>)}
                  </ul>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">Action</span>{b.action}</p>
                  <p className="text-sm text-ink-2"><b>À suivre :</b> {b.watch.metric}. Objectif : {b.watch.target}.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={decideBet}><input type="hidden" name="week" value={report.weekKey} /><input type="hidden" name="rank" value={rank} /><input type="hidden" name="status" value="kept" /><button className={"rounded-lg px-3.5 py-2 text-sm font-semibold " + (d === "kept" ? "bg-[var(--color-accent)] text-white" : "bg-ink text-white")}>{d === "kept" ? "Retenue ✓" : "Retenir → file d’actions"}</button></form>
                    <form action={decideBet}><input type="hidden" name="week" value={report.weekKey} /><input type="hidden" name="rank" value={rank} /><input type="hidden" name="status" value="dropped" /><button className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold">{d === "dropped" ? "Écartée" : "Écarter"}</button></form>
                  </div>
                </li>
              );
            })}
          </ol>

          {report.output.review.length > 0 && (
            <section className="mt-6 rounded-xl border border-line bg-white p-4">
              <h2 className="font-bold">Ce qu’on avait retenu la semaine dernière</h2>
              <ul className="mt-2 grid gap-2.5">
                {report.output.review.map((r) => (
                  <li key={r.title} className="flex items-start gap-2.5 text-sm">
                    <span className={"mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase " + OUT_STYLE[r.outcome]}>{OUTCOME[r.outcome]}</span>
                    <span>{r.title}<span className="block text-xs text-muted">{r.note}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="font-bold">Ce qu’il lit</h2>
          <ul className="mt-2 grid gap-1 text-ink-2">
            <li>Objectifs, courbes et prévisions (Pilotage)</li>
            <li>Visites et étapes, par source et par pays (Tunnel)</li>
            <li>Publications et visites amenées (Marketing)</li>
            <li>Pub payante, codes promo, envois automatiques</li>
            <li>Ce qui a été retenu la semaine d’avant</li>
          </ul>
          <p className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">Pas encore branché</p>
          <p className="mt-1 text-ink-2">Impressions LinkedIn, recherches Google, ouvertures des e-mails, dépense Meta en direct.</p>
        </section>
        <section className="rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="font-bold">Ses règles</h2>
          <ul className="mt-2 grid gap-1 text-ink-2">
            <li>Chaque chiffre vient des données de la semaine ; un chiffre sans source est retiré.</li>
            <li>Sous {MIN_SAMPLE} personnes ou {MIN_SPEND_CENTS / 100} USD de pub : « échantillon petit ».</li>
            <li>Il ne décide rien et n’envoie rien.</li>
            <li>Il ne lit aucune donnée personnelle : des comptes et des taux.</li>
          </ul>
        </section>
      </div>

      <form action={runAnalysisNow} className="mt-6 flex flex-wrap items-center gap-3">
        <button className="rounded-lg border border-ink px-4 py-2.5 text-sm font-semibold">{report?.weekKey === analystWeekKey(new Date()) ? "Relancer l’analyse de la semaine" : "Lancer l’analyse maintenant"}</button>
        <span className="text-xs text-muted">Environ une minute. Relancer remet à zéro vos choix de la semaine.</span>
      </form>
    </main>
  );
}

const trend = (n: number | null) => (n === null ? "pas de comparaison" : `${n > 0 ? "+" : ""}${n} % vs semaine passée`);

function Tile({ value, label, note, warn }: { value: string; label: string; note?: string; warn?: boolean }) {
  return (
    <div className={"min-w-0 rounded-lg border px-3 py-2.5 " + (warn ? "border-amber-200 bg-amber-50" : "border-line")}>
      <div className="text-xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {note && <div className="mt-1 text-[11px] font-semibold text-muted">{note}</div>}
    </div>
  );
}
