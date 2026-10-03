import Anthropic from "@anthropic-ai/sdk";

import { ANGLES, ART_DIRECTION, type Angle, CHANNELS, type Channel, DESTINATIONS, type Destination, FORMATS, type Format, PILLARS, type Pillar } from "./plan";

/**
 * The marketing studio's two calls to Claude (Ben, 28/09): three post
 * variants for a channel and an angle, and a personal follow-up for one
 * prospect. The facts come from the database; the model writes, it does not
 * invent. Ben reads, edits and publishes himself: nothing is sent from here.
 */

export const MARKETING_MODEL = "claude-opus-5-5";

const HONESTY = [
  "Règles non négociables :",
  "- N'utilise que les faits fournis. N'invente aucun chiffre, aucun taux de réussite, aucun témoignage, aucun nom d'élève, aucune date.",
  "- Jamais de promesse de réussite (« garanti », « vous réussirez »).",
  "- N'écris jamais « vraies questions d'examen », « banque d'examen » ni rien qui laisse croire à des questions officielles : ce sont des questions d'entraînement.",
  "- Un score se dit tel quel (« 3 bonnes réponses sur 5 ») ; il ne prédit jamais le résultat à l'examen.",
  "- Français clair, vouvoiement, phrases courtes, aucun emoji sauf sur TikTok et WhatsApp (deux au plus), aucune formule creuse.",
].join("\n");

const STUDIO_SYSTEM = `Tu es le directeur marketing de Ben, coach CISSP certifié et francophone, qui vend des bootcamps de préparation en ligne à des professionnels d'Afrique francophone et de la diaspora. Tu écris des contenus qui donnent envie de faire le premier pas gratuit (le test d'entraînement ou l'analyse de profil, selon la destination du lien) puis de réserver sa place.

${HONESTY}
- Dates, places, prix, chiffres et résultats ne viennent que des FAITS. Pour les posts de valeur (méthode, carrière, certifications), tu peux t'appuyer sur des connaissances professionnelles établies (CBK du CISSP, exigences publiques d'ISC², métiers de la cybersécurité), sans aucun chiffre de marché (salaires, nombre de postes, taux) qui ne soit pas fourni. Une actualité ne se cite que si elle est fournie avec sa source, et la source se mentionne.

Le lien s'écrit exactement [LIEN] dans le texte ; il sera remplacé par un lien suivi. Sa destination est donnée avec chaque demande : le texte doit annoncer exactement ce que la personne trouvera en cliquant.

${ART_DIRECTION}

Pour chaque variante, donne un brief visuel court et concret qui respecte strictement cette direction artistique : ce qu'on voit, le texte à l'écran (5 à 8 mots, un mot ou un chiffre fort à mettre en vert), le cadrage, et la description en anglais de la photographie seule pour le générateur d'images (personnes fictives : jamais Ben, jamais un élève présenté comme réel).
Pour TikTok : un storyboard de 3 à 6 plans (durée, image, voix off, texte à l'écran) pour 15 à 30 secondes, et un prompt texte-vers-vidéo en anglais pour MiniMax (un seul plan de 6 secondes, le plan d'ouverture, avec les mouvements de caméra entre crochets comme [Push in] ou [Tracking shot], sans texte à l'écran, sans logo). Pour les autres canaux : storyboard vide et prompt vide.
Les trois variantes doivent être vraiment différentes (accroche, structure, ton), pas trois reformulations.`;

const CHANNEL_RULES: Record<Channel, string> = {
  linkedin: "LinkedIn : 120 à 220 mots. Première ligne = accroche qui arrête le défilement. Paragraphes d'une à deux phrases. Une seule action à la fin avec [LIEN]. 3 à 5 hashtags pertinents en fin.",
  whatsapp_status: "Statut WhatsApp : 25 à 60 mots, lisible en 5 secondes, une action avec [LIEN]. Pas de hashtag.",
  whatsapp_group: "Message de groupe WhatsApp : 60 à 120 mots, ton de collègue qui partage une opportunité, pas de publicité criarde, une action avec [LIEN]. Pas de hashtag.",
  tiktok: "TikTok : le texte est la légende de la vidéo, 20 à 50 mots, avec [LIEN] (« lien en bio » si besoin) et 3 à 5 hashtags. L'essentiel du message passe par le storyboard : accroche dans les 2 premières secondes.",
};

