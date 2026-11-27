import { z } from "zod";

import { prisma } from "@/lib/db";

import { ALL_DESTINATIONS, type MarketingKind, destinationsFor, pillarsFor } from "./plan";

/**
 * The editorial line (Ben, 27/11): what every topic idea and every post is
 * anchored on, per audience — the pillars with their intent, examples, link
 * and share of posts, then the audience, Ben's convictions, the tone, what to
 * avoid and model posts. Ben edits it in Marketing › Ligne éditoriale; it is
 * kept in site_settings and handed to the model before anything else. The
 * pillar slots are fixed in lib/marketing/plan.ts so tracking keeps working;
 * a weight of 0 turns a pillar off.
 */

export type PillarLine = { label: string; intent: string; examples: string[]; destination: string; weight: number };
export type EditorialLine = { pillars: Record<string, PillarLine>; audience: string; convictions: string; tone: string; avoid: string; models: string };

const CERT_INTENTS: Record<string, { intent: string; weight: number }> = {
  decouverte: { intent: "Une notion précise du domaine expliquée simplement (un sigle, un concept, un fait méconnu), pour qu'on se dise « tiens, c'est intéressant » et qu'on ait envie d'en apprendre plus.", weight: 30 },
  carriere: { intent: "Les métiers de la cybersécurité, les évolutions possibles, ce qui fait progresser un profil.", weight: 20 },
  tendances: { intent: "Ce qui bouge dans le domaine (régulation, nouvelles menaces, nouveaux rôles), expliqué pour un professionnel, avec sa source quand c'est une actualité.", weight: 15 },
  certification: { intent: "Ce qu'apporte une certification (CISSP, CC) dans une carrière, et laquelle choisir selon son profil.", weight: 15 },
  bootcamp: { intent: "Pourquoi se préparer en bootcamp plutôt que seul : le cadre, le groupe, l'accompagnement. Sans détailler la méthode.", weight: 10 },
  entreprises: { intent: "Pour les managers et les directions : pourquoi former une équipe à la sécurité, ce que ça change dans l'entreprise. Le lien mène à la demande de devis.", weight: 5 },
  offre: { intent: "La prochaine cohorte : dates, places, prix, inscription. Un post sur dix environ.", weight: 10 },
};

const IA_INTENTS: Record<string, { intent: string; weight: number }> = {
  ia_decouverte: { intent: "Une notion de l'IA ou du numérique expliquée simplement (agent, API, base de données, automatisation), avec un exemple d'entreprise, pour piquer la curiosité.", weight: 25 },
  cas_usage: { intent: "Une tâche concrète qu'une petite entreprise peut confier à l'IA, et ce que ça change au quotidien. Sans gain chiffré.", weight: 20 },
  autonome: { intent: "L'idée d'entreprise autonome : ce qui tourne seul, ce que l'entrepreneur garde.", weight: 10 },
  ia_tendances: { intent: "Ce qui bouge dans l'IA et le numérique pour les petites entreprises, avec sa source quand c'est une actualité.", weight: 15 },
  ia_pourquoi: { intent: "Pourquoi apprendre à construire soi-même plutôt que tout acheter ou tout déléguer.", weight: 10 },
  ia_bootcamp: { intent: "Pourquoi apprendre en bootcamp, en construisant son propre projet avec d'autres entrepreneurs. Sans détailler la méthode.", weight: 5 },
  garde_fous: { intent: "Les bons réflexes avec l'IA : secrets, relecture, données des clients.", weight: 5 },
  ia_entreprises: { intent: "Pour les dirigeants de PME et d'organisations : ce que l'IA peut prendre en charge dans leurs processus, avec leurs règles et leurs données. Le lien mène à la demande de devis.", weight: 10 },
  offre: { intent: "Les prochaines dates d'entrée et l'inscription. Un post sur dix environ.", weight: 10 },
};

