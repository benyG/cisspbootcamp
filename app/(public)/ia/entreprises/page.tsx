import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { Catalogue } from "@/components/ia/entreprises/Catalogue";
import { Ladder, type LadderStep } from "@/components/ia/entreprises/Ladder";
import { ProcessMap } from "@/components/ia/entreprises/ProcessMap";
import { HostingModes, type SovereignCard, SovereignOffers } from "@/components/ia/entreprises/Sovereign";
import { ZoneProvider } from "@/components/ia/entreprises/zone";
import { RequestForm } from "@/components/ia/entreprises/RequestForm";
import { Dock } from "@/components/ia/landing/Dock";
import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { TrackView } from "@/components/tracking/TrackView";
import { SOVEREIGN_NAME, type Zone, priceLabel } from "@/lib/enterprise";
import { loadOffer, zoneOf } from "@/lib/enterprise-server";
import { iaPath } from "@/lib/ia-domain";
import { COUNTRIES } from "@/lib/scanner/questions";

import "../landing.css";
import "./entreprises.css";

const TITLE = "Bâtisseur IA Entreprises : vos processus tournent avec l’IA";
const DESCRIPTION = "Diagnostic, pilote, déploiement et suivi : nous mettons l’IA au travail dans votre entreprise, un processus après l’autre, mesuré, avec un interrupteur sur chaque automatisation. Et si vos données doivent rester chez vous, nous installons l’IA dans vos locaux.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: iaPath("/ia/entreprises") },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Bâtisseur IA", type: "website", locale: "fr_FR" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};
export const dynamic = "force-dynamic";

const PAINS = [
  ["Les mêmes questions", "Prix, délais, disponibilités : répondues une à une, souvent tard le soir."],
  ["Les relances oubliées", "Un devis envoyé, puis plus rien. Le client signe ailleurs."],
  ["Les documents à ressaisir", "Factures, bons de commande, pièces : tapés à la main dans le tableur."],
  ["Les chiffres en retard", "Le point du mois arrive le 15, quand il est trop tard pour agir."],
];

const GUARDS = [
  ["Validation humaine", "Avant ce qui part vers un client, tout paiement, toute décision sur une personne."],
  ["Arrêt général et interrupteurs", "Tout s’arrête en un clic ; le processus manuel reprend."],
  ["Plafonds", "Budget IA et messagerie mensuel, alerte à 80 % et 100 %."],
  ["Journal", "Chaque action notée ; chaque connecteur n’accède qu’au nécessaire."],
  ["Données personnelles", "Déclarations faites, transferts analysés, données réduites au nécessaire."],
  ["À vous", "Comptes, clés, code et documentation à votre nom. Aucune dépendance à nous."],
  ["Dans vos locaux", "En mode privé et souverain, le modèle, vos données et le journal ne quittent pas votre réseau."],
];

const SWITCHES: Array<[string, string, boolean]> = [
  ["Agent WhatsApp", "Répond depuis vos documents", true],
  ["Relances de devis", "J+3 et J+7, au plus 2 par semaine", true],
  ["Lecture des factures", "Chaque ligne validée par la comptable", true],
  ["Rapport du lundi", "Envoyé à la direction", false],
];

const RUNS: Array<[string, "auto" | "assist" | "manual"]> = [
  ["Cohortes suivies face à leur objectif", "auto"],
  ["Paiements commencés relancés", "auto"],
  ["Reçus numérotés, export comptable", "auto"],
  ["Publications de la semaine", "assist"],
  ["Prix, dates, appels", "manual"],
];
const LEVEL = { auto: "Autonome", assist: "Assisté", manual: "Manuel" } as const;

const FAQ = [
  ["Nos données partent-elles à l’étranger ?", "Pas si vous ne le voulez pas. Avec l’IA privée et souveraine, le modèle est installé dans vos locaux et rien ne sort. Avec les modèles hébergés, c’est un transfert encadré par la loi de votre pays : données réduites au nécessaire, déclarations à l’autorité (ARTCI, CDP, APDP), et rien de sensible sans base légale."],
  ["Un modèle installé chez nous est-il aussi bon ?", "Il est très bon sur des tâches cadrées : répondre depuis vos documents, résumer, classer, extraire. Il reste en retrait des meilleurs modèles hébergés sur le raisonnement complexe. C’est pourquoi l’étude le teste sur vos propres documents avant tout achat de matériel."],
  ["Que se passe-t-il pendant une coupure de courant ?", "Le serveur est protégé par un onduleur et redémarre seul. Pendant une coupure, le travail manuel reprend, comme avec n’importe quel interrupteur du système."],
  ["Qui paie les coûts d’IA et de WhatsApp ?", "Vous, directement, sur vos propres comptes, avec un plafond mensuel et une alerte avant de l’atteindre. Nous ne refacturons rien et vous voyez chaque dépense."],
  ["Et si le pilote ne donne rien ?", "Les indicateurs sont fixés avant de commencer. À J14, un point d’arrêt : si la piste ne tient pas, on change de processus ou on arrête. À J30, vous décidez sur des mesures, pas sur une impression."],
  ["Le système nous appartient-il ?", "Oui : comptes, clés, code, documentation et, en mode souverain, le serveur lui-même, acheté à votre nom. Vous pouvez continuer seul, avec votre équipe formée, ou avec nous en suivi mensuel."],
  ["Intervenez-vous sur place ?", "Le suivi se fait à distance, avec un accès que vous ouvrez et fermez. Si vous le souhaitez, nous nous déplaçons : le déplacement est facturé à part, sur devis accepté avant."],
  ["Faut-il un informaticien chez nous ?", "Non. Il faut une personne référente qui connaît le métier. Nous la formons pour qu’elle suive et fasse évoluer le système."],
  ["Quelle différence avec la formation Bâtisseur IA ?", "La formation vous apprend à construire vous-même, en 6 journées. L’accompagnement le construit avec vous, dans votre entreprise, et s’engage sur un résultat mesuré."],
];

