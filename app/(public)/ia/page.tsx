import { CalendarDays, Clock, Code2, LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { btnGhost, btnPrimary, eyebrow, shell } from "@/components/landing/sections";
import { ProgramPrice } from "@/components/programs/ProgramPrice";
import { TrackView } from "@/components/tracking/TrackView";
import { prisma } from "@/lib/db";
import { IA_ZONE, JOURNEES, journeeSlot, shortDate } from "@/lib/ia-days";
import { openIaEntries } from "@/lib/ia-days-server";
import { PROGRAMS } from "@/lib/programs";
import { loadRates } from "@/lib/registration";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";
import { iaDomain, iaPath } from "@/lib/ia-domain";
import { env } from "@/lib/env";

const TITLE = "Bâtisseur IA : votre application en ligne en 5 journées, avec Claude Code";
const DESCRIPTION = "Bootcamp en français, le week-end : créez l’application de votre entreprise et automatisez vente, relances, chiffres et comptabilité avec Claude Code. Pas besoin de savoir coder.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: iaPath("/ia") },
  // Not the CISSP card when the link is shared on WhatsApp or LinkedIn.
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Bâtisseur IA", type: "website", locale: "fr_FR" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};
export const dynamic = "force-dynamic";

const POINTS = [
  { icon: Clock, text: "5 journées de 5 h, plus 1 h de pause" },
  { icon: CalendarDays, text: "Le week-end, aux dates de votre choix" },
  { icon: Code2, text: "Pas besoin de savoir coder" },
  { icon: LifeBuoy, text: "30 jours de suivi après la J5" },
];

const clock = (d: Date, timeZone: string) => d.toLocaleTimeString("fr-FR", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).replace(":", " h ").replace(" h 00", " h");

/** Bâtisseur IA (Ben, 03/11): the programme, the next entries, the price. */
export default async function IaPage() {
  const program = PROGRAMS.ia;
  const [settings, entries, tiers, prices, rates] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    openIaEntries().then((e) => e.slice(0, 3)).catch(() => []),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }).catch(() => []),
    prisma.programPrice.findMany({ where: { program: "ia" } }).catch(() => []),
    loadRates().catch(() => ({})),
  ]);
  const slot = entries[0] ? journeeSlot(entries[0].date, entries[0].start) : null;

  return (
    <>
      <TrackView name="ia_view" />
      <IaTopbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <section className="grid items-start gap-8 pt-4 sm:pt-8 lg:grid-cols-[1.15fr_.85fr]">
          <div className="max-w-[720px]">
            <div className={eyebrow}>{program.days} journées le week-end · en français</div>
            <h1 className="display mt-4 text-[clamp(2.1rem,4.4vw,4.2rem)] leading-[.98] font-black tracking-[-.05em]">Vous apportez un besoin. Vous repartez avec votre application en ligne.</h1>
            <p className="mt-4 text-[1.08rem] text-ink-2">Le bootcamp Claude Code pour créer votre produit et automatiser votre entreprise : vente, relances, chiffres, comptabilité. Vous choisissez vos samedis et dimanches.</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 font-semibold text-ink-2"><Icon className="size-[18px] shrink-0 text-accent" aria-hidden />{text}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={iaPath("/ia/diagnostic")} className={btnPrimary}>Faire le diagnostic · 3 min</Link>
              <a href="#programme" className={btnGhost}>Voir le programme</a>
            </div>
            <p className="mt-2 text-[.85rem] text-muted">Gratuit, résultat immédiat.</p>
          </div>

          <div className="rounded-[28px] border border-line bg-white p-6 shadow-[var(--shadow-panel)] lg:sticky lg:top-6">
            <div className={eyebrow}>Prix</div>
            <ProgramPrice program="ia" note="Les 5 journées, les supports et 30 jours de suivi. Abonnement Claude et nom de domaine en plus." tiers={tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] }))} prices={Object.fromEntries(prices.map((p) => [p.tier, p.amountUsd]))} rates={rates} />
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[.78rem] font-extrabold tracking-[.06em] text-muted uppercase">Prochaines entrées (J1)</p>
              {entries.length ? (
                <ul className="mt-2 grid gap-1.5">
                  {entries.map((e) => <li key={e.cohortId} className="flex justify-between gap-3 text-[.95rem]"><span className="font-bold first-letter:uppercase">{shortDate(e.date)}</span><span className="text-muted">{e.left} place{e.left > 1 ? "s" : ""} sur {e.capacity}</span></li>)}
                </ul>
              ) : (
                <p className="mt-2 text-[.95rem] text-ink-2">Les dates arrivent. Faites le diagnostic : Ben vous écrit dès l’ouverture.</p>
              )}
              {slot && <p className="mt-2 text-[.82rem] text-muted">De {clock(slot.startsAt, IA_ZONE)} à {clock(slot.endsAt, IA_ZONE)} heure de Montréal ({clock(slot.startsAt, "Africa/Douala")} à {clock(slot.endsAt, "Africa/Douala")} à Douala).</p>}
            </div>
            {entries.length ? (
              <>
                <Link href={iaPath("/ia/inscription")} className={btnPrimary + " mt-5 w-full"}>Réserver ma place →</Link>
                <p className="mt-3 text-[.82rem] text-muted">Carte bancaire ou mobile money. Place confirmée dès réception du paiement, reçu par e-mail.</p>
              </>
            ) : (
              <Link href={iaPath("/ia/diagnostic")} className={btnPrimary + " mt-5 w-full"}>Faire le diagnostic →</Link>
            )}
          </div>
        </section>

        <section className="mt-16 max-w-[860px] rounded-[22px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
          <div className={eyebrow}>La preuve</div>
          <h2 className="display mt-3 text-[clamp(1.6rem,3vw,2.4rem)] leading-tight font-black tracking-[-.04em]">Ce site a été construit avec Claude Code. Par un coach, pas par une agence.</h2>
          <p className="mt-3 text-ink-2">Analyse de profil, prise de rendez-vous, paiement par carte et mobile money, cohortes, vidéothèque, devis entreprise, back-office : plus de 100 changements depuis septembre 2026, plus de 380 tests automatiques. Le 27 octobre, une panne de la page de rendez-vous a été diagnostiquée, corrigée, testée et remise en ligne le jour même. C’est ce que vous apprendrez à faire pour votre entreprise.</p>
        </section>

        <section id="programme" className="mt-16 scroll-mt-6">
          <div className={eyebrow}>Le programme</div>
          <h2 className="display mt-3 mb-6 max-w-[860px] text-[clamp(1.9rem,3.4vw,3.2rem)] leading-[.98] font-black tracking-[-.05em]">Cinq journées, une application qui grandit chaque jour.</h2>
          <ol className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {JOURNEES.map((j) => (
              <li key={j.n} className="rounded-[18px] border border-line bg-white p-5">
                <div className="text-[.78rem] font-extrabold tracking-[.08em] text-accent uppercase">J{j.n}</div>
                <h3 className="display mt-2 mb-1.5 text-[1.2rem] font-black">{j.title}</h3>
                <p className="text-[.95rem] text-muted">{j.text}</p>
              </li>
            ))}
            <li className="rounded-[18px] border-2 border-ink bg-ink p-5 text-white">
              <div className="text-[.78rem] font-extrabold tracking-[.08em] text-[#7be0c8] uppercase">Votre calendrier</div>
              <h3 className="display mt-2 mb-1.5 text-[1.2rem] font-black">Dans l’ordre, aux week-ends que vous choisissez</h3>
              <p className="text-[.95rem] text-[#cbd5df]">Chaque samedi ou dimanche ouvert porte une journée. Vous entrez par une J1, puis vous choisissez vos J2 à J5 parmi les dates suivantes.</p>
            </li>
          </ol>
        </section>

        <section className="mt-14 grid gap-3.5 sm:grid-cols-2">
          <div className="rounded-[18px] border border-line bg-white p-5">
            <strong className="display block text-[1.4rem] tracking-[-.04em]">À prévoir en plus</strong>
            <p className="mt-1 text-[.95rem] text-muted">Un abonnement Claude pendant le mois : 20 USD (Pro) ou 100 USD (Max, recommandé). Un nom de domaine, environ 10 à 20 USD par an. Le reste démarre avec des offres gratuites.</p>
          </div>
          <div className="rounded-[18px] border border-line bg-white p-5">
            <strong className="display block text-[1.4rem] tracking-[-.04em]">Votre matériel</strong>
            <p className="mt-1 text-[.95rem] text-muted">Un ordinateur portable et une connexion correcte. Claude Code tourne aussi dans le cloud : la session continue même si la connexion coupe.</p>
          </div>
        </section>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line bg-white p-5">
          <p className="text-ink-2"><b className="text-ink">Former une équipe ?</b> Le Bâtisseur IA en groupe réservé, sur site ou en ligne, aux dates de votre entreprise.</p>
          <Link href={iaDomain() ? `${env.NEXT_PUBLIC_APP_URL}/entreprises?formation=ia` : "/entreprises?formation=ia"} className={btnGhost}>Demander un devis</Link>
        </section>
      </main>
      <IaFooter coach={settings.coach.name} />
    </>
  );
}