export type Variant = {
  title: string;
  text: string;
  hashtags: string[];
  /** imagePrompt: the photograph alone, in English, for MiniMax (absent on posts kept before 03/10). */
  visual: { format: string; scene: string; onScreenText: string; direction: string; imagePrompt?: string };
  video: { scenes: Array<{ seconds: number; image: string; voiceover: string; onScreen: string }>; minimaxPrompt: string };
};

const VARIANTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text", "hashtags", "visual", "video"],
        properties: {
          title: { type: "string", description: "Nom court de la variante, pour Ben (3 à 6 mots)." },
          text: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          visual: {
            type: "object",
            additionalProperties: false,
            required: ["format", "scene", "onScreenText", "direction", "imagePrompt"],
            properties: {
              format: { type: "string" },
              scene: { type: "string" },
              onScreenText: { type: "string" },
              direction: { type: "string", description: "Rappel en une phrase des choix de la direction artistique appliqués." },
              imagePrompt: { type: "string", description: "La photographie seule, en anglais, pour le générateur d'images : qui (âge, genre, tenue), ce qu'il fait, où, cadrage, lumière. 40 à 80 mots. Aucun texte, logo ni écran lisible : le titre est ajouté ensuite par l'application." },
            },
          },
          video: {
            type: "object",
            additionalProperties: false,
            required: ["scenes", "minimaxPrompt"],
            properties: {
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["seconds", "image", "voiceover", "onScreen"],
                  properties: { seconds: { type: "integer" }, image: { type: "string" }, voiceover: { type: "string" }, onScreen: { type: "string" } },
                },
              },
              minimaxPrompt: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

export type StudioResult = { ok: true; variants: Variant[] } | { ok: false; error: string };

export type GenerateInput = {
  facts: string;
  channel: Channel;
  /** Legacy selling angle; a pillar and a subject take over when given. */
  angle?: Angle;
  pillar?: Pillar;
  format?: Format;
  /** The subject, from the ideas or typed by Ben; may carry a news source. */
  topic?: string;
  destination?: Destination;
  /** What Ben wants to say (an anecdote, an opinion) or an instruction. */
  brief: string;
};

export async function generateVariants(input: GenerateInput): Promise<StudioResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur." };
  const prompt = [
    "FAITS SUR L'OFFRE (seule source pour dates, places, prix et chiffres) :",
    input.facts,
    "",
    `Canal : ${CHANNELS[input.channel].label}. ${CHANNEL_RULES[input.channel]}`,
    `Format visuel : ${CHANNELS[input.channel].format}.`,
    input.pillar ? `Pilier éditorial : ${PILLARS[input.pillar].label}.${input.pillar === "offre" ? "" : " C'est un post de valeur : il aide d'abord, l'offre n'arrive qu'avec l'action finale, en une phrase."}` : null,
    input.topic ? `Sujet : ${input.topic}` : input.angle ? `Angle : ${ANGLES[input.angle]}.` : null,
    `Format : ${FORMATS[input.format ?? "standard"].label}. ${FORMATS[input.format ?? "standard"].rule}`,
    `Le lien [LIEN] mène à : ${DESTINATIONS[input.destination ?? "scanner"].forModel}.`,
    input.brief ? `Ce que Ben veut dire, ou sa consigne (sa parole : tu peux la reprendre, sans rien y ajouter de factuel) : ${input.brief}` : null,
    "",
    "Écris trois variantes.",
  ].filter((l): l is string => l !== null).join("\n");

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MARKETING_MODEL,
      max_tokens: 12000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: STUDIO_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: VARIANTS_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "Le modèle a refusé cette demande. Reformulez la consigne." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "Réponse trop longue, coupée. Réessayez avec une consigne plus courte." };
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text) as { variants: Variant[] };
    const variants = parsed.variants.filter((v) => v.text?.trim()).slice(0, 3);
    return variants.length ? { ok: true, variants } : { ok: false, error: "Aucune variante exploitable. Réessayez." };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[marketing] Claude API ${error.status}: ${error.message}`);
      return { ok: false, error: `Le service d'IA a répondu ${error.status}. Réessayez dans un instant.` };
    }
    console.error("[marketing]", error);
    return { ok: false, error: "La génération a échoué. Réessayez." };
  }
}