/**
 * Bâtisseur IA Entreprises (Ben, 22/11, from the validated prototype): the
 * done-with-you offer for companies. The ladder's prices come from the
 * catalogue Ben edits in the admin, in the visitor's zone; the one action
 * is a free 30-minute scoping call.
 */
export default async function EntreprisesPage() {
  const country = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? "";
  const [offer, zone] = await Promise.all([loadOffer(), zoneOf(country).catch((): Zone => "africa")]);
  const steps: LadderStep[] = offer.packages.map((p) => ({
    code: p.code,
    name: p.name,
    duration: p.duration,
    items: p.items,
    featured: p.featured,
    price: { africa: priceLabel(p, "africa"), intl: priceLabel(p, "intl") },
    sub: { africa: p.outcome, intl: p.outcome },
  }));
  const sovereign: SovereignCard[] = offer.sovereign.map((p) => ({ code: p.code, name: p.name, duration: p.duration, items: p.items, outcome: p.outcome, price: { africa: priceLabel(p, "africa"), intl: priceLabel(p, "intl") } }));
  const known = COUNTRIES.some((c) => c.value === country) ? country : "";

  return (
    <div className="ial">
      <TrackView name="enterprise_view" />
      <IaTopbar current="entreprises" />
      <main className="ent">
        <ZoneProvider initial={zone}>
        <div className="hero">
          <div className="wrap hero-grid">
            <div>
              <div className="kicker"><span>Diagnostic</span><span>Pilote</span><span>Déploiement</span><span>Suivi</span>{offer.showSovereign && <span>IA privée et souveraine</span>}</div>
              <h1>Vos processus tournent avec l’IA. <em>Vous gardez la main.</em></h1>
              <p className="lede">Nous mettons l’IA au travail <b>dans votre entreprise</b> : service client sur WhatsApp, relances, devis, factures, chiffres du mois. Un processus après l’autre, mesuré avant et après, avec vos règles et un interrupteur sur chaque automatisation.</p>
              <div className="hero-cta" id="cadrage">
                <a className="btn btn-go btn-big" href="#demande">Réserver un appel de cadrage</a>
                <Link className="btn btn-line" href={iaPath("/ia/diagnostic")}>Mesurer mon autonomie (3 min)</Link>
              </div>
              {offer.showSovereign && <p className="hero-note">Données sensibles ? <a href="#souverain">Nous installons aussi l’IA dans vos locaux</a>.</p>}
              <p className="hero-note">Appel de 30 minutes, gratuit. Vous préférez former votre équipe à le faire elle-même ? <Link href={iaPath("/ia")}>La formation Bâtisseur IA</Link>.</p>
            </div>
            <ProcessMap />
          </div>
        </div>

        <section className="block" aria-labelledby="repete">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Ce qui reste manuel</span>
              <h2 id="repete">Le temps part dans ce qui se répète.</h2>
              <p>Dans la plupart des PME, ce sont les mêmes tâches qui retiennent les équipes. Ce sont celles que l’IA fait le mieux, sous contrôle.</p>
            </div>
            <ul className="pains">{PAINS.map(([t, s]) => <li key={t}><b>{t}</b><span>{s}</span></li>)}</ul>
          </div>
        </section>

        <section className="block" id="parcours" aria-labelledby="parcours-title">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Le parcours</span>
              <h2 id="parcours-title">Cinq marches. Vous vous arrêtez quand vous voulez.</h2>
              <p>Chaque marche se suffit à elle-même et prépare la suivante. Prix fixes : vous payez un résultat, jamais des journées.</p>
            </div>
            <Ladder steps={steps} />
            {offer.options.length > 0 && (
              <div className="options">
                {offer.options.map((o) => <div key={o.name} className="opt"><b>Option · {o.name}</b><p>{o.text}</p></div>)}
              </div>
            )}
            <ul className="rules">
              <li>50 % à la commande, 50 % à la livraison</li>
              <li>Coûts d’usage sur vos comptes, avec plafond</li>
              <li>Devis numéroté, reçu à chaque paiement</li>
              <li>Paiement par carte ou virement</li>
            </ul>
          </div>
        </section>

        {offer.showSovereign && (
          <section className="block sov" id="souverain" aria-labelledby="souverain-title">
            <div className="wrap">
              <div className="sec-head">
                <span className="label">{SOVEREIGN_NAME}</span>
                <h2 id="souverain-title">Votre IA, dans vos murs.</h2>
                <p>Données de santé, comptes clients, dossiers juridiques, données publiques : certaines informations ne doivent pas sortir. Nous installons un modèle d’IA dans vos locaux, sur un serveur à votre nom. Vous choisissez où tourne chaque processus.</p>
              </div>
              <HostingModes />
              <ul className="cases">
                <li><b>Clinique</b> Les dossiers patients résumés sans quitter l’établissement.</li>
                <li><b>Cabinet juridique</b> Contrats et pièces analysés sur place.</li>
                <li><b>Administration</b> Le courrier entrant trié et orienté en interne.</li>
              </ul>
              <SovereignOffers cards={sovereign} />
              <ul className="rules">
                <li>Matériel acheté à votre nom, chiffré dans l’étude, sans marge de notre part</li>
                <li>Modèle testé sur vos documents avant tout achat</li>
                <li>Suivi à distance ; déplacement sur site facturé à part</li>
              </ul>
              <p className="sov-demo">Pendant l’appel de cadrage, nous vous montrons un modèle ouvert en direct, sur notre machine de démonstration.</p>
            </div>
          </section>
        )}

        <section className="block" id="catalogue" aria-labelledby="catalogue-title">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Ce qu’on peut automatiser</span>
              <h2 id="catalogue-title">Fonction par fonction.</h2>
              <p><b>Assisté</b> : l’IA prépare, une personne valide. <b>Autonome</b> : elle agit seule, selon vos règles, sous plafond, et tout est noté.</p>
            </div>
            <Catalogue />
            <p className="never"><b>Ce que nous refusons :</b> une décision automatique sur une personne (recrutement, crédit), l’envoi en masse non sollicité, la collecte de contacts, des données sensibles confiées à une IA sans base légale.</p>
          </div>
        </section>

        <section className="block control" aria-labelledby="main-title">
          <div className="wrap ctl-grid">
            <div>
              <div className="sec-head">
                <span className="label">Vous gardez la main</span>
                <h2 id="main-title">Un interrupteur sur chaque automatisation.</h2>
                <p>Écrit au contrat de chaque mission, et visible dans votre tableau de bord.</p>
              </div>
              <ul className="guards">{GUARDS.map(([t, s]) => <li key={t}><span><b>{t}</b><span>{s}</span></span></li>)}</ul>
            </div>
            <div>
              <div className="console" aria-label="Exemple de tableau de garde-fous">
                <div className="console-bar"><span>Garde-fous · exemple</span><b>● En marche</b></div>
                {SWITCHES.map(([t, s, on]) => (
                  <div key={t} className="sw"><span>{t}<small>{s}</small></span><span className={"toggle" + (on ? "" : " off")} aria-label={`${t} : ${on ? "activé" : "désactivé"}`} role="img" /></div>
                ))}
                <div className="budget"><p><span>Budget IA du mois</span><span>62 / 100 USD</span></p><div className="bar"><i /></div></div>
              </div>
              <p className="console-note">Ce tableau existe déjà : c’est celui qui pilote notre propre entreprise.</p>
            </div>
          </div>
        </section>

        <section className="block" aria-label="La preuve">
          <div className="wrap eproof">
            <div>
              <span className="label">La preuve</span>
              <blockquote>Notre propre entreprise <span>tourne déjà ainsi.</span></blockquote>
              <p>Ce site et son administration ont été construits avec Claude Code par l’équipe qui vous accompagne. Les références clients viendront avec nos premières missions, avec l’accord écrit de chacun.</p>
            </div>
            <ul className="eruns">{RUNS.map(([t, l]) => <li key={t}><span>{t}</span><span className={`pill ${l}`}>{LEVEL[l]}</span></li>)}</ul>
          </div>
        </section>

        <section className="block" aria-labelledby="questions">
          <div className="wrap">
            <div className="sec-head"><span className="label">Avant de nous appeler</span><h2 id="questions">Les questions des directions.</h2></div>
            <div className="faq">{FAQ.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}</div>
          </div>
        </section>

        <section className="block" id="demande" aria-labelledby="demande-title">
          <div className="wrap req">
            <div>
              <div className="sec-head">
                <span className="label">Demande</span>
                <h2 id="demande-title">30 minutes pour cadrer.</h2>
                <p>Gratuit et sans engagement. Vous repartez avec une première idée des processus à traiter d’abord.</p>
              </div>
              <ol className="req-steps">
                <li>Vous décrivez votre organisation en deux minutes.</li>
                <li>Vous choisissez un créneau dans l’agenda, à votre heure locale.</li>
                <li>Après l’appel, vous recevez une proposition numérotée, avec le prix.</li>
              </ol>
            </div>
            <RequestForm countries={COUNTRIES} defaultCountry={known} />
          </div>
        </section>
        </ZoneProvider>
        <Dock href="#demande" watch="cadrage" title="Appel de cadrage" sub="30 min, gratuit" action="Réserver" />
      </main>
      <IaFooter />
    </div>
  );
}
