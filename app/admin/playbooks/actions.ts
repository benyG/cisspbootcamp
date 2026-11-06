"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { MODES, PLAYBOOK_IDS } from "@/lib/playbooks/rules";
import { saveMode } from "@/lib/playbooks/server";

const schema = z.object({ id: z.enum(PLAYBOOK_IDS), mode: z.enum(MODES) });

/** Actif, Essai or Arrêté for one playbook (lot 3). */
export async function setPlaybookMode(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
  const parsed = schema.safeParse({ id: formData.get("id"), mode: formData.get("mode") });
  if (!parsed.success) return;
  await saveMode(parsed.data.id, parsed.data.mode);
  revalidatePath("/admin/playbooks");
}