const FOLLOWUP_SYSTEM = `Tu es Ben, coach CISSP certifié et francophone. Tu écris toi-même, à la première personne, à une personne qui a analysé son profil sur ton site et a accepté d'être recontactée. Objectif : une réponse, puis une inscription.

${HONESTY}

Message personnel, pas une publicité : prénom, un détail de son profil (son analyse, et son score au test s'il en a un), la cohorte et sa date, une seule question ou action à la fin. L'offre à proposer et la destination du lien sont données avec la demande : ne propose rien d'autre. 50 à 110 mots. Texte brut. Signe « Ben ».`;

export type FollowupInput = { facts: string; channel: "whatsapp" | "email"; person: string; segment: string; offer: string; link: string };

export async function draftFollowup(input: FollowupInput): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur." };
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MARKETING_MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: FOLLOWUP_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low" },
      messages: [{ role: "user", content: `FAITS SUR LA COHORTE :\n${input.facts}\n\nLA PERSONNE :\n${input.person}\n\nPourquoi on la relance : ${input.segment}\nCe qu'on lui propose : ${input.offer}\nLe lien [LIEN] mène à : ${input.link}\nCanal : ${input.channel === "whatsapp" ? "WhatsApp (pas d'objet, ton oral)" : "e-mail (commence par une ligne « Objet : … »)"}.\n\nÉcris le message. Le lien s'écrit [LIEN].` }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "Le modèle a refusé cette demande." };
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("").trim();
    return text.length > 30 ? { ok: true, text } : { ok: false, error: "Message vide. Réessayez." };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[marketing] Claude API ${error.status}: ${error.message}`);
      return { ok: false, error: `Le service d'IA a répondu ${error.status}. Réessayez dans un instant.` };
    }
    console.error("[marketing]", error);
    return { ok: false, error: "La rédaction a échoué. Réessayez." };
  }
}

// --- Topic ideas (Ben, 29/09) ---------------------------------------------

export type TopicIdea = { pillar: Pillar; format: Format; channel: Channel; destination: Destination; title: string; hook: string; why: string; source: string };

const IDEAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pillar", "format", "channel", "destination", "title", "hook", "why", "source"],
        properties: {
          pillar: { type: "string", enum: Object.keys(PILLARS) },
          format: { type: "string", enum: Object.keys(FORMATS) },
          channel: { type: "string", enum: Object.keys(CHANNELS) },
          destination: { type: "string", enum: Object.keys(DESTINATIONS) },
          title: { type: "string", description: "Le sujet en une phrase, 12 mots au plus." },
          hook: { type: "string", description: "La première ligne du post, telle qu'elle serait écrite." },
          why: { type: "string", description: "Pourquoi ce sujet maintenant, en une phrase, pour Ben : quelle donnée ou quelle actualité l'inspire." },
          source: { type: "string", description: "L'URL de l'actualité utilisée, sinon une chaîne vide." },
        },
      },
    },
  },
} as const;

const IDEAS_SYSTEM = `Tu es le responsable éditorial de Ben, coach CISSP certifié et francophone. Tu proposes des sujets de posts pour LinkedIn, WhatsApp et TikTok, destinés à des professionnels de l'informatique et de la cybersécurité en Afrique francophone et dans la diaspora.

${HONESTY}

Règles des idées :
- Environ quatre sujets de valeur (méthode, carrière, choix de certification, éligibilité, vie du candidat) pour un sujet de vente (pilier « offre »).
- Varie les piliers, les formats et les canaux. Respecte les formats possibles par canal.
- Chaque sujet a une seule destination pour son lien, la plus naturelle : méthode → test, carrière → conseil, choix et éligibilité → analyse, vie du candidat et offre → cohorte.
- Pars de ce que les prospects disent et font (leurs objectifs, leurs questions, leurs verdicts) : c'est la meilleure source. Ne cite jamais leurs phrases, ne les reconnais jamais : reformule le besoin.
- Évite les sujets déjà traités ce mois-ci.
- Une actualité ne sert que si elle est fournie avec sa source ; ne rapporte que ce qu'elle dit.`;

