import type { z } from "zod";

import { adCampaignSchema, adCode } from "@/lib/ads";
import { prisma } from "@/lib/db";

import type { OpResult } from "./leads";

/** Paid campaigns (lot 8), for the admin page and the MCP plug. */

export async function createAdCampaign(input: unknown): Promise<OpResult & { code?: string }> {
  const parsed = adCampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const d: z.output<typeof adCampaignSchema> = parsed.data;
  if (d.cohortId && !(await prisma.cohort.findUnique({ where: { id: d.cohortId }, select: { id: true } }))) return { ok: false, error: "Cohorte introuvable." };
  let code = adCode(d.name);
  for (let i = 0; i < 4 && (await prisma.adCampaign.findUnique({ where: { code } })); i++) code = adCode(d.name);
  await prisma.adCampaign.create({ data: { ...d, code } });
  return { ok: true, code, message: `Campagne « ${d.name} » créée : copiez son lien dans votre publicité.` };
}

/** What has been spent so far, as read in the ad tool, USD cents. */
export async function setAdSpend(id: number, spentCents: number, now = new Date()): Promise<OpResult> {
  if (!Number.isInteger(spentCents) || spentCents < 0 || spentCents > 100_000_000) return { ok: false, error: "Montant invalide." };
  const row = await prisma.adCampaign.findUnique({ where: { id }, select: { id: true } });
  if (!row) return { ok: false, error: "Campagne introuvable." };
  await prisma.adCampaign.update({ where: { id }, data: { spentCents, spentUpdatedAt: now } });
  return { ok: true, message: "Dépense mise à jour." };
}

export async function setAdActive(id: number, active?: boolean): Promise<OpResult> {
  const row = await prisma.adCampaign.findUnique({ where: { id }, select: { active: true } });
  if (!row) return { ok: false, error: "Campagne introuvable." };
  const next = active ?? !row.active;
  await prisma.adCampaign.update({ where: { id }, data: { active: next } });
  return { ok: true, message: next ? "Campagne réactivée." : "Campagne marquée terminée." };
}
