import type { Channel } from "./plan";

/**
 * The brand kit for generated media (Ben, 03/10): every MiniMax image and
 * clip must read as cisspbootcamp.online. Two locks, so the brand does not
 * depend on the model's goodwill:
 * - the prompt: a fixed style block (photography, people, setting, light,
 *   grade, clichés to avoid) wraps whatever scene Ben asks for;
 * - the layout: the model draws the photograph only, never text; headline,
 *   colours, fonts and signature are composed by the app (lib/marketing/compose.tsx)
 *   with the site's own tokens (app/globals.css) and fonts.
 * Pure, so the rules are tested and Ben can retune them here.
 */

/** The site's tokens (app/globals.css), the only colours a visual may carry. */
export const BRAND_COLORS = {
  night: "#071A33",
  night2: "#14324F",
  paper: "#F7F8F6",
  green: "#17B890",
  greenDeep: "#0F8E73",
} as const;

/** The 15 dots of the signature line: the 15 days of the bootcamp. */
export const PROGRESS_DOTS = 15;
export const SIGNATURE = "CISSP Bootcamp";

/**
 * Photography rules, in English (what the image models follow best). Kept
 * in step with ART_DIRECTION (lib/marketing/plan.ts), which briefs Claude in
 * French.
 */
const PHOTO_STYLE = [
  "Style: realistic editorial documentary photo, 35mm lens, natural depth of field, real skin texture; not an illustration or 3D render.",
  "People: Black African francophone cybersecurity professionals, aged 30 to 45, women and men, smart business attire, focused on their work, not posing.",
  "Place: a credible, tidy modern African workplace (office, meeting room, security operations room, server room).",
  "Colour: warm light on skin, deep night-blue shadows (#071A33), off-white, one small touch of emerald green (#17B890); no other strong colour.",
  "Composition: calm, negative space, subject off-centre, lower third dark and quiet for a headline.",
].join(" ");

const AVOID = "Strictly no text, letters, numbers, logos or watermarks. Avoid: hooded hacker, Matrix code, padlocks, glowing shields, digital globes, handshakes, stock smiles at camera, neon, holograms.";

const VIDEO_STYLE = "Cinematic documentary look: slow, steady camera moves, discreet handheld feel, shallow depth of field, cool night-blue shadows and warm light on skin, a single small touch of emerald green in the scene, realistic motion, no text, no logo, no subtitles on screen.";

/** Longest prompt MiniMax accepts for an image (characters). */
export const IMAGE_PROMPT_MAX = 1500;
/** Longest prompt MiniMax accepts for a clip (characters). */
export const VIDEO_PROMPT_MAX = 2000;

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

/** The scene Ben asked for, wrapped in the brand's photography rules. */
export function brandedImagePrompt(scene: string): string {
  const fixed = `${PHOTO_STYLE} ${AVOID}`;
  return `${clip(scene.trim(), IMAGE_PROMPT_MAX - fixed.length - 2)}\n\n${fixed}`;
}

/** A clip prompt (camera moves in brackets kept as Ben wrote them) with the brand's film rules. */
export function brandedVideoPrompt(prompt: string): string {
  const fixed = `${VIDEO_STYLE} People: Black African francophone cybersecurity professionals aged 30 to 45 in a credible workplace. ${AVOID}`;
  const room = VIDEO_PROMPT_MAX - fixed.length - 2;
  return `${clip(prompt.trim(), room)}\n\n${fixed}`;
}

/**
 * Canvas per channel: the final size, and the aspect ratio asked from
 * MiniMax (it has no 4:5, so LinkedIn is drawn in 3:4 and cropped).
 */
export const CANVAS: Record<Channel, { width: number; height: number; aspectRatio: "3:4" | "9:16" | "1:1" }> = {
  linkedin: { width: 1080, height: 1350, aspectRatio: "3:4" },
  whatsapp_status: { width: 1080, height: 1920, aspectRatio: "9:16" },
  whatsapp_group: { width: 1080, height: 1080, aspectRatio: "1:1" },
  tiktok: { width: 1080, height: 1920, aspectRatio: "9:16" },
};

/** Longest headline the layout carries (the charter asks for 5 to 8 words). */
export const HEADLINE_MAX = 70;

/**
 * The single word in green (charter: "un seul mot ou chiffre en vert"):
 * a figure when there is one, otherwise the longest word.
 */
export function defaultKeyword(headline: string): string {
  const words = headline.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  const figure = words.find((w) => /\p{N}/u.test(w));
  if (figure) return figure;
  return words.reduce((best, w) => (w.length > best.length ? w : best), "");
}

const core = (word: string) => word.toLocaleLowerCase("fr").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/**
 * Pure: the headline as words, the keyword's words in green (first match
 * only). Words, not substrings, so the layout wraps between words and a
 * comma stays with its word.
 */
export function headlineParts(headline: string, keyword: string): Array<{ text: string; green: boolean }> {
  const words = headline.trim().split(/\s+/).filter(Boolean);
  const key = keyword.trim().split(/\s+/).map(core).filter(Boolean);
  const at = key.length ? words.findIndex((_, i) => key.every((k, j) => core(words[i + j] ?? "") === k)) : -1;
  return words.map((text, i) => ({ text, green: at >= 0 && i >= at && i < at + key.length }));
}

/** Headline size: big and few words, smaller as it grows, so it never runs past three or four lines. */
export function headlineSize(headline: string, width: number): number {
  const length = headline.trim().length;
  const base = width * (length <= 20 ? 0.105 : length <= 40 ? 0.085 : 0.068);
  return Math.round(base);
}
