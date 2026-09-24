import Link from "next/link";

import { QUESTIONS } from "@/lib/scanner/questions";
import { tunnelReport } from "@/lib/tracking/report";

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n === null ? "—" : `${n} %`);
const delta = (n: number | null) => (n === null ? "" : n >= 0 ? `+${n} %` : `${n} %`);

/**
 * The tunnel of the last seven days, against the seven before
 * (docs/CONVERSION.md §3.3). Read in ten seconds: where people leave, which
 * question loses them, which source pays.
 */
export default async function TunnelPage() {
  const report = await tunnelReport();
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const label = (id: string) => QUESTIONS.find((q) => q.id === id)?.label.replace(/\{\{.*?\}\}/g, "…") ?? id;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 text-2xl font-bold">Tunnel de la semaine</h1>
      <p className="mt-1 text-sm text-muted">Du {fmt.format(report.since)} au {fmt.format(report.until)}, comparé aux sept jours précédents. Visiteurs distincts par étape.</p>

      {report.completionAlert && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Moins de 60 % des questionnaires commencés sont terminés{report.worstDrop ? ` ; la question ${report.worstDrop.step} fait perdre ${report.worstDrop.lostPercent} points` : ""}. Une question fait fuir : voir la perte par question ci-dessous.
        </p>
      )}

      <section className="mt-6 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Étapes</h2>
        <ol className="mt-3 grid gap-2">
          {report.funnel.map((row) => (
            <li key={row.name} className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-3 text-sm">
              <span>{row.label}</span>
              <b className="text-base tabular-nums">{row.count}</b>
              <span className="w-14 text-right text-muted tabular-nums">{pct(row.rateFromPrevious)}</span>
              <span className={"w-14 text-right text-xs tabular-nums " + (row.deltaPercent !== null && row.deltaPercent < 0 ? "text-red-700" : "text-muted")}>{delta(row.deltaPercent)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">Colonnes : visiteurs · taux depuis l&apos;étape précédente · variation sur une semaine. {report.returns > 0 && `${report.returns} prospect${report.returns > 1 ? "s" : ""} revenu${report.returns > 1 ? "s" : ""} voir leur résultat.`}</p>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Perte par question du scanner</h2>
        <p className="mt-1 text-xs text-muted">Part des personnes ayant commencé qui ont répondu à chaque question. Une marche qui descend d&apos;un coup désigne la question à réécrire.</p>
        <ol className="mt-3 grid gap-1.5">
          {report.dropoff.map((row) => (
            <li key={row.step} className="grid grid-cols-[1.5rem_1fr_3rem] items-center gap-2 text-sm">
              <span className="text-muted">{row.step}</span>
              <span className="relative h-5 overflow-hidden rounded bg-slate-100" title={label(report.questionLabels[row.step - 1] ?? "")}>
                <span className="absolute inset-y-0 left-0 rounded bg-accent" style={{ width: `${row.share}%` }} />
                <span className="absolute inset-y-0 left-2 flex items-center truncate text-xs text-ink">{label(report.questionLabels[row.step - 1] ?? "")}</span>
              </span>
              <span className="text-right tabular-nums">{row.share} %</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Table title="Par source" head={["Source", "Visites", "Scanner", "Payé"]} rows={report.sources.map((r) => [r.source, r.visits, r.submitted, r.paid])} empty="Aucune visite mesurée." />
        <Table title="Par pays" head={["Pays", "Scanner", "Payé"]} rows={report.countries.map((r) => [r.country, r.submitted, r.paid])} empty="Aucun questionnaire terminé." />
        <Table title="Boutons cliqués" head={["Position", "Clics"]} rows={report.ctas.map((r) => [r.label, r.clicks])} empty="Aucun clic mesuré." />
        <Table title="Objections (FAQ ouverte)" head={["Question", "Fois"]} rows={report.faq.map((r) => [r.question, r.opens])} empty="Aucune question ouverte." />
        <Table title="Conseil carrière" head={["Service", "Pages vues", "Clics paiement", "Payés", "Séances réservées"]} rows={report.services.map((r) => [r.service, r.views, r.payClicks, r.paid, r.booked])} empty="Aucune vue de service cette semaine." />
        <Table title="Tests ExamBoot (5 questions)" head={["Emplacement", "Lancés", "Scores", "Moyenne"]} rows={report.examboot.byPlacement.map((r) => [r.placement, r.started, r.completed, r.averagePercent === null ? "—" : `${r.averagePercent} %`])} empty="Aucun test lancé." />
      </div>
    </main>
  );
}

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: Array<Array<string | number>>; empty: string }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead><tr>{head.map((h, i) => <th key={h} className={"pb-1 text-xs font-semibold text-muted " + (i === 0 ? "text-left" : "text-right")}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i} className="border-t border-line">
                {cells.map((c, j) => <td key={j} className={"py-1.5 " + (j === 0 ? "max-w-[220px] truncate pr-2" : "text-right tabular-nums")}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
