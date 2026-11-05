import type { Metadata } from "next";
import Link from "next/link";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { BuildScrubber } from "@/components/ia/landing/BuildScrubber";
import { Dock } from "@/components/ia/landing/Dock";
import { IaQuote } from "@/components/ia/landing/IaQuote";
import { LiveSession } from "@/components/ia/landing/LiveSession";
import { TrackView } from "@/components/tracking/TrackView";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { IA_DEFAULT_CAPACITY, IA_DEFAULT_START, IA_ZONE, JOURNEES, journeeSlot, shortDate } from "@/lib/ia-days";
import { openIaEntries } from "@/lib/ia-days-server";
import { iaDomain, iaPath } from "@/lib/ia-domain";
import { DAY_DEMO, DAY_PLAN, IA_FAQ, SITE_LOG } from "@/lib/ia-landing";
import { PROGRAMS } from "@/lib/programs";
import { loadRates } from "@/lib/registration";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

import "./landing.css";

const TITLE = "Bâtisseur IA : le bootcamp pratique pour construire votre application avec l’IA";
const DESCRIPTION = "Formation en direct, en français, le week-end : en 6 journées, construisez vous-même l’application de votre entreprise avec Claude Code. Sans savoir coder.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: iaPath("/ia") },
  // Not the CISSP card when the link is shared on WhatsApp or LinkedIn.
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Bâtisseur IA", type: "website", locale: "fr_FR" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};
export const dynamic = "force-dynamic";

const clock = (d: Date, timeZone: string) => d.toLocaleTimeString("fr-FR", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).replace(":", " h ").replace(" h 00", " h");

/**
 * Bâtisseur IA (Ben, 05/11, from the validated prototype): a hands-on
 * bootcamp, said in the first line. The diagnostic button comes first, then
 * a day hour by hour, the programme, this site's own build log, the price
 * and the next entries.
 */
