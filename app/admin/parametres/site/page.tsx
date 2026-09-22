import Link from "next/link";

import { loadSiteSettings } from "@/lib/site-settings";

import { SiteSettingsForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  const settings = await loadSiteSettings();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 text-2xl font-bold">Page d&apos;accueil</h1>
      <p className="mt-1 text-sm text-muted">Chaque section s&apos;enregistre séparément et se met en ligne dans la minute. La cohorte, la jauge et les prix viennent de la base, pas d&apos;ici.</p>
      <SiteSettingsForm initial={settings} />
    </main>
  );
}
