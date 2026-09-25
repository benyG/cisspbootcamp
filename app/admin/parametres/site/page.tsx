import { Settings2 } from "lucide-react";
import Link from "next/link";

import { loadSiteSettings } from "@/lib/site-settings";

import { resetAllCopy } from "./actions";
import { SiteSettingsForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const settings = await loadSiteSettings();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Settings2 className="size-6 shrink-0 text-accent" aria-hidden />Page d&apos;accueil</h1>
      <p className="mt-1 text-sm text-muted">Chaque section s&apos;enregistre séparément et se met en ligne dans la minute. La cohorte, la jauge et les prix viennent de la base, pas d&apos;ici.</p>
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Textes remis par défaut, en ligne dans la minute.</p>}
      <form action={resetAllCopy} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm">
        <span>Nouvelle version des textes de la page (24/09) : héros, chiffres, méthode, coach, offre et FAQ. Vos réglages de contact et de vidéo sont conservés.</span>
        <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Tout remettre aux textes par défaut</button>
      </form>
      <SiteSettingsForm key={ok ? "reset" : "current"} initial={settings} />
    </main>
  );
}
