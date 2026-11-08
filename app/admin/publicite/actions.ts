"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { adCampaignSchema, adCode } from "@/lib/ads";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const back = (message: string, ok = false): never => redirect(`/admin/publicite?${ok ? "ok" : "erreur"}=${encodeURIComponent(message)}`);

/** Declares a paid campaign and gives it its tracked link (lot 8). */
export async function createAdCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = adCampaignSchema.safeParse(Object.fromEntries(["name", "channel", "destination", "cohortId", "budgetUsd"].map((k) => [k, formData.get(k)])));
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Données invalides");
  const d = parsed.data!;
  if (d.cohortId && !(await prisma.cohort.findUnique({ where: { id: d.cohortId }, select: { id: true } }))) back("Cohorte introuvable.");
  let code = adCode(d.name);
  for (let i = 0; i < 4 && (await prisma.adCampaign.findUnique({ where: { code } })); i++) code = adCode(d.name);
  await prisma.adCampaign.create({ data: { ...d, code } });
  revalidatePath("/admin/publicite");
  back(`Campagne « ${d.name} » créée : copiez son lien dans votre publicité.`, true);
}

/** What has been spent so far, as read in the ad tool, in USD (cents allowed). */
export async function updateAdSpend(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({
    id: z.coerce.number().int().positive(),
    spent: z.string().trim().transform((v) => Number(v.replace(/\s/g, "").replace(",", "."))).pipe(z.number({ invalid_type_error: "Montant invalide" }).min(0, "Montant invalide").max(1_000_000, "Montant trop élevé")),
  }).safeParse({ id: formData.get("id"), spent: formData.get("spent") ?? "" });
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Montant invalide");
  const { id, spent } = parsed.data!;
  await prisma.adCampaign.update({ where: { id }, data: { spentCents: Math.round(spent * 100), spentUpdatedAt: new Date() } });
  revalidatePath("/admin/publicite");
  revalidatePath("/admin/pilotage");
  back("Dépense mise à jour.", true);
}

export async function toggleAdCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) back("Campagne introuvable.");
  const row = await prisma.adCampaign.findUnique({ where: { id: id.data! }, select: { active: true } });
  if (!row) back("Campagne introuvable.");
  await prisma.adCampaign.update({ where: { id: id.data! }, data: { active: !row!.active } });
  revalidatePath("/admin/publicite");
  back(row!.active ? "Campagne marquée terminée." : "Campagne réactivée.", true);
}
