import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { MARKETING_MODEL } from "@/lib/marketing/ai";
import { type Mode, resolveModes } from "@/lib/playbooks/rules";

import { type AnalystOutput, CONFIDENCE, MAX_BETS, MIN_SAMPLE, MIN_SPEND_CENTS, OUTPUT_JSON_SCHEMA, analystWeekKey, groundOutput, isAnalystDay, outputSchema } from "./rules";
import { buildSnapshot } from "./snapshot";

/**
 * The analyst of the week (Ben, 08/11): Claude reads the week's snapshot and
 * proposes three orientations, each with the figures behind it, and says
 * what came of last week's. It decides nothing and sends nothing; Ben keeps
 * or drops each orientation. Figures not found in the snapshot are removed.
 */

const SYSTEM = `Tu es l'analyste business d'une petite entreprise de formation francophone en ligne : les bootcamps CISSP et CC de Ben (coach CISSP) et le Bâtisseur IA d'ExamBoot. L'objectif : remplir chaque cohorte. Chaque semaine, tu lis la PHOTO de la semaine (des comptes et des taux, jamais une personne) et tu proposes au plus ${MAX_BETS} orientations pour atteindre les objectifs.

Règles non négociables :
- Chaque chiffre que tu écris vient de la PHOTO, recopié tel quel (même nombre, même unité). Tu n'en calcules aucun nouveau, tu n'en inventes aucun, tu n'utilises aucune moyenne de marché ou de secteur.
- Sous ${MIN_SAMPLE} personnes, ou sous ${MIN_SPEND_CENTS / 100} USD dépensés pour une pub, la confiance est « small » et tu le dis. « solid » seulement quand les chiffres sont nets et suffisants.
- Une orientation = une cause probable lue dans les chiffres, une action concrète que Ben peut faire cette semaine (dans l'admin : file d'actions, Marketing, Pilotage, Pub payante, Codes promo, Playbooks ; ou sur le site), et l'indicateur à suivre avec son objectif.
- Classe-les par effet attendu sur les places payées. Moins de trois orientations si les données ne justifient pas plus : mieux vaut une orientation solide que trois fragiles.
- Pour chaque orientation retenue la semaine dernière (fournie dans la PHOTO), dis si elle a marché, sans effet, ou trop tôt pour juger, d'après l'indicateur à suivre.
- Aucune promesse, aucun « garanti ». Ne propose jamais d'envoyer des messages non sollicités, d'importer des contacts ou d'écrire à des personnes qui n'ont pas donné leur accord.
- Français clair, phrases courtes, vouvoiement de Ben.`;

const CONFIDENCE_HELP = Object.entries(CONFIDENCE).map(([k, v]) => `${k} = ${v}`).join(", ");

export type AnalystResult = { ok: true; weekKey: string; bets: number; removed: number } | { ok: false; error: string };

/** Builds the snapshot, asks Claude, keeps only grounded figures, stores the week's report. */
export async function generateAnalysis(now = new Date()): Promise<AnalystResult> {
  const weekKey = analystWeekKey(now);
  const snapshot = await buildSnapshot(now);
  let output: AnalystOutput;
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MARKETING_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_JSON_SCHEMA } },
      messages: [{ role: "user", content: `Niveaux de confiance : ${CONFIDENCE_HELP}.\n\nPHOTO de la semaine (JSON) :\n${JSON.stringify(snapshot, null, 1)}` }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "Le modèle a refusé l’analyse." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "Réponse coupée. Relancez l’analyse." };
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    const parsed = outputSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false, error: "Réponse de l’analyste illisible. Relancez l’analyse." };
    output = parsed.data;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[analyst] Claude API ${error.status}: ${error.message}`);
      return { ok: false, error: `Le service d’IA a répondu ${error.status}. Réessayez dans un instant.` };
    }
    console.error("[analyst]", error);
    return { ok: false, error: "L’analyse a échoué. Réessayez." };
  }
  const grounded = groundOutput(output, snapshot);
  if (grounded.removed) console.warn(`[analyst] ${grounded.removed} chiffre(s) ou orientation(s) sans source retirés`);
  const data = { snapshot: snapshot as unknown as Prisma.InputJsonValue, output: grounded.output as unknown as Prisma.InputJsonValue, model: MARKETING_MODEL };
  // A new analysis for the same week starts the decisions over.
  await prisma.analystReport.upsert({ where: { weekKey }, create: { weekKey, ...data, decisions: {} }, update: { ...data, decisions: {} } });
  return { ok: true, weekKey, bets: grounded.output.bets.length, removed: grounded.removed };
}

/** From the daily cron: on Sundays, once per week, when the playbook is on. */
export async function runAnalyst(now = new Date(), mode?: Mode): Promise<"off" | "trial" | "not_today" | "already" | "done" | "failed"> {
  const current = mode ?? resolveModes((await prisma.siteSetting.findUnique({ where: { key: "playbooks" } }).catch(() => null))?.value).analyst;
  if (current !== "on") return current === "off" ? "off" : "trial";
  if (!isAnalystDay(now)) return "not_today";
  if (await prisma.analystReport.findUnique({ where: { weekKey: analystWeekKey(now) }, select: { id: true } })) return "already";
  const result = await generateAnalysis(now);
  return result.ok ? "done" : "failed";
}

/** The report of a week, read back. */
export async function analystReport(weekKey: string) {
  const row = await prisma.analystReport.findUnique({ where: { weekKey } });
  if (!row) return null;
  const output = outputSchema.safeParse(row.output);
  return { ...row, output: output.success ? output.data : { diagnosis: "", bets: [], review: [] } };
}
