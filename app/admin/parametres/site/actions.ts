"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { SITE_CACHE_TAG, type SiteSectionKey, saveSiteSection } from "@/lib/site-settings";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** One section at a time: the form posts a JSON payload built client-side. */
export async function saveSection(key: SiteSectionKey, payload: unknown): Promise<SaveResult> {
  await requireAdmin();
  try {
    await saveSiteSection(key, payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return { ok: false, error: `${issue?.path.join(".") || key} : ${issue?.message ?? "valeur invalide"}` };
    }
    throw error;
  }
  revalidateTag(SITE_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/admin/parametres/site");
  return { ok: true };
}
