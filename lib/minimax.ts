import { get, put } from "@vercel/blob";

import { prisma } from "@/lib/db";
import { brandedImagePrompt, brandedVideoPrompt } from "@/lib/marketing/brand";

/**
 * MiniMax text-to-video for the TikTok posts (Ben, 03/10), over plain
 * fetch: create a task, poll it, fetch the file and copy it to private Blob
 * storage, since MiniMax download links expire. One call makes one clip of
 * 6 seconds; a 15 to 30 second TikTok is assembled from several clips.
 * Model and resolution are environment settings, so a new MiniMax model is
 * a Vercel change, not a code change.
 */

const config = () => ({
  apiKey: process.env.MINIMAX_API_KEY ?? "",
  groupId: process.env.MINIMAX_GROUP_ID ?? "",
  baseUrl: (process.env.MINIMAX_BASE_URL ?? "https://api.minimax.io").replace(/\/$/, ""),
  model: process.env.MINIMAX_VIDEO_MODEL ?? "MiniMax-Hailuo-02",
  resolution: process.env.MINIMAX_VIDEO_RESOLUTION ?? "768P",
  imageModel: process.env.MINIMAX_IMAGE_MODEL ?? "image-01",
});

export const CLIP_SECONDS = 6;
/** A task still running after this long is marked failed (MiniMax usually takes a few minutes). */
export const GIVE_UP_MINUTES = 60;

export function minimaxEnabled(): boolean {
  return Boolean(config().apiKey);
}

type BaseResp = { status_code?: number; status_msg?: string };

class MinimaxError extends Error {}

async function call<T extends { base_resp?: BaseResp }>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new MinimaxError(`MiniMax a répondu ${response.status} : ${text.slice(0, 200)}`);
  }
  if (!response.ok || (data.base_resp?.status_code ?? 0) !== 0) {
    const msg = data.base_resp?.status_msg ?? text.slice(0, 200);
    throw new MinimaxError(response.status === 401 || data.base_resp?.status_code === 1004 ? "Clé MiniMax refusée : vérifiez MINIMAX_API_KEY sur Vercel." : `MiniMax : ${msg}`);
  }
  return data;
}

/** Pure: MiniMax task status → ours. */
export function mapStatus(status: string | undefined): "queued" | "processing" | "done" | "failed" {
  switch ((status ?? "").toLowerCase()) {
    case "success":
      return "done";
    case "fail":
    case "failed":
      return "failed";
    case "processing":
      return "processing";
    default:
      return "queued";
  }
}

/**
 * Starts one clip for a post. The brand's film rules are added to Ben's
 * prompt (lib/marketing/brand.ts); a first frame, when given, is one of the
 * post's generated photographs, so the clip opens on the brand's image.
 */
export async function startVideo(postId: number, prompt: string, firstFrame?: { bytes: Uint8Array; type: string } | null): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!minimaxEnabled()) return { ok: false, error: "La clé MINIMAX_API_KEY n'est pas configurée sur Vercel." };
  const { model, resolution } = config();
  try {
    const task = await call<{ task_id: string; base_resp?: BaseResp }>("/v1/video_generation", {
      method: "POST",
      body: JSON.stringify({
        model,
        prompt: brandedVideoPrompt(prompt),
        duration: CLIP_SECONDS,
        resolution,
        ...(firstFrame ? { first_frame_image: `data:${firstFrame.type};base64,${Buffer.from(firstFrame.bytes).toString("base64")}` } : {}),
      }),
    });
    const row = await prisma.marketingVideo.create({ data: { postId, prompt, model, duration: CLIP_SECONDS, taskId: task.task_id } });
    return { ok: true, id: row.id };
  } catch (error) {
    console.error("[minimax] création", error);
    return { ok: false, error: error instanceof Error ? error.message : "La création de la vidéo a échoué." };
  }
}