const CERT_TEXT = {
  audience: "Des professionnels de l'informatique et de la cybersécurité, en Afrique francophone et dans la diaspora, qui ne sont pas encore en formation. Ils font défiler leur fil : un post doit leur faire dire « tiens, c'est intéressant » et leur donner envie d'en apprendre plus. On attire par la curiosité et l'intérêt pour le métier, pas par la mécanique de la formation.",
  convictions: "- La sécurité est d'abord une affaire de décisions et de risques, pas seulement d'outils.\n- Comprendre une notion vaut mieux que réciter une définition.\n- Une certification compte quand elle s'appuie sur une vraie compréhension du métier.\n- Se former avec un cadre et un groupe aide à aller au bout.",
  tone: "Un professionnel qui partage ce qu'il trouve intéressant dans son métier, avec curiosité et simplicité. Une seule idée par post, un exemple concret. L'accroche pique la curiosité (une question, un fait surprenant mais vrai). La fin invite doucement à en apprendre plus.",
  avoid: "- La méthodologie de la formation (déroulé des séances, rythme, outils de préparation, techniques de révision) : c'est pour ceux qui sont déjà inscrits.\n- Les posts qui supposent qu'on prépare déjà l'examen.\n- Le jargon non expliqué.\n- La vente en dehors du pilier « Offre et cohorte ».\n- Les chiffres de marché (salaires, nombre de postes) sans source.",
  models: "C'est quoi, au juste, la GIA ?\n\nGestion des identités et des accès. Derrière le sigle, une question simple : qui a le droit de faire quoi, et comment le vérifie-t-on ?\n\nQuand un collaborateur quitte l'entreprise, son compte doit disparaître le jour même. Quand un stagiaire arrive, il ne doit voir que ce dont il a besoin. La GIA, c'est donner le bon accès, à la bonne personne, au bon moment, et pouvoir le prouver.\n\nC'est l'un des huit domaines du CISSP. Pour aller plus loin sur celui-ci et les sept autres, la formation en 15 jours : [LIEN]",
};

const IA_TEXT = {
  audience: "Des chefs d'entreprise, des indépendants et des porteurs de projet d'Afrique francophone et de la diaspora, qui ne savent pas coder et ne sont pas encore en formation. Un post doit leur faire dire « tiens, c'est intéressant » et leur donner envie d'en apprendre plus.",
  convictions: "- L'IA sert l'entrepreneur, elle ne le remplace pas : il garde les décisions, les prix et ce qui est public.\n- Ne pas savoir coder n'empêche plus de construire ses propres outils.\n- Commencer petit, une tâche à la fois, et garder la main.",
  tone: "Une équipe qui explique simplement, avec des exemples tirés de la vie d'une petite entreprise (boutique, atelier, cabinet). Pas de jargon sans explication. Une seule idée par post. On parle au nom d'ExamBoot et de son équipe, jamais d'une personne.",
  avoid: "- La méthode de la formation (déroulé des journées, Claude Code étape par étape, fiches réflexes) : c'est pour les participants.\n- Les gains chiffrés (heures, chiffre d'affaires) et les promesses.\n- Les robots, le futurisme, le vocabulaire de science-fiction.\n- La vente en dehors du pilier « Offre et dates ».",
  models: "C'est quoi, au juste, un agent IA ?\n\nUn assistant qui ne se contente pas de répondre : il agit. Il lit une demande de devis, prépare le devis, l'envoie pour validation, et relance si le client ne répond pas.\n\nLa différence avec un simple chatbot ? Il a des outils (votre catalogue, votre agenda, votre paiement) et des règles : ce qu'il fait seul, ce qu'il vous laisse décider.\n\nConstruire vos propres agents, pour votre activité, sans savoir coder : c'est le Bâtisseur IA. [LIEN]",
};

function defaults(kind: MarketingKind): EditorialLine {
  const base = pillarsFor(kind) as Record<string, { label: string; destination: string; examples: readonly string[] }>;
  const intents = kind === "ia" ? IA_INTENTS : CERT_INTENTS;
  const pillars = Object.fromEntries(Object.entries(base).map(([k, p]) => [k, { label: p.label, intent: intents[k]?.intent ?? "", examples: [...p.examples], destination: p.destination, weight: intents[k]?.weight ?? 10 }]));
  return { pillars, ...(kind === "ia" ? IA_TEXT : CERT_TEXT) };
}

