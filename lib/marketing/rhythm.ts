import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { examBootEnabled } from "@/lib/examboot/client";
import { generateVariants } from "@/lib/marketing/ai";
import { cohortFacts, factsForModel, recentPosts, recentTestStats } from "@/lib/marketing/data";
import { type BalancePost, type MarketingKind, type Pillar, editorialBalance, marketingKind, newPostCode, trackedLink, withLink } from "@/lib/marketing/plan";
import { DEFAULT_EDITORIAL, type EditorialLine, activePillars, editorialForModel, loadEditorial } from "@/lib/marketing/editorial";
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

/**
 * The subject of the week: the pillar furthest behind its share in Ben's
 * editorial line (the offer pillar last on a tie), one of its example subjects.
 */
export function chooseSubject(kind: MarketingKind, recent: BalancePost[], week: number, line: EditorialLine = DEFAULT_EDITORIAL[kind]): { pillar: Pillar; topic: string; destination: string } {
  const { byPillar } = editorialBalance(recent, kind);
  const n = recent.length;
  const gap = (p: { key: string; share: number }) => (byPillar[p.key as Pillar] ?? 0) - (p.share / 100) * (n + 1);
  const ranked = activePillars(line).filter((p) => p.examples.length > 0).sort((a, b) => gap(a) - gap(b) || Number(a.key === "offre") - Number(b.key === "offre") || a.key.localeCompare(b.key));
  const chosen = ranked[0] ?? activePillars(DEFAULT_EDITORIAL[kind])[0]!;
  const pillar = chosen.key;
  const examples = chosen.examples;
  let destination = chosen.destination;
  if (destination === "test" && !examBootEnabled()) destination = "scanner";
  return { pillar: pillar as Pillar, topic: examples[week % examples.length]!, destination };
}

/** Writes and keeps the week's drafts for a cohort. Returns how many were kept, or an error. */
export async function generateRhythmDrafts(cohortId: number, now = new Date()): Promise<{ ok: true; count: number; topic: string } | { ok: false; error: string }> {
  const [facts, settings] = await Promise.all([cohortFacts(cohortId, now), loadMarketingSettings()]);
  if (!facts) return { ok: false, error: "Cohorte introuvable." };
  const kind = marketingKind(facts.program);
  const [tests, recent] = await Promise.all([recentTestStats(settings.testThreshold, now), recentPosts(now, kind)]);
  const line = await loadEditorial(kind);
  const subject = chooseSubject(kind, recent, Math.floor(now.getTime() / (7 * 86_400_000)), line);
  const result = await generateVariants({ kind, editorial: editorialForModel(line), pillarLine: line.pillars[subject.pillar], facts: factsForModel(facts, kind === "ia" ? null : tests.stats), channel: "linkedin", pillar: subject.pillar, format: "standard", topic: subject.topic, destination: subject.destination as never, brief: "" });
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
