import { Building2, CalendarRange, Clock, Languages, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";

import { QuoteForm } from "@/components/entreprises/QuoteForm";
import { Footer, Topbar, eyebrow, shell } from "@/components/landing/sections";
import { TrackView } from "@/components/tracking/TrackView";
import { ANSWER_DELAY, MIN_TEAM } from "@/lib/quotes";
import { COUNTRIES } from "@/lib/scanner/questions";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Formation CISSP pour les entreprises · CISSP Bootcamp",
  description: "Formez votre équipe au CISSP ou au CC, sur site ou en ligne, en français. Demandez un devis.",
  alternates: { canonical: "/entreprises" },
};

export const dynamic = "force-dynamic";

const POINTS = [
  { icon: MapPin, title: "Sur site ou en ligne", text: "Dans vos locaux, en visioconférence, ou les deux." },
  { icon: Users, title: `À partir de ${MIN_TEAM} personnes`, text: "Une session réservée à vos collaborateurs." },
  { icon: CalendarRange, title: "Votre calendrier", text: "Des dates et un rythme adaptés à vos équipes." },
  { icon: Languages, title: "En français", text: "Le vocabulaire anglais de l'examen travaillé au fil des sessions." },
];

/** Companies training a team (Ben, 21/10): what we offer, then the quote form. */
export default async function CompaniesPage() {
  const settings = await loadSiteSettings().catch(() => SITE_DEFAULTS);
  return (
    <>
      <TrackView name="company_view" />
      <Topbar />
      <main className={shell + " grid gap-8 pt-4 pb-16 lg:grid-cols-[.9fr_1.1fr] lg:items-start"}>
        <div className="grid gap-5 lg:sticky lg:top-6">
          <div className={eyebrow}><Building2 className="size-4 shrink-0 text-accent" aria-hidden />Entreprises</div>
          <h1 className="display text-[clamp(2.1rem,4.6vw,4rem)] leading-[.98] font-black tracking-[-.05em]">Formez votre équipe au CISSP.</h1>
          <p className="max-w-[560px] text-[1.05rem] font-semibold text-ink-2">Une préparation réservée à vos collaborateurs, guidée par {settings.coach.name}, coach CISSP certifié : les 8 domaines, le raisonnement de l&apos;examen et un plan jusqu&apos;au jour J. Ou la certification CC pour les profils qui débutent.</p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 rounded-[16px] border border-line bg-white p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink"><Icon className="size-[18px]" aria-hidden /></span>
                <span><b className="block">{title}</b><span className="text-[.9rem] text-muted">{text}</span></span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-[.92rem] font-bold text-ink-2"><Clock className="size-4 text-accent" aria-hidden />Réponse de Ben sous {ANSWER_DELAY}.</p>
        </div>
        <div className="grid gap-3">
          <h2 className="display text-[1.5rem] font-black tracking-[-.03em]">Demander un devis</h2>
          <QuoteForm countries={COUNTRIES} />
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}
