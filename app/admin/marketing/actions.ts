"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { marketingKind } from "@/lib/marketing/plan";
import { saveMarketingSettings } from "@/lib/marketing/settings";
import { MAX_IMAGE_BYTES } from "@/lib/linkedin";
import { publishPostNow, sendLeadEmail } from "@/lib/admin-ops/sensitive";
import { planPost, scheduleDay } from "@/lib/marketing/schedule";
import { draftLeadFollowup, generateStudioPosts, saveStudioPost, topicIdeas } from "@/lib/marketing/studio";
import { put } from "@vercel/blob";

import { CANVAS, HEADLINE_MAX } from "@/lib/marketing/brand";
import { composeVisual } from "@/lib/marketing/compose";
import { generatePhoto, readBytes, startVideo, syncVideo } from "@/lib/minimax";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();

export type { StudioVariant } from "@/lib/marketing/studio";

/** Ten subject ideas (Ben, 29/09). */
export async function suggestTopicIdeas(input: { cohortId: number; withNews: boolean }) {
  await requireAdmin();
  return topicIdeas(input);
}

/** Three variants for a channel, a pillar, a format and a subject, each with its own tracked link. */
export async function generatePosts(input: Parameters<typeof generateStudioPosts>[0]) {
  await requireAdmin();
  return generateStudioPosts(input);
}

/** Keeps a variant (as Ben edited it) in the cohort's library. */
export async function savePost(input: Parameters<typeof saveStudioPost>[0]) {
  await requireAdmin();
  const result = await saveStudioPost(input);
  revalidatePath("/admin/marketing");
  return result;
}

/** A personal follow-up for one consenting prospect. Nothing is sent here. */
export async function draftFollowupFor(input: Parameters<typeof draftLeadFollowup>[0]) {
  await requireAdmin();
  return draftLeadFollowup(input);
}

export async function togglePublished(formData: FormData): Promise<void> {
  await requireAdmin();
  const postId = id.parse(formData.get("postId"));
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { publishedAt: true } });
  if (post) await prisma.marketingPost.update({ where: { id: postId }, data: { publishedAt: post.publishedAt ? null : new Date() } });
  revalidatePath("/admin/marketing");
}

export async function deletePost(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.marketingPost.delete({ where: { id: id.parse(formData.get("postId")) } }).catch(() => undefined);
  revalidatePath("/admin/marketing");
}

/** Ben's score threshold for the "test réussi" and "test à consolider" segments. */
export async function saveTestThreshold(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.coerce.number().int().min(20).max(100).safeParse(formData.get("testThreshold"));
  if (parsed.success) await saveMarketingSettings({ testThreshold: parsed.data });
  revalidatePath("/admin/marketing");
}

