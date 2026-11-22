import { z } from "zod";

/**
 * Bâtisseur IA Entreprises (Ben, 22/11/2026): support for companies, not
 * training. Pure part: the catalogue of the five steps validated with Ben,
 * the request form, the proposal and its arithmetic. No database here
 * (lib/enterprise-server.ts reads and writes).
 */

export const ENTERPRISE_OFFER_KEY = "enterprise_offer";

export const PACKAGE_CODES = ["diagnostic", "roadmap", "pilot", "deploy", "autopilot"] as const;
export type PackageCode = (typeof PACKAGE_CODES)[number];

export type Zone = "africa" | "intl";
export const ZONE_LABEL: Record<Zone, string> = { africa: "Afrique francophone", intl: "International" };

/** The pricing tier code decides the zone; anything but Africa pays the international price. */
export function zoneOfTier(tierCode: string | null | undefined): Zone {
  return tierCode === "africa" ? "africa" : "intl";
}

const text = (max: number) => z.string().trim().min(1).max(max);
const usdCents = z.number().int().min(0).max(100_000_000);

export const packageSchema = z.object({
  code: z.enum(PACKAGE_CODES),
  name: text(80),
  duration: text(60),
  /** What it contains, a few short lines. */
  items: z.array(text(140)).min(1).max(6),
  /** What the client has at the end, one sentence. */
  outcome: text(160),
  africaUsd: usdCents,
  intlUsd: usdCents,
  /** "dès 10 000 USD": a starting price. */
  from: z.boolean(),
  /** A monthly subscription, not a one-off. */
  monthly: z.boolean(),
  /** Calendar weeks, for the proposal's timeline (0 for the subscription). */
  weeks: z.number().int().min(0).max(52),
  /** Highlighted on the page (« Le plus demandé »). */
  featured: z.boolean(),
});
export type EnterprisePackage = z.infer<typeof packageSchema>;

export const offerSchema = z.object({
  packages: z.array(packageSchema).length(PACKAGE_CODES.length).refine((ps) => PACKAGE_CODES.every((c, i) => ps[i]?.code === c), "Les cinq marches restent dans l’ordre."),
  options: z.array(z.object({ name: text(80), text: text(300) })).max(4),
});
export type EnterpriseOffer = z.infer<typeof offerSchema>;

/** The catalogue validated with Ben on 22/11/2026, until he edits it in the admin. */
export const DEFAULT_OFFER: EnterpriseOffer = {
  packages: [
    { code: "diagnostic", name: "Diagnostic IA", duration: "2 semaines", items: ["4 à 6 entretiens avec vos équipes", "8 à 12 processus cartographiés", "Volet données personnelles", "3 cas d’usage chiffrés"], outcome: "Une feuille de route sur 90 jours", africaUsd: 150_000, intlUsd: 350_000, from: false, monthly: false, weeks: 2, featured: false },
    { code: "roadmap", name: "Feuille de route & gouvernance", duration: "3 à 4 semaines", items: ["Atelier de direction", "Priorités valeur × faisabilité", "Charte IA et registre des outils", "Budget et architecture cible"], outcome: "Un plan sur 12 mois validé par la direction", africaUsd: 450_000, intlUsd: 900_000, from: false, monthly: false, weeks: 4, featured: false },
    { code: "pilot", name: "Pilote 30 jours", duration: "30 jours", items: ["Un processus mis en service", "Indicateurs fixés avant", "Point d’arrêt à J14", "Mesure et décision à J30"], outcome: "Un processus en service, mesuré à J30", africaUsd: 400_000, intlUsd: 800_000, from: false, monthly: false, weeks: 4, featured: true },
    { code: "deploy", name: "Déploiement", duration: "2 à 3 mois", items: ["3 à 5 processus connectés", "CRM, comptabilité, paiements, messagerie", "Documentation complète", "Votre équipe formée pour reprendre"], outcome: "Un système en production, à votre nom", africaUsd: 1_000_000, intlUsd: 2_000_000, from: true, monthly: false, weeks: 10, featured: false },
    { code: "autopilot", name: "Pilote automatique", duration: "Abonnement, 3 mois minimum", items: ["Surveillance et ajustements", "8 h d’évolutions par mois", "Rapport mensuel", "Plafond de dépense IA"], outcome: "Vos automatisations suivies chaque mois", africaUsd: 80_000, intlUsd: 180_000, from: false, monthly: true, weeks: 0, featured: false },
  ],
  options: [
    { name: "Former vos équipes", text: "La formation Bâtisseur IA en groupe réservé, sur site ou en ligne : votre équipe apprend à faire évoluer le système elle-même." },
    { name: "Conformité IA", text: "Déclarations à l’autorité de protection des données (ARTCI, CDP, APDP), registre des outils IA, sensibilisation des équipes. Dès 2 500 USD." },
  ],
};

