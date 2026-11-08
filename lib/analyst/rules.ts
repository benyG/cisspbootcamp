import { z } from "zod";

/**
 * The analyst of the week (Ben, 08/11, from the validated prototype). Pure:
 * the week key, the output contract, and the guard that keeps only figures
 * found in the week's snapshot. The snapshot holds counts and rates only,
 * never a person. Constants are Ben's.
 */

/** Below this many people (visitors, prospects, results…), a figure is a small sample. */
export const MIN_SAMPLE = 20;
/** Below this ad spend, USD cents, no verdict on an ad. */
export const MIN_SPEND_CENTS = 5_000;
/** At most this many orientations per week. */
export const MAX_BETS = 3;
/** A kept orientation stays in the action queue this many days. */
export const KEEP_DAYS = 14;

const DAY_MS = 86_400_000;

/** The Monday the analysis is for: today if Monday, otherwise the next one (YYYY-MM-DD). */
export function analystWeekKey(now: Date): string {
  const day = now.getUTCDay();
  const ahead = (8 - day) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + ahead * DAY_MS).toISOString().slice(0, 10);
}

/** The weekly run happens on Sunday, for the Monday report. */
export const isAnalystDay = (now: Date) => now.getUTCDay() === 0;

export const CONFIDENCE = { solid: "Chiffres solides", likely: "Probable", small: "Échantillon petit" } as const;
export type Confidence = keyof typeof CONFIDENCE;
export const OUTCOME = { worked: "A marché", no_effect: "Sans effet", too_early: "Trop tôt" } as const;
export type Outcome = keyof typeof OUTCOME;

export const outputSchema = z.object({
  diagnosis: z.string().trim().min(1).max(600),
  bets: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    confidence: z.enum(["solid", "likely", "small"]),
    facts: z.array(z.object({ label: z.string().trim().min(1).max(140), value: z.string().trim().min(1).max(60) })).max(5),
    action: z.string().trim().min(1).max(400),
    watch: z.object({ metric: z.string().trim().min(1).max(140), target: z.string().trim().min(1).max(140) }),
  })).max(MAX_BETS),
  review: z.array(z.object({ title: z.string().trim().min(1).max(160), outcome: z.enum(["worked", "no_effect", "too_early"]), note: z.string().trim().min(1).max(300) })).max(MAX_BETS),
});
export type AnalystOutput = z.infer<typeof outputSchema>;
export type Bet = AnalystOutput["bets"][number];

/** The same contract, as the JSON schema the model answers with. */
export const OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["diagnosis", "bets", "review"],
  properties: {
    diagnosis: { type: "string", description: "Deux phrases au plus : où en sont les objectifs, et le point qui compte cette semaine." },
    bets: {
      type: "array",
      description: "Trois orientations au plus, de la plus utile à la moins utile.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "confidence", "facts", "action", "watch"],
        properties: {
          title: { type: "string", description: "L'orientation, en une phrase à l'impératif." },
          confidence: { type: "string", enum: ["solid", "likely", "small"] },
          facts: {
            type: "array",
            description: "2 à 4 chiffres qui la justifient, recopiés tels quels depuis la PHOTO.",
            items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: { type: "string" }, value: { type: "string" } } },
          },
          action: { type: "string", description: "Ce qu'il faut faire, concrètement, et où (dans l'admin ou ailleurs)." },
          watch: { type: "object", additionalProperties: false, required: ["metric", "target"], properties: { metric: { type: "string" }, target: { type: "string" } } },
        },
      },
    },
    review: {
      type: "array",
      description: "Pour chaque orientation retenue la semaine dernière (fournie dans la PHOTO), ce qu'il en est.",
      items: { type: "object", additionalProperties: false, required: ["title", "outcome", "note"], properties: { title: { type: "string" }, outcome: { type: "string", enum: ["worked", "no_effect", "too_early"] }, note: { type: "string" } } },
    },
  },
} as const;

/** Every number written in a text, normalised ("1 180" → 1180, "13,5" → 13.5). */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.replace(/[  ]/g, " ").matchAll(/\d{1,3}(?: \d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g)) {
    const n = Number(m[0].replace(/ /g, "").replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** All the numbers of the snapshot, as the model saw them. */
export function snapshotNumbers(snapshot: unknown): Set<number> {
  const set = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === "number") set.add(v);
    else if (typeof v === "string") for (const n of numbersIn(v)) set.add(n);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(snapshot);
  return set;
}

/**
 * Keeps only the figures found in the snapshot: a fact whose numbers are
 * not all in it is removed, and a bet left without any fact is removed.
 * The analyst can phrase; it cannot invent a figure.
 */
export function groundOutput(output: AnalystOutput, snapshot: unknown): { output: AnalystOutput; removed: number } {
  const known = snapshotNumbers(snapshot);
  let removed = 0;
  const bets = output.bets.flatMap((b) => {
    const facts = b.facts.filter((f) => {
      const ok = numbersIn(f.value).every((n) => known.has(n));
      if (!ok) removed++;
      return ok;
    });
    if (!facts.length) { removed++; return []; }
    return [{ ...b, facts }];
  });
  return { output: { ...output, bets: bets.slice(0, MAX_BETS) }, removed };
}

/** Ben's decision on each orientation, by its rank (1, 2, 3). */
export const decisionsSchema = z.record(z.string(), z.object({ status: z.enum(["kept", "dropped"]), at: z.string() }));
export type Decisions = z.infer<typeof decisionsSchema>;

export function readDecisions(value: unknown): Decisions {
  const parsed = decisionsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/** Relative change between two counts, in whole percent, or null when there is nothing to compare. */
export function delta(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

/** A conversion rate in whole percent, or null under one person. */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** The paragraph of the Monday report. */
export function reportParagraph(output: AnalystOutput, url: string): string[] {
  if (!output.bets.length && !output.diagnosis) return [];
  return [
    "L’analyste de la semaine :",
    output.diagnosis,
    "",
    ...output.bets.map((b, i) => `${i + 1}. ${b.title} (${CONFIDENCE[b.confidence].toLowerCase()})`),
    "",
    `Retenir ou écarter : ${url}`,
    "",
  ];
}