/** Sends one follow-up e-mail Ben has read, with the unsubscribe link. */
export async function sendFollowupEmail(input: { leadId: number; subject: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = z.object({ leadId: id, subject: z.string().trim().min(3).max(160), text: z.string().trim().min(20).max(5000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Objet et message requis." };
  const result = await sendLeadEmail(parsed.data.leadId, parsed.data.subject, parsed.data.text);
  revalidatePath("/admin/marketing");
  return result.ok ? { ok: true } : result;
}

/** WhatsApp leaves from Ben's phone: he marks it sent once he has. */
export async function markFollowupSent(input: { leadId: number }): Promise<void> {
  await requireAdmin();
  const leadId = id.parse(input.leadId);
  await prisma.actionLog.create({ data: { leadId, type: "marketing_followup_sent", channel: "whatsapp" } });
  revalidatePath("/admin/marketing");
}

/**
 * Publishes a kept post on Ben's LinkedIn profile (Ben, 03/10), with an
 * optional image (the visual made from the brief). The post is marked
 * published and keeps its tracked link.
 */
export async function publishPostOnLinkedin(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const postId = id.safeParse(formData.get("postId"));
  if (!postId.success) return { ok: false, error: "Post introuvable." };
  const file = formData.get("image");
  const generated = id.safeParse(formData.get("imageId"));
  let image: Parameters<typeof publishPostNow>[1] = null;
  if (file instanceof File && file.size > 0) {
    if (!["image/jpeg", "image/png"].includes(file.type)) return { ok: false, error: "Image en JPG ou PNG seulement." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image trop lourde : 4 Mo au plus." };
    image = { upload: { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type } };
  } else if (generated.success) image = { imageId: generated.data };
  const result = await publishPostNow(postId.data, image);
  revalidatePath("/admin/marketing");
  return result.ok ? { ok: true, url: result.url } : result;
}

export type VideoRow = { id: number; status: string; error: string | null; prompt: string; ready: boolean; createdAt: string };

async function videosOf(postId: number): Promise<VideoRow[]> {
  const rows = await prisma.marketingVideo.findMany({ where: { postId }, orderBy: { createdAt: "desc" }, take: 12 });
  return rows.map((v) => ({ id: v.id, status: v.status, error: v.error, prompt: v.prompt, ready: Boolean(v.blobPathname), createdAt: v.createdAt.toISOString() }));
}

/**
 * Starts one 6-second MiniMax clip for a TikTok post (Ben, 03/10),
 * optionally opening on one of the post's generated photographs.
 */
export async function generateVideo(input: { postId: number; prompt: string; imageId?: number | null }): Promise<{ ok: true; videos: VideoRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z.object({ postId: id, prompt: z.string().trim().min(20, "Prompt trop court.").max(1200), imageId: id.nullish() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Prompt invalide." };
  const post = await prisma.marketingPost.findUnique({ where: { id: parsed.data.postId }, select: { id: true, cohort: { select: { program: true } } } });
  if (!post) return { ok: false, error: "Post introuvable." };
  let firstFrame: { bytes: Uint8Array; type: string } | null = null;
  if (parsed.data.imageId) {
    const image = await prisma.marketingImage.findFirst({ where: { id: parsed.data.imageId, postId: post.id } });
    const bytes = image ? await readBytes(image.photoPathname) : null;
    if (!bytes) return { ok: false, error: "Image de départ introuvable." };
    firstFrame = { bytes, type: bytes[0] === 0x89 ? "image/png" : "image/jpeg" };
  }
  const started = await startVideo(post.id, parsed.data.prompt, firstFrame, marketingKind(post.cohort?.program ?? "cissp"));
  if (!started.ok) return started;
  return { ok: true, videos: await videosOf(post.id) };
}

/** Checks the pending clips of a post; the page calls it while a clip is being made. */
export async function refreshVideos(input: { postId: number }): Promise<VideoRow[]> {
  await requireAdmin();
  const postId = id.parse(input.postId);
  const pending = await prisma.marketingVideo.findMany({ where: { postId, status: { in: ["queued", "processing"] } }, select: { id: true } });
  for (const v of pending) await syncVideo(v.id);
  return videosOf(postId);
}

export type ImageRow = { id: number; headline: string; createdAt: string };

/**
 * One brand visual for a post (Ben, 03/10): MiniMax draws the photograph
 * from the scene, inside the brand's photography rules; the app adds the
 * headline, the green keyword and the signature with the site's fonts and
 * colours, at the channel's size. Both files go to private storage.
 */
export async function generateVisual(input: { postId: number; scene: string; headline: string; keyword: string }): Promise<{ ok: true; images: ImageRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z
    .object({
      postId: id,
      scene: z.string().trim().min(15, "Décrivez la scène en une ou deux phrases.").max(650, "Scène trop longue : 650 caractères au plus."),
      headline: z.string().trim().max(HEADLINE_MAX, `Titre trop long : ${HEADLINE_MAX} caractères au plus.`),
      keyword: z.string().trim().max(60),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  const post = await prisma.marketingPost.findUnique({ where: { id: parsed.data.postId }, select: { id: true, channel: true, cohort: { select: { program: true } } } });
  if (!post) return { ok: false, error: "Post introuvable." };
  const channel = (post.channel in CANVAS ? post.channel : "linkedin") as keyof typeof CANVAS;
  const kind = marketingKind(post.cohort?.program ?? "cissp");
  const photo = await generatePhoto(parsed.data.scene, CANVAS[channel].aspectRatio, kind);
  if (!photo.ok) return photo;
  try {
    const visual = await composeVisual({ photo: photo.bytes, photoType: photo.type, channel, headline: parsed.data.headline, keyword: parsed.data.keyword, kind });
    const ext = photo.type === "image/png" ? "png" : "jpg";
    const [raw, final] = await Promise.all([
      put(`marketing-images/post-${post.id}-photo.${ext}`, Buffer.from(photo.bytes), { access: "private", contentType: photo.type, addRandomSuffix: true }),
      put(`marketing-images/post-${post.id}-visuel.png`, Buffer.from(visual), { access: "private", contentType: "image/png", addRandomSuffix: true }),
    ]);
    await prisma.marketingImage.create({
      data: { postId: post.id, scene: parsed.data.scene, headline: parsed.data.headline, keyword: parsed.data.keyword, model: photo.model, photoPathname: raw.pathname, imagePathname: final.pathname },
    });
  } catch (error) {
    console.error("[marketing] visuel", error);
    return { ok: false, error: "La photo est faite, mais la mise en page ou l'enregistrement a échoué : réessayez." };
  }
  revalidatePath("/admin/marketing");
  return { ok: true, images: await imagesOf(post.id) };
}

async function imagesOf(postId: number): Promise<ImageRow[]> {
  const rows = await prisma.marketingImage.findMany({ where: { postId }, orderBy: { createdAt: "desc" }, take: 12 });
  return rows.map((i) => ({ id: i.id, headline: i.headline, createdAt: i.createdAt.toISOString() }));
}

/**
 * Lot 7: Ben validates a LinkedIn post by giving it a day (and an image);
 * the daily cron publishes it. Also clears a previous failure.
 */
export async function schedulePost(formData: FormData): Promise<void> {
  await requireAdmin();
  const postId = id.parse(formData.get("postId"));
  const day = scheduleDay(String(formData.get("day") ?? ""), new Date());
  const imageId = id.safeParse(formData.get("imageId"));
  if (!day) return;
  await planPost(postId, day, imageId.success ? imageId.data : null);
  revalidatePath("/admin/marketing");
  revalidatePath("/admin");
}

export async function unschedulePost(formData: FormData): Promise<void> {
  await requireAdmin();
  await planPost(id.parse(formData.get("postId")), null).catch(() => undefined);
  revalidatePath("/admin/marketing");
}
