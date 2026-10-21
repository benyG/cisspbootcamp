import { PriceSection } from "@/components/landing/PriceSection";
import { StickyCta } from "@/components/landing/StickyCta";
import { Coach, Faq, FinalCta, Footer, Hero, HowItWorks, LadderStrip, PracticeTest, Testimonials, Topbar, Video, eyebrow, shell } from "@/components/landing/sections";
import { ScannerWizard } from "@/components/scanner/ScannerWizard";
import { TrackView } from "@/components/tracking/TrackView";
import { publicCohortSummary } from "@/lib/cohorts-admin";
import { loadServices } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { loadRates } from "@/lib/registration";
import { loadScannerContext } from "@/lib/scanner/context";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * The landing (docs/LANDING.md): one funnel, visitor → diagnostic → result →
 * registration. The questionnaire sits right under the hero so the visitor
 * acts before changing screens; the other offers (CC, consulting, companies)
 * stay visible in one slim band after the price. Each fact is said once in
 * the hero and once at the price, no more (Ben, 21/10).
 */
export default async function HomePage() {
  // Every read degrades to a sensible default: the landing never goes down
  // because the database blinked (and it is cached anyway).
  const [settings, cohort, context, rates, testimonials, services, ccCohort] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    publicCohortSummary().catch(() => null),
    loadScannerContext().catch(() => ({ tiers: [], cohort: null, availabilityLabel: "Seriez-vous disponible pour la prochaine cohorte ?" })),
    loadRates().catch(() => ({})),
    prisma.testimonial.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 3 }).catch(() => []),
    loadServices().catch(() => []),
    publicCohortSummary("cc").catch(() => null),
  ]);
  const tiers = context.tiers;
  const cohortIso = cohort ? { name: cohort.name, startsAt: cohort.startsAt.toISOString(), gauge: cohort.gauge } : null;

  return (
    <>
      <TrackView name="landing_view" />
      <Topbar />
      <main>
        <Hero settings={settings} cohort={cohort} />

        <section id="evaluation" className={shell + " scroll-mt-4 pb-14 sm:pb-16"}>
          <div className="grid items-start gap-8 lg:grid-cols-[.86fr_1.14fr]">
            <div className="lg:sticky lg:top-6 lg:pt-7">
              <div className={eyebrow}>Diagnostic gratuit</div>
              <h2 className="display my-4 text-[clamp(2rem,3.8vw,3.8rem)] leading-[.98] font-black tracking-[-.05em]">Êtes-vous réellement prêt pour le CISSP ?</h2>
              <p className="text-[1.04rem] font-semibold text-ink-2">3 minutes pour savoir :</p>
              <ul className="mt-3 grid gap-1">
                {["Votre éligibilité ISC²", "Vos domaines à renforcer", "Votre délai réaliste jusqu’à l’examen"].map((l) => (
                  <li key={l} className="relative py-2 pl-7 font-bold text-ink before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{l}</li>
                ))}
              </ul>
              <p className="mt-4 text-[.9rem] text-muted">Puis la prochaine étape qui vous convient.</p>
            </div>
            <ScannerWizard context={{ tiers, availabilityLabel: context.availabilityLabel }} />
          </div>
        </section>

        <HowItWorks settings={settings} />
        <Coach settings={settings} />
        <Testimonials items={testimonials} />
        <Video settings={settings} />
        <PracticeTest />
        <PriceSection settings={settings} tiers={tiers} rates={rates} cohort={cohortIso} />
        <LadderStrip services={services} ccCohort={ccCohort} />
        <Faq settings={settings} />
        <FinalCta cohort={cohort} />
      </main>
      <Footer settings={settings} />
      <StickyCta tiers={tiers} cohortStartsAt={cohortIso?.startsAt ?? null} />
    </>
  );
}
