import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { publishOnLinkedin } from "@/lib/linkedin";
import { sendEmail } from "@/lib/messaging/email";
import { readBytes } from "@/lib/minimax";

/**
 * Planned LinkedIn publication (lot 7 of docs/PILOTAGE.md): Ben validates a
 * post by giving it a day; the daily cron publishes it that day, with the
 * generated image he chose. A refusal is kept on the post and e-mailed to
 * Ben once; the post then waits for him (nothing is retried blindly).
 */

const DAY_MS = 86_400_000;

/** "2026-11-12" → that day at 00:00 UTC; null when not a date or before today. */
export function scheduleDay(value: string, now: Date): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return null;
  const today = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  return day.getTime() < today ? null : day;
}

/** Due: its day has come, not published, no failure waiting for Ben. */
export function isDue(post: { scheduledFor: Date | null; publishedAt: Date | null; linkedinUrn: string | null; publishError: string | null }, now: Date): boolean {
  return !!post.scheduledFor && post.scheduledFor.getTime() <= now.getTime() && !post.publishedAt && !post.linkedinUrn && !post.publishError;
}

/** Publishes the posts whose day has come. Returns how many went out. */
export async function publishDuePosts(now = new Date()): Promise<number> {
  const posts = await prisma.marketingPost.findMany({
    where: { channel: "linkedin", scheduledFor: { lte: now }, publishedAt: null, linkedinUrn: null, publishError: null },
    orderBy: { scheduledFor: "asc" },
    take: 5,
  });
  let done = 0;
  for (const post of posts) {
    if (!isDue(post, now)) continue;
    try {
      let image: { bytes: Uint8Array; type: string; alt: string } | null = null;
      if (post.scheduledImageId) {
        const row = await prisma.marketingImage.findFirst({ where: { id: post.scheduledImageId, postId: post.id } });
        const bytes = row ? await readBytes(row.imagePathname) : null;
        if (row && bytes) image = { bytes, type: "image/png", alt: row.headline || "Visuel" };
      }
      const published = await publishOnLinkedin({ text: post.text, image });
      await prisma.marketingPost.update({ where: { id: post.id }, data: { linkedinUrn: published.urn || null, publishedAt: new Date(), autoDraft: false } });
      done++;
    } catch (error) {
      const reason = (error instanceof Error ? error.message : "Publication refusée par LinkedIn.").slice(0, 300);
      await prisma.marketingPost.update({ where: { id: post.id }, data: { publishError: reason } });
      await sendEmail({
        to: env.ADMIN_EMAIL,
        subject: "Publication LinkedIn programmée : échec",
        text: ["Bonjour Ben,", "", `La publication prévue aujourd’hui n’est pas partie : ${reason}`, "", `« ${post.text.split("\n")[0]!.slice(0, 120)} »`, "", `Pour la reprogrammer ou la publier à la main : ${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/admin/marketing${post.cohortId ? `?cohorte=${post.cohortId}` : ""}`].join("\n"),
      }).catch(() => undefined);
    }
  }
  return done;
}

/**
 * Plans a LinkedIn post for a day (lot 7), or takes it off the plan (day
 * null). Planning validates a proposed draft; the daily cron publishes it.
 */
export async function planPost(postId: number, day: Date | null, imageId: number | null = null): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { channel: true, linkedinUrn: true, publishedAt: true } });
  if (!post) return { ok: false, error: `Aucun post n°${postId}.` };
  if (!day) {
    await prisma.marketingPost.update({ where: { id: postId }, data: { scheduledFor: null, scheduledImageId: null, publishError: null } });
    return { ok: true, message: "Post retiré du planning." };
  }
  if (post.channel !== "linkedin") return { ok: false, error: "Seuls les posts LinkedIn se programment." };
  if (post.linkedinUrn || post.publishedAt) return { ok: false, error: "Ce post est déjà publié." };
  if (imageId !== null && !(await prisma.marketingImage.findFirst({ where: { id: imageId, postId }, select: { id: true } }))) return { ok: false, error: "Ce visuel n’appartient pas à ce post." };
  await prisma.marketingPost.update({ where: { id: postId }, data: { scheduledFor: day, scheduledImageId: imageId, publishError: null, autoDraft: false } });
  return { ok: true, message: `Post programmé pour le ${day.toISOString().slice(0, 10)}.` };
}
