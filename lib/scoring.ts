import { z } from "zod";

/**
 * Scanner scoring — SPECS A2.
 *
 * Pure, deterministic, no AI. Every threshold is a named constant so Ben can
 * retune the funnel without reading the logic below.
 */

// --- Réglages : ce que Ben peut ajuster ---------------------------------

/** Heat points per answer (commercial priority, 0–100). */
export const HEAT_POINTS = {
  /** Budget déjà couvert par le prospect. */
  budgetYes: 30,
  /** Budget couvert si l'employeur finance. */
  budgetEmployer: 20,
  /** Disponible pour la prochaine cohorte. */
  nextCohort: 20,
  /** Objectif d'examen à moins de six mois. */
  examWithinSixMonths: 15,
  /** En poste (donc finançable et crédible sur l'expérience). */
  employed: 10,
  /** A déjà échoué à l'examen : motivation forte. */
  previousFailure: 5,
} as const;

/** A lead at or above this score jumps into the coach's hot queue (SPECS A6). */
export const HOT_LEAD_THRESHOLD = 60;

/** At or below this level on the 1-to-5 scale, English lengthens preparation. */
export const LOW_ENGLISH_MAX_LEVEL = 2;

/** Domains covered below this count make the "domaines faibles" advice fire. */
export const WEAK_COVERAGE_MAX_DOMAINS = 3;

/**
 * Certifications we accept as granting the ISC² one-year experience waiver.
 *
 * Deliberately a short, verifiable list rather than an attempt to mirror the
 * full ISC² catalogue: Ben extends it here, in one place. Anything declared as
 * `other` is not counted automatically — the result tells the prospect to have
 * it checked rather than promising a waiver we cannot confirm.
 */
export const WAIVER_CERTIFICATIONS = [
  "security_plus",
  "sscp",
  "cisa",
  "cism",
  "ccsp",
  "ceh",
  "gsec",
  "ccna_security",
] as const;

// --- Questionnaire ------------------------------------------------------

/** The eight CISSP domains, in ISC² order. */
export const CISSP_DOMAINS = [
  "security_risk_management",
  "asset_security",
  "security_architecture",
  "network_security",
  "identity_access_management",
  "security_assessment",
  "security_operations",
  "software_security",
] as const;

/** Offered as checkboxes on the certifications screen. */
export const CERTIFICATIONS = [
  ...WAIVER_CERTIFICATIONS,
  "other",
] as const;

export const answersSchema = z.object({
  /** ISO 3166-1 alpha-2, drives the pricing tier. */
  country: z.string().length(2),
  professionalStatus: z.enum(["employed", "student", "career_change", "freelance"]),
  experience: z.enum(["none", "one_two", "three_four", "five_plus"]),
  domains: z.array(z.enum(CISSP_DOMAINS)).max(CISSP_DOMAINS.length),
  /** Four-year academic degree (a Master, for instance). */
  hasFourYearDegree: z.boolean(),
  /** Certifications already held; empty means none. */
  certifications: z.array(z.enum(CERTIFICATIONS)),
  /** Reading and comprehension only, on Ben's 1-to-5 scale. */
  englishReading: z.number().int().min(1).max(5),
  examAttempt: z.enum(["none", "failed", "passed"]),
  examGoal: z.enum(["under_three_months", "three_to_six", "six_to_twelve", "undefined"]),
  budget: z.enum(["yes", "employer", "no", "to_discuss"]),
  cohortAvailability: z.enum(["yes", "later_one", "unsure"]),
});

export type ScannerAnswers = z.infer<typeof answersSchema>;

export type Readiness = "ready" | "conditional" | "not_yet";

/**
 * The ISC² one-year waiver: a four-year degree, or an approved certification.
 * Derived rather than asked, so the prospect never has to know the rule.
 */
export function grantsWaiver(answers: ScannerAnswers): boolean {
  if (answers.hasFourYearDegree) return true;

  return answers.certifications.some((certification) =>
    (WAIVER_CERTIFICATIONS as readonly string[]).includes(certification),
  );
}

/** A declared certification we cannot verify, so it never grants the waiver. */
export function hasUnverifiedCertification(answers: ScannerAnswers): boolean {
  return answers.certifications.includes("other");
}

export type ScannerScore = {
  readiness: Readiness;
  heatScore: number;
  /** Ordered, human-readable reasons shown on the result page (SPECS A2). */
  reasons: string[];
  coveredDomains: number;
};

// --- Éligibilité --------------------------------------------------------

/**
 * ISC² eligibility (SPECS A2):
 *   5+ years, or 3–4 years with the one-year waiver  -> ready
 *   3–4 years without the waiver                     -> conditional (Associate)
 *   under 3 years, or still a student                -> not yet
 */
export function assessReadiness(answers: ScannerAnswers): Readiness {
  if (answers.professionalStatus === "student") return "not_yet";

  switch (answers.experience) {
    case "five_plus":
      return "ready";
    case "three_four":
      return grantsWaiver(answers) ? "ready" : "conditional";
    default:
      return "not_yet";
  }
}

