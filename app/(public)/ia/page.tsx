import type { Metadata } from "next";
import Link from "next/link";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { BuildScrubber } from "@/components/ia/landing/BuildScrubber";
import { Dock } from "@/components/ia/landing/Dock";
import { IaQuote } from "@/components/ia/landing/IaQuote";
import { AutopilotConsole } from "@/components/ia/landing/AutopilotConsole";
import { TrackView } from "@/components/tracking/TrackView";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { IA_DEFAULT_CAPACITY, IA_DEFAULT_START, IA_ZONE, JOURNEES, journeeSlot, shortDate } from "@/lib/ia-days";
import { openIaEntries } from "@/lib/ia-days-server";
import { iaDomain, iaPath } from "@/lib/ia-domain";
import { AUTONOMY_LEVELS, DAY_DEMO, DAY_PLAN, GARTNER, IA_FAQ, SITE_RUNS } from "@/lib/ia-landing";
import { PROGRAMS } from "@/lib/programs";
import { loadRates } from "@/lib/registration";

import { IA_COMPANY } from "@/lib/ia-brand";
import "./landing.css";

const TITLE = "Bâtisseur IA : bâtissez votre entreprise autonome avec l’IA";
const DESCRIPTION = "Formation bootcamp en direct, en français, le week-end : en 6 journées, construisez vous-même le système qui fait tourner votre entreprise. Sans savoir coder.";
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
 * Bâtisseur IA (Ben, 05/11; repositioned 08/11 on the autonomous business,
 * from the validated prototype): a bootcamp where people build the system
 * that runs their business. Booking a seat is the main action everywhere;
 * the diagnostic is offered to those who hesitate. Then a day hour by hour,
 * the programme, what an autonomous business is, our own site as proof,
 * the price and the next entries.
 */
