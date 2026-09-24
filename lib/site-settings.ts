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
    numbers: z.array(z.object({ value: short(12), text: short(120) })).length(4),
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
    promoLabel: short(80).default("Prix promotionnel de lancement"),
    /** Let a "ready" profile open the registration page before Ben validates the sales message. */
    directRegistrationForReady: z.boolean().default(false),
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
    title: "CISSP : révéler {{en toute sérénité}} l’expert en cybersécurité que vous êtes.",
    lead:
      "Un bootcamp de 40 heures sur 15 jours, en français, pour structurer votre préparation, " +
      "relier les 8 domaines et apprendre à raisonner comme l’examen l’exige — avec un coach " +
      "certifié qui tient le rythme avec vous.",
    promises: [
      { title: "15 jours, 40 h", text: "Un rythme clair, pas cinq jours condensés." },
      { title: "Sessions live", text: "Un cadre guidé pour poser les bonnes questions." },
      { title: "Jusqu’à l’examen", text: "Un plan de préparation, pas seulement des cours." },
    ],
    microcopy: "Résultat immédiat · Gratuit, sans engagement",
  },
  proof: {
    title: "Le CISSP n’est pas un concours de mémorisation. La différence se fait dans la méthode — et dans le rythme.",
    numbers: [
      { value: "8", text: "domaines à relier, pas simplement à réciter." },
      { value: "40 h", text: "de préparation étalées sur 15 jours, en français." },
      { value: "10", text: "places par cohorte. Chacun est suivi." },
      { value: "1 à 2", text: "mois jusqu’à l’examen pour un profil expérimenté accompagné." },
    ],
  },
  method: {
    title: "Vous n’achetez pas 40 heures de cours. Vous achetez une trajectoire jusqu’au jour de l’examen.",
    steps: [
      { kicker: "Comprendre", title: "Structurer les 8 domaines", text: "Revoir les concepts essentiels et surtout comprendre comment ils s’articulent dans les scénarios d’examen." },
      { kicker: "Raisonner", title: "Penser « CISSP »", text: "Identifier le niveau de décision attendu, éliminer les distracteurs, choisir la réponse la plus pertinente." },
      { kicker: "S’entraîner", title: "Travailler vos vraies difficultés", text: "Questions, scénarios, corrections commentées et analyse de vos erreurs récurrentes." },
      { kicker: "Exécuter", title: "Arriver avec un plan", text: "Transformer le bootcamp en stratégie de préparation, jusqu’au passage de l’examen." },
    ],
    rhythm: [
      { title: "Lun. → ven.", text: "2 à 3 h en fin de journée. Compatible avec un poste à temps plein." },
      { title: "Week-ends", text: "Jusqu’à 7 h par jour. Pendant 15 jours, la préparation est la priorité." },
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
    quote: "Je vous dis honnêtement si vous êtes prêt. Puis je vous y amène.",
    bio:
      "Certifié CISSP, auditeur ISO 27001, conférencier. Deux cohortes encadrées, des participants " +
      "certifiés — et une conviction : ce qui manque aux candidats, ce n’est pas le matériel, c’est " +
      "quelqu’un qui tient le rythme avec eux.",
    credentials: [
      "Certifié CISSP (ISC²)",
      "Auditeur ISO 27001, expérience terrain en audit de sécurité",
      "Conférencier cybersécurité, communauté francophone",
    ],
    linkedinUrl: "",
  },
  offer: {
    title: "Votre préparation mérite mieux qu’une pile de PDF et des QCM au hasard.",
    text: "Une préparation intensive, en français, avec un cadre clair, des sessions live et un coach qui reste jusqu’à votre examen.",
    included: [
      "40 h de sessions live sur 15 jours",
      "Les 8 domaines, supports en français",
      "Questions type examen corrigées et commentées",
      "Plan de préparation jusqu’à la date d’examen",
    ],
    soonEnabled: true,
    soonText: "Bientôt : modules en ligne entre deux cohortes, avec rendez-vous coach",
    referencePriceUsd: 2800,
    referenceSource: "Formation officielle ISC² (Official Training)",
    referenceCheckedOn: "septembre 2026",
    promoLabel: "Prix promotionnel de lancement",
    directRegistrationForReady: false,
  },
  faq: [
    { q: "Faut-il vraiment 5 ans d’expérience ?", a: "ISC² exige 5 ans d’expérience dans au moins 2 des 8 domaines. Un diplôme de 4 ans ou une certification reconnue en compte pour 1. Avec 3 à 4 ans, vous pouvez passer l’examen et devenir Associate of ISC² le temps de compléter. L’analyse de profil vous le dit précisément." },
    { q: "L’examen est en anglais — le bootcamp aussi ?", a: "Non. Le bootcamp est intégralement en français. Nous travaillons le vocabulaire technique anglais de l’examen, mais les explications, les échanges et les supports sont en français." },
    { q: "Je travaille à temps plein. Est-ce compatible ?", a: "C’est conçu pour. En semaine, 2 à 3 h en fin de journée ; les week-ends sont plus denses. Pendant 15 jours, il faut en faire une priorité — c’est le prix d’un format qui ne s’étale pas sur six mois." },
    { q: "Que se passe-t-il après les 15 jours ?", a: "Vous repartez avec un plan jusqu’à votre date d’examen, et le coach reste joignable. L’objectif n’est pas de finir le bootcamp, c’est d’être certifié." },
    { q: "Mon employeur peut-il financer ?", a: "Oui. Un reçu est émis à chaque paiement, et une facture au nom de l’entreprise est possible sur demande." },
    { q: "Comment payer depuis l’Afrique ?", a: "Carte bancaire, Orange Money ou MTN Mobile Money. Le prix est affiché en USD avec l’équivalent indicatif en FCFA." },
    { q: "Je n’ai pas encore 5 ans d’expérience. Que puis-je faire maintenant ?", a: "Deux marches avant le bootcamp. Sans expérience ou en reconversion : la certification CC d’ISC², préparée en 15 jours avec Ben, sans prérequis. Avec quelques années : une séance de conseil carrière d’une heure, avec un plan daté, déduite du bootcamp si vous le rejoignez dans les 90 jours. Le mentorat mensuel prend ensuite le relais." },
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
