import type { Metadata } from "next";
import Link from "next/link";

import { Footer, Topbar, eyebrow, shell } from "@/components/landing/sections";
import { TrackView } from "@/components/tracking/TrackView";
import { loadServices } from "@/lib/consulting";
import { groupByFormat } from "@/lib/services";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Conseil carrière cybersécurité — CISSP Bootcamp",
  description: "Conseil carrière cybersécurité à toutes les étapes, avec un coach CISSP certifié : bilan, évolution vers le management ou le RSSI, repositionnement, reconversion, certifications, mentorat.",
};
export const dynamic = "force-dynamic";

/**
 * The consulting catalogue (docs/OFFRES.md §2): the step for those who are not
 * yet at the bootcamp. Prices by country, one button per service.
 */
export default async function ConsultingPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const [settings, services] = await Promise.all([loadSiteSettings().catch(() => SITE_DEFAULTS), loadServices().catch(() => [])]);
  const formats = groupByFormat(services);
  const tokenParam = t ? `&t=${encodeURIComponent(t)}` : "";

  return (
    <>
      <TrackView name="service_view" label="catalogue" />
      <Topbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <div className="max-w-[820px] pt-6 sm:pt-10">
          <div className={eyebrow}>Conseil carrière</div>
          <h1 className="display mt-4 text-[clamp(2.2rem,4.4vw,4.4rem)] leading-[.98] font-black tracking-[-.05em]">Conseil carrière cybersécurité, à toutes les étapes.</h1>
          <p className="mt-4 text-[1.08rem] text-ink-2">
            Débuter, évoluer, se repositionner : une carrière en cybersécurité se décide plusieurs fois. Une heure avec Ben, et vous repartez avec un plan écrit pour l’étape qui est la vôtre, que vous ayez un an ou quinze ans de métier.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-3">
            {[["Débuter", "Choisir sa voie, sa première certification, son premier poste."], ["Évoluer", "Prendre une équipe, viser le poste de RSSI, passer à la gouvernance."], ["Se repositionner", "Spécialisation, freelance, expatriation, retour après une pause."]].map(([t, d]) => (
              <li key={t} className="rounded-[14px] border border-line bg-white px-4 py-3"><b className="display block">{t}</b><span className="text-[.9rem] text-muted">{d}</span></li>
            ))}
          </ul>
          <ul className="mt-5 grid gap-1.5 text-ink-2 sm:grid-cols-2">
            {["Vous choisissez la durée, puis votre créneau (le mercredi soir) ; la séance et son prix viennent ensuite.", "Visio, en français, avec un plan écrit envoyé après la séance.", "Report gratuit jusqu’à 24 h avant. Remboursé si Ben annule."].map((l) => (
              <li key={l} className="relative py-1.5 pl-7 before:absolute before:left-0 before:font-black before:text-accent before:content-['✓']">{l}</li>
            ))}
          </ul>
        </div>

        <section className="mt-10 rounded-[22px] border-2 border-ink bg-ink p-6 text-white">
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[.78rem] font-extrabold tracking-[.08em] text-[#7be0c8] uppercase">Premier contact · 15 min · gratuit</p>
              <h2 className="display mt-1 text-[1.5rem] leading-tight font-black">Commencez par 15 minutes avec Ben, sans rien payer.</h2>
              <p className="mt-2 text-[.95rem] text-[#cbd5df]">Vous choisissez un créneau, vous validez votre profil en 3 minutes, et Ben arrive à l’appel en sachant à qui il parle. À la fin, vous savez quelle marche prendre.</p>
            </div>
            <Link href="/rdv" className="inline-flex items-center justify-center rounded-[14px] bg-accent-bright px-6 py-4 font-extrabold text-ink">Réserver mon premier contact →</Link>
          </div>
        </section>

        <section className="mt-10 max-w-[820px]">
          <div className={eyebrow}>Consultation approfondie</div>
          <h2 className="display mt-3 text-[1.6rem] leading-tight font-black">Choisissez la durée, puis votre créneau.</h2>
          <p className="mt-2 text-ink-2">Les séances proposées et leur prix s’affichent une fois le créneau retenu ; rien n’est confirmé avant votre analyse de profil et le paiement.</p>
          {formats.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Les séances de conseil ouvrent bientôt. En attendant, le premier contact de 15 minutes est ouvert.</p>
          ) : (
            <ul className="mt-5 grid gap-2">
              {formats.map((f) => (
                <li key={f.key}>
                  <Link href={`/rdv?type=approfondie&format=${f.key}${tokenParam}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-white px-4 py-3.5 shadow-[var(--shadow-card)] hover:border-ink">
                    <span><b className="display block text-lg">{f.label}</b><span className="block text-[.9rem] text-muted">{f.services.join(" · ")}</span></span>
                    <span className="shrink-0 font-black">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-14 max-w-[820px] rounded-[22px] border border-line bg-white p-6 shadow-[var(--shadow-panel)]">
          <h2 className="display text-[1.5rem] leading-tight font-black">Le CISSP fait partie de votre trajectoire ?</h2>
          <p className="mt-2 text-ink-2">Le bootcamp et le conseil se complètent : l’un prépare l’examen, l’autre la carrière. Si vous rejoignez le bootcamp dans les 90 jours qui suivent une séance, cette heure vous est déduite.</p>
          <Link href="/#evaluation" className="mt-4 inline-flex rounded-[14px] border border-line bg-white px-5 py-3 font-extrabold">Analyser mon profil CISSP →</Link>
        </section>
      </main>
      <Footer settings={settings} />
    </>
  );
}
