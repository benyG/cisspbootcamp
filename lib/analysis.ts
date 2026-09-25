import {
  CISSP_DOMAINS,
  type Readiness,
  type ScannerAnswers,
  computeHeatScore,
  countCoveredDomains,
  grantsWaiver,
  hasUnverifiedCertification,
  assessReadiness,
} from "@/lib/scoring";

/**
 * Profile analysis — the diagnosis Ben reviews before it reaches the prospect.
 *
 * Pure and deterministic: the same answers always produce the same analysis,
 * which is what lets Ben trust it enough to approve in seconds. Every constant
 * below is his to retune.
 *
 * Tone rules encoded here, in this order and on purpose:
 *   1. lead with what the person already has, never with what is missing;
 *   2. quantify the gap so it reads as finite and crossable;
 *   3. never promise a pass;
 *   4. nobody is rejected — "pas encore" keeps a path and a date.
 */

// --- Estimation de délai ------------------------------------------------
//
// Calibrated on what Ben observed over two cohorts, *with* coaching:
//   senior (5+ years, most domains, fluent reader)   -> 1 to 2 months
//   median (3-4 years, half the domains, English 3)  -> 3 to 4 months
//   too early (1-2 years, one domain, English 2)     -> 5 to 6 months
// tests/analysis.test.ts pins these three profiles.

/** Coached preparation for an eligible, comfortable profile. */
export const BASE_PREPARATION_WEEKS = 9;

/** Domains beyond this many uncovered start adding time. */
export const FREE_UNCOVERED_DOMAINS = 3;
export const WEEKS_PER_UNCOVERED_DOMAIN = 1;
/**
 * Caps the domain penalty. Kept below the arithmetic maximum (5 billable
 * domains x 1 week) so it actually binds: a profile covering nothing and one
 * covering a single domain face the same ceiling.
 */
export const MAX_DOMAIN_WEEKS = 4;

/** The exam is in English; reading speed is a real predictor. */
export const WEEKS_LOW_ENGLISH = 4;
export const WEEKS_MEDIUM_ENGLISH = 3;

/** A failed attempt means the format holds no surprises. */
export const WEEKS_PREVIOUS_ATTEMPT = -2;
export const WEEKS_SENIOR_EXPERIENCE = -4;
export const WEEKS_JUNIOR_EXPERIENCE = 5;

/** Never quote a single number: the estimate is always a range. */
export const ESTIMATE_SPREAD_WEEKS = 4;
export const MINIMUM_PREPARATION_WEEKS = 4;

/**
 * What the same preparation costs without a coach, as a multiple. Ben's
 * observation, stated as his in the message: what candidates lack is not
 * material but someone to hold the pace. The result shows both figures.
 */
export const SOLO_MULTIPLIER = 2;

const WEEKS_PER_MONTH = 4.345;

export type TimelineEstimate = {
  minWeeks: number;
  maxWeeks: number;
  minMonths: number;
  maxMonths: number;
  /** "3 à 4 mois", ready to drop into a sentence. */
  label: string;
  /** The same range without coaching, e.g. "6 à 8 mois". */
  soloLabel: string;
};

function monthsRange(minWeeks: number, maxWeeks: number) {
  const minMonths = Math.max(1, Math.round(minWeeks / WEEKS_PER_MONTH));
  const maxMonths = Math.max(
    minMonths + 1,
    Math.round(maxWeeks / WEEKS_PER_MONTH),
  );
  return { minMonths, maxMonths, label: `${minMonths} à ${maxMonths} mois` };
}

export function estimateTimeline(answers: ScannerAnswers): TimelineEstimate {
  let weeks = BASE_PREPARATION_WEEKS;

  const uncovered = CISSP_DOMAINS.length - countCoveredDomains(answers);
  const billableDomains = Math.max(0, uncovered - FREE_UNCOVERED_DOMAINS);
  weeks += Math.min(
    billableDomains * WEEKS_PER_UNCOVERED_DOMAIN,
    MAX_DOMAIN_WEEKS,
  );

  if (answers.englishReading <= 2) weeks += WEEKS_LOW_ENGLISH;
  else if (answers.englishReading === 3) weeks += WEEKS_MEDIUM_ENGLISH;

  if (answers.examAttempt === "failed") weeks += WEEKS_PREVIOUS_ATTEMPT;

  if (answers.experience === "five_plus") weeks += WEEKS_SENIOR_EXPERIENCE;
  else if (answers.experience === "none" || answers.experience === "one_two") {
    weeks += WEEKS_JUNIOR_EXPERIENCE;
  }

  const minWeeks = Math.max(MINIMUM_PREPARATION_WEEKS, weeks);
  const maxWeeks = minWeeks + ESTIMATE_SPREAD_WEEKS;
  const coached = monthsRange(minWeeks, maxWeeks);
  const solo = monthsRange(
    minWeeks * SOLO_MULTIPLIER,
    maxWeeks * SOLO_MULTIPLIER,
  );

  return {
    minWeeks,
    maxWeeks,
    ...coached,
    soloLabel: solo.label,
  };
}

/** True when the prospect's own deadline is tighter than the estimate. */
export function isGoalTight(
  answers: ScannerAnswers,
  timeline: TimelineEstimate,
): boolean {
  if (answers.examGoal === "under_three_months") return timeline.minMonths > 3;
  if (answers.examGoal === "three_to_six") return timeline.minMonths > 6;
  return false;
}

