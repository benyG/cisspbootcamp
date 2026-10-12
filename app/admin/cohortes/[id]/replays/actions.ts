"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { type DriveVideo, listDriveVideos } from "@/lib/drive";
import { REOPEN_MONTHS } from "@/lib/replays";
import {
  type Result,
  attachLab,
  driveCopyStep,
  finishComputerUpload,
  publishReplay,
  refreshVideo,
  refuseReopen,
  removeLab,
  removeVideo,
  reopenAccess,
  startComputerUpload,
  startDriveCopy,
} from "@/lib/replays-server";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();
const target = z.object({ cohortId: id, day: id });
const refresh = (cohortId: number) => revalidatePath(`/admin/cohortes/${cohortId}/replays`);

export async function startUploadAction(input: { cohortId: number; day: number; name: string; size: number }) {
  await requireAdmin();
  const parsed = target.extend({ name: z.string().trim().min(1).max(255), size: z.number().int().positive().max(30 * 1024 ** 3) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Fichier invalide." };
  return startComputerUpload(parsed.data.cohortId, parsed.data.day, { name: parsed.data.name, size: parsed.data.size });
}

export async function finishUploadAction(input: { cohortId: number; replayId: number }): Promise<void> {
  await requireAdmin();
  await finishComputerUpload(id.parse(input.replayId));
  refresh(id.parse(input.cohortId));
}

export async function driveVideosAction(input: { search: string }): Promise<{ ok: true; videos: DriveVideo[] } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    return { ok: true, videos: await listDriveVideos(z.string().max(100).parse(input.search ?? "")) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Google Drive ne répond pas." };
  }
}

export async function startDriveAction(input: { cohortId: number; day: number; fileId: string }) {
  await requireAdmin();
  const parsed = target.extend({ fileId: z.string().regex(/^[A-Za-z0-9_-]{10,120}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Fichier invalide." };
  const result = await startDriveCopy(parsed.data.cohortId, parsed.data.day, parsed.data.fileId);
  refresh(parsed.data.cohortId);
  return result;
}

/** One stretch of a Drive copy; the page calls it until the copy is done. */
export async function driveStepAction(input: { replayId: number }) {
  await requireAdmin();
  return driveCopyStep(id.parse(input.replayId), 40_000);
}

/** Asks Cloudflare whether the video is ready; true when the row changed. */
export async function checkVideoAction(input: { cohortId: number; replayId: number }): Promise<boolean> {
  await requireAdmin();
  const replay = await prisma.cohortReplay.findUnique({ where: { id: id.parse(input.replayId) }, select: { streamUid: true, videoStatus: true } });
  if (!replay?.streamUid || replay.videoStatus !== "processing") return false;
  const changed = await refreshVideo(id.parse(input.replayId), replay.streamUid);
  if (changed) refresh(id.parse(input.cohortId));
  return changed;
}

export async function removeVideoAction(input: { cohortId: number; day: number }): Promise<void> {
  await requireAdmin();
  const t = target.parse(input);
  await removeVideo(t.cohortId, t.day);
  refresh(t.cohortId);
}

export async function attachLabAction(input: { cohortId: number; day: number; pathname: string; name: string }): Promise<Result> {
  await requireAdmin();
  const parsed = target.extend({ pathname: z.string().max(255), name: z.string().trim().min(1).max(255) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fichier invalide." };
  const result = await attachLab(parsed.data.cohortId, parsed.data.day, parsed.data);
  refresh(parsed.data.cohortId);
  return result;
}

export async function removeLabAction(input: { cohortId: number; day: number }): Promise<void> {
  await requireAdmin();
  const t = target.parse(input);
  await removeLab(t.cohortId, t.day);
  refresh(t.cohortId);
}

export async function publishAction(input: { cohortId: number; day: number; leadIds: number[] | "all" }): Promise<Result> {
  await requireAdmin();
  const parsed = target.extend({ leadIds: z.union([z.literal("all"), z.array(id).min(1).max(200)]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisissez au moins une personne." };
  const result = await publishReplay(parsed.data.cohortId, parsed.data.day, parsed.data.leadIds);
  refresh(parsed.data.cohortId);
  return result;
}

const back = (cohortId: number, r: Result): never => redirect(`/admin/cohortes/${cohortId}/replays?${r.ok ? "ok" : "erreur"}=${encodeURIComponent(r.ok ? r.message : r.error)}`);

export async function reopenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = id.parse(formData.get("cohortId"));
  const months = z.coerce.number().int().refine((m) => (REOPEN_MONTHS as readonly number[]).includes(m)).parse(formData.get("months"));
  back(cohortId, await reopenAccess(id.parse(formData.get("accessId")), months));
}

export async function refuseAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = id.parse(formData.get("cohortId"));
  back(cohortId, await refuseReopen(id.parse(formData.get("accessId"))));
}