/** Whatever is stored, a complete catalogue: the stored one if valid, else the default. */
export function resolveOffer(raw: unknown): EnterpriseOffer {
  const parsed = offerSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_OFFER;
}

export function priceOf(p: EnterprisePackage, zone: Zone): number {
  return zone === "africa" ? p.africaUsd : p.intlUsd;
}

/** "1 500 USD", "dès 10 000 USD", "800 USD / mois". */
export function priceLabel(p: EnterprisePackage, zone: Zone): string {
  const amount = `${formatUsd(priceOf(p, zone))}`;
  return `${p.from ? "dès " : ""}${amount}${p.monthly ? " / mois" : ""}`;
}

export function formatUsd(cents: number): string {
  const whole = Math.round(cents / 100);
  return `${whole.toLocaleString("fr-FR").replace(/[  ]/g, " ")} USD`;
}

// ── The request form ────────────────────────────────────────────────────────

export const FUNCTIONS = {
  service: "Service client",
  ventes: "Ventes et relances",
  documents: "Factures et documents",
  paiements: "Paiements",
  pilotage: "Chiffres et pilotage",
  inconnu: "Je ne sais pas encore",
} as const;
export type FunctionKey = keyof typeof FUNCTIONS;
const FUNCTION_KEYS = Object.keys(FUNCTIONS) as [FunctionKey, ...FunctionKey[]];

export const SIZES = { lt10: "Moins de 10 personnes", "10-50": "10 à 50", "50-200": "50 à 200", "200+": "Plus de 200" } as const;
export type SizeKey = keyof typeof SIZES;

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export const requestSchema = z.object({
  organization: z.string().trim().min(2, "Indiquez votre organisation.").max(160),
  country: z.string().trim().toUpperCase().length(2, "Choisissez votre pays."),
  contactName: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  jobTitle: optional(120),
  email: z.string().trim().toLowerCase().email("Vérifiez l’adresse e-mail.").max(180),
  size: z.enum(Object.keys(SIZES) as [SizeKey, ...SizeKey[]]),
  functions: z.array(z.enum(FUNCTION_KEYS)).max(FUNCTION_KEYS.length).default([]),
  need: optional(600),
  /** The box the person ticked; never pre-ticked. */
  consent: z.literal("on", { errorMap: () => ({ message: "Cochez la case pour que nous puissions vous répondre." }) }),
});
export type EnterpriseRequestInput = z.infer<typeof requestSchema>;

/** "Awa Koné" → first and last name for the lead record. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? full, lastName: parts.slice(1).join(" ") };
}

// ── Statuses ────────────────────────────────────────────────────────────────

export const STATUSES = { new: "Nouvelle demande", call: "Appel prévu", proposal: "Proposition envoyée", won: "Signée", lost: "Perdue" } as const;
export type Status = keyof typeof STATUSES;

/** Deposit references start with CE-: the Stripe webhook routes on it. */
export const DEPOSIT_PREFIX = "CE-";
export function isDepositReference(reference: string): boolean {
  return reference.startsWith(DEPOSIT_PREFIX);
}

// ── The proposal ────────────────────────────────────────────────────────────

export const LEVELS = { manual: "Manuel", assist: "Assisté", auto: "Autonome" } as const;
export type Level = keyof typeof LEVELS;
const LEVEL_KEYS = Object.keys(LEVELS) as [Level, ...Level[]];

