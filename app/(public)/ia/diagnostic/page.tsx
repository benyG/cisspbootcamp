import type { Metadata } from "next";

import { Diagnostic } from "@/components/ia/Diagnostic";
import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { eyebrow, shell } from "@/components/landing/sections";
import { COUNTRIES } from "@/lib/scanner/questions";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Diagnostic d’automatisation · Bâtisseur IA",
  description: "Cinq questions, trois minutes : les trois automatisations que votre application peut prendre en charge en premier.",
  alternates: { canonical: "/ia/diagnostic" },
  openGraph: { title: "Diagnostic d’automatisation · Bâtisseur IA", description: "Cinq questions, trois minutes : les trois automatisations que votre application peut prendre en charge en premier.", siteName: "Bâtisseur IA", type: "website", locale: "fr_FR" },
  twitter: { card: "summary_large_image", title: "Diagnostic d’automatisation · Bâtisseur IA" },
};

/** The automation diagnostic (Ben, 03/11): rules only, result on screen and by e-mail. */
export default async function IaDiagnosticPage() {
  const settings = await loadSiteSettings().catch(() => SITE_DEFAULTS);
  return (
    <>
      <IaTopbar />
      <main className={shell + " grid max-w-[640px] gap-5 pt-2 pb-16"}>
        <div className={eyebrow + " w-fit"}>Diagnostic d’automatisation · 3 min</div>
        <h1 className="display text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] font-black tracking-[-.05em]">Ce que votre application peut faire à votre place.</h1>
        <p className="-mt-2 text-ink-2">Cinq questions. Le résultat est calculé par des règles simples, sans IA et sans gain promis.</p>
        <Diagnostic countries={COUNTRIES} />
      </main>
      <IaFooter coach={settings.coach.name} />
    </>
  );
}
