import type { Metadata } from "next";

import { Diagnostic } from "@/components/ia/Diagnostic";
import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { eyebrow, shell } from "@/components/landing/sections";
import { COUNTRIES } from "@/lib/scanner/questions";
import { iaPath } from "@/lib/ia-domain";

const DESCRIPTION = "Cinq questions, trois minutes : où en est l’autonomie de votre entreprise, ou de votre projet, et les trois tâches à mettre en pilote automatique d’abord.";

export const metadata: Metadata = {
  title: "Diagnostic d’autonomie · Bâtisseur IA",
  description: DESCRIPTION,
  alternates: { canonical: iaPath("/ia/diagnostic") },
  openGraph: { title: "Diagnostic d’autonomie · Bâtisseur IA", description: DESCRIPTION, siteName: "Bâtisseur IA", type: "website", locale: "fr_FR" },
  twitter: { card: "summary_large_image", title: "Diagnostic d’autonomie · Bâtisseur IA" },
};

/** The autonomy diagnostic (Ben, 03/11; 08/11): rules only, result on screen and by e-mail. */
export default async function IaDiagnosticPage() {
  return (
    <>
      <IaTopbar />
      <main className={shell + " grid max-w-[640px] grid-cols-[minmax(0,1fr)] gap-5 pt-2 pb-16"}>
        <div className={eyebrow + " w-fit"}>Diagnostic d’autonomie · 3 min</div>
        <h1 className="display text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] font-black tracking-[-.05em]">Où en est l’autonomie de votre entreprise ?</h1>
        <p className="-mt-2 text-ink-2">Cinq questions, pour une activité ou un projet. Le résultat est calculé par des règles simples, sans IA et sans gain promis.</p>
        <Diagnostic countries={COUNTRIES} />
      </main>
      <IaFooter />
    </>
  );
}
