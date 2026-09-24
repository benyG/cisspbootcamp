import { unstable_cache } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";

/**
 * Landing-page copy and settings — SPECS A9, edited from /admin/parametres/site.
 *
 * One Zod schema is the contract: it validates what the admin form saves and
 * what the page reads, and the defaults below are the prototype Ben approved
 * on 21/09/2026. A missing key falls back to its default, so the landing
 * never renders empty because a row was never written.
 */

const short = (max = 160) => z.string().trim().max(max);
const line = (max = 400) => z.string().trim().max(max);

export const siteSettingsSchema = z.object({
  hero: z.object({
    /** The headline, with the part to colour between double braces: "…CISSP {{au hasard.}}" */
    title: short(140),
    lead: line(500),
    promises: z.array(z.object({ title: short(60), text: short(120) })).length(3),
    microcopy: short(160),
  }),
  proof: z.object({
    title: short(200),
    numbers: z.array(z.object({ value: short(12), text: short(120) })).min(3).max(4),
  }),
  method: z.object({
    title: short(200),
    steps: z.array(z.object({ kicker: short(30), title: short(60), text: short(220) })).length(4),
    rhythm: z.array(z.object({ title: short(30), text: short(160) })).length(2),
  }),
  video: z.object({
    /** YouTube or Vimeo page URL; empty hides the section. */
    url: z.string().trim().max(300),
    duration: short(20),
    title: short(200),
    text: line(300),
  }),
  coach: z.object({
    name: short(60),
    tagline: short(120),
    quote: short(200),
    bio: line(600),
    credentials: z.array(short(120)).min(1).max(5),
    linkedinUrl: z.string().trim().max(300),
  }),
  offer: z.object({
    title: short(200),
    text: line(400),
    included: z.array(short(120)).min(1).max(8),
    soonEnabled: z.boolean(),
    soonText: short(160),
    /** Market reference the promotional price is compared to, in whole USD. 0 hides the comparison. */
    referencePriceUsd: z.coerce.number().int().min(0).max(100_000).default(2800),
    referenceSource: short(140).default("Formation officielle ISC² (Official Training)"),
    referenceCheckedOn: short(40).default("septembre 2026"),
    promoLabel: short(80).default("Tarif de lancement"),
    /** Let a "ready" profile open the registration page before Ben validates the sales message. */
    directRegistrationForReady: z.boolean().default(true),
  }),
  faq: z.array(z.object({ q: short(160), a: line(700) })).max(12),
  contact: z.object({
    /** International format, digits only after +, for wa.me links. */
    whatsapp: z.string().trim().regex(/^(\+[1-9]\d{6,14})?$/),
    legalName: short(120),
    legalText: line(600),
  }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type SiteSectionKey = keyof SiteSettings;

export const SITE_DEFAULTS: SiteSettings = {
  hero: {
    title: "CISSP, {{réveillez le leader en cybersécurité}} qui est en vous.",
    lead: "Une préparation intensive, guidée par un coach certifié, pour raisonner comme l’examen l’exige et arriver au jour J sans doute sur votre niveau.",
    promises: [
      { title: "40 h sur 15 jours", text: "" },
      { title: "Sessions live, en français", text: "" },
      { title: "Accompagnement jusqu’à l’examen", text: "" },
    ],
    microcopy: "Résultat immédiat · Gratuit · Sans engagement",
  },
  proof: {
    title: "Le CISSP n’est pas un concours de mémorisation. La différence se fait dans la méthode et dans le rythme.",
    numbers: [
      { value: "40 h", text: "de sessions live avec le coach." },
      { value: "15 jours", text: "de préparation intensive." },
      { value: "10", text: "participants maximum par cohorte formation CISSP." },
    ],
  },
  method: {
    title: "Pas 40 heures de cours. Une trajectoire jusqu’au jour de l’examen.",
    steps: [
      { kicker: "Comprendre", title: "Relier les 8 domaines", text: "Pas seulement les apprendre : comprendre comment ils interagissent." },
      { kicker: "Raisonner", title: "Penser CISSP", text: "Choisir la meilleure décision, pas seulement une réponse techniquement correcte." },
      { kicker: "S’entraîner", title: "Corriger ses erreurs", text: "Scénarios, questions, corrections commentées." },
      { kicker: "Exécuter", title: "Arriver prêt", text: "Un plan clair jusqu’à l’examen." },
    ],
    rhythm: [
      { title: "Lun. → ven.", text: "2 à 3 h en soirée." },
      { title: "Week-ends", text: "Sessions intensives, jusqu’à 7 h par jour." },
    ],
  },
  video: {
    url: "",
    duration: "1 min 30",
    title: "Ben vous explique comment se déroule le bootcamp — et à qui il ne convient pas.",
    text: "Une vidéo courte, face caméra, sans montage. Ce que vous verrez ici, c’est ce que vous aurez pendant 15 jours.",
  },
  coach: {
    name: "Ben",
    tagline: "Coach CISSP certifié · Auditeur ISO 27001 · Conférencier",
    quote: "Je vous dis honnêtement si vous êtes prêt. Puis on construit le chemin jusqu’à l’examen.",
    bio: "Une préparation exigeante, structurée et basée sur le terrain, pas une lecture commentée du CBK.",
    credentials: [
      "CISSP",
      "Auditeur ISO 27001",
      "Conférencier",
    ],
    linkedinUrl: "",
  },
  offer: {
    title: "Ce qui est inclus",
    text: "Tout ce qu’il faut pour arriver prêt, avec un coach qui reste jusqu’à votre examen.",
    included: [
      "Les 8 domaines, en sessions live",
      "Questions et scénarios corrigés",
      "Plan de préparation jusqu’à l’examen",
      "Accompagnement du coach",
    ],
    soonEnabled: true,
    soonText: "Bientôt : modules en ligne entre deux cohortes, avec rendez-vous coach",
    referencePriceUsd: 2800,
    referenceSource: "Formation officielle ISC² (Official Training)",
    referenceCheckedOn: "septembre 2026",
    promoLabel: "Tarif de lancement",
    directRegistrationForReady: true,
  },
  faq: [
    { q: "Ai-je besoin de 5 ans d’expérience ?", a: "ISC² demande généralement 5 ans d’expérience cumulée dans au moins 2 des 8 domaines. Un diplôme de 4 ans ou une certification reconnue peut réduire cette exigence d’un an. Si vous ne remplissez pas encore l’expérience requise, vous pouvez passer l’examen et suivre le parcours Associate of ISC². Le diagnostic vous le dit précisément." },
    { q: "Le bootcamp est-il entièrement en français ?", a: "Oui. Explications, échanges et supports sont en français. Le vocabulaire technique anglais de l’examen est travaillé au fil des sessions." },
    { q: "Puis-je suivre tout en travaillant ?", a: "C’est conçu pour. En semaine, 2 à 3 h en soirée ; les week-ends sont plus denses. Pendant 15 jours, la préparation est la priorité." },
    { q: "L’examen CISSP est-il inclus ?", a: "Non. Les frais d’examen se règlent auprès d’ISC². Le bootcamp vous prépare et vous laisse avec un plan jusqu’à votre date d’examen." },
    { q: "Comment payer depuis l’Afrique ?", a: "Carte bancaire, Orange Money ou MTN Mobile Money. Le prix est en USD, avec l’équivalent indicatif en FCFA. Un reçu est émis à chaque paiement." },
  ],
  contact: {
    whatsapp: "",
    legalName: "CISSP Bootcamp",
    legalText: "",
  },
};

export const SITE_CACHE_TAG = "site-settings";

/** Read everything, defaults filling any missing or invalid key. Cached 60 s. */
export const loadSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const rows = await prisma.siteSetting.findMany();
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const merged: Record<string, unknown> = {};
    for (const key of Object.keys(SITE_DEFAULTS) as SiteSectionKey[]) {
      const section = siteSettingsSchema.shape[key].safeParse(stored[key]);
      merged[key] = section.success ? section.data : SITE_DEFAULTS[key];
    }
    return merged as SiteSettings;
  },
  ["site-settings"],
  { revalidate: 60, tags: [SITE_CACHE_TAG] },
);

/** Validate and store one section. Throws a ZodError the form turns into messages. */
export async function saveSiteSection<K extends SiteSectionKey>(key: K, value: unknown): Promise<SiteSettings[K]> {
  const parsed = siteSettingsSchema.shape[key].parse(value) as SiteSettings[K];
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: parsed as object },
    update: { value: parsed as object },
  });
  return parsed;
}

/** "Ne préparez plus le CISSP {{au hasard.}}" → ["Ne préparez plus le CISSP ", "au hasard."] */
export function splitHighlight(title: string): { before: string; highlight: string; after: string } {
  const match = title.match(/^([\s\S]*?)\{\{([\s\S]+?)\}\}([\s\S]*)$/);
  if (!match) return { before: title, highlight: "", after: "" };
  return { before: match[1], highlight: match[2], after: match[3] };
}
