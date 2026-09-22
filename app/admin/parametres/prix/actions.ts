"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";

/** Amount entered in whole USD, stored in cents (CLAUDE.md). Country list as codes. */
export async function updateTier(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
  const parsed = z.object({
    code: z.string().min(1).max(32),
    label: z.string().trim().min(1).max(120),
    amountUsd: z.coerce.number().min(0).max(100_000),
    countries: z.string().max(2000),
  }).safeParse({ code: formData.get("code"), label: formData.get("label"), amountUsd: formData.get("amountUsd"), countries: formData.get("countries") });
  if (!parsed.success) return;
  const { code, label, amountUsd, countries } = parsed.data;
  await prisma.pricingTier.update({
    where: { code },
    data: {
      label,
      amountUsd: Math.round(amountUsd * 100),
      countries: countries.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)),
    },
  });
  revalidateTag(COHORTS_CACHE_TAG);
  revalidatePath("/admin/parametres/prix");
  revalidatePath("/");
}
