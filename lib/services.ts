import type { Readiness, ScannerAnswers } from "@/lib/scoring";

/**
 * Career-consulting services — docs/OFFRES.md §2. Pure definitions and
 * arithmetic: the catalogue Ben approved on 24/09/2026, the credit rule, and
 * the routing from a scanner verdict to the service that fits. No I/O here.
 */

export const SERVICE_CODES = ["bilan", "reconversion", "certif", "mentorat"] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

export function isServiceCode(value: unknown): value is ServiceCode {
  return typeof value === "string" && (SERVICE_CODES as readonly string[]).includes(value);
}

export type ServiceDefinition = {
  code: ServiceCode;
  name: string;
  tagline: string;
  /** One bullet per line. */
  description: string;
  deliverable: string;
  sessionMinutes: number;
  sessions: number;
  creditable: boolean;
  sortOrder: number;
  /** USD cents by pricing tier. */
  prices: Record<"africa" | "international", number>;
};

/** Seeded catalogue; Ben edits prices and activity from /admin/conseil. */
export const SERVICE_CATALOGUE: readonly ServiceDefinition[] = [
  {
    code: "bilan",
    name: "Bilan de carrière cybersécurité",
    tagline: "Où vous en êtes, où aller, par quelle certification commencer.",
    description:
      "Votre parcours, vos compétences, ce que le marché attend\n" +
      "Les voies possibles : GRC, SOC, pentest, cloud, audit\n" +
      "La première certification à viser, et dans quel ordre ensuite\n" +
      "Un plan à 12 mois, daté",
    deliverable: "Un plan écrit d’une page, envoyé après la séance",
    sessionMinutes: 60,
    sessions: 1,
    creditable: true,
    sortOrder: 1,
    prices: { africa: 6_000, international: 12_000 },
  },
  {
    code: "reconversion",
    name: "Reconversion vers la cybersécurité",
    tagline: "Trois séances pour passer de votre métier actuel à un premier poste cyber.",
    description:
      "Séance 1 : écart de compétences depuis l’IT, le réseau, le dev ou un autre métier\n" +
      "Séance 2 : ordre des certifications et stratégie de premier poste\n" +
      "Séance 3 : relecture de vos candidatures et suivi à 30 et 60 jours",
    deliverable: "Un plan de reconversion écrit, relu à chaque séance",
    sessionMinutes: 60,
    sessions: 3,
    creditable: true,
    sortOrder: 2,
    prices: { africa: 15_000, international: 30_000 },
  },
  {
    code: "certif",
    name: "Choisir et préparer sa certification",
    tagline: "Security+, SSCP, CC, CCSP, CISM, CISA, ISO 27001 : laquelle, quand, comment.",
    description:
      "La certification qui sert votre objectif, pas la plus connue\n" +
      "Les prérequis, le coût réel, le délai réaliste\n" +
      "Une méthode de préparation adaptée à votre emploi du temps",
    deliverable: "Un plan d’étude daté jusqu’à l’examen",
    sessionMinutes: 60,
    sessions: 1,
    creditable: true,
    sortOrder: 3,
    prices: { africa: 6_000, international: 12_000 },
  },
  {
    code: "mentorat",
    name: "Mentorat mensuel",
    tagline: "Un mois de suivi : deux séances de 45 minutes et vos questions entre les deux.",
    description:
      "Séance 1, début de mois : bilan de votre progression, objectifs du mois, plan de travail\n" +
      "Séance 2, mi-mois : déblocage des points durs, questions d’examen commentées, ajustements\n" +
      "Entre les séances : une question par e-mail chaque semaine, réponse sous 48 h\n" +
      "Fin de mois : un récapitulatif écrit et les objectifs du mois suivant",
    deliverable: "Deux séances, quatre réponses écrites, un récapitulatif mensuel",
    sessionMinutes: 45,
    sessions: 2,
    creditable: false,
    sortOrder: 4,
    prices: { africa: 9_900, international: 19_900 },
  },
];

export function serviceDefinition(code: ServiceCode): ServiceDefinition {
  const found = SERVICE_CATALOGUE.find((service) => service.code === code);
  if (!found) throw new Error(`Service inconnu : ${code}`);
  return found;
}

// --- Crédit sur le bootcamp ----------------------------------------------

/** A paid consulting hour is deducted from the bootcamp within this window (docs/OFFRES.md §2). */
export const CREDIT_WINDOW_DAYS = 90;

/** The credit never exceeds one hour of consulting at the lead's tier. */
export type CreditableOrder = { id: number; amountUsd: number; sessions: number; sessionMinutes: number; paidAt: Date; creditedRegistrationId: number | null };

/**
 * Which paid order, if any, is deducted from a bootcamp registration, and
 * for how much: one hour's worth of that order, the most recent eligible
 * order first. Pure, so the rule is testable without a database.
 */
export function consultingCredit(orders: readonly CreditableOrder[], now: Date): { orderId: number; creditUsd: number } | null {
  const windowStart = now.getTime() - CREDIT_WINDOW_DAYS * 86_400_000;
  const eligible = orders
    .filter((order) => order.creditedRegistrationId === null && order.paidAt.getTime() >= windowStart && order.paidAt.getTime() <= now.getTime())
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  const order = eligible[0];
  if (!order) return null;

  const totalMinutes = order.sessions * order.sessionMinutes;
  const oneHour = totalMinutes <= 60 ? order.amountUsd : Math.round((order.amountUsd * 60) / totalMinutes);
  return { orderId: order.id, creditUsd: Math.min(order.amountUsd, oneHour) };
}

// --- Aiguillage depuis le scanner ----------------------------------------

/**
 * The step that fits a prospect who is not ready for the bootcamp
 * (docs/OFFRES.md §4). "Pas encore" with little or no experience, or in
 * career change, goes to the reconversion pack; with some experience, to
 * the career review. "Sous conditions" gets the review as a secondary
 * offer — the call stays the main action. "Prêt" gets nothing: never sell
 * the step below to someone who can climb.
 */
export function recommendedService(readiness: Readiness, answers: Pick<ScannerAnswers, "experience" | "professionalStatus">): ServiceCode | null {
  if (readiness === "ready") return null;
  if (readiness === "conditional") return "bilan";
  if (answers.professionalStatus === "career_change" || answers.experience === "none") return "reconversion";
  return "bilan";
}

/** "1 h", "3 × 1 h", "2 × 45 min". */
export function formatDuration(sessions: number, sessionMinutes: number): string {
  const one = sessionMinutes % 60 === 0 ? `${sessionMinutes / 60} h` : sessionMinutes > 60 ? `${Math.floor(sessionMinutes / 60)} h ${sessionMinutes % 60}` : `${sessionMinutes} min`;
  return sessions > 1 ? `${sessions} × ${one}` : one;
}
