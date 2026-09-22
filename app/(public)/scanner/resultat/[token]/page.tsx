import Link from "next/link";
import { notFound } from "next/navigation";

import { btnPrimary, eyebrow, shell } from "@/components/landing/sections";
import type { ProfileAnalysis } from "@/lib/analysis";
import { prospectAxes } from "@/lib/analysis";
import { prisma } from "@/lib/db";

import { RevealBars } from "./reveal";

export const dynamic = "force-dynamic";

const VERDICT = {
  ready: { badge: "Profil prêt", tone: "bg-accent-soft text-accent-ink" },
  conditional: { badge: "Prêt sous conditions", tone: "bg-amber-100 text-amber-900" },
  not_yet: { badge: "Construisons votre éligibilité", tone: "bg-slate-100 text-ink-2" },
} as const;

/**
 * The prospect's result, shown the moment the questionnaire is submitted and
 * reachable by token afterwards (the e-mail links here). The sales follow-up
 * Ben validates is a separate message; it never gates this page.
 */
export default async function ScannerResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await prisma.scannerResponse.findUnique({
    where: { resultToken: token },
    include: { lead: { select: { firstName: true } } },
  });
  if (!response) notFound();

  const analysis = response.analysis as unknown as ProfileAnalysis;
  const axes = prospectAxes(analysis.axes);
  const verdict = VERDICT[analysis.readiness];
  const canBook = analysis.recommendation !== "build_first";

  return (
    <main className={shell + " py-8 sm:py-12"}>
      <div className="mx-auto max-w-2xl">
        <span className={`inline-flex rounded-full px-3 py-1.5 text-[.82rem] font-extrabold ${verdict.tone}`}>{verdict.badge}</span>
        <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.8rem)] leading-[.98] font-black tracking-[-.05em]">
          {response.lead.firstName}, {analysis.headline.charAt(0).toLowerCase() + analysis.headline.slice(1)}
        </h1>

        <RevealBars axes={axes.map((a) => ({ key: a.key, label: a.label, score: a.score, detail: a.detail }))} />

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] bg-ink p-5 text-white">
            <div className="text-[.72rem] font-extrabold tracking-[.1em] text-[#7be0c8] uppercase">Avec accompagnement</div>
            <div className="display mt-1 text-[2.4rem] leading-none font-black tracking-[-.04em]">{analysis.timeline.label}</div>
            <p className="mt-2 text-[.9rem] text-[#cbd5df]">jusqu’à l’examen, avec quelqu’un qui tient le rythme avec vous.</p>
          </div>
          <div className="rounded-[18px] border border-line bg-white p-5">
            <div className="text-[.72rem] font-extrabold tracking-[.1em] text-muted uppercase">Seul</div>
            <div className="display mt-1 text-[2.4rem] leading-none font-black tracking-[-.04em] text-muted">{analysis.timeline.soloLabel}</div>
            <p className="mt-2 text-[.9rem] text-muted">d’après ce que Ben observe chez les candidats qui préparent sans cadre.</p>
          </div>
        </section>
        {analysis.goalIsTight && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[.92rem] text-amber-900">Votre objectif de date est plus serré que cette estimation. Il reste jouable, à condition d’attaquer les domaines non couverts dès la première semaine.</p>
        )}

        <section className="mt-8">
          <div className={eyebrow}>Ce qu’il faut en retenir</div>
          <ul className="mt-4 grid gap-3">
            {analysis.axes.filter((a) => a.audience === "prospect").map((a) => (
              <li key={a.key} className="rounded-[14px] border border-line bg-white px-4 py-3 text-ink-2"><b className="text-ink">{a.label}</b> — {a.detail}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-[22px] border border-line bg-white p-6 shadow-[var(--shadow-panel)]">
          <h2 className="display text-[1.6rem] leading-tight font-black">{canBook ? "Prochaine étape : 15 minutes avec Ben." : "Prochaine étape : construire votre éligibilité."}</h2>
          <p className="mt-2 text-ink-2">
            {canBook
              ? "Un appel vidéo, sans engagement, pour vérifier que le format vous convient et fixer votre date d’examen."
              : "Ben vous envoie de quoi avancer dès maintenant et revient vers vous dans six mois. Si votre situation change avant, écrivez-lui."}
          </p>
          {canBook ? (
            <Link href={`/rdv?t=${token}`} className={btnPrimary + " mt-5 w-full"}>Réserver mon appel →</Link>
          ) : (
            <Link href="/" className={btnPrimary + " mt-5 w-full"}>Retour à l’accueil</Link>
          )}
          <p className="mt-3 text-[.86rem] text-muted">Cette analyse vous a aussi été envoyée par e-mail. Ben la lit et vous écrit personnellement.</p>
        </section>
      </div>
    </main>
  );
}
