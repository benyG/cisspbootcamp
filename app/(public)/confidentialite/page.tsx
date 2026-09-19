import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politique de confidentialité — CISSP Bootcamp" };

/**
 * Written from what the application actually does. Ben should have it
 * reviewed before the first European or Canadian prospect signs up.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
      <h1>Politique de confidentialité</h1>
      <p>
        Ce site est édité par Ben, coach CISSP, pour l&apos;inscription à ses
        bootcamps. Voici ce qui est collecté, pourquoi, et comment le retirer.
      </p>
      <h2>Ce qui est collecté</h2>
      <ul>
        <li>Vos réponses au questionnaire d&apos;analyse de profil ;</li>
        <li>Votre prénom, nom, e-mail et, si vous le donnez, votre numéro WhatsApp ;</li>
        <li>Le titre de votre poste et vos objectifs, si vous les renseignez ;</li>
        <li>La date de votre consentement ;</li>
        <li>Si vous réservez un appel : le créneau choisi et votre fuseau horaire ;</li>
        <li>Si vous vous inscrivez : le montant, le moyen de paiement et la référence de transaction. Aucun numéro de carte ne transite par ce site.</li>
      </ul>
      <h2>Pourquoi</h2>
      <p>
        Pour vous envoyer votre analyse, organiser un appel de découverte, gérer
        votre inscription à une cohorte et vous recontacter à propos du bootcamp.
        Rien d&apos;autre. Vos données ne sont ni vendues ni partagées à des fins
        publicitaires.
      </p>
      <h2>Qui y a accès</h2>
      <p>
        Ben seul, et les prestataires techniques nécessaires au service : l&apos;hébergeur
        du site et de la base de données, le service d&apos;envoi d&apos;e-mails,
        Google Calendar pour les rendez-vous, Stripe et Netticket pour les paiements.
      </p>
      <h2>Combien de temps</h2>
      <p>
        Tant que vous êtes en contact avec Ben au sujet du bootcamp, et au plus
        trois ans après votre dernier échange. Vous pouvez demander la suppression
        à tout moment.
      </p>
      <h2>Vos droits</h2>
      <p>
        Chaque e-mail contient un lien de désinscription en un clic. Pour accéder
        à vos données, les corriger ou les faire supprimer entièrement, écrivez à
        l&apos;adresse indiquée dans chaque message : la suppression est faite à la main,
        sous quinze jours.
      </p>
    </main>
  );
}