export const proposalSchema = z.object({
  zone: z.enum(["africa", "intl"]),
  contact: text(120),
  role: z.string().trim().max(120).default(""),
  /** What the client told us, in their words: one line each. */
  heard: z.array(text(200)).min(1).max(5),
  /** Three measurable goals: a short title and the sentence. */
  goals: z.array(z.object({ title: text(40), text: text(200) })).min(1).max(3),
  /** Before / after, process by process. */
  processes: z.array(z.object({ name: text(80), before: z.enum(LEVEL_KEYS), after: z.enum(LEVEL_KEYS) })).max(8),
  /** The steps sold, with the price agreed for this client (USD cents). */
  lines: z.array(z.object({ code: z.enum(PACKAGE_CODES), priceUsd: usdCents })).min(1, "Choisissez au moins une marche.").max(PACKAGE_CODES.length),
  validDays: z.number().int().min(7).max(90),
  start: z.string().trim().max(60).default(""),
  /** The date printed on the proposal (YYYY-MM-DD). */
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type Proposal = z.infer<typeof proposalSchema>;

/** The first draft of a proposal, from the request: the client's words, the Pilot and the subscription. */
export function draftProposal(input: { contactName: string; jobTitle: string | null; need: string | null; functions: readonly string[]; zone: Zone }, offer: EnterpriseOffer): Proposal {
  const pkg = (code: PackageCode) => offer.packages.find((p) => p.code === code)!;
  const fn = input.functions.filter((f): f is Exclude<FunctionKey, "inconnu"> => f in FUNCTIONS && f !== "inconnu");
  const processes = (fn.length ? fn : (["service", "ventes", "pilotage"] as const)).map((f) => ({ name: FUNCTIONS[f], before: "manual" as Level, after: (f === "documents" || f === "ventes" ? "assist" : "auto") as Level }));
  return {
    zone: input.zone,
    contact: input.contactName,
    role: input.jobTitle ?? "",
    heard: [input.need?.trim() || "À compléter après l’appel de cadrage."],
    goals: [{ title: "Objectif 1", text: "À préciser après l’appel : un résultat mesurable." }],
    processes: [...processes, { name: "Prix et remises", before: "manual", after: "manual" }],
    lines: (["pilot", "autopilot"] as const).map((code) => ({ code, priceUsd: priceOf(pkg(code), input.zone) })),
    validDays: 30,
    start: "",
  };
}

export type Totals = { onceUsd: number; monthlyUsd: number; depositUsd: number; balanceUsd: number };

/**
 * One-off total, monthly total, and the deposit: half of the one-off part,
 * or the first month when only the subscription is sold.
 */
export function proposalTotals(p: Pick<Proposal, "lines">, offer: EnterpriseOffer): Totals {
  const monthlyCodes = new Set(offer.packages.filter((x) => x.monthly).map((x) => x.code));
  const onceUsd = p.lines.filter((l) => !monthlyCodes.has(l.code)).reduce((s, l) => s + l.priceUsd, 0);
  const monthlyUsd = p.lines.filter((l) => monthlyCodes.has(l.code)).reduce((s, l) => s + l.priceUsd, 0);
  const depositUsd = onceUsd > 0 ? Math.round(onceUsd / 2) : monthlyUsd;
  return { onceUsd, monthlyUsd, depositUsd, balanceUsd: onceUsd > 0 ? onceUsd - depositUsd : 0 };
}

export type TimelineStep = { when: string; pkg: EnterprisePackage };

/** The steps in catalogue order, each with its weeks: « Semaines 1 à 4 », then « Ensuite, chaque mois ». */
export function proposalTimeline(p: Pick<Proposal, "lines">, offer: EnterpriseOffer): { steps: TimelineStep[]; weeks: number } {
  let week = 0;
  const steps: TimelineStep[] = [];
  for (const pkg of offer.packages) {
    if (!p.lines.some((l) => l.code === pkg.code)) continue;
    if (pkg.monthly) {
      steps.push({ when: "Ensuite, chaque mois", pkg });
      continue;
    }
    steps.push({ when: pkg.weeks <= 1 ? `Semaine ${week + 1}` : `Semaines ${week + 1} à ${week + pkg.weeks}`, pkg });
    week += pkg.weeks;
  }
  return { steps, weeks: week };
}

/** « 2 mois, puis un suivi mensuel ». */
export function durationLabel(weeks: number, monthly: boolean): string {
  if (!weeks) return monthly ? "Suivi mensuel" : "—";
  const months = Math.max(1, Math.round(weeks / 4.3));
  const base = weeks < 6 ? `${weeks} semaines` : `${months} mois`;
  return monthly ? `${base}, puis un suivi mensuel` : base;
}