const FORMAT_CHANNELS = Object.entries(FORMATS).map(([k, f]) => `${k} (${f.label}) : ${f.channels.join(", ")}`).join("\n");

export async function suggestTopics(input: { facts: string; insights: string; recent: string; news: string }): Promise<{ ok: true; ideas: TopicIdea[] } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur." };
  const prompt = [
    "FAITS SUR L'OFFRE :",
    input.facts,
    "",
    "CE QUE DISENT ET FONT LES PROSPECTS :",
    input.insights,
    "",
    "DÉJÀ PUBLIÉ OU PRÉPARÉ CE MOIS-CI :",
    input.recent || "Rien encore.",
    "",
    "ACTUALITÉS (avec source) :",
    input.news || "Aucune : n'en invente pas.",
    "",
    `Piliers : ${Object.entries(PILLARS).map(([k, p]) => `${k} (${p.label})`).join(", ")}.`,
    `Formats possibles par canal :\n${FORMAT_CHANNELS}`,
    "",
    "Propose 10 sujets.",
  ].join("\n");
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MARKETING_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: IDEAS_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: IDEAS_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "Le modèle a refusé cette demande." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "Réponse coupée. Réessayez." };
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    const ideas = (JSON.parse(text) as { ideas: TopicIdea[] }).ideas.filter((i) => i.title && (FORMATS[i.format]?.channels as readonly string[] | undefined)?.includes(i.channel));
    return ideas.length ? { ok: true, ideas: ideas.slice(0, 10) } : { ok: false, error: "Aucune idée exploitable. Réessayez." };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[marketing] Claude API ${error.status}: ${error.message}`);
      return { ok: false, error: `Le service d'IA a répondu ${error.status}. Réessayez dans un instant.` };
    }
    console.error("[marketing]", error);
    return { ok: false, error: "La recherche d'idées a échoué. Réessayez." };
  }
}

export type NewsItem = { title: string; date: string; url: string; why: string };

const NEWS_SYSTEM = `Tu fais une veille d'actualité pour Ben, coach CISSP francophone. Cherche sur le web des actualités des 30 derniers jours utiles pour des posts : cybersécurité en Afrique francophone (incidents publics, lois et régulateurs de protection des données, stratégies nationales, recrutements), et nouvelles d'ISC² sur le CISSP ou la CC. Sources fiables uniquement (médias reconnus, autorités, ISC²). Ne rapporte que ce que la source dit.

Réponds uniquement par une ligne par actualité, 3 à 6 lignes, sans autre texte :
TITRE || DATE (AAAA-MM-JJ) || URL || en quoi c'est utile pour un post, en une phrase`;

/** Pure: reads the model's news lines; drops anything without an http(s) URL. */
export function parseNews(text: string): NewsItem[] {
  return text
    .split("\n")
    .map((line) => line.split("||").map((p) => p.trim()))
    .filter((p) => p.length >= 4 && /^https?:\/\//.test(p[2]))
    .map(([title, date, url, why]) => ({ title: title.replace(/^[-*•\d.\s]+/, "").slice(0, 200), date: date.slice(0, 10), url: url.slice(0, 500), why: why.slice(0, 300) }))
    .slice(0, 6);
}

/**
 * Recent news through Claude's web search (Ben, 30/09), each item with its
 * source. A separate call from the ideas: search results come with
 * citations, which structured outputs do not accept. A long search may
 * pause; the paused turn is sent back so the server resumes it.
 */
export async function searchNews(): Promise<{ ok: true; items: NewsItem[] } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur." };
  try {
    const client = new Anthropic();
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `Nous sommes le ${new Date().toISOString().slice(0, 10)}. Fais la veille.` }];
    let text = "";
    for (let round = 0; round < 3; round++) {
      const response = await client.beta.messages.create({
        model: MARKETING_MODEL,
        max_tokens: 6000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: NEWS_SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        output_config: { effort: "low" },
        messages,
      });
      text += response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    const items = parseNews(text);
    return items.length ? { ok: true, items } : { ok: false, error: "Aucune actualité exploitable trouvée." };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[marketing] Claude API ${error.status}: ${error.message}`);
      return { ok: false, error: `La recherche web a répondu ${error.status}.` };
    }
    console.error("[marketing]", error);
    return { ok: false, error: "La recherche d'actualités a échoué." };
  }
}
