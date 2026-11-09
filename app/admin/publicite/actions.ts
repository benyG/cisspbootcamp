"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { createAdCampaign as createCampaign, setAdActive, setAdSpend } from "@/lib/admin-ops/ads";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const back = (message: string, ok = false): never => redirect(`/admin/publicite?${ok ? "ok" : "erreur"}=${encodeURIComponent(message)}`);

/** Declares a paid campaign and gives it its tracked link (lot 8). */
export async function createAdCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = await createCampaign(Object.fromEntries(["name", "channel", "destination", "cohortId", "budgetUsd"].map((k) => [k, formData.get(k)])));
  revalidatePath("/admin/publicite");
  back(result.ok ? result.message : result.error, result.ok);
}

/** What has been spent so far, as read in the ad tool, in USD (cents allowed). */
export async function updateAdSpend(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({
    id: z.coerce.number().int().positive(),
    spent: z.string().trim().transform((v) => Number(v.replace(/\s/g, "").replace(",", "."))).pipe(z.number({ invalid_type_error: "Montant invalide" }).min(0, "Montant invalide").max(1_000_000, "Montant trop élevé")),
  }).safeParse({ id: formData.get("id"), spent: formData.get("spent") ?? "" });
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Montant invalide");
  const result = await setAdSpend(parsed.data!.id, Math.round(parsed.data!.spent * 100));
  revalidatePath("/admin/publicite");
  revalidatePath("/admin/pilotage");
  back(result.ok ? result.message : result.error, result.ok);
}

export async function toggleAdCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) back("Campagne introuvable.");
  const result = await setAdActive(id.data!);
  revalidatePath("/admin/publicite");
  back(result.ok ? result.message : result.error, result.ok);
}
