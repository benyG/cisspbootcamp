import { accessToken } from "@/lib/calendar/google";

/**
 * Google Drive, read only (Ben, 12/10): Ben's session recordings (Meet
 * saves them in "Meet Recordings") are listed and read piece by piece, to be
 * copied to Cloudflare Stream. Needs the Drive scope, added from
 * Paramètres › Google; without it Google answers 403.
 */

const API = "https://www.googleapis.com/drive/v3";

export type DriveVideo = { id: string; name: string; size: number; modifiedTime: string; durationSec: number | null };

export class DriveAccessError extends Error {}

async function token(): Promise<string> {
  return (await accessToken()).token;
}

function failure(status: number, text: string): Error {
  if (status === 401 || status === 403) return new DriveAccessError("Google Drive n'est pas autorisé : Paramètres › Google › « Ajouter l’accès Google Drive ».");
  return new Error(`Google Drive a répondu ${status} : ${text.slice(0, 200)}`);
}

/** Pure: a name search, with quotes and backslashes escaped for Drive's query language. */
export function videoQuery(search: string): string {
  const term = search.trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return ["mimeType contains 'video/'", "trashed = false", ...(term ? [`name contains '${term}'`] : [])].join(" and ");
}

/** The latest videos of the Drive, newest first; `search` filters on the name. */
export async function listDriveVideos(search = ""): Promise<DriveVideo[]> {
  const params = new URLSearchParams({
    q: videoQuery(search),
    orderBy: "modifiedTime desc",
    pageSize: "25",
    fields: "files(id,name,size,modifiedTime,videoMediaMetadata(durationMillis))",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetch(`${API}/files?${params}`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw failure(response.status, await response.text());
  const data = (await response.json()) as { files?: Array<{ id: string; name: string; size?: string; modifiedTime: string; videoMediaMetadata?: { durationMillis?: string } }> };
  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    size: Number(f.size ?? 0),
    modifiedTime: f.modifiedTime,
    durationSec: f.videoMediaMetadata?.durationMillis ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000) : null,
  }));
}

export async function driveFile(id: string): Promise<{ name: string; size: number; mimeType: string }> {
  const response = await fetch(`${API}/files/${encodeURIComponent(id)}?fields=name,size,mimeType&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw failure(response.status, await response.text());
  const f = (await response.json()) as { name: string; size?: string; mimeType: string };
  return { name: f.name, size: Number(f.size ?? 0), mimeType: f.mimeType };
}

/** Bytes [from, to] of a Drive file. */
export async function readDriveRange(id: string, from: number, to: number): Promise<Uint8Array> {
  const response = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await token()}`, Range: `bytes=${from}-${to}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw failure(response.status, await response.text());
  return new Uint8Array(await response.arrayBuffer());
}
