import type { Metadata } from "next";
import Link from "next/link";

import { CohortGauge } from "@/components/cohorts/CohortGauge";
import { AdmissionCountdown } from "@/components/offer/AdmissionCountdown";
import { Footer, Topbar, btnPrimary, eyebrow, shell } from "@/components/landing/sections";
import { ProgramPrice } from "@/components/programs/ProgramPrice";
import { TrackLink } from "@/components/tracking/TrackLink";
import { TrackView } from "@/components/tracking/TrackView";
import { admissionClosesAt, formatAdmissionDeadline, formatCohortMonth } from "@/lib/cohorts";
import { publicCohortSummary } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { CC_DOMAINS, PROGRAMS } from "@/lib/programs";
import { loadRates } from "@/lib/registration";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "15 jours pour votre première certification (CC d’ISC²) — CISSP Bootcamp",
  description: "Formation en français à la certification Certified in Cybersecurity d’ISC² : 10 h de sessions live sur 15 jours avec un coach CISSP certifié. Aucun prérequis.",
};
export const dynamic = "force-dynamic";

/**
 * The entry step (docs/OFFRES.md §3): the ISC² CC course for people with
 * little or no experience. Same structure as the bootcamp offer — cohort,
 * gauge, price by country, admission deadline — one level down.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const [settings, cohort, tiers, prices, rates] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    publicCohortSummary("cc").catch(() => null),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }).catch(() => []),
    prisma.programPrice.findMany({ where: { program: "cc" } }).catch(() => []),
    loadRates().catch(() => ({})),
  ]);
  const program = PROGRAMS.cc;
  const register = `/demarrer/inscription${t ? `?t=${t}` : ""}`;

  return (
    <>
      <TrackView name="program_view" label="cc" />
      <Topbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <section className="grid items-start gap-8 pt-6 sm:pt-10 lg:grid-cols-[1.15fr_.85fr]">
          <div className="max-w-[720px]">
            <div className={eyebrow}>Débuter · Certification CC d’ISC²</div>
            <h1 className="display mt-4 text-[clamp(2.2rem,4.4vw,4.4rem)] leading-[.98] font-black tracking-[-.05em]">15 jours pour votre première certification en cybersécurité.</h1>
            <p className="mt-4 text-[1.08rem] text-ink-2">
              La <b>Certified in Cybersecurity (CC)</b> est la certification d’entrée d’ISC², la maison du CISSP. Aucun prérequis d’expérience, un examen reconnu partout, et une préparation qui tient en {program.hours} heures de sessions live, en français, avec un coach CISSP certifié.
            </p>
            <ul className="mt-5 grid gap-1.5 text-ink-2">
              {[
                `${program.hours} h de sessions live sur ${program.days} jours, soirs et week-end, en français`,
                "Les 5 domaines de l’examen, avec des questions d’entraînement corrigées à chaque session",
                "Un plan de révision jusqu’à votre date d’examen, et le coach joignable entre les sessions",
                "Votre première marche chez ISC² : la même méthode vous mènera au CISSP quand l’expérience sera là",
              ].map((l) => <li key={l} className="relative py-1.5 pl-7 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{l}</li>)}
            </ul>
            <p className="mt-4 text-[.9rem] text-muted">{program.examNote}</p>
          </div>

          <div className="rounded-[28px] border border-line bg-white p-6 shadow-[var(--shadow-panel)] lg:sticky lg:top-6">
            {cohort ? (
              <>
                <div className={eyebrow}><span className="rounded-full border border-accent/10 bg-accent/10 px-2.5 py-1.5 tracking-[.1em] text-accent">Session</span><span>{formatCohortMonth(cohort.startsAt)}</span></div>
                <ProgramPrice tiers={tiers.map((tier) => ({ code: tier.code, countries: Array.isArray(tier.countries) ? (tier.countries as string[]) : [] }))} prices={Object.fromEntries(prices.map((p) => [p.tier, p.amountUsd]))} rates={rates} />
                <div className="mt-4 rounded-xl border border-line bg-[#fbfffd] px-3.5 py-2.5">
                  <div className="text-[.72rem] font-extrabold tracking-[.08em] text-muted uppercase">Admissions jusqu’au {formatAdmissionDeadline(cohort.startsAt)}</div>
                  <div className="mt-1"><AdmissionCountdown closesAt={admissionClosesAt(cohort.startsAt).toISOString()} /></div>
                </div>
                <div className="mt-4"><CohortGauge gauge={cohort.gauge} /></div>
                <TrackLink href={register} event="cta_click" label="demarrer-inscription" className={btnPrimary + " mt-5 w-full"}>Réserver ma place →</TrackLink>
                <p className="mt-3 text-[.82rem] text-muted">Carte bancaire ou mobile money. Place confirmée dès réception du paiement, reçu par e-mail.</p>
              </>
            ) : (
              <>
                <p className="display text-[1.4rem] leading-tight font-black">Prochaine session en préparation.</p>
                <p className="mt-2 text-ink-2">Les dates arrivent. En attendant, une heure de conseil avec Ben vous dit si la CC est la bonne première marche pour vous.</p>
                <Link href="/conseil/certif" className={btnPrimary + " mt-5 w-full"}>Choisir ma certification avec Ben →</Link>
              </>
            )}
          </div>
        </section>

        <section className="mt-16">
          <div className={eyebrow}>Le programme</div>
          <h2 className="display mt-3 mb-6 max-w-[860px] text-[clamp(1.9rem,3.4vw,3.2rem)] leading-[.98] font-black tracking-[-.05em]">Les cinq domaines de l’examen, dans l’ordre d’ISC².</h2>
          <ol className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {CC_DOMAINS.map((d, i) => (
              <li key={d.title} className="rounded-[18px] border border-line bg-white p-5">
                <div className="text-[.78rem] font-extrabold tracking-[.08em] text-accent uppercase">Domaine {i + 1} · {d.weight} de l’examen</div>
                <h3 className="display mt-2.5 mb-2 text-[1.2rem] font-black">{d.title}</h3>
                <p className="text-[.95rem] text-muted">{d.text}</p>
              </li>
            ))}
            <li className="rounded-[18px] border-2 border-ink bg-ink p-5 text-white">
              <div className="text-[.78rem] font-extrabold tracking-[.08em] text-[#7be0c8] uppercase">Session finale</div>
              <h3 className="display mt-2.5 mb-2 text-[1.2rem] font-black">Examen blanc et plan jusqu’au jour J</h3>
              <p className="text-[.95rem] text-[#cbd5df]">Un examen blanc complet, corrigé ensemble, puis votre plan de révision daté et la marche à suivre pour réserver l’examen chez ISC².</p>
            </li>
          </ol>
        </section>

        <section className="mt-14 grid gap-3.5 sm:grid-cols-2">
          <div className="rounded-[18px] border border-line bg-white p-5">
            <strong className="display block text-[1.6rem] tracking-[-.04em]">Pour qui</strong>
            <p className="text-[.95rem] text-muted">Étudiants, professionnels de l’IT qui veulent passer côté sécurité, personnes en reconversion : la CC ne demande aucune expérience, seulement 15 jours d’attention.</p>
          </div>
          <div className="rounded-[18px] border border-line bg-white p-5">
            <strong className="display block text-[1.6rem] tracking-[-.04em]">Et après</strong>
            <p className="text-[.95rem] text-muted">La CC est reconnue par les employeurs comme preuve de bases solides. Avec l’expérience, la suite s’appelle SSCP puis CISSP, et vous connaissez déjà le coach.</p>
          </div>
        </section>

        <section className="mt-14 max-w-[820px] rounded-[22px] border border-line bg-white p-6 shadow-[var(--shadow-panel)]">
          <h2 className="display text-[1.5rem] leading-tight font-black">Vous hésitez entre la CC et autre chose ?</h2>
          <p className="mt-2 text-ink-2">Trois minutes d’analyse de profil vous disent où vous en êtes. Et si vous préférez en parler, une heure de conseil avec Ben choisit la certification avec vous.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/#evaluation" className="inline-flex rounded-[14px] border border-line bg-white px-5 py-3 font-extrabold">Analyser mon profil →</Link>
            <Link href="/conseil/certif" className="inline-flex rounded-[14px] border border-line bg-white px-5 py-3 font-extrabold">Choisir ma certification avec Ben →</Link>
          </div>
        </section>
      </main>
      <Footer settings={settings} />
    </>
  );
}