// --- Axes ---------------------------------------------------------------

export type AxisAudience = "prospect" | "coach";

export type AnalysisAxis = {
  key: string;
  label: string;
  /** 0–100, for the bars on Ben's review screen and the prospect's result. */
  score: number;
  /** The raw figure behind the bar, e.g. "6 domaines sur 8". */
  detail: string;
  /**
   * Who sees the bar. An axis a first-time candidate scores zero on is kept
   * for the coach's call prep, never shown to the prospect: an empty bar on a
   * page meant to motivate says the opposite of what it should.
   */
  audience: AxisAudience;
};

const EXPERIENCE_YEARS: Record<ScannerAnswers["experience"], number> = {
  none: 0,
  one_two: 1.5,
  three_four: 3.5,
  five_plus: 5,
};

const REQUIRED_YEARS = 5;

export function buildAxes(answers: ScannerAnswers): AnalysisAxis[] {
  const years = EXPERIENCE_YEARS[answers.experience];
  const credited = Math.min(REQUIRED_YEARS, years + (grantsWaiver(answers) ? 1 : 0));
  const covered = countCoveredDomains(answers);

  return [
    {
      key: "isc2_prerequisite",
      label: "Expérience vers le titre",
      score: Math.round((credited / REQUIRED_YEARS) * 100),
      detail:
        (grantsWaiver(answers)
          ? `${years} an${years > 1 ? "s" : ""} d'expérience + 1 an de dérogation, sur 5 pour le titre`
          : `${years} an${years > 1 ? "s" : ""} d'expérience sur 5 pour le titre`) +
        (credited < REQUIRED_YEARS ? " · Associate of ISC² possible dès maintenant" : ""),
      audience: "prospect",
    },
    {
      key: "domain_coverage",
      label: "Couverture des 8 domaines",
      score: Math.round((covered / CISSP_DOMAINS.length) * 100),
      detail: `${covered} domaine${covered > 1 ? "s" : ""} sur ${CISSP_DOMAINS.length}`,
      audience: "prospect",
    },
    {
      key: "english_reading",
      label: "Anglais en lecture",
      score: Math.round(((answers.englishReading - 1) / 4) * 100),
      detail: `${answers.englishReading} sur 5`,
      audience: "prospect",
    },
    {
      key: "exam_maturity",
      label: "Maturité certification",
      score: examMaturityScore(answers),
      detail: describeExamMaturity(answers),
      audience: "coach",
    },
  ];
}

export function prospectAxes(axes: readonly AnalysisAxis[]): AnalysisAxis[] {
  return axes.filter((axis) => axis.audience === "prospect");
}

function examMaturityScore(answers: ScannerAnswers): number {
  const certifications = answers.certifications.filter(
    (certification) => certification !== "other",
  ).length;

  let score = Math.min(60, certifications * 30);
  if (answers.examAttempt === "failed") score += 40;
  if (answers.examAttempt === "passed") score = 100;

  return Math.min(100, score);
}

function describeExamMaturity(answers: ScannerAnswers): string {
  const count = answers.certifications.length;
  if (answers.examAttempt === "passed") return "CISSP déjà obtenu";
  if (answers.examAttempt === "failed") {
    return count > 0
      ? `${count} certification${count > 1 ? "s" : ""}, examen CISSP déjà tenté`
      : "Examen CISSP déjà tenté";
  }
  return count > 0
    ? `${count} certification${count > 1 ? "s" : ""} obtenue${count > 1 ? "s" : ""}`
    : "Première certification — le CISSP comme point d'entrée, c'est possible";
}

// --- Recommandation -----------------------------------------------------

export type Recommendation = "now" | "with_condition" | "build_first";

export function recommend(readiness: Readiness): Recommendation {
  if (readiness === "ready") return "now";
  if (readiness === "conditional") return "with_condition";
  return "build_first";
}

export const RECOMMENDATION_HEADLINES: Record<Recommendation, string> = {
  now: "Le bootcamp est fait pour vous, maintenant.",
  with_condition: "Le bootcamp vous mène à l'examen ; le titre Associate of ISC² vous attend derrière.",
  build_first: "Votre première certification en 15 jours, puis le CISSP : le chemin est tracé.",
};

// --- Analyse complète ---------------------------------------------------

export type ProfileAnalysis = {
  readiness: Readiness;
  recommendation: Recommendation;
  headline: string;
  axes: AnalysisAxis[];
  timeline: TimelineEstimate;
  goalIsTight: boolean;
  /** Internal only — never shown to the prospect (SPECS A2). */
  heatScore: number;
};

export function analyseProfile(answers: ScannerAnswers): ProfileAnalysis {
  const readiness = assessReadiness(answers);
  const timeline = estimateTimeline(answers);
  const recommendation = recommend(readiness);

  return {
    readiness,
    recommendation,
    headline: RECOMMENDATION_HEADLINES[recommendation],
    axes: buildAxes(answers),
    timeline,
    goalIsTight: isGoalTight(answers, timeline),
    heatScore: computeHeatScore(answers),
  };
}

export { hasUnverifiedCertification };