/** Checks one pending clip; when MiniMax is done, copies the file to Blob. */
export async function syncVideo(id: number, now = new Date()): Promise<void> {
  const row = await prisma.marketingVideo.findUnique({ where: { id } });
  if (!row || row.status === "done" || row.status === "failed") return;
  if (now.getTime() - row.createdAt.getTime() > GIVE_UP_MINUTES * 60_000) {
    await prisma.marketingVideo.update({ where: { id }, data: { status: "failed", error: "Pas de résultat après une heure : relancez la génération." } });
    return;
  }
  try {
    const task = await call<{ status?: string; file_id?: string; base_resp?: BaseResp }>(`/v1/query/video_generation?task_id=${encodeURIComponent(row.taskId)}`);
    const status = mapStatus(task.status);
    if (status === "failed") {
      await prisma.marketingVideo.update({ where: { id }, data: { status, error: "MiniMax n'a pas pu générer ce plan : reformulez le prompt." } });
      return;
    }
    if (status !== "done" || !task.file_id) {
      if (status !== row.status) await prisma.marketingVideo.update({ where: { id }, data: { status } });
      return;
    }
    const { groupId } = config();
    const file = await call<{ file?: { download_url?: string }; base_resp?: BaseResp }>(`/v1/files/retrieve?file_id=${encodeURIComponent(task.file_id)}${groupId ? `&GroupId=${encodeURIComponent(groupId)}` : ""}`);
    if (!file.file?.download_url) throw new MinimaxError("MiniMax n'a pas donné de lien de téléchargement.");
    const download = await fetch(file.file.download_url, { signal: AbortSignal.timeout(60_000) });
    if (!download.ok) throw new MinimaxError(`Téléchargement de la vidéo refusé (${download.status}).`);
    const blob = await put(`marketing-videos/post-${row.postId}-video-${row.id}.mp4`, Buffer.from(await download.arrayBuffer()), { access: "private", contentType: "video/mp4", addRandomSuffix: true });
    await prisma.marketingVideo.update({ where: { id }, data: { status: "done", blobPathname: blob.pathname, error: null } });
  } catch (error) {
    console.error("[minimax] suivi", row.id, error);
    // A transient error leaves the clip pending; the next check retries.
    if (error instanceof MinimaxError && /Clé MiniMax/.test(error.message)) {
      await prisma.marketingVideo.update({ where: { id }, data: { status: "failed", error: error.message.slice(0, 300) } });
    }
  }
}

/** Cron, every 15 minutes: clips still pending from the last day. */
export async function syncPendingVideos(now = new Date()): Promise<number> {
  if (!minimaxEnabled()) return 0;
  const pending = await prisma.marketingVideo.findMany({ where: { status: { in: ["queued", "processing"] }, createdAt: { gt: new Date(now.getTime() - 24 * 3_600_000) } }, select: { id: true }, take: 20 });
  for (const v of pending) await syncVideo(v.id, now);
  return pending.length;
}

/** The bytes of a stored file (clip or image), for the admin-only routes. */
export async function readStored(pathname: string): Promise<ReadableStream<Uint8Array> | null> {
  const result = await get(pathname, { access: "private" });
  return result && result.statusCode === 200 ? result.stream : null;
}

export async function readBytes(pathname: string): Promise<Uint8Array | null> {
  const stream = await readStored(pathname);
  return stream ? new Uint8Array(await new Response(stream).arrayBuffer()) : null;
}

/**
 * One photograph (Ben, 03/10): the scene wrapped in the brand's photography
 * rules, no text drawn by the model. Synchronous on MiniMax's side (a few
 * seconds to a minute). MiniMax's own prompt rewriting stays off, so the
 * brand rules reach the model as written.
 */
export async function generatePhoto(scene: string, aspectRatio: string): Promise<{ ok: true; bytes: Uint8Array; type: string; prompt: string; model: string } | { ok: false; error: string }> {
  if (!minimaxEnabled()) return { ok: false, error: "La clé MINIMAX_API_KEY n'est pas configurée sur Vercel." };
  const { imageModel } = config();
  const prompt = brandedImagePrompt(scene);
  try {
    const result = await call<{ data?: { image_base64?: string[] }; metadata?: { failed_count?: string | number }; base_resp?: BaseResp }>(
      "/v1/image_generation",
      { method: "POST", body: JSON.stringify({ model: imageModel, prompt, aspect_ratio: aspectRatio, response_format: "base64", n: 1, prompt_optimizer: false }) },
      90_000,
    );
    const b64 = result.data?.image_base64?.[0];
    if (!b64) return { ok: false, error: "MiniMax n'a pas rendu d'image (scène refusée par son filtre ?) : reformulez la scène." };
    const bytes = new Uint8Array(Buffer.from(b64, "base64"));
    return { ok: true, bytes, type: bytes[0] === 0x89 ? "image/png" : "image/jpeg", prompt, model: imageModel };
  } catch (error) {
    console.error("[minimax] image", error);
    return { ok: false, error: error instanceof Error ? error.message : "La génération de l'image a échoué." };
  }
}
