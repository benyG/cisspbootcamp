import { randomBytes } from "node:crypto";

import { z } from "zod";

import { iaDomain, iaUrl } from "@/lib/ia-domain";

/**
 * Paid campaigns (lot 8 of docs/PILOTAGE.md). Ben runs the ad in Meta,
 * LinkedIn or Google himself; here he declares it once, gets its tracked
 * link, and types what he has spent so far. Visits, prospects and paid
 * seats are counted from the link's utm_campaign: the cost per prospect
 * and per signup come from real counts only. Pure: the page and the tests.
 */

export const AD_CHANNELS = {
  facebook: { label: "Facebook / Instagram", utmSource: "facebook" },
  linkedin: { label: "LinkedIn", utmSource: "linkedin" },
  google: { label: "Google", utmSource: "google" },
  tiktok: { label: "TikTok", utmSource: "tiktok" },
  other: { label: "Autre", utmSource: "pub" },
} as const;
export type AdChannel = keyof typeof AD_CHANNELS;
export const AD_CHANNEL_IDS = Object.keys(AD_CHANNELS) as AdChannel[];

/** Where an ad sends people: the page that captures a prospect for each programme. */
export const AD_DESTINATIONS = {
  scanner: { label: "Analyse de profil CISSP", path: "/scanner" },
  cc: { label: "Page CC", path: "/demarrer" },
  ia: { label: "Diagnostic Bâtisseur IA", path: "/ia/diagnostic" },
} as const;
export type AdDestination = keyof typeof AD_DESTINATIONS;

/** Cost per signup at or under this share of the price paid: the ad pays for itself comfortably. Ben's constant. */
export const AD_GOOD_SHARE = 0.15;
/** Over this share of the price: the ad costs too much for what it brings. */
export const AD_HIGH_SHARE = 0.35;
/** Spend below which no verdict is given (too early to judge), USD cents. */
export const AD_MIN_SPEND_CENTS = 5_000;

export const adCampaignSchema = z.object({
  name: z.string().trim().min(2, "Nom de la campagne requis").max(80),
  channel: z.enum(AD_CHANNEL_IDS as [AdChannel, ...AdChannel[]]),
  destination: z.enum(Object.keys(AD_DESTINATIONS) as [AdDestination, ...AdDestination[]]),
  cohortId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().positive().nullable()),
  budgetUsd: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(1).max(100_000).nullable()),
});

/** "Relance décembre" → "pub-relance-decembre-3f9a": what utm_campaign carries. */
export function adCode(name: string, random = randomBytes(2)): string {
  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, "");
  return `pub-${slug ? `${slug}-` : ""}${random.toString("hex").slice(0, 4)}`;
}

/** The link to put in the ad; the Bâtisseur IA pages on their own domain when it is set. */
export function adLink(appUrl: string, campaign: { channel: AdChannel; destination: AdDestination; code: string }, domain: string | null = iaDomain()): string {
  const params = new URLSearchParams({ utm_source: AD_CHANNELS[campaign.channel].utmSource, utm_medium: "paid", utm_campaign: campaign.code });
  return iaUrl(`${AD_DESTINATIONS[campaign.destination].path}?${params.toString()}`, appUrl, domain);
}

/** "USD 12,50" style: amounts are USD cents. */
export const usdCents = (cents: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100)} USD`;

export type AdCounts = { spentCents: number; visits: number; leads: number; paid: number; revenueCents: number };
export type AdVerdict = "too_early" | "no_signup" | "good" | "watch" | "high";

export type AdMetrics = AdCounts & {
  costPerVisitCents: number | null;
  costPerLeadCents: number | null;
  costPerSignupCents: number | null;
  /** Revenue of the paid seats over the spend: 3 = three dollars back per dollar spent. */
  returnRatio: number | null;
  verdict: AdVerdict;
};

const per = (spent: number, n: number) => (n > 0 && spent > 0 ? Math.round(spent / n) : null);

/**
 * Costs and a verdict, from real counts. The cost of a seat is weighed
 * against what those seats actually paid (promos and tiers included).
 */
export function adMetrics(counts: AdCounts): AdMetrics {
  const costPerSignupCents = per(counts.spentCents, counts.paid);
  const priceCents = counts.paid ? counts.revenueCents / counts.paid : 0;
  let verdict: AdVerdict;
  if (counts.paid > 0 && costPerSignupCents !== null && priceCents > 0) {
    const share = costPerSignupCents / priceCents;
    verdict = share <= AD_GOOD_SHARE ? "good" : share <= AD_HIGH_SHARE ? "watch" : "high";
  } else if (counts.paid > 0) verdict = "good";
  else verdict = counts.spentCents < AD_MIN_SPEND_CENTS ? "too_early" : "no_signup";
  return {
    ...counts,
    costPerVisitCents: per(counts.spentCents, counts.visits),
    costPerLeadCents: per(counts.spentCents, counts.leads),
    costPerSignupCents,
    returnRatio: counts.spentCents > 0 && counts.revenueCents > 0 ? Math.round((counts.revenueCents / counts.spentCents) * 10) / 10 : null,
    verdict,
  };
}

/** One line Ben reads in ten seconds. */
export function verdictText(m: AdMetrics): string {
  const priceCents = m.paid ? m.revenueCents / m.paid : 0;
  const share = () => `${Math.round(((m.costPerSignupCents ?? 0) / priceCents) * 100)} % du prix payé`;
  switch (m.verdict) {
    case "too_early": return m.spentCents ? `Trop tôt pour juger : ${usdCents(m.spentCents)} dépensés.` : "Pas encore de dépense saisie.";
    case "no_signup": return `${usdCents(m.spentCents)} dépensés, aucune place payée pour l’instant${m.leads ? ` (${m.leads} prospect${m.leads > 1 ? "s" : ""} à relancer)` : ""}.`;
    case "good": return `Rentable : une place coûte ${usdCents(m.costPerSignupCents ?? 0)} de pub${priceCents && m.costPerSignupCents ? `, ${share()}` : ""}.`;
    case "watch": return `À surveiller : une place coûte ${usdCents(m.costPerSignupCents ?? 0)} de pub, ${share()}.`;
    case "high": return `Trop cher : une place coûte ${usdCents(m.costPerSignupCents ?? 0)} de pub, ${share()}. Changez le visuel, le public ou arrêtez.`;
  }
}

export const VERDICT_LABEL: Record<AdVerdict, string> = { too_early: "Trop tôt", no_signup: "Aucune place", good: "Rentable", watch: "À surveiller", high: "Trop cher" };

/** Totals over several campaigns (the Monday report, the page header). */
export function adTotals(rows: AdCounts[]): AdCounts {
  return rows.reduce((t, r) => ({ spentCents: t.spentCents + r.spentCents, visits: t.visits + r.visits, leads: t.leads + r.leads, paid: t.paid + r.paid, revenueCents: t.revenueCents + r.revenueCents }), { spentCents: 0, visits: 0, leads: 0, paid: 0, revenueCents: 0 });
}
