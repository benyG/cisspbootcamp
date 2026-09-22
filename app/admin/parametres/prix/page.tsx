import Link from "next/link";

import { prisma } from "@/lib/db";

import { updateTier } from "./actions";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [tiers, rates] = await Promise.all([prisma.pricingTier.findMany({ orderBy: { amountUsd: "asc" } }), prisma.exchangeRate.findMany({ orderBy: { currency: "asc" } })]);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 text-2xl font-bold">Tarifs</h1>
      <p className="mt-1 text-sm text-muted">Prix en USD, la monnaie de référence. Un pays absent de toute liste relève de l&apos;international. Un montant à 0 signifie « sur devis ».</p>
      <div className="mt-5 grid gap-3">
        {tiers.map((t) => (
          <form key={t.code} action={updateTier} className="grid gap-2 rounded-xl border border-line bg-white p-4">
            <input type="hidden" name="code" value={t.code} />
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Libellé <span className="text-muted">({t.code})</span></span><input name="label" defaultValue={t.label} className={input} /></label>
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium">USD</span><input name="amountUsd" type="number" min={0} step={1} defaultValue={t.amountUsd / 100} className={input} /></label>
            </div>
            <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Pays (codes à deux lettres)</span><textarea name="countries" rows={2} defaultValue={(Array.isArray(t.countries) ? (t.countries as string[]) : []).join(", ")} className={input} /></label>
            <div className="flex justify-end"><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Enregistrer</button></div>
          </form>
        ))}
      </div>
      <section className="mt-8 text-sm">
        <h2 className="font-semibold">Taux de change (mis à jour chaque nuit)</h2>
        <p className="mt-1 text-muted">{rates.length ? rates.map((r) => `1 USD = ${r.perUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${r.currency}`).join(" · ") : "Aucun taux encore chargé."}</p>
      </section>
    </main>
  );
}
const input = "rounded-lg border border-line px-3 py-2 text-base";
