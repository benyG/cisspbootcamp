import { PriceSection } from "@/components/landing/PriceSection";
import { Coach, Faq, Footer, Hero, Method, Proof, Testimonials, Topbar, Video, eyebrow, shell } from "@/components/landing/sections";
import { ScannerWizard } from "@/components/scanner/ScannerWizard";
import { TrackView } from "@/components/tracking/TrackView";
import { publicCohortSummary } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { loadRates } from "@/lib/registration";
import { loadScannerContext } from "@/lib/scanner/context";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * The landing (SPECS A1, docs/DESIGN.md). One action above the fold —
 * analyse your profile — and the questionnaire itself on the page, so the
 * visitor is already engaged before changing screens.
 */
export default async function HomePage() {
  // Every read degrades to a sensible default: the landing never goes down
  // because the database blinked (and it is cached anyway).
  const [settings, cohort, context, rates, testimonials] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    publicCohortSummary().catch(() => null),
    loadScannerContext().catch(() => ({ tiers: [], cohort: null, availabilityLabel: "Seriez-vous disponible pour la prochaine cohorte ?" })),
    loadRates().catch(() => ({})),
    prisma.testimonial.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 6 }).catch(() => []),
  ]);

  return (
    <>
      <TrackView name="landing_view" />
      <Topbar />
      <main>
        <Hero settings={settings} cohort={cohort} />

        <section id="evaluation" className={shell + " pb-16 sm:pb-20"}>
          <div className="grid items-start gap-8 lg:grid-cols-[.86fr_1.14fr]">
            <div className="lg:sticky lg:top-6 lg:pt-7">
              <div className={eyebrow}>Analyse de profil</div>
              <h2 className="display my-4 text-[clamp(2.1rem,4vw,4.1rem)] leading-[.98] font-black tracking-[-.05em]">Avant de parler inscription, voyons honnêtement où vous en êtes.</h2>
              <p className="text-[1.04rem] text-ink-2">11 questions, 3 minutes. Votre résultat s’affiche tout de suite : éligibilité ISC², domaines forts et faibles, délai réaliste jusqu’à l’examen. Puis Ben revient vers vous personnellement.</p>
              <ul className="mt-6 grid gap-1">
                {["Prérequis ISC² : expérience et dérogation, calculés pour vous", "Couverture des 8 domaines", "Délai réaliste, avec et sans accompagnement", "La prochaine étape recommandée"].map((l) => (
                  <li key={l} className="relative py-2.5 pl-7 text-ink-2 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{l}</li>
                ))}
              </ul>
            </div>
            <ScannerWizard context={{ tiers: context.tiers, availabilityLabel: context.availabilityLabel }} />
          </div>
        </section>

        <Proof settings={settings} />
        <Method settings={settings} />
        <Testimonials items={testimonials} />
        <Video settings={settings} />
        <Coach settings={settings} />
        <PriceSection settings={settings} tiers={context.tiers} rates={rates} cohort={cohort ? { name: cohort.name, startsAt: cohort.startsAt.toISOString() } : null} />
        <Faq settings={settings} />
      </main>
      <Footer settings={settings} />
    </>
  );
}