// --- Chaleur commerciale ------------------------------------------------

/**
 * Commercial heat, 0–100. Budget answers are mutually exclusive, so the
 * reachable maximum is 80; the range is kept at 0–100 so Ben can raise a
 * weight without the scale changing meaning.
 */
export function computeHeatScore(answers: ScannerAnswers): number {
  let score = 0;

  if (answers.budget === "yes") score += HEAT_POINTS.budgetYes;
  else if (answers.budget === "employer") score += HEAT_POINTS.budgetEmployer;

  if (answers.cohortAvailability === "yes") score += HEAT_POINTS.nextCohort;

  if (
    answers.examGoal === "under_three_months" ||
    answers.examGoal === "three_to_six"
  ) {
    score += HEAT_POINTS.examWithinSixMonths;
  }

  if (answers.professionalStatus === "employed") score += HEAT_POINTS.employed;
  if (answers.examAttempt === "failed") score += HEAT_POINTS.previousFailure;

  return clamp(score, 0, 100);
}

export function isHotLead(heatScore: number): boolean {
  return heatScore >= HOT_LEAD_THRESHOLD;
}

// --- Explication --------------------------------------------------------

/**
 * Why the verdict is what it is, in the order the result page shows it:
 * eligibility first, then domain coverage, then a realistic timeline.
 */
export function buildReasons(
  answers: ScannerAnswers,
  readiness: Readiness,
): string[] {
  const reasons: string[] = [];

  // 1. Éligibilité ISC².
  if (readiness === "ready" && answers.experience === "five_plus") {
    reasons.push(
      "Vous déclarez 5 ans ou plus d'expérience : le prérequis ISC² est rempli.",
    );
  } else if (readiness === "ready") {
    reasons.push(
      "Vos 3 à 4 ans d'expérience, complétés par la dérogation d'un an, " +
        "remplissent le prérequis ISC².",
    );
  } else if (readiness === "conditional") {
    reasons.push(
      hasUnverifiedCertification(answers)
        ? "Avec 3 à 4 ans d'expérience, tout se joue sur la dérogation d'un an. " +
            "La certification que vous avez indiquée peut vous la donner : elle " +
            "vaut d'être vérifiée. Sinon, vous passez l'examen et devenez " +
            "Associate of ISC² le temps de compléter la cinquième année."
        : "Avec 3 à 4 ans d'expérience, vous pouvez passer l'examen dès " +
            "maintenant et devenir Associate of ISC² le temps de compléter la " +
            "cinquième année. Le titre vous attend, l'examen est derrière vous.",
    );
  } else if (answers.professionalStatus === "student") {
    reasons.push(
      "Le CISSP exige 5 ans d'expérience professionnelle : en tant " +
        "qu'étudiant, l'examen viendra plus tard.",
    );
  } else {
    reasons.push(
      "Le prérequis ISC² est de 5 ans d'expérience (4 avec dérogation). " +
        "Vous n'y êtes pas encore.",
    );
  }

  // 2. Domaines forts / faibles.
  const covered = countCoveredDomains(answers);
  if (covered >= CISSP_DOMAINS.length - 1) {
    reasons.push(
      `Votre expérience couvre ${covered} des 8 domaines : une base très large.`,
    );
  } else if (covered <= WEAK_COVERAGE_MAX_DOMAINS) {
    reasons.push(
      `Votre expérience couvre ${covered} domaine${covered > 1 ? "s" : ""} sur 8. ` +
        "Les domaines non couverts demanderont le plus de travail.",
    );
  } else {
    reasons.push(
      `Votre expérience couvre ${covered} des 8 domaines : une base solide à élargir.`,
    );
  }

  // 3. Délai réaliste.
  if (answers.englishReading <= LOW_ENGLISH_MAX_LEVEL) {
    reasons.push(
      "L'examen se passe en anglais. Avec un anglais technique encore " +
        "basique, prévoyez du temps de lecture en plus.",
    );
  }
  if (answers.examAttempt === "failed") {
    reasons.push(
      "Une tentative échouée est un atout : vous connaissez le format, " +
        "il reste à cibler les domaines qui ont manqué.",
    );
  } else if (answers.examAttempt === "passed") {
    reasons.push(
      "Vous êtes déjà passé par l'examen avec succès : le bootcamp ne vous " +
        "apportera rien, parlons plutôt de la suite.",
    );
  }
  if (answers.examGoal === "undefined") {
    reasons.push(
      "Sans date d'examen visée, la préparation s'étire. Fixer une échéance " +
        "est le premier levier.",
    );
  }

  return reasons;
}

export function countCoveredDomains(answers: ScannerAnswers): number {
  return new Set(answers.domains).size;
}

/** Single entry point: everything the scanner needs from a set of answers. */
export function scoreScanner(answers: ScannerAnswers): ScannerScore {
  const readiness = assessReadiness(answers);

  return {
    readiness,
    heatScore: computeHeatScore(answers),
    reasons: buildReasons(answers, readiness),
    coveredDomains: countCoveredDomains(answers),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
