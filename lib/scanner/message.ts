import type { ProfileAnalysis } from "@/lib/analysis";
import type { CohortCandidate } from "@/lib/cohorts";
import { formatCohortMonth } from "@/lib/cohorts";
import { recommendedProgram } from "@/lib/programs";
import { buildReasons, type ScannerAnswers } from "@/lib/scoring";

/**
 * The message Ben reads, edits and approves before it reaches the prospect.
 *
 * Written in his voice, first person, short sentences. Structure follows the
 * tone rules in lib/analysis.ts: what you have, the gap in numbers, the path,
 * and the cohort. The coach is the argument — what candidates lack is not
 * material but someone to hold the pace.
 */
export function draftCoachMessage(input: {
  firstName: string;
  answers: ScannerAnswers;
  analysis: ProfileAnalysis;
  cohort: CohortCandidate | null;
}): string {
  const { firstName, answers, analysis, cohort } = input;
  const paragraphs: string[] = [];

  paragraphs.push(`Bonjour ${firstName},`);
  paragraphs.push("J'ai regardé votre profil. Voici ce que j'en retiens.");

  // 1. Le verdict, puis les raisons dans l'ordre : prérequis, domaines, délai.
  paragraphs.push(analysis.headline);
  paragraphs.push(buildReasons(answers, analysis.readiness).join(" "));

  // 2. Le délai, avec et sans coach — l'argument central.
  paragraphs.push(timelineParagraph(analysis, cohort));

  // 3. La suite.
  paragraphs.push(nextStepParagraph(analysis, answers));

  paragraphs.push("Ben\nCoach CISSP");

  return paragraphs.join("\n\n");
}

function timelineParagraph(
  analysis: ProfileAnalysis,
  cohort: CohortCandidate | null,
): string {
  const { timeline, goalIsTight } = analysis;
  const sentences: string[] = [];

  sentences.push(
    `Seul, avec du bon matériel, je vous vois prêt pour l'examen en ${timeline.soloLabel}.`,
  );
  sentences.push(
    `Accompagné, en ${timeline.label}. La différence ne vient pas des supports : ` +
      "elle vient de quelqu'un qui tient le rythme avec vous, semaine après semaine. " +
      "C'est ce qui manque à la plupart des candidats au CISSP, et c'est ce que je fais.",
  );

  if (goalIsTight) {
    sentences.push(
      "Votre objectif de date est plus serré que cette estimation. Il reste " +
        "jouable, à condition d'attaquer les domaines non couverts dès la première semaine.",
    );
  }

  if (cohort && analysis.recommendation !== "build_first") {
    sentences.push(
      `La cohorte de ${formatCohortMonth(cohort.startsAt)} vous y amène dans ce délai.`,
    );
  }

  return sentences.join(" ");
}

function nextStepParagraph(analysis: ProfileAnalysis, answers: ScannerAnswers): string {
  switch (analysis.recommendation) {
    case "now":
      return (
        "Prochaine étape : 15 minutes ensemble, pour vérifier que le format " +
        "vous convient et fixer votre date d'examen. Le lien pour réserver est ci-dessous. " +
        "D'ici là, si vous voulez vous situer sur cinq vraies questions d'examen, le lien du test est là aussi : dites-moi votre score."
      );
    case "with_condition":
      return (
        "Prochaine étape : 15 minutes ensemble, pour lever la condition dont je " +
        "parle plus haut et fixer votre date d'examen. Le lien pour réserver est ci-dessous. " +
        "D'ici là, cinq vraies questions d'examen vous diront où vous en êtes : le lien du test est là aussi."
      );
    case "build_first":
      if (recommendedProgram("not_yet", answers) === "cc") {
        return (
          "Prochaine étape : votre première certification. La CC d'ISC² ne demande aucune " +
          "expérience, et je la prépare avec vous en 15 jours, en français : dix heures de " +
          "sessions, les cinq domaines, un examen blanc, un plan jusqu'au jour J. C'est la " +
          "même maison que le CISSP, et le chemin est tracé. Le lien est ci-dessous ; si vous " +
          "préférez d'abord en parler, une heure de conseil carrière est là aussi."
        );
      }
      return (
        "Prochaine étape : une heure ensemble, en séance de conseil carrière, pour faire " +
        "le point sur votre parcours, choisir la voie et la première certification qui vous " +
        "conviennent, et repartir avec un plan écrit. Le lien pour réserver est ci-dessous. " +
        "Cette heure est déduite du bootcamp si vous le rejoignez dans les 90 jours."
      );
  }
}