export const DEFAULT_EDITORIAL: Record<MarketingKind, EditorialLine> = { cert: defaults("cert"), ia: defaults("ia") };

const text = (max: number) => z.string().trim().max(max);

export function editorialSchema(kind: MarketingKind) {
  const destinations = Object.keys(destinationsFor(kind)) as [string, ...string[]];
  const pillar = z.object({
    label: text(60).min(2, "Chaque pilier a un nom."),
    intent: text(400),
    examples: z.array(text(160).min(3)).max(8),
    destination: z.enum(destinations),
    weight: z.coerce.number().int().min(0).max(100),
  });
  const keys = Object.keys(pillarsFor(kind));
  return z
    .object({ pillars: z.object(Object.fromEntries(keys.map((k) => [k, pillar]))), audience: text(1200), convictions: text(2000), tone: text(1200), avoid: text(2000), models: text(4000) })
    .refine((v) => Object.values(v.pillars as Record<string, PillarLine>).some((p) => p.weight > 0), { message: "Gardez au moins un pilier avec une part supérieure à 0." });
}

/** A saved line, completed with the defaults for any missing or invalid part. Pure. */
export function readEditorial(kind: MarketingKind, raw: unknown): EditorialLine {
  const parsed = editorialSchema(kind).safeParse(raw);
  return parsed.success ? (parsed.data as EditorialLine) : DEFAULT_EDITORIAL[kind];
}

/** The pillars that are on (weight above 0), largest share first, with their share in percent. */
export function activePillars(line: EditorialLine): Array<PillarLine & { key: string; share: number }> {
  const on = Object.entries(line.pillars).filter(([, p]) => p.weight > 0);
  const total = on.reduce((a, [, p]) => a + p.weight, 0) || 1;
  return on.map(([key, p]) => ({ key, ...p, share: Math.round((p.weight / total) * 100) })).sort((a, b) => b.weight - a.weight);
}

/** The line as the model reads it, before any data. Pure. */
export function editorialForModel(line: EditorialLine): string {
  const pillars = activePillars(line).map((p) => `- ${p.key} « ${p.label} », ${p.share} % des posts : ${p.intent}${p.examples.length ? ` Exemples : ${p.examples.join(" ; ")}.` : ""} Lien vers : ${ALL_DESTINATIONS[p.destination as keyof typeof ALL_DESTINATIONS]?.label ?? p.destination}.`);
  return [
    "LIGNE ÉDITORIALE (décidée par la direction : elle prime sur tout le reste, sauf les règles d'honnêteté)",
    `Public visé : ${line.audience}`,
    `Piliers et part des posts (seuls ces piliers existent) :\n${pillars.join("\n")}`,
    line.convictions && `Convictions à refléter :\n${line.convictions}`,
    line.tone && `Ton : ${line.tone}`,
    line.avoid && `À éviter absolument :\n${line.avoid}`,
    "Appel à l'action : chaque post se termine toujours par une phrase d'action, puis [LIEN] (les hashtags peuvent suivre). Le lien mène à la formation, ou à la demande de devis pour un sujet qui parle aux entreprises, selon la destination du pilier.",
    line.models && `Posts modèles (s'en inspirer pour le ton, le niveau et la longueur ; ne jamais les recopier) :\n${line.models}`,
  ].filter(Boolean).join("\n\n");
}

const key = (kind: MarketingKind) => `editorial-line:${kind}`;

export async function loadEditorial(kind: MarketingKind): Promise<EditorialLine> {
  const row = await prisma.siteSetting.findUnique({ where: { key: key(kind) } }).catch(() => null);
  return readEditorial(kind, row?.value ?? null);
}

export async function saveEditorial(kind: MarketingKind, value: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = editorialSchema(kind).safeParse(value);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ligne éditoriale invalide." };
  await prisma.siteSetting.upsert({ where: { key: key(kind) }, create: { key: key(kind), value: parsed.data }, update: { value: parsed.data } });
  return { ok: true };
}

export async function resetEditorial(kind: MarketingKind): Promise<void> {
  await prisma.siteSetting.deleteMany({ where: { key: key(kind) } });
}
