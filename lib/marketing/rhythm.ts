import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { examBootEnabled } from "@/lib/examboot/client";
import { generateVariants } from "@/lib/marketing/ai";
import { cohortFacts, factsForModel, recentPosts, recentTestStats } from "@/lib/marketing/data";
import { type BalancePost, type MarketingKind, type Pillar, editorialBalance, marketingKind, newPostCode, pillarsFor, trackedLink, withLink } from "@/lib/marketing/plan";
import { loadMarketingSettings } from "@/lib/marketing/settings";

/**
 * Content rhythm (lot 7 of docs/PILOTAGE.md): each week, for a cohort in
 * campaign on LinkedIn, the Studio writes three variants on the pillar the
 * last 30 days used least. They land in the library as drafts "proposé
 * automatiquement"; nothing is published until Ben gives one a day.
 */

/** Posts per cohort per week below which drafts are proposed. */
export const RHYTHM_POSTS_PER_WEEK = 3;
/** Drafts are proposed at most once in this many days per cohort. */
export const RHYTHM_EVERY_DAYS = 6;

/** The subject of the week: the least used pillar (the offer pillar last), one of its example subjects. */
export function chooseSubject(kind: MarketingKind, recent: BalancePost[], week: number): { pillar: Pillar; topic: string; destination: string } {
  const pillars = pillarsFor(kind) as Record<string, { label: string; destination: string; examples: readonly string[] }>;
  const { byPillar } = editorialBalance(recent, kind);
  const keys = Object.keys(pillars).sort((a, b) => (byPillar[a as Pillar] ?? 0) - (byPillar[b as Pillar] ?? 0) || Number(a === "offre") - Number(b === "offre") || a.localeCompare(b));
  const pillar = keys[0]!;
  const examples = pillars[pillar]!.examples;
  let destination = pillars[pillar]!.destination;
  if (destination === "test" && !examBootEnabled()) destination = "scanner";
  return { pillar: pillar as Pillar, topic: examples[week % examples.length]!, destination };
}

/** Writes and keeps the week's drafts for a cohort. Returns how many were kept, or an error. */
export async function generateRhythmDrafts(cohortId: number, now = new Date()): Promise<{ ok: true; count: number; topic: string } | { ok: false; error: string }> {
  const [facts, settings] = await Promise.all([cohortFacts(cohortId, now), loadMarketingSettings()]);
  if (!facts) return { ok: false, error: "Cohorte introuvable." };
  const kind = marketingKind(facts.program);
  const [tests, recent] = await Promise.all([recentTestStats(settings.testThreshold, now), recentPosts(now, kind)]);
  const subject = chooseSubject(kind, recent, Math.floor(now.getTime() / (7 * 86_400_000)));
  const result = await generateVariants({ kind, facts: factsForModel(facts, kind === "ia" ? null : tests.stats), channel: "linkedin", pillar: subject.pillar, format: "standard", topic: subject.topic, destination: subject.destination as never, brief: "" });
  if (!result.ok) return result;
  for (const v of result.variants) {
    const code = newPostCode("linkedin");
    const link = trackedLink(env.NEXT_PUBLIC_APP_URL, "linkedin", facts.id, code, subject.destination as never);
    await prisma.marketingPost.create({
      data: { cohortId: facts.id, channel: "linkedin", angle: subject.pillar, pillar: subject.pillar, format: "standard", topic: subject.topic, destination: subject.destination, code, text: withLink(v.text, link), visualBrief: JSON.stringify(v.visual), autoDraft: true },
    });
  }
  return { ok: true, count: result.variants.length, topic: subject.topic };
}