export default async function IaPage() {
  const program = PROGRAMS.ia;
  const [entries, tiers, prices, rates] = await Promise.all([
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
  // The main action: book the next group; with no open date, hear about the next one through the diagnostic.
  const book = first ? iaPath(`/ia/inscription?entree=${first.cohortId}`) : diagnostic;
  const bookLabel = first ? "Réserver ma place" : "Recevoir la prochaine date";
  const firstDay = first ? shortDate(first.date) : "";
  const days = JOURNEES.map((j, i) => ({ ...j, ...DAY_DEMO[i] }));

  return (
    <div className="ial">
      <TrackView name="ia_view" />
      <IaTopbar />
      <main>
        <div className="hero">
          <div className="wrap hero-grid">
            <div>
              <div className="kicker"><span>Formation bootcamp</span><span>en direct</span><span>en français</span></div>
              <h1>Bâtissez votre entreprise <em>autonome</em> avec l’IA.</h1>
              <p className="lede">Une formation {IA_COMPANY}. En {program.days} journées, <b>vous construisez vous-même le système qui fait tourner votre entreprise</b> : il vend, encaisse, communique et vous alerte. Vous gardez les commandes. <b>Sans savoir coder.</b></p>
              <ul className="facts">
                <li><b>{program.days}</b> journées de 5 h</li>
                <li><b>{IA_DEFAULT_CAPACITY}</b> places par groupe</li>
                <li>Le week-end, <b>à vos dates</b></li>
                <li><b>30 jours</b> de suivi</li>
              </ul>
              <div className="hero-cta" id="reserver">
                <Link className="btn btn-go btn-big" href={book}>{bookLabel} →</Link>
                {first && <span className="next-group">Prochain groupe : {firstDay} · <b>{first.left} place{first.left > 1 ? "s" : ""} sur {first.capacity}</b></span>}
                <p className="soft">Vous hésitez encore ? <Link href={diagnostic}>Mesurez l’autonomie de votre entreprise</Link> en 3 minutes.</p>
              </div>
            </div>
            <AutopilotConsole />
          </div>
        </div>

        <div className="audiences" aria-label="Pour qui">
          <div className="wrap">
            <p><b>Vous avez une activité</b><span>Elle tourne sans vous à chaque étape.</span></p>
            <p><b>Vous lancez la vôtre</b><span>Elle démarre déjà organisée.</span></p>
          </div>
        </div>

        <section className="block" style={{ paddingBottom: 0 }} aria-labelledby="journee-type">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Une journée de formation</span>
              <h2 id="journee-type">On vous montre. Vous construisez. On vérifie ensemble.</h2>
              <p>Une étape montrée en direct, puis vous la refaites sur votre projet, avec quelqu’un pour vous débloquer.</p>
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

        <section className="block" aria-labelledby="programme-title" id="programme">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Le programme</span>
              <h2 id="programme-title">Chaque journée, une fonction de plus tourne seule.</h2>
              <p>En bleu : ce qui reste à construire. En blanc : ce qui tourne déjà.</p>
            </div>
            <BuildScrubber days={days} />
            <div className="again"><Link className="btn btn-go" href={book}>{bookLabel}</Link>{first && <span className="next-group">Démarrage le {firstDay}</span>}</div>
          </div>
        </section>

        <section className="block" style={{ paddingTop: 0 }} aria-labelledby="autonome">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">L’entreprise autonome</span>
              <h2 id="autonome">Elle agit seule. Vous décidez.</h2>
            </div>
            <div className="autonomy">
              <div>
                <blockquote>{GARTNER.text}</blockquote>
                <cite>{GARTNER.source} · <a href={GARTNER.url} target="_blank" rel="noopener">gartner.com</a> · traduction libre</cite>
              </div>
              <div className="levels" aria-label="Trois niveaux d’autonomie">
                {AUTONOMY_LEVELS.map((l, i) => <div key={l.name} className={`l${i + 1}`}><b>{l.name}</b><span>{l.text}</span></div>)}
              </div>
            </div>
            <div className="hesitate" id="diagnostic">
              <p>Où en est votre entreprise, ou votre projet ?<span>5 questions, 3 minutes : votre niveau et les 3 tâches à automatiser d’abord.</span></p>
              <Link className="btn btn-line" href={diagnostic}>Faire le diagnostic gratuit</Link>
            </div>
          </div>
        </section>

        <section className="block proof" aria-labelledby="preuve">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Notre preuve</span>
              <h2 id="preuve">Notre propre entreprise tourne déjà ainsi.</h2>
              <p>Ce site a été construit avec Claude Code par l’équipe qui vous forme, sans agence. Il pilote seul nos cohortes.</p>
            </div>
            <div className="tallies">
              <div><b>21 sept.</b><span>premier jour en ligne</span></div>
              <div><b>120+</b><span>changements livrés depuis</span></div>
              <div><b>500+</b><span>tests automatiques à chaque livraison</span></div>
              <div><b>0</b><span>agence, 0 développeur salarié</span></div>
            </div>
            <div className="runs">
              <div><h3>Il fait seul</h3><ul>{SITE_RUNS.alone.map((t) => <li key={t}>{t}</li>)}</ul></div>
              <div className="hand"><h3>Il nous laisse</h3><ul>{SITE_RUNS.ours.map((t) => <li key={t}>{t}</li>)}</ul></div>
            </div>
            <p className="proof-foot">Chiffres tirés de l’historique réel du code de ce site.</p>
          </div>
        </section>

        <section className="block" aria-labelledby="prix">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Prix et prochains groupes</span>
              <h2 id="prix">Choisissez votre J1. Réservez votre place.</h2>
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
                  }) : <p className="empty">Les prochaines dates arrivent. Faites le diagnostic : nous vous écrivons dès l’ouverture.</p>}
                </div>
                <div className="cta-stack">
                  <Link className="btn btn-go" href={entries.length ? iaPath("/ia/inscription") : diagnostic}>{bookLabel}</Link>
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
        <Dock href={book} watch="reserver" title={first ? `Groupe du ${firstDay.replace(/^\S+ /, "")}` : "Prochaine date"} sub={first ? `${first.left} place${first.left > 1 ? "s" : ""} sur ${first.capacity}` : "Annoncée par e-mail"} action={first ? "Réserver" : "Recevoir"} />
      </main>
      <IaFooter />
    </div>
  );
}
