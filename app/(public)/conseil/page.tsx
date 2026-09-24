import type { Metadata } from "next";
import Link from "next/link";

import { ServiceCards } from "@/components/consulting/ServiceCards";
import { Footer, Topbar, eyebrow, shell } from "@/components/landing/sections";
import { TrackView } from "@/components/tracking/TrackView";
import { loadServices } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { loadRates } from "@/lib/registration";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Conseil carrière cybersécurité — CISSP Bootcamp",
  description: "Une heure avec un coach CISSP certifié : bilan de carrière, reconversion vers la cyber, choix de certification, mentorat mensuel. Payé à l'avance, réservé en ligne.",
};
export const dynamic = "force-dynamic";

/**
 * The consulting catalogue (docs/OFFRES.md §2): the step for those who are not
 * yet at the bootcamp. Prices by country, one button per service.
 */
export default async function ConsultingPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const [settings, services, tiers, rates] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    loadServices().catch(() => []),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }).catch(() => []),
    loadRates().catch(() => ({})),
  ]);

  return (
    <>
      <TrackView name="service_view" label="catalogue" />
      <Topbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <div className="max-w-[820px] pt-6 sm:pt-10">
          <div className={eyebrow}>Conseil carrière</div>
          <h1 className="display mt-4 text-[clamp(2.2rem,4.4vw,4.4rem)] leading-[.98] font-black tracking-[-.05em]">Une heure avec Ben, pour avancer maintenant.</h1>
          <p className="mt-4 text-[1.08rem] text-ink-2">
            Le bootcamp CISSP s’adresse aux profils déjà expérimentés. Si vous n’y êtes pas encore, ou si vous hésitez sur la route à prendre, une séance de conseil vous donne un plan clair : votre situation, la voie qui vous convient, la première certification, les étapes datées.
          </p>
          <ul className="mt-5 grid gap-1.5 text-ink-2 sm:grid-cols-2">
            {["Vous payez, puis vous choisissez votre créneau (le mercredi soir).", "Visio, en français, avec un plan écrit envoyé après la séance.", "Report gratuit jusqu’à 24 h avant. Remboursé si Ben annule.", "Une heure de conseil est déduite du bootcamp CISSP dans les 90 jours."].map((l) => (
              <li key={l} className="relative py-1.5 pl-7 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{l}</li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          {services.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Les séances de conseil ouvrent bientôt. En attendant, analysez votre profil : c’est gratuit et ça prend 3 minutes.</p>
          ) : (
            <ServiceCards services={services} tiers={tiers.map((tier) => ({ code: tier.code, countries: Array.isArray(tier.countries) ? (tier.countries as string[]) : [] }))} rates={rates} token={t} />
          )}
        </div>

        <section className="mt-14 max-w-[820px] rounded-[22px] border border-line bg-white p-6 shadow-[var(--shadow-panel)]">
          <h2 className="display text-[1.5rem] leading-tight font-black">Vous avez déjà 4 ans d’expérience en sécurité ?</h2>
          <p className="mt-2 text-ink-2">Alors le conseil n’est sans doute pas la bonne marche : le bootcamp CISSP l’est. Trois minutes d’analyse de profil vous le confirment.</p>
          <Link href="/#evaluation" className="mt-4 inline-flex rounded-[14px] border border-line bg-white px-5 py-3 font-extrabold">Analyser mon profil →</Link>
        </section>
      </main>
      <Footer settings={settings} />
    </>
  );
}
