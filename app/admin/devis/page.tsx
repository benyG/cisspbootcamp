import { Building2 } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { CERTIFICATIONS, FORMATS, HEADCOUNTS, STATUSES, type QuoteStatus, TIMINGS, countryLabel, quoteSummary } from "@/lib/quotes";

import { deleteQuoteAction, updateQuoteAction } from "./actions";

export const dynamic = "force-dynamic";

const PILL: Record<QuoteStatus, string> = { new: "bg-amber-50 text-amber-900", sent: "bg-paper text-muted", won: "bg-accent-soft text-accent-ink", lost: "bg-red-50 text-red-800" };
const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Company quote requests (Ben, 21/10): who asks, for what; Ben answers himself. */
export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ id?: string; ok?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const quotes = await prisma.quoteRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const open = quotes.find((q) => q.id === Number(sp.id)) ?? null;
  const pending = quotes.filter((q) => q.status === "new").length;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Building2 className="size-6 text-accent" aria-hidden />Devis entreprises</h1>
      <p className="mt-1 text-sm text-muted">{quotes.length === 0 ? "Aucune demande pour l'instant. Le formulaire est sur /entreprises." : `${quotes.length} demande${quotes.length > 1 ? "s" : ""}, ${pending} à traiter. Vous envoyez le devis vous-même, puis vous changez l'état ici.`}</p>
      {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sp.ok}</p>}
      {sp.erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.erreur}</p>}

      {open && (
        <section className="mt-5 grid gap-4 rounded-xl border border-accent bg-white p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">{open.organization}</h2>
              <p className="text-muted">{countryLabel(open.country)} · reçue le {day(open.createdAt)} · consentement le {open.consentAt.toLocaleString("fr-FR")}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PILL[open.status as QuoteStatus] ?? ""}`}>{STATUSES[open.status as QuoteStatus] ?? open.status}</span>
          </div>
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted">Contact</dt><dd><b>{open.contactName}</b>{open.jobTitle ? `, ${open.jobTitle}` : ""}</dd>
            <dt className="text-muted">E-mail</dt><dd><a href={`mailto:${open.email}`} className="underline">{open.email}</a></dd>
            {open.phone && <><dt className="text-muted">Téléphone</dt><dd>{open.phone}</dd></>}
            <dt className="text-muted">Formation</dt><dd>{CERTIFICATIONS[open.certification as keyof typeof CERTIFICATIONS] ?? open.certification}</dd>
            <dt className="text-muted">Format</dt><dd>{FORMATS[open.format as keyof typeof FORMATS] ?? open.format}</dd>
            <dt className="text-muted">Personnes</dt><dd>{HEADCOUNTS[open.headcount as keyof typeof HEADCOUNTS] ?? open.headcount}</dd>
            <dt className="text-muted">Période</dt><dd>{TIMINGS[open.timing as keyof typeof TIMINGS] ?? open.timing}</dd>
          </dl>
          {open.need && <p className="whitespace-pre-line rounded-lg bg-paper p-3">{open.need}</p>}
          <form action={updateQuoteAction} className="grid gap-2">
            <input type="hidden" name="id" value={open.id} />
            <label className="grid gap-1 font-medium">Note interne
              <textarea name="note" rows={3} maxLength={4000} defaultValue={open.note ?? ""} placeholder="Ex. : appel le 23/10, devis 8 personnes en ligne envoyé" className="rounded-lg border border-line px-3 py-2 text-base font-normal" /></label>
            <div className="flex flex-wrap items-center gap-2">
              <select name="status" defaultValue={open.status} className="rounded-lg border border-line bg-white px-3 py-2">{Object.entries(STATUSES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
              <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Enregistrer</button>
            </div>
          </form>
          <form action={deleteQuoteAction} className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
            <input type="hidden" name="id" value={open.id} />
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="confirm" />Supprimer définitivement cette demande et ses coordonnées</label>
            <button className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800">Supprimer</button>
          </form>
        </section>
      )}

      {quotes.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-[.06em] text-muted uppercase"><tr><th className="px-3 py-2">Reçue</th><th className="px-3 py-2">Entreprise</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Besoin</th><th className="px-3 py-2">État</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className={`border-t border-line ${q.id === open?.id ? "bg-accent-soft" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{day(q.createdAt)}</td>
                  <td className="px-3 py-2"><Link href={`/admin/devis?id=${q.id}`} className="font-bold hover:underline">{q.organization}</Link><span className="block text-xs text-muted">{countryLabel(q.country)}</span></td>
                  <td className="px-3 py-2">{q.contactName}{q.jobTitle && <span className="block text-xs text-muted">{q.jobTitle}</span>}</td>
                  <td className="px-3 py-2">{quoteSummary(q as Parameters<typeof quoteSummary>[0])}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${PILL[q.status as QuoteStatus] ?? ""}`}>{STATUSES[q.status as QuoteStatus] ?? q.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
