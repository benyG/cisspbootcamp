import { Bot, Settings2 } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { FUNCTIONS, type FunctionKey, SIZES, type SizeKey, STATUSES, type Status, formatUsd } from "@/lib/enterprise";
import { countryLabel } from "@/lib/quotes";

export const dynamic = "force-dynamic";

const PILL: Record<Status, string> = { new: "bg-amber-50 text-amber-900", call: "bg-sky-50 text-sky-900", proposal: "bg-paper text-muted", won: "bg-accent-soft text-accent-ink", lost: "bg-red-50 text-red-800" };
const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Bâtisseur IA Entreprises (Ben, 22/11): the requests, by state; open one to call, propose, collect the deposit. */
export default async function EnterpriseRequestsPage({ searchParams }: { searchParams: Promise<{ etat?: string; ok?: string }> }) {
  const sp = await searchParams;
  const filter = sp.etat && sp.etat in STATUSES ? (sp.etat as Status) : null;
  const [requests, counts] = await Promise.all([
    prisma.enterpriseRequest.findMany({ where: filter ? { status: filter } : {}, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.enterpriseRequest.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: Status) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((n, c) => n + c._count, 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="size-6 text-accent" aria-hidden />Entreprises IA</h1>
        <Link href="/admin/entreprises/offre" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold"><Settings2 className="size-4 text-accent" aria-hidden />Catalogue et prix</Link>
      </div>
      <p className="mt-1 text-sm text-muted">{total === 0 ? "Aucune demande pour l'instant. La page est sur /ia/entreprises." : "Ouvrez une demande pour préparer la proposition, la télécharger en PDF et créer le lien d'acompte."}</p>
      {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sp.ok}</p>}

      <nav className="mt-4 flex flex-wrap gap-1.5 text-sm" aria-label="Filtrer par état">
        <Link href="/admin/entreprises" className={`rounded-full border px-3 py-1 ${!filter ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>Toutes · {total}</Link>
        {(Object.keys(STATUSES) as Status[]).map((s) => (
          <Link key={s} href={`/admin/entreprises?etat=${s}`} className={`rounded-full border px-3 py-1 ${filter === s ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{STATUSES[s]} · {count(s)}</Link>
        ))}
      </nav>

      {requests.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-[.06em] text-muted uppercase"><tr><th className="px-3 py-2">Reçue</th><th className="px-3 py-2">Organisation</th><th className="px-3 py-2">À traiter</th><th className="px-3 py-2">Proposition</th><th className="px-3 py-2">État</th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2 whitespace-nowrap">{day(r.createdAt)}</td>
                  <td className="px-3 py-2"><Link href={`/admin/entreprises/${r.id}`} className="font-bold hover:underline">{r.organization}</Link><span className="block text-xs text-muted">{r.contactName} · {countryLabel(r.country)} · {SIZES[r.size as SizeKey] ?? r.size}{r.dataOnSite ? " · données sur site" : ""}</span></td>
                  <td className="px-3 py-2 text-xs">{(Array.isArray(r.functions) ? (r.functions as string[]) : []).map((f) => FUNCTIONS[f as FunctionKey] ?? f).join(", ") || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.quoteNumber ?? "—"}{r.depositUsd ? <span className="block text-xs text-muted">acompte {formatUsd(r.depositUsd)}{r.depositPaidAt ? " · payé" : ""}</span> : null}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${PILL[r.status as Status] ?? ""}`}>{STATUSES[r.status as Status] ?? r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
