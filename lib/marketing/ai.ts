import Anthropic from "@anthropic-ai/sdk";

import { ANGLES, ART_DIRECTION, type Angle, CHANNELS, type Channel } from "./plan";

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
  "- N'écris jamais « vraies questions d'examen », « banque d'examen » ni rien qui laisse croire à des questions officielles.",
  "- Français clair, vouvoiement, phrases courtes, aucun emoji sauf sur TikTok et WhatsApp (deux au plus), aucune formule creuse.",
].join("\n");

const STUDIO_SYSTEM = `Tu es le directeur marketing de Ben, coach CISSP certifié et francophone, qui vend des bootcamps de préparation en ligne à des professionnels d'Afrique francophone et de la diaspora. Tu écris des contenus qui donnent envie d'analyser son profil (première étape gratuite) puis de réserver sa place.

${HONESTY}

Le lien vers l'analyse de profil s'écrit exactement [LIEN] dans le texte ; il sera remplacé par un lien suivi.

${ART_DIRECTION}

Pour chaque variante, donne un brief visuel court et concret qui respecte strictement cette direction artistique : ce qu'on voit, le texte à l'écran (5 à 8 mots), le cadrage.
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
  visual: { format: string; scene: string; onScreenText: string; direction: string };
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
            required: ["format", "scene", "onScreenText", "direction"],
            properties: {
              format: { type: "string" },
              scene: { type: "string" },
              onScreenText: { type: "string" },
              direction: { type: "string", description: "Rappel en une phrase des choix de la direction artistique appliqués." },
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

export async function generateVariants(input: { facts: string; channel: Channel; angle: Angle; brief: string }): Promise<StudioResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur." };
  const prompt = [
    "FAITS (seule source autorisée) :",
    input.facts,
    "",
    `Canal : ${CHANNELS[input.channel].label}. ${CHANNEL_RULES[input.channel]}`,
    `Format visuel : ${CHANNELS[input.channel].format}.`,
    `Angle : ${ANGLES[input.angle]}.`,
    input.brief ? `Consigne de Ben : ${input.brief}` : null,
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

Message personnel, pas une publicité : prénom, un détail de son profil, la cohorte et sa date, une seule question ou action à la fin. 50 à 110 mots. Texte brut. Signe « Ben ».`;

export type FollowupInput = { facts: string; channel: "whatsapp" | "email"; person: string; segment: string };

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
      messages: [{ role: "user", content: `FAITS SUR LA COHORTE :\n${input.facts}\n\nLA PERSONNE :\n${input.person}\n\nPourquoi on la relance : ${input.segment}\nCanal : ${input.channel === "whatsapp" ? "WhatsApp (pas d'objet, ton oral)" : "e-mail (commence par une ligne « Objet : … »)"}.\n\nÉcris le message. Le lien de l'analyse ou de l'inscription s'écrit [LIEN].` }],
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
