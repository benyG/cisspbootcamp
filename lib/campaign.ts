import { z } from "zod";

import { CAMPAIGN_DAYS, closeDayFor } from "@/lib/pilotage";

/**
 * "Lancer une cohorte" (lot 5 of docs/PILOTAGE.md): a cohort's campaign
 * settings and the dated plan from J-60 to after the end. Pure: the wizard
 * previews it in the browser, the cohort page and the admin queue read it.
 * Every action says whether it runs alone (a playbook, the Monday report)
 * or waits for Ben, and where Ben does it.
 */

const DAY_MS = 86_400_000;

export const campaignSchema = z.object({
  channels: z.object({
    email: z.boolean().default(true),
    linkedin: z.boolean().default(true),
    facebook: z.boolean().default(false),
    whatsapp: z.boolean().default(true),
    ads: z.boolean().default(false),
  }).default({}),
  adsBudgetUsd: z.number().int().min(0).max(100_000).nullable().default(null),
  promo: z.object({
    early: z.object({ priceUsd: z.number().int().min(1).max(100_000), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullable().default(null),
    partners: z.boolean().default(false),
    referral: z.boolean().default(false),
  }).default({}),
});
export type Campaign = z.output<typeof campaignSchema>;
export type CampaignInput = z.input<typeof campaignSchema>;

export const DEFAULT_CAMPAIGN: Campaign = campaignSchema.parse({});

/** A stored campaign, or null when the cohort has none (or it is unreadable). */
export function readCampaign(value: unknown): Campaign | null {
  if (value === null || value === undefined) return null;
  const parsed = campaignSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type PlanKind = "auto" | "validate" | "measure" | "milestone";

export type PlanAction = {
  /** Stable within a cohort: marks the action done. */
  key: string;
  /** Days from the first day. */
  day: number;
  date: Date;
  text: string;
  kind: PlanKind;
  /** Who does it: a playbook, the report, or the tool Ben uses. */
  by: string;
  /** Where Ben does it, for "validate" actions. */
  href?: string;
  note?: string;
};

export const KIND_LABEL: Record<PlanKind, string> = { auto: "Automatique", validate: "À valider", measure: "Mesure", milestone: "Jalon" };

const usd = (cents: number) => `${new Intl.NumberFormat("fr-FR").format(cents)} USD`;
const dayMonth = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/**
 * The plan, sorted by date. `startsAt` is the first day, `endsAt` the last.
 * Promo prices are typed in whole USD.
 */
export function buildCampaignPlan(cohort: { program: string; startsAt: Date; endsAt: Date; goal: number }, campaign: Campaign): PlanAction[] {
  const { channels, promo } = campaign;
  const close = closeDayFor(cohort.program);
  const goal = Math.max(1, cohort.goal);
  const social = [channels.linkedin && "LinkedIn", channels.facebook && "Facebook"].filter(Boolean).join(" et ");
  const out: Array<Omit<PlanAction, "date">> = [];
  const add = (a: Omit<PlanAction, "date">) => out.push(a);
  const seats = (share: number) => { const n = Math.round(goal * share); return `${n} place${n > 1 ? "s" : ""}`; };

  add({ key: "opening", day: -CAMPAIGN_DAYS, kind: "auto", by: "Playbook Ouverture", text: channels.email ? "Ouverture : « les inscriptions sont ouvertes » aux prospects consentants du programme (ou un rappel pour ouvrir les inscriptions)" : "Ouverture : un rappel si les inscriptions ne sont pas ouvertes" });
  if (social) add({ key: "content-plan", day: -CAMPAIGN_DAYS, kind: "validate", by: "Studio marketing", href: "/admin/marketing", text: `Préparer le plan de contenu des 8 semaines (${social})` });
  if (promo.early) add({ key: "early-start", day: -CAMPAIGN_DAYS, kind: "validate", by: "Tarifs", href: "/admin/parametres/prix", text: `Tarif de lancement : ${usd(promo.early.priceUsd)} jusqu’au ${dayMonth(promo.early.until)}`, note: "appliqué automatiquement au paiement avec le lot 6 ; d’ici là, réglé dans Tarifs" });
  if (promo.partners) add({ key: "partners", day: -CAMPAIGN_DAYS, kind: "validate", by: "Promo", href: "/admin/pilotage", text: "Créer un code par partenaire", note: "codes suivis inscrit par inscrit avec le lot 6" });
  add({ key: "monday", day: -56, kind: "auto", by: "Rapport du lundi", text: "Chaque lundi : où en est la cohorte, ce qui a marché, qui appeler (e-mail)" });
  add({ key: "playbooks", day: -56, kind: "auto", by: "Playbooks", text: "En continu : inscriptions non finalisées, retard sur la courbe, cohorte pleine", note: channels.whatsapp ? "les relances personnelles arrivent dans votre file avec un message WhatsApp prêt" : undefined });
  if (social) {
    for (let d = -56; d < close; d += 7) add({ key: `posts${d}`, day: d, kind: "validate", by: "Studio marketing", href: "/admin/marketing", text: `Valider les publications de la semaine (${social})` });
  }
  if (promo.referral) add({ key: "referral", day: -45, kind: "validate", by: "Anciens participants", href: "/admin/pilotage", text: "Inviter les anciens participants à recommander la cohorte", note: "codes de parrainage avec le lot 6" });
  if (channels.ads) add({ key: "ads", day: -45, kind: "validate", by: "Pub payante", href: "/admin/marketing", text: `Préparer la campagne payante${campaign.adsBudgetUsd ? ` (budget ${usd(campaign.adsBudgetUsd)})` : ""} : textes, visuels, liens suivis ; vous la lancez dans Meta ou LinkedIn` });
  add({ key: "check-20", day: -45, kind: "measure", by: "Pilotage", text: `Point d’étape : ${seats(0.2)} attendue${Math.round(goal * 0.2) > 1 ? "s" : ""} (20 %)`, note: "en retard : alerte et pack de rattrapage" });
  if (promo.early) {
    const end = Math.floor((new Date(`${promo.early.until}T00:00:00Z`).getTime() - cohort.startsAt.getTime()) / DAY_MS);
    add({ key: "early-end", day: end, kind: "validate", by: "Tarifs", href: "/admin/parametres/prix", text: "Fin du tarif de lancement : remettre le prix normal" });
  }
  add({ key: "check-50", day: -21, kind: "measure", by: "Pilotage", text: `Point d’étape : ${seats(0.5)} attendues (50 %)`, note: "en retard : alerte et pack de rattrapage" });
  if (channels.email) add({ key: "follow-up", day: -14, kind: "validate", by: "File d’actions", href: "/admin", text: "Relancer les prospects « à suivre » qui n’ont pas réservé" });
  if (channels.email) add({ key: "last-call", day: close - 4, kind: "auto", by: "Playbook Dernier appel", text: "Dernier appel : la vraie date de fermeture et les places restantes, aux prospects engagés" });
  add({ key: "balance", day: Math.min(-7, close), kind: "auto", by: "Rappels de solde", text: "Rappels du second versement (paiement en 2 fois)" });
  add({ key: "close", day: close, kind: "milestone", by: "—", text: `Fermeture des admissions (objectif : ${seats(1)})` });
  add({ key: "start", day: 0, kind: "milestone", by: "—", text: "Premier jour" });
  const lastDay = Math.round((cohort.endsAt.getTime() - cohort.startsAt.getTime()) / DAY_MS);
  add({ key: "wrapup", day: lastDay + 7, kind: "auto", by: "Playbook Fin de cohorte", text: "Messages prêts pour demander un témoignage (avec accord écrit) et une recommandation" });

  return out
    .map((a) => ({ ...a, date: new Date(cohort.startsAt.getTime() + a.day * DAY_MS) }))
    .sort((a, b) => a.day - b.day);
}

/** Actions waiting for Ben today: "à valider", due, not done, not too old (two weeks). */
export function dueActions(plan: readonly PlanAction[], done: ReadonlySet<string>, now: Date): PlanAction[] {
  return plan.filter((a) => a.kind === "validate" && !done.has(a.key) && a.date.getTime() <= now.getTime() && now.getTime() - a.date.getTime() < 14 * DAY_MS);
}

/** Counts for the summary line. */
export function planCounts(plan: readonly PlanAction[]): { auto: number; validate: number } {
  return { auto: plan.filter((a) => a.kind === "auto").length, validate: plan.filter((a) => a.kind === "validate").length };
}

/** Plan phases, for display. */
export const PHASES: ReadonlyArray<{ title: string; from: number; to: number }> = [
  { title: "Ouverture · J-60 à J-46", from: -999, to: -46 },
  { title: "Montée · J-45 à J-22", from: -45, to: -22 },
  { title: "Accélération · J-21 à J-8", from: -21, to: -8 },
  { title: "Clôture · J-7 au premier jour", from: -7, to: 0 },
  { title: "Après", from: 1, to: 9999 },
];

/** The form's flat fields → a campaign (server and browser). */
export function campaignFromForm(get: (name: string) => string | null): Campaign {
  const on = (name: string) => get(name) === "on" || get(name) === "true";
  const int = (name: string) => { const v = Number(get(name)); return Number.isFinite(v) && v > 0 ? Math.round(v) : null; };
  const earlyPrice = int("earlyPriceUsd");
  const earlyUntil = get("earlyUntil") ?? "";
  return campaignSchema.parse({
    channels: { email: on("chEmail"), linkedin: on("chLinkedin"), facebook: on("chFacebook"), whatsapp: on("chWhatsapp"), ads: on("chAds") },
    adsBudgetUsd: on("chAds") ? int("adsBudgetUsd") : null,
    promo: {
      early: on("promoEarly") && earlyPrice && /^\d{4}-\d{2}-\d{2}$/.test(earlyUntil) ? { priceUsd: earlyPrice, until: earlyUntil } : null,
      partners: on("promoPartners"),
      referral: on("promoReferral"),
    },
  });
}