export default async function IaPage() {
  const program = PROGRAMS.ia;
  const [settings, entries, tiers, prices, rates] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    openIaEntries().then((e) => e.slice(0, 3)).catch(() => []),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }).catch(() => []),
    prisma.programPrice.findMany({ where: { program: "ia" } }).catch(() => []),
    loadRates().catch(() => ({})),
  ]);
  // The day's timetable follows the next entry's start, or the usual start.
  const first = entries[0];
  const slot = journeeSlot(first?.date ?? "2027-01-23", first?.start ?? IA_DEFAULT_START);
  const at = (minutes: number) => clock(new Date(slot.startsAt.getTime() + minutes * 60_000), IA_ZONE);
  const diagnostic = iaPath("/ia/diagnostic");
  const days = JOURNEES.map((j, i) => ({ ...j, ...DAY_DEMO[i] }));

  return (
    <div className="ial">
      <TrackView name="ia_view" />
      <IaTopbar />
      <main>
        <div className="hero">
          <div className="wrap hero-grid">
            <div>
              <div className="kicker"><span>Bootcamp pratique</span><span>en direct</span><span>en français</span></div>
              <h1>Apprenez à construire <em>votre</em> application avec l’IA.</h1>
              <p className="lede">Une formation en direct, en petit groupe, avec {settings.coach.name.split(" ")[0] || "Ben"}. En {program.days} journées, <b>vous construisez vous-même</b> l’application de votre entreprise avec Claude Code, étape par étape, et vous repartez en sachant la faire évoluer. <b>Sans savoir coder.</b></p>
              <ul className="facts">
                <li><b>{program.days}</b> journées de 5 h</li>
                <li><b>{IA_DEFAULT_CAPACITY}</b> places par groupe</li>
                <li>Le week-end, <b>à vos dates</b></li>
                <li><b>30 jours</b> de suivi</li>
              </ul>
              <div className="dig-cta" id="diagnostic">
                <Link className="btn btn-go btn-big" href={diagnostic}>Voir ce que j’apprendrai à automatiser →</Link>
              </div>
            </div>
            <LiveSession journee={{ n: 3, title: JOURNEES[2].title }} />
          </div>
        </div>

        <section className="block" style={{ paddingBottom: 0 }} aria-labelledby="journee-type">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Une journée de formation</span>
              <h2 id="journee-type">Ben montre. Vous construisez. On vérifie ensemble.</h2>
              <p>Chaque journée suit le même rythme : une étape montrée en direct, puis vous la refaites sur votre propre projet, avec Ben pour vous débloquer.</p>
            </div>
            <div className="dayplan">
              {DAY_PLAN.map((s) => (
                <div key={s.at} className={"slot" + (s.kind === "you" ? " you" : s.kind === "pause" ? " pause" : "")}>
                  <time>{at(s.at)}</time>
                  <b>{s.title}</b>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
            <p className="dayplan-note">Heure de Montréal ; de {clock(slot.startsAt, "Africa/Douala")} à {clock(slot.endsAt, "Africa/Douala")} à Douala, de {clock(slot.startsAt, "Africa/Dakar")} à {clock(slot.endsAt, "Africa/Dakar")} à Dakar.</p>
          </div>
        </section>

        <section className="block" aria-labelledby="programme" id="programme">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Le programme</span>
              <h2 id="programme-title">Ce que vous apprenez, et construisez, chaque journée.</h2>
              <p>Votre projet passe du plan à l’application en ligne. En bleu : ce qui reste à construire. En blanc : ce que vous avez déjà construit. Exemple : le projet d’Adjoa, une couturière de Lomé, pendant la formation.</p>
            </div>
            <BuildScrubber days={days} />
          </div>
        </section>

        <section className="block proof" aria-labelledby="preuve">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Notre preuve</span>
              <h2 id="preuve">Ce site est notre chantier. Voici son journal.</h2>
              <p>Il a été construit avec Claude Code par Ben, votre formateur, sans agence. On ne le cache pas : c’est la méthode que la formation vous transmet.</p>
            </div>
            <div className="tallies">
              <div><b>21 sept.</b><span>premier jour en ligne</span></div>
              <div><b>100+</b><span>changements livrés depuis</span></div>
              <div><b>450+</b><span>tests automatiques à chaque livraison</span></div>
              <div><b>0</b><span>agence, 0 développeur salarié</span></div>
            </div>
            <ol className="log">
              {SITE_LOG.map((e) => (
                <li key={e.date} className={e.incident ? "incident" : undefined}>
                  <time dateTime={e.date}>{e.label}</time>
                  <p>{e.text} <span className="stamp">{e.incident ? "réparé" : "livré"}</span></p>
                </li>
              ))}
            </ol>
            <p className="proof-foot">Dates et chiffres tirés de l’historique réel du code de ce site.</p>
          </div>
        </section>

        <section className="block" aria-labelledby="prix">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Le prix de la formation</span>
              <h2 id="prix">Ce que coûte la formation. Tout, sans surprise.</h2>
            </div>
            <div className="quote-grid">
              <IaQuote
                tiers={tiers.map((t) => ({ code: t.code, countries: Array.isArray(t.countries) ? (t.countries as string[]) : [] }))}
                prices={Object.fromEntries(prices.map((p) => [p.tier, { amountUsd: p.amountUsd, installmentUsd: p.installmentUsd }]))}
                rates={rates}
                hours={program.hours}
                days={program.days}
                capacity={IA_DEFAULT_CAPACITY}
              />
              <div>
                <span className="label">Prochains groupes : votre J1</span>
                <div className="open-dates" style={{ marginTop: 10 }}>
                  {entries.length ? entries.map((e) => {
                    const d = new Date(`${e.date}T12:00:00Z`);
                    return (
                      <Link key={e.cohortId} href={iaPath(`/ia/inscription?entree=${e.cohortId}`)} className="date" style={{ textDecoration: "none" }}>
                        <div className="d"><b>{d.getUTCDate()}</b><span>{d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })}</span></div>
                        <p><span className="first-letter:uppercase">{shortDate(e.date)}</span><small>puis vos J2 à J6 aux week-ends suivants</small></p>
                        <span className="left">{e.left} place{e.left > 1 ? "s" : ""}</span>
                      </Link>
                    );
                  }) : <p className="empty">Les prochaines dates arrivent. Faites le diagnostic : Ben vous écrit dès l’ouverture.</p>}
                </div>
                <div className="cta-stack">
                  <Link className="btn btn-go" href={diagnostic}>Faire le diagnostic d’abord</Link>
                  {entries.length > 0 && <Link className="btn btn-line" href={iaPath("/ia/inscription")}>Réserver ma place</Link>}
                </div>
                <p className="note">Carte bancaire, Orange Money, MTN MoMo. Reçu par e-mail.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="block" style={{ paddingTop: 0 }} aria-labelledby="questions">
          <div className="wrap">
            <div className="sec-head"><span className="label">Avant de vous inscrire</span><h2 id="questions">Les questions qu’on nous pose.</h2></div>
            <div className="faq">
              {IA_FAQ.map((f, i) => <details key={f.q} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>)}
              <details>
                <summary>Et pour toute une équipe ?</summary>
                <p>Le Bâtisseur IA existe en groupe réservé, sur site ou en ligne, aux dates de votre entreprise. <Link className="underline" href={iaDomain() ? `${env.NEXT_PUBLIC_APP_URL}/entreprises?formation=ia` : "/entreprises?formation=ia"}>Demander un devis</Link>.</p>
              </details>
            </div>
          </div>
        </section>
        <Dock href={diagnostic} watch="diagnostic" />
      </main>
      <IaFooter coach={settings.coach.name} />
    </div>
  );
}
