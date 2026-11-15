import { BookLock } from "lucide-react";
import Link from "next/link";

import { PRIVACY_ANSWER_DAYS, RETENTION_YEARS } from "@/lib/admin-records";

/**
 * Register of processing activities (RGPD art. 30), as the app actually
 * processes data (lot B). Static: it changes with the code, in the same PR.
 * A base to complete and validate, not a legal opinion.
 */
const TREATMENTS = [
  {
    name: "Analyse de profil (scanner) et prospects",
    purpose: "Évaluer l’éligibilité à la certification et proposer la formation adaptée",
    data: "Prénom, nom, e-mail, WhatsApp (facultatif), pays, poste, objectifs, réponses au questionnaire, source de la visite",
    basis: "Consentement (case non pré-cochée, horodatée)",
    keep: `${RETENTION_YEARS} ans après la dernière activité, puis suppression proposée`,
  },
  {
    name: "Rendez-vous",
    purpose: "Planifier l’appel découverte et les séances de conseil",
    data: "Nom, e-mail, créneau, fuseau horaire",
    basis: "Mesures précontractuelles à la demande de la personne",
    keep: `${RETENTION_YEARS} ans après la dernière activité`,
  },
  {
    name: "Inscriptions et paiements",
    purpose: "Réserver la place, encaisser, émettre les reçus numérotés",
    data: "Identité, e-mail, pays, montant, moyen de paiement, référence ; aucune donnée de carte (traitée par Stripe)",
    basis: "Exécution du contrat ; obligation légale pour les pièces comptables",
    keep: "Reçus : durée légale de conservation comptable du pays (souvent 10 ans), même après une demande de suppression",
  },
  {
    name: "Formation et suivi des participants",
    purpose: "Séances, plan de révision, replays, évaluations",
    data: "Identité, e-mail, présence, accès aux replays, réponses aux évaluations",
    basis: "Exécution du contrat",
    keep: `${RETENTION_YEARS} ans après la fin de la cohorte`,
  },
  {
    name: "Assistant du site",
    purpose: "Répondre aux questions des visiteurs à partir de la FAQ ; transmettre à l’équipe ce qu’il ne sait pas",
    data: "Messages de la conversation, empreinte salée de l’adresse IP (limite quotidienne) ; e-mail seulement si la personne transmet sa question, avec son accord",
    basis: "Intérêt légitime pour la conversation ; consentement pour la réponse par e-mail",
    keep: "Conversations : 30 jours ; questions transmises : le temps de répondre, puis 3 ans",
  },
  {
    name: "Messages automatiques",
    purpose: "Rappels, relances et informations sur les cohortes",
    data: "Prénom, e-mail, étape du parcours",
    basis: "Consentement ; désinscription en un clic dans chaque e-mail ; au plus quelques messages par semaine (Garde-fous)",
    keep: "Journal des envois : le temps de la relation",
  },
] as const;

const PROCESSORS = [
  ["Vercel", "Hébergement du site et mesure d’audience anonyme"],
  ["Hostinger (MySQL)", "Base de données"],
  ["Resend", "Envoi des e-mails"],
  ["Stripe", "Paiement par carte"],
  ["Netticket", "Paiement mobile money"],
  ["Google", "Agenda, liens de visio, stockage des replays"],
  ["Anthropic (Claude)", "Rédaction de messages, analyses et assistant du site ; reçoit le prénom, les réponses au questionnaire et les messages de l’assistant, jamais l’e-mail"],
] as const;

export default function RegistrePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin/administratif" className="text-sm text-muted">← Administratif</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><BookLock className="size-6 shrink-0 text-accent" aria-hidden />Registre des traitements</h1>
      <p className="mt-1 text-sm text-muted">Ce que l’application fait des données personnelles. Base à compléter (responsable, adresse) et à faire valider : ce n’est pas un avis juridique.</p>

      <ul className="mt-6 grid gap-3">
        {TREATMENTS.map((t) => (
          <li key={t.name} className="rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="font-bold">{t.name}</h2>
            <dl className="mt-2 grid gap-1.5">
              <div><dt className="text-xs font-bold text-muted uppercase">Finalité</dt><dd>{t.purpose}</dd></div>
              <div><dt className="text-xs font-bold text-muted uppercase">Données</dt><dd>{t.data}</dd></div>
              <div><dt className="text-xs font-bold text-muted uppercase">Base légale</dt><dd>{t.basis}</dd></div>
              <div><dt className="text-xs font-bold text-muted uppercase">Conservation</dt><dd>{t.keep}</dd></div>
            </dl>
          </li>
        ))}
      </ul>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="font-bold">Sous-traitants</h2>
        <ul className="mt-2 grid gap-1">{PROCESSORS.map(([n, r]) => <li key={n}><b>{n}</b> : {r}</li>)}</ul>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="font-bold">Droits des personnes</h2>
        <p className="mt-1">Accès, rectification, suppression, opposition : réponse sous {PRIVACY_ANSWER_DAYS} jours, suivie dans <Link href="/admin/administratif#demandes" className="underline">Administratif</Link>. Désinscription des e-mails en un clic. Aucune importation de contacts ni envoi non sollicité.</p>
      </section>
    </main>
  );
}
