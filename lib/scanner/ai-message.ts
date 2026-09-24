import Anthropic from "@anthropic-ai/sdk";

import type { ProfileAnalysis } from "@/lib/analysis";
import type { CohortCandidate } from "@/lib/cohorts";
import { formatCohortMonth } from "@/lib/cohorts";
import { CERTIFICATION_LABELS, DOMAIN_LABELS } from "@/lib/scanner/questions";
import { draftCoachMessage } from "@/lib/scanner/message";
import type { ScannerAnswers } from "@/lib/scoring";

/**
 * The follow-up message Ben validates in the admin, drafted by Claude.
 *
 * The diagnosis itself (verdict, axes, timeline) is computed by the rules in
 * lib/scoring.ts and lib/analysis.ts and is handed to the model as facts. The
 * model's job is narrower and commercial: turn those facts into a personal,
 * honest argument for joining the cohort. Without an API key, or on any
 * failure, the deterministic template in lib/scanner/message.ts is used —
 * the prospect never waits on the model, and Ben always has a draft.
 */

export const AI_MODEL = "claude-opus-5";

export type DraftInput = {
  firstName: string;
  jobTitle: string | null;
  goals: string | null;
  answers: ScannerAnswers;
  analysis: ProfileAnalysis;
  cohort: CohortCandidate | null;
  priceLabel: string;
};

export type DraftResult = { text: string; source: "ai" | "template" };

const SYSTEM = `Tu es Ben, coach CISSP certifié, auditeur ISO 27001, francophone. Tu écris à un prospect qui vient d'analyser son profil sur ton site. Ton objectif : l'amener à réserver un appel de 15 minutes et à s'inscrire au bootcamp (40 h sur 15 jours, en français, 10 places par cohorte).

Règles, dans l'ordre :
1. Le diagnostic qui t'est fourni fait foi. Tu ne modifies ni le verdict, ni les chiffres, ni le délai. Tu les expliques et tu les vends.
2. Commence toujours par ce que la personne a déjà. Puis l'écart, chiffré, pour qu'il paraisse franchissable. Puis le chemin.
3. L'argument central : seul, le délai est le double ; accompagné, quelqu'un tient le rythme. Ce qui manque aux candidats, ce n'est pas le matériel.
4. Jamais de promesse de réussite. Jamais « vous réussirez », jamais « garanti ».
5. Un profil « pas encore » n'est pas écarté : propose-lui la marche qui lui convient maintenant. Sans expérience ou en reconversion : la certification CC d'ISC², sans prérequis, que tu prépares en 15 jours (dix heures de sessions live), première marche vers le CISSP. Avec un peu d'expérience : une séance de conseil carrière d'une heure avec toi (bilan de carrière). Chaleureusement, sans pression.
5b. Le conseil carrière n'est pas réservé aux débutants : à un profil prêt ou expérimenté, tu peux mentionner en une phrase qu'une heure de conseil existe aussi pour l'après-CISSP (poste, spécialisation, management, repositionnement), sans en faire l'action principale.
6. Ton : direct, chaleureux, professionnel, tutoiement interdit, phrases courtes, aucun emoji, aucune formule creuse (« n'hésitez pas », « au plaisir »).
7. Utilise les objectifs écrits par la personne s'il y en a : cite-les, c'est la preuve que tu as lu.
8. Termine par une seule action : réserver 15 minutes (le lien sera ajouté sous le message). Juste avant, en une phrase, propose de tester son raisonnement sur cinq questions d'entraînement CISSP et de te dire son score (ce lien aussi sera ajouté sous le message). Pour un profil « pas encore », termine par la séance de conseil (le lien sera ajouté sous le message).
9. 180 à 260 mots. Commence par « Bonjour {prénom}, ». Signe « Ben — Coach CISSP ». Texte brut, sans titres ni listes.`;

export function buildPrompt(input: DraftInput): string {
  const { answers, analysis, cohort } = input;
  const covered = answers.domains.map((d) => DOMAIN_LABELS[d]);
  const missing = Object.entries(DOMAIN_LABELS).filter(([k]) => !answers.domains.includes(k as keyof typeof DOMAIN_LABELS)).map(([, v]) => v);
  const certs = answers.certifications.map((c) => CERTIFICATION_LABELS[c]);

  const lines = [
    `Prénom : ${input.firstName}`,
    input.jobTitle ? `Poste actuel : ${input.jobTitle}` : null,
    `Situation : ${answers.professionalStatus}`,
    `Expérience en sécurité : ${answers.experience}`,
    `Diplôme de 4 ans : ${answers.hasFourYearDegree ? "oui" : "non"}`,
    `Certifications : ${certs.length ? certs.join(", ") : "aucune"}`,
    `Domaines couverts (${covered.length}/8) : ${covered.join(", ") || "aucun"}`,
    `Domaines non couverts : ${missing.join(", ") || "aucun"}`,
    `Anglais en lecture : ${answers.englishReading}/5`,
    `Examen CISSP : ${answers.examAttempt === "failed" ? "déjà tenté, échoué" : answers.examAttempt === "passed" ? "déjà réussi" : "jamais tenté"}`,
    `Objectif de date : ${answers.examGoal}`,
    `Budget : ${answers.budget}`,
    `Disponible pour la prochaine cohorte : ${answers.cohortAvailability}`,
    input.goals ? `Objectifs écrits par la personne : « ${input.goals} »` : "Objectifs écrits : aucun",
    "",
    "DIAGNOSTIC (règles, fait foi) :",
    `Verdict : ${analysis.readiness} — ${analysis.headline}`,
    ...analysis.axes.map((a) => `Axe ${a.label} : ${a.score}/100 (${a.detail})`),
    `Délai jusqu'à l'examen, accompagné : ${analysis.timeline.label}. Seul : ${analysis.timeline.soloLabel}.`,
    analysis.goalIsTight ? "Son objectif de date est plus serré que l'estimation : le dire sans le décourager." : null,
    cohort ? `Cohorte en vente : ${cohort.name}, démarre en ${formatCohortMonth(cohort.startsAt)}, ${Math.max(0, cohort.capacity - cohort.confirmedCount)} places restantes sur ${cohort.capacity}.` : "Aucune cohorte en vente pour le moment : proposer l'appel quand même.",
    `Tarif pour son pays : ${input.priceLabel} (formation et préparation ; frais d'examen ISC² en plus, ~750 USD).`,
    "",
    "Rédige le message.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export async function draftSalesMessage(input: DraftInput): Promise<DraftResult> {
  const fallback = (): DraftResult => ({
    text: draftCoachMessage({ firstName: input.firstName, answers: input.answers, analysis: input.analysis, cohort: input.cohort }),
    source: "template",
  });

  if (!process.env.ANTHROPIC_API_KEY) return fallback();

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    if (response.stop_reason === "refusal") return fallback();
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return text.length > 80 ? { text, source: "ai" } : fallback();
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[ai-message] Claude API ${error.status}: ${error.message}`);
    } else {
      console.error("[ai-message]", error);
    }
    return fallback();
  }
}
