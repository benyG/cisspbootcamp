import { CERTIFICATIONS, CISSP_DOMAINS } from "@/lib/scoring";

/**
 * The scanner questionnaire — one screen per question on mobile (SPECS A2).
 *
 * Wording validated by Ben on 19/09/2026 from his previous intake form. Two
 * labels are filled at render time: the price of the prospect's tier in the
 * budget question, and the cohort month in the availability question.
 */

export type Option = { value: string; label: string; hint?: string };

export type Question =
  | { id: "country"; kind: "country"; label: string; hint?: string }
  | {
      id: string;
      kind: "single" | "multi" | "scale";
      label: string;
      hint?: string;
      options: Option[];
    };

export const DOMAIN_LABELS: Record<(typeof CISSP_DOMAINS)[number], string> = {
  security_risk_management: "Sécurité et gestion des risques",
  asset_security: "Sécurité des actifs",
  security_architecture: "Architecture et ingénierie de sécurité",
  network_security: "Sécurité des communications et des réseaux",
  identity_access_management: "Gestion des identités et des accès (IAM)",
  security_assessment: "Évaluation et tests de sécurité",
  security_operations: "Opérations de sécurité",
  software_security: "Sécurité du développement logiciel",
};

export const CERTIFICATION_LABELS: Record<
  (typeof CERTIFICATIONS)[number],
  string
> = {
  security_plus: "CompTIA Security+",
  sscp: "SSCP",
  cisa: "CISA",
  cism: "CISM",
  ccsp: "CCSP",
  ceh: "CEH",
  gsec: "GSEC",
  ccna_security: "CCNA Security",
  other: "Une autre certification",
};

export const QUESTIONS: Question[] = [
  {
    id: "country",
    kind: "country",
    label: "Dans quel pays résidez-vous ?",
    hint: "Le tarif du bootcamp dépend de votre pays.",
  },
  {
    id: "professionalStatus",
    kind: "single",
    label: "Quelle est votre situation professionnelle ?",
    options: [
      { value: "employed", label: "En poste" },
      { value: "freelance", label: "Indépendant" },
      { value: "career_change", label: "En reconversion" },
      { value: "student", label: "Étudiant" },
    ],
  },
  {
    id: "experience",
    kind: "single",
    label: "Combien d'années d'expérience avez-vous en sécurité de l'information ?",
    hint: "Comptez uniquement les postes où la sécurité était au cœur de votre travail.",
    options: [
      { value: "none", label: "Moins d'un an" },
      { value: "one_two", label: "1 à 2 ans" },
      { value: "three_four", label: "3 à 4 ans" },
      { value: "five_plus", label: "5 ans ou plus" },
    ],
  },
  {
    id: "hasFourYearDegree",
    kind: "single",
    label: "Avez-vous un diplôme académique de quatre ans ou plus ?",
    hint: "Un Master, par exemple. Cela peut compter pour un an d'expérience auprès d'ISC².",
    options: [
      { value: "true", label: "Oui" },
      { value: "false", label: "Non" },
    ],
  },
  {
    id: "certifications",
    kind: "multi",
    label: "Quelles certifications possédez-vous déjà ?",
    hint: "Cochez toutes celles qui s'appliquent, ou passez si vous n'en avez aucune.",
    options: CERTIFICATIONS.map((value) => ({
      value,
      label: CERTIFICATION_LABELS[value],
    })),
  },
  {
    id: "domains",
    kind: "multi",
    label: "Quels domaines du CISSP votre expérience couvre-t-elle ?",
    hint: "Les 8 domaines officiels. Cochez ceux que vous avez pratiqués, même partiellement.",
    options: CISSP_DOMAINS.map((value) => ({
      value,
      label: DOMAIN_LABELS[value],
    })),
  },
  {
    id: "englishReading",
    kind: "scale",
    label: "Quel est votre niveau en anglais, en lecture et compréhension ?",
    hint: "L'examen se passe en anglais. 1 = je devine, 5 = je lis un document technique sans effort.",
    options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
  },
  {
    id: "examAttempt",
    kind: "single",
    label: "Avez-vous déjà passé l'examen CISSP ?",
    options: [
      { value: "none", label: "Non, jamais" },
      { value: "failed", label: "Oui, sans succès" },
      { value: "passed", label: "Oui, je l'ai réussi" },
    ],
  },
  {
    id: "examGoal",
    kind: "single",
    label: "Quand souhaitez-vous passer l'examen ?",
    options: [
      { value: "under_three_months", label: "Dans moins de 3 mois" },
      { value: "three_to_six", label: "Dans 3 à 6 mois" },
      { value: "six_to_twelve", label: "Dans 6 à 12 mois" },
      { value: "undefined", label: "Je n'ai pas encore de date" },
    ],
  },
  {
    id: "budget",
    kind: "single",
    // {{price}} is replaced at render time with the prospect's tier.
    label: "Une inscription à {{price}} est-elle envisageable pour vous ?",
    hint:
      "Ce montant couvre la formation et la préparation. Les frais d'examen ISC² " +
      "(environ 750 USD) sont à prévoir en plus et se règlent directement auprès d'ISC².",
    options: [
      { value: "yes", label: "Oui" },
      { value: "employer", label: "Oui, si mon employeur finance" },
      { value: "to_discuss", label: "À discuter" },
      { value: "no", label: "Non" },
    ],
  },
  {
    id: "cohortAvailability",
    kind: "single",
    // Label comes from availabilityQuestionLabel() at render time.
    label: "{{availability}}",
    options: [
      { value: "yes", label: "Oui" },
      { value: "later_one", label: "Plutôt la suivante" },
      { value: "unsure", label: "Je ne sais pas encore" },
    ],
  },
];

/** Countries offered in the first screen, francophone Africa first. */
export const COUNTRIES: Option[] = [
  { value: "BJ", label: "Bénin" },
  { value: "BF", label: "Burkina Faso" },
  { value: "BI", label: "Burundi" },
  { value: "CM", label: "Cameroun" },
  { value: "CF", label: "Centrafrique" },
  { value: "KM", label: "Comores" },
  { value: "CG", label: "Congo" },
  { value: "CD", label: "Congo (RDC)" },
  { value: "CI", label: "Côte d'Ivoire" },
  { value: "DJ", label: "Djibouti" },
  { value: "GA", label: "Gabon" },
  { value: "GN", label: "Guinée" },
  { value: "GQ", label: "Guinée équatoriale" },
  { value: "MG", label: "Madagascar" },
  { value: "ML", label: "Mali" },
  { value: "MA", label: "Maroc" },
  { value: "MR", label: "Mauritanie" },
  { value: "MU", label: "Maurice" },
  { value: "NE", label: "Niger" },
  { value: "RW", label: "Rwanda" },
  { value: "SN", label: "Sénégal" },
  { value: "SC", label: "Seychelles" },
  { value: "TD", label: "Tchad" },
  { value: "TG", label: "Togo" },
  { value: "TN", label: "Tunisie" },
  { value: "DZ", label: "Algérie" },
  { value: "HT", label: "Haïti" },
  { value: "BE", label: "Belgique" },
  { value: "CA", label: "Canada" },
  { value: "FR", label: "France" },
  { value: "LU", label: "Luxembourg" },
  { value: "CH", label: "Suisse" },
  { value: "ZZ", label: "Autre pays" },
];
