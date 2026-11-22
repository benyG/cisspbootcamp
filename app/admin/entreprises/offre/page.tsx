import { Settings2 } from "lucide-react";
import Link from "next/link";

import { loadOffer } from "@/lib/enterprise-server";

import { saveOfferAction } from "../actions";

export const dynamic = "force-dynamic";

const input = "w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm";
const label = "grid gap-1 text-xs font-semibold";
const usd = (cents: number) => String(cents / 100);

/** The five steps and their prices (Ben, 22/11): what the public page shows and what new proposals start from. */
export default async function EnterpriseOfferPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const [sp, offer] = await Promise.all([searchParams, loadOffer()]);
  const options = [...offer.options, ...Array.from({ length: 4 - offer.options.length }, () => ({ name: "", text: "" }))];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href="/admin/entreprises" className="text-sm text-muted">← Entreprises IA</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Settings2 className="size-6 text-accent" aria-hidden />Catalogue et prix</h1>
      <p className="mt-1 text-sm text-muted">Prix en USD. La page publique les affiche selon le pays du visiteur ; une proposition déjà enregistrée garde ses prix.</p>
      {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sp.ok}</p>}
      {sp.erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.erreur}</p>}

      <form action={saveOfferAction} className="mt-5 grid gap-4">
        {offer.packages.map((p, i) => (
          <fieldset key={p.code} className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-bold">{i + 1}. {p.name}</legend>
            <label className={label}>Nom<input name={`${p.code}.name`} defaultValue={p.name} maxLength={80} required className={input} /></label>
            <label className={label}>Durée affichée<input name={`${p.code}.duration`} defaultValue={p.duration} maxLength={60} required className={input} /></label>
            <label className={label + " sm:row-span-2"}>Contenu (une ligne par point, 6 au plus)<textarea name={`${p.code}.items`} defaultValue={p.items.join("\n")} rows={4} required className={input} /></label>
            <label className={label}>Résultat pour le client<input name={`${p.code}.outcome`} defaultValue={p.outcome} maxLength={160} required className={input} /></label>
            <div className="grid grid-cols-3 gap-2">
              <label className={label}>Afrique (USD)<input name={`${p.code}.africa`} type="number" min={0} step={50} defaultValue={usd(p.africaUsd)} className={input + " tabular-nums"} /></label>
              <label className={label}>International<input name={`${p.code}.intl`} type="number" min={0} step={50} defaultValue={usd(p.intlUsd)} className={input + " tabular-nums"} /></label>
              <label className={label}>Semaines<input name={`${p.code}.weeks`} type="number" min={0} max={52} defaultValue={p.weeks} className={input + " tabular-nums"} /></label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
              <label className="flex items-center gap-1.5"><input type="checkbox" name={`${p.code}.from`} defaultChecked={p.from} />Prix « dès »</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" name={`${p.code}.monthly`} defaultChecked={p.monthly} />Abonnement mensuel</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="featured" value={p.code} defaultChecked={p.featured} />« Le plus demandé »</label>
            </div>
          </fieldset>
        ))}
        <fieldset className="grid gap-3 rounded-xl border border-line bg-white p-4">
          <legend className="px-1 text-sm font-bold">Options (vides = masquées)</legend>
          {options.map((o, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
              <input name={`opt${i}.name`} defaultValue={o.name} maxLength={80} placeholder="Nom de l’option" className={input} />
              <input name={`opt${i}.text`} defaultValue={o.text} maxLength={300} placeholder="Ce qu’elle apporte, en une phrase" className={input} />
            </div>
          ))}
        </fieldset>
        <button className="justify-self-start rounded-lg bg-accent px-5 py-2.5 font-semibold text-white">Enregistrer le catalogue</button>
      </form>
    </main>
  );
}
