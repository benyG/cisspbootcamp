"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function updateTemplate(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
  const parsed = z.object({ key: z.string().min(1).max(64), subject: z.string().max(255).optional().or(z.literal("")), body: z.string().min(1).max(5000) })
    .safeParse({ key: formData.get("key"), subject: formData.get("subject"), body: formData.get("body") });
  if (!parsed.success) return;
  await prisma.messageTemplate.update({ where: { key: parsed.data.key }, data: { subject: parsed.data.subject || null, body: parsed.data.body } });
  revalidatePath("/admin/parametres/gabarits");
  revalidatePath("/admin");
}
