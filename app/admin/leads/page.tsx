import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { new: "Nouveau", contacted: "Contacté", booked: "RDV pris", called: "Appelé", registered: "Inscrit", nurture: "À recontacter", lost: "Perdu" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; supprime?: string }> }) {
  const { q, supprime } = await searchParams;
  const leads = await prisma.lead.findMany({
    where: q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] } : undefined,
    orderBy: [{ heatScore: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 text-2xl font-bold">Leads</h1>
      {supprime && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Lead supprimé, avec tout son historique.</p>}
      <form className="mt-4"><input name="q" defaultValue={q} placeholder="Chercher un nom ou un e-mail" className="w-full rounded-lg border border-line px-3 py-2.5" /></form>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-line bg-white">
        {leads.map((l) => (
          <li key={l.id}>
            <Link href={`/admin/leads/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0"><span className="block truncate font-semibold">{l.firstName} {l.lastName}</span><span className="text-sm text-muted">{l.country} · {STATUS[l.status]}{l.unsubscribedAt ? " · désinscrit" : ""}</span></span>
              <span className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-black text-white" style={{ background: l.heatScore >= 60 ? "#b91c1c" : l.heatScore >= 30 ? "#c2410c" : "#64748b" }}>{l.heatScore}</span>
            </Link>
          </li>
        ))}
        {leads.length === 0 && <li className="px-4 py-3 text-sm text-muted">Aucun lead.</li>}
      </ul>
    </main>
  );
}
