/**
 * Cloudflare Stream over plain fetch (Ben, 12/10): the session recordings,
 * watched on the site only. Every video requires a signed token, which the
 * site mints per viewer for a couple of hours, and plays only from the
 * site's own domain; downloads stay off. Uploads use the resumable (tus)
 * protocol, so a 3 GB recording goes up in pieces: from Ben's browser, or
 * copied from his Google Drive by the server.
 */

const API = "https://api.cloudflare.com/client/v4";

const config = () => ({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  token: process.env.CLOUDFLARE_STREAM_TOKEN ?? "",
});

export function streamEnabled(): boolean {
  const c = config();
  return Boolean(c.accountId && c.token);
}

/** Pieces of a resumable upload: Cloudflare wants multiples of 256 KiB, at least 5 MB. */
export const TUS_CHUNK_BYTES = 50 * 1024 * 1024;
/** A session recording is at most this long (7 h days, with margin). */
export const MAX_DURATION_SECONDS = 8 * 3600;
/** A playback token lasts this long; the page asks for a new one on each visit. */
export const PLAYBACK_TOKEN_SECONDS = 3 * 3600;

class StreamError extends Error {}

/** Domains allowed to embed the player: the site, with and without www. */
export function allowedOrigins(appUrl: string): string[] {
  const host = new URL(appUrl).host.replace(/^www\./, "");
  return [host, `www.${host}`];
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { accountId, token } = config();
  const response = await fetch(`${API}/accounts/${accountId}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => null)) as { success?: boolean; result?: T; errors?: Array<{ message?: string }> } | null;
  if (!response.ok || !data?.success) {
    const message = data?.errors?.map((e) => e.message).filter(Boolean).join(" ; ") || `HTTP ${response.status}`;
    throw new StreamError(response.status === 401 || response.status === 403 ? "Cloudflare refuse la clé : vérifiez CLOUDFLARE_STREAM_TOKEN (permission Stream : modifier)." : `Cloudflare Stream : ${message}`);
  }
  return data.result as T;
}

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

/**
 * Opens a resumable upload of `size` bytes. The returned URL takes the
 * pieces without any key (it is single-use), so the browser can send them
 * itself; the video is created private (signed playback only).
 */
export async function createUpload(input: { name: string; size: number; appUrl: string }): Promise<{ uploadUrl: string; uid: string }> {
  const { accountId, token } = config();
  const metadata = [
    `name ${b64(input.name)}`,
    "requiresignedurls",
    `maxdurationseconds ${b64(String(MAX_DURATION_SECONDS))}`,
    `allowedorigins ${b64(allowedOrigins(input.appUrl).join(","))}`,
  ].join(",");
  const response = await fetch(`${API}/accounts/${accountId}/stream?direct_user=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(input.size), "Upload-Metadata": metadata },
    signal: AbortSignal.timeout(20_000),
  });
  const uploadUrl = response.headers.get("location");
  const uid = response.headers.get("stream-media-id");
  if (!response.ok || !uploadUrl || !uid) {
    const text = await response.text().catch(() => "");
    throw new StreamError(response.status === 401 || response.status === 403 ? "Cloudflare refuse la clé : vérifiez CLOUDFLARE_STREAM_TOKEN." : `Cloudflare n'a pas ouvert l'envoi (${response.status}) ${text.slice(0, 200)}`);
  }
  return { uploadUrl, uid };
}

/** Sends one piece of a resumable upload; returns the new offset. */
export async function sendChunk(uploadUrl: string, offset: number, bytes: Uint8Array): Promise<number> {
  const response = await fetch(uploadUrl, {
    method: "PATCH",
    headers: { "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
    body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new StreamError(`Envoi refusé par Cloudflare (${response.status}).`);
  return Number(response.headers.get("upload-offset") ?? offset + bytes.byteLength);
}

/** Where an interrupted upload stands. */
export async function uploadOffset(uploadUrl: string): Promise<number | null> {
  const response = await fetch(uploadUrl, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;
  return Number(response.headers.get("upload-offset") ?? 0);
}

export type VideoState = { ready: boolean; state: string; error: string | null; duration: number | null };

/** Pure: Cloudflare's video record → ours. */
export function videoState(v: { readyToStream?: boolean; status?: { state?: string; errorReasonText?: string }; duration?: number }): VideoState {
  const state = v.status?.state ?? "unknown";
  return {
    ready: Boolean(v.readyToStream) && state === "ready",
    state,
    error: state === "error" ? v.status?.errorReasonText || "Cloudflare n'a pas pu traiter la vidéo." : null,
    duration: typeof v.duration === "number" && v.duration > 0 ? Math.round(v.duration) : null,
  };
}

export async function getVideo(uid: string): Promise<VideoState> {
  return videoState(await call<{ readyToStream?: boolean; status?: { state?: string; errorReasonText?: string }; duration?: number }>(`/${encodeURIComponent(uid)}`));
}

/** Locks a video down again (signed playback, site domains only); idempotent. */
export async function secureVideo(uid: string, appUrl: string): Promise<void> {
  await call(`/${encodeURIComponent(uid)}`, { method: "POST", body: JSON.stringify({ uid, requireSignedURLs: true, allowedOrigins: allowedOrigins(appUrl) }) });
}

/** A short-lived playback token: the player URL is https://iframe.videodelivery.net/<token>. */
export async function playbackToken(uid: string, now = Date.now()): Promise<string> {
  const result = await call<{ token: string }>(`/${encodeURIComponent(uid)}/token`, {
    method: "POST",
    body: JSON.stringify({ exp: Math.floor(now / 1000) + PLAYBACK_TOKEN_SECONDS, downloadable: false }),
  });
  return result.token;
}

export async function deleteVideo(uid: string): Promise<void> {
  const { accountId, token } = config();
  const response = await fetch(`${API}/accounts/${accountId}/stream/${encodeURIComponent(uid)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok && response.status !== 404) throw new StreamError(`Cloudflare n'a pas supprimé la vidéo (${response.status}).`);
}

export const PLAYER_ORIGIN = "https://iframe.videodelivery.net";
