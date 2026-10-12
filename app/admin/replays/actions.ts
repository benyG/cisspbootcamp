"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { type DriveVideo, listDriveVideos } from "@/lib/drive";
import { REOPEN_MONTHS } from "@/lib/replays";
import {
  type Result,
  attachLab,
  createItem,
  deleteItem,
  driveCopyStep,
  finishComputerUpload,
  publishItem,
  refreshVideo,
  refuseReopen,
  removeLab,
  removeVideo,
  reopenAccess,
  startComputerUpload,
  startDriveCopy,
  updateItem,
} from "@/lib/replays-server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();
const refresh = () => revalidatePath("/admin/replays");
const back = (query: string, r: Result): never => redirect(`/admin/replays?${query}${query ? "&" : ""}${r.ok ? "ok" : "erreur"}=${encodeURIComponent(r.ok ? r.message : r.error)}`);
const keep = (formData: FormData) => { const c = formData.get("cohorte"); const p = formData.get("programme"); return [p ? `programme=${p}` : "", c ? `cohorte=${c}` : ""].filter(Boolean).join("&"); };
const itemSchema = z.object({ title: z.string().trim().min(3, "Donnez un titre (3 caractères au moins).").max(200), modules: z.array(z.coerce.number().int().min(1).max(40)).max(40) });

/** A new recording in the library: a title and the modules it covers (Ben, 12/10). */
export async function createItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const program = z.enum(["cissp", "cc"]).parse(formData.get("program"));
  const parsed = itemSchema.safeParse({ title: formData.get("title"), modules: formData.getAll("modules") });
  if (!parsed.success) back(keep(formData), { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." });
  if (program === "cissp" && parsed.data!.modules.length === 0) back(keep(formData), { ok: false, error: "Cochez au moins un module couvert par l'enregistrement." });
  await createItem({ program, ...parsed.data! });
  refresh();
  back(keep(formData), { ok: true, message: `« ${parsed.data!.title} » ajouté : envoyez maintenant la vidéo ou le lab.` });
}

export async function updateItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = itemSchema.safeParse({ title: formData.get("title"), modules: formData.getAll("modules") });
  if (!parsed.success) back(keep(formData), { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." });
  await updateItem(id.parse(formData.get("itemId")), parsed.data!);
  refresh();
  back(keep(formData), { ok: true, message: "Enregistrement mis à jour." });
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  if (formData.get("confirm") !== "on") back(keep(formData), { ok: false, error: "Cochez la confirmation pour supprimer." });
  await deleteItem(id.parse(formData.get("itemId")));
  refresh();
  back(keep(formData), { ok: true, message: "Enregistrement supprimé de la vidéothèque, avec sa vidéo et son lab." });
}

export async function startUploadAction(input: { itemId: number; name: string; size: number }) {
  await requireAdmin();
  const parsed = z.object({ itemId: id, name: z.string().trim().min(1).max(255), size: z.number().int().positive().max(30 * 1024 ** 3) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Fichier invalide." };
  return startComputerUpload(parsed.data.itemId, { name: parsed.data.name, size: parsed.data.size });
}

export async function finishUploadAction(input: { itemId: number }): Promise<void> {
  await requireAdmin();
  await finishComputerUpload(id.parse(input.itemId));
  refresh();
}

export async function driveVideosAction(input: { search: string }): Promise<{ ok: true; videos: DriveVideo[] } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    return { ok: true, videos: await listDriveVideos(z.string().max(100).parse(input.search ?? "")) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Google Drive ne répond pas." };
  }
}

export async function startDriveAction(input: { itemId: number; fileId: string }) {
  await requireAdmin();
  const parsed = z.object({ itemId: id, fileId: z.string().regex(/^[A-Za-z0-9_-]{10,120}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Fichier invalide." };
  const result = await startDriveCopy(parsed.data.itemId, parsed.data.fileId);
  refresh();
  return result;
}

/** One stretch of a Drive copy; the page calls it until the copy is done. */
export async function driveStepAction(input: { itemId: number }) {
  await requireAdmin();
  return driveCopyStep(id.parse(input.itemId), 40_000);
}

/** Asks Cloudflare whether the video is ready; true when the row changed. */
export async function checkVideoAction(input: { itemId: number }): Promise<boolean> {
  await requireAdmin();
  const item = await prisma.replayItem.findUnique({ where: { id: id.parse(input.itemId) }, select: { streamUid: true, videoStatus: true } });
  if (!item?.streamUid || item.videoStatus !== "processing") return false;
  const changed = await refreshVideo(id.parse(input.itemId), item.streamUid);
  if (changed) refresh();
  return changed;
}

export async function removeVideoAction(input: { itemId: number }): Promise<void> {
  await requireAdmin();
  await removeVideo(id.parse(input.itemId));
  refresh();
}

export async function attachLabAction(input: { itemId: number; pathname: string; name: string }): Promise<Result> {
  await requireAdmin();
  const parsed = z.object({ itemId: id, pathname: z.string().max(255), name: z.string().trim().min(1).max(255) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fichier invalide." };
  const result = await attachLab(parsed.data.itemId, parsed.data);
  refresh();
  return result;
}

export async function removeLabAction(input: { itemId: number }): Promise<void> {
  await requireAdmin();
  await removeLab(id.parse(input.itemId));
  refresh();
}

export async function publishAction(input: { itemId: number; cohortId: number; leadIds: number[] | "all" }): Promise<Result> {
  await requireAdmin();
  const parsed = z.object({ itemId: id, cohortId: id, leadIds: z.union([z.literal("all"), z.array(id).min(1).max(200)]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisissez une cohorte et au moins une personne." };
  const result = await publishItem(parsed.data.itemId, parsed.data.cohortId, parsed.data.leadIds);
  refresh();
  return result;
}

export async function reopenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const months = z.coerce.number().int().refine((m) => (REOPEN_MONTHS as readonly number[]).includes(m)).parse(formData.get("months"));
  back(keep(formData), await reopenAccess(id.parse(formData.get("accessId")), months));
}

export async function refuseAction(formData: FormData): Promise<void> {
  await requireAdmin();
  back(keep(formData), await refuseReopen(id.parse(formData.get("accessId"))));
}
