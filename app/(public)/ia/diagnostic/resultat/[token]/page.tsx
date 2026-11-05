import { CheckCircle2, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { btnGhost, btnPrimary, eyebrow, shell } from "@/components/landing/sections";
import { openIaEntries } from "@/lib/ia-days-server";
import { diagnosticByToken } from "@/lib/ia-diagnostic-server";
import { iaPath } from "@/lib/ia-domain";

export const metadata: Metadata = { title: "Votre diagnostic · Bâtisseur IA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The diagnostic result, addressed by its token (never indexed). */
export default async function IaResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [diag, entries] = await Promise.all([diagnosticByToken(token), openIaEntries().catch(() => [])]);
  const hasEntries = entries.length > 0;
  if (!diag) notFound();
  const { result: d, lead } = diag;

  return (
    <>
      <IaTopbar />
      <main className={shell + " grid max-w-[720px] grid-cols-[minmax(0,1fr)] gap-5 pt-2 pb-16"}>
        <div className={eyebrow + " w-fit"}>Votre résultat</div>
        <h1 className="display text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.04] font-black tracking-[-.05em]">
          {lead.firstName ? `${lead.firstName}, v` : "V"}oici ce que votre application fera à votre place.
        </h1>
        <p className="-mt-2 text-ink-2">Vous déclarez <b>{d.hoursPhrase} par semaine</b> sur ces tâches. Dans l’ordre où nous les construirons :</p>
        <ol className="grid gap-2.5">
          {d.priorities.map((p, i) => (
            <li key={p.code} className="flex gap-3 rounded-[18px] border border-line bg-white p-4">
              <span className="display grid size-9 shrink-0 place-items-center rounded-full bg-ink font-black text-white">{i + 1}</span>
              <span><b className="block text-[1.05rem]">{p.title}</b><span className="text-[.92rem] text-muted">{p.how}</span></span>
            </li>
          ))}
        </ol>
        <p className="rounded-[18px] border border-line bg-white p-4 text-ink-2">{d.toolsNote}</p>
        <div className={`flex gap-3 rounded-[18px] p-4 ${d.ready ? "bg-accent-soft text-accent-ink" : "border border-amber-300 bg-amber-50 text-amber-950"}`}>
          {d.ready ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> : <Wrench className="mt-0.5 size-5 shrink-0" aria-hidden />}
          <p>{d.ready ? "Votre aisance avec l’ordinateur suffit : vous démarrez directement à la J1." : "Vous pouvez y aller : avant la J1, une séance d’accueil d’une heure installe les outils avec vous, pour démarrer à égalité avec le groupe."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasEntries ? (
            <Link href={iaPath(`/ia/inscription?t=${token}`)} className={btnPrimary}>Réserver ma place</Link>
          ) : (
            <Link href={iaPath("/ia#programme")} className={btnPrimary}>Voir le programme et le prix</Link>
          )}
          <Link href={iaPath("/ia/diagnostic")} className={btnGhost}>Refaire le diagnostic</Link>
        </div>
        <p className="text-[.85rem] text-muted">Ce résultat vous a aussi été envoyé par e-mail.{hasEntries ? "" : " Nous vous écrivons dès l’ouverture des inscriptions."}</p>
      </main>
      <IaFooter />
    </>
  );
}
