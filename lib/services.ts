import type { Readiness, ScannerAnswers } from "@/lib/scoring";

/**
 * Career-consulting services — docs/OFFRES.md §2. Pure definitions and
 * arithmetic: the catalogue Ben approved on 24/09/2026, the credit rule, and
 * the routing from a scanner verdict to the service that fits. No I/O here.
 */

export const SERVICE_CODES = ["bilan", "evolution", "repositionnement", "reconversion", "certif", "mentorat"] as const;
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
    tagline: "Où vous en êtes, où aller, quelle est la prochaine étape, à tout niveau d’expérience.",
    description:
      "Votre parcours, vos compétences, ce que le marché attend de vous aujourd’hui\n" +
      "Les voies possibles : GRC, SOC, pentest, cloud, audit, management\n" +
      "La prochaine certification utile, et dans quel ordre ensuite\n" +
      "Un plan à 12 mois, daté",
    deliverable: "Un plan écrit d’une page, envoyé après la séance",
    sessionMinutes: 60,
    sessions: 1,
    creditable: true,
    sortOrder: 1,
    prices: { africa: 6_000, international: 12_000 },
  },
  {
    code: "evolution",
    name: "Évoluer vers le management ou le poste de RSSI",
    tagline: "De la technique à la gouvernance : prendre une équipe, un périmètre, une fonction.",
    description:
      "Ce qu’un comité de direction attend d’un RSSI, et ce qui manque encore à votre profil\n" +
      "Passer de l’expertise technique au pilotage : risques, budget, conformité, communication\n" +
      "Se faire nommer ou recruter : positionnement, visibilité, négociation\n" +
      "Les certifications qui comptent à ce niveau, CISM, CISSP, CRISC, et lesquelles ignorer",
    deliverable: "Une feuille de route écrite vers le poste visé",
    sessionMinutes: 60,
    sessions: 1,
    creditable: true,
    sortOrder: 2,
    prices: { africa: 6_000, international: 12_000 },
  },
  {
    code: "repositionnement",
    name: "Se repositionner dans la cybersécurité",
    tagline: "Spécialisation, freelance, expatriation, retour après une pause : changer de trajectoire sans repartir de zéro.",
    description:
      "Le marché de la spécialité visée : cloud, GRC, pentest, réponse à incident, audit\n" +
      "Ce que votre expérience vaut ailleurs : à l’étranger, en indépendant, dans un autre secteur\n" +
      "Les écarts à combler, et le plus court chemin pour les combler\n" +
      "Un plan de transition daté, avec les premiers pas concrets",
    deliverable: "Un plan de repositionnement écrit",
    sessionMinutes: 60,
    sessions: 1,
    creditable: true,
    sortOrder: 3,
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
    sortOrder: 4,
    prices: { africa: 15_000, international: 30_000 },
  },
  {
    code: "certif",
    name: "Choisir et préparer sa certification",
    tagline: "De la CC au CCSP, CISM, CISA ou CRISC : laquelle sert votre objectif, quand, comment.",
    description:
      "La certification qui sert votre objectif, pas la plus connue\n" +
      "Les prérequis, le coût réel, le délai réaliste\n" +
      "Une méthode de préparation adaptée à votre emploi du temps",
    deliverable: "Un plan d’étude daté jusqu’à l’examen",
    sessionMinutes: 60,
    sessions: 1,
    creditable: true,
    sortOrder: 5,
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
    sortOrder: 6,
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
 * The consulting session that speaks to this profile (Ben, 24/09/2026:
 * consulting is for every level, it is about the career, not about being
 * ready for the bootcamp). A career change or no experience → the
 * reconversion pack; five years and more → the evolution session; in
 * between → the career review. Every verdict gets one.
 */
export function recommendedService(readiness: Readiness, answers: Pick<ScannerAnswers, "experience" | "professionalStatus">): ServiceCode {
  if (answers.professionalStatus === "career_change" || answers.experience === "none") return "reconversion";
  if (answers.experience === "five_plus") return "evolution";
  void readiness;
  return "bilan";
}

/** "1 h", "3 × 1 h", "2 × 45 min". */
export function formatDuration(sessions: number, sessionMinutes: number): string {
  const one = sessionMinutes % 60 === 0 ? `${sessionMinutes / 60} h` : sessionMinutes > 60 ? `${Math.floor(sessionMinutes / 60)} h ${sessionMinutes % 60}` : `${sessionMinutes} min`;
  return sessions > 1 ? `${sessions} × ${one}` : one;
}

/**
 * A consulting "format" is what the prospect picks first (Ben, 24/09):
 * the duration and number of sessions, before any service or price. Each
 * format groups the services that share it, so the slots computed for it
 * suit every service it contains.
 */
export type ServiceFormat = {
  /** "60x1": session minutes × sessions. */
  key: string;
  sessionMinutes: number;
  sessions: number;
  label: string;
  /** Names of the services in this format, in catalogue order. */
  services: string[];
};

export function formatKey(sessionMinutes: number, sessions: number): string {
  return `${sessionMinutes}x${sessions}`;
}

export function parseFormatKey(key: string): { sessionMinutes: number; sessions: number } | null {
  const match = /^(\d{2,3})x(\d{1,2})$/.exec(key);
  if (!match) return null;
  const sessionMinutes = Number(match[1]);
  const sessions = Number(match[2]);
  if (sessionMinutes < 15 || sessionMinutes > 180 || sessions < 1 || sessions > 12) return null;
  return { sessionMinutes, sessions };
}

export function groupByFormat<T extends { code: string; name: string; sessionMinutes: number; sessions: number }>(services: readonly T[]): ServiceFormat[] {
  const formats: ServiceFormat[] = [];
  for (const service of services) {
    const key = formatKey(service.sessionMinutes, service.sessions);
    let format = formats.find((f) => f.key === key);
    if (!format) {
      const monthly = service.code === "mentorat";
      format = { key, sessionMinutes: service.sessionMinutes, sessions: service.sessions, label: formatDuration(service.sessions, service.sessionMinutes) + (monthly ? " par mois" : ""), services: [] };
      formats.push(format);
    }
    format.services.push(service.name);
  }
  return formats;
}

export function servicesInFormat<T extends { sessionMinutes: number; sessions: number }>(services: readonly T[], key: string): T[] {
  return services.filter((s) => formatKey(s.sessionMinutes, s.sessions) === key);
}
