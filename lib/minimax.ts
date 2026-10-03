import { get, put } from "@vercel/blob";

import { prisma } from "@/lib/db";

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
});

export const CLIP_SECONDS = 6;
/** A task still running after this long is marked failed (MiniMax usually takes a few minutes). */
export const GIVE_UP_MINUTES = 60;

export function minimaxEnabled(): boolean {
  return Boolean(config().apiKey);
}

type BaseResp = { status_code?: number; status_msg?: string };

class MinimaxError extends Error {}

async function call<T extends { base_resp?: BaseResp }>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
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

/** Starts one clip for a post. */
export async function startVideo(postId: number, prompt: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!minimaxEnabled()) return { ok: false, error: "La clé MINIMAX_API_KEY n'est pas configurée sur Vercel." };
  const { model, resolution } = config();
  try {
    const task = await call<{ task_id: string; base_resp?: BaseResp }>("/v1/video_generation", {
      method: "POST",
      body: JSON.stringify({ model, prompt, duration: CLIP_SECONDS, resolution }),
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

/** The MP4 bytes of a finished clip, for the admin-only download route. */
export async function readVideo(pathname: string): Promise<ReadableStream<Uint8Array> | null> {
  const result = await get(pathname, { access: "private" });
  return result && result.statusCode === 200 ? result.stream : null;
}
