import type { Readiness, ScannerAnswers } from "@/lib/scoring";

/**
 * Programmes taught in cohorts — docs/OFFRES.md §3. The CISSP bootcamp is
 * the product this site exists for; the ISC² CC course is the first step for
 * those who are not there yet. Copy and defaults live here; prices for the
 * bootcamp stay on the pricing tiers, prices for the other programmes on
 * ProgramPrice (seeded from PROGRAM_PRICES).
 */

export const PROGRAM_CODES = ["cissp", "cc"] as const;
export type ProgramCode = (typeof PROGRAM_CODES)[number];

export function isProgramCode(value: unknown): value is ProgramCode {
  return typeof value === "string" && (PROGRAM_CODES as readonly string[]).includes(value);
}

export type ProgramDefinition = {
  code: ProgramCode;
  /** "CISSP Bootcamp", "Certification CC d'ISC²". */
  name: string;
  /** What the receipt and Stripe line show. */
  productName: string;
  productLine: string;
  hours: number;
  days: number;
  defaultCapacity: number;
  examNote: string;
  /** The receipt's exam line. */
  receiptExamNote: string;
};

export const PROGRAMS: Record<ProgramCode, ProgramDefinition> = {
  cissp: {
    code: "cissp",
    name: "CISSP Bootcamp",
    productName: "CISSP Bootcamp",
    productLine: "40 h de préparation au CISSP en français, sur 15 jours, avec coach certifié.",
    hours: 40,
    days: 15,
    defaultCapacity: 10,
    examNote: "Les frais d’examen ISC² (~750 USD) se règlent séparément auprès d’ISC².",
    receiptExamNote: "Les frais d'examen CISSP ne sont pas inclus et se règlent auprès d'ISC².",
  },
  cc: {
    code: "cc",
    name: "Certification CC d’ISC²",
    productName: "Formation CC d’ISC² — 15 jours pour votre première certification",
    productLine: "10 h de préparation au Certified in Cybersecurity (ISC²) en français, sur 15 jours, avec coach CISSP.",
    hours: 10,
    days: 15,
    defaultCapacity: 15,
    examNote: "L’examen CC se passe auprès d’ISC², qui l’offre à la première tentative dans son programme « One Million Certified in Cybersecurity » (conditions en vigueur sur isc2.org).",
    receiptExamNote: "L'examen CC n'est pas inclus : il se passe auprès d'ISC², gratuit à la première tentative selon les conditions d'ISC².",
  },
};

/** Seeded prices, USD cents by tier (docs/OFFRES.md §3, decided 24/09/2026). */
export const PROGRAM_PRICES: Record<Exclude<ProgramCode, "cissp">, Record<"africa" | "international", number>> = {
  cc: { africa: 14_900, international: 29_900 },
};

/** The five CC domains, in ISC² order, with the share of the exam. */
export const CC_DOMAINS: ReadonlyArray<{ title: string; weight: string; text: string }> = [
  { title: "Principes de sécurité", weight: "26 %", text: "CIA, gestion des risques, contrôles, éthique et gouvernance : le vocabulaire commun de tout métier cyber." },
  { title: "Continuité, reprise et réponse aux incidents", weight: "10 %", text: "Ce qu’on fait quand ça casse : plans BC/DR, réponse aux incidents, rôles." },
  { title: "Contrôle d’accès", weight: "22 %", text: "Contrôles physiques et logiques, moindre privilège, séparation des tâches, gestion des identités." },
  { title: "Sécurité des réseaux", weight: "24 %", text: "Modèles OSI et TCP/IP, menaces courantes, segmentation, pare-feu, cloud et infrastructure." },
  { title: "Opérations de sécurité", weight: "18 %", text: "Durcissement, chiffrement, gestion des configurations, sensibilisation, politiques." },
];

/**
 * The programme offered first on the foundations path (Ben, 25/09/2026):
 * no experience or 1–2 years, student or career change → the CC course, the
 * CISSP as Associate of ISC² right after. Everyone else is sold the bootcamp.
 */
export function recommendedProgram(readiness: Readiness, answers: Pick<ScannerAnswers, "experience" | "professionalStatus">): ProgramCode | null {
  void answers;
  return readiness === "not_yet" ? "cc" : null;
}
