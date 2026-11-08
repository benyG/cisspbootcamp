"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { generateRhythmDrafts } from "@/lib/marketing/rhythm";
import { sendCatchUp } from "@/lib/playbooks/catchup";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const cohortId = (formData: FormData) => z.coerce.number().int().positive().safeParse(formData.get("cohortId"));
const back = (id: number, message: string, ok = false): never => redirect(`/admin/pilotage?c=${id}&${ok ? "ok" : "erreur"}=${encodeURIComponent(message)}#rattrapage`);

/** Rattrapage (lot 8): Ben's click sends the prepared e-mails to consenting prospects. */
export async function catchUpEmails(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = cohortId(formData);
  if (!id.success) redirect("/admin/pilotage");
  const out = await sendCatchUp(id.data!);
  revalidatePath("/admin/pilotage");
  if ("error" in out) back(id.data!, out.error);
  const r = out as { sent: number; failed: number; remaining: number };
  const parts = [`${r.sent} e-mail${r.sent > 1 ? "s" : ""} envoyé${r.sent > 1 ? "s" : ""}`];
  if (r.failed) parts.push(`${r.failed} en échec (réessayez plus tard)`);
  if (r.remaining) parts.push(`${r.remaining} à envoyer avec le prochain clic`);
  back(id.data!, `${parts.join(", ")}.`, r.sent > 0);
}

/** Rattrapage: three LinkedIn posts written now, to read in Marketing. */
export async function catchUpDrafts(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = cohortId(formData);
  if (!id.success) redirect("/admin/pilotage");
  const out = await generateRhythmDrafts(id.data!);
  revalidatePath("/admin/marketing");
  if (!out.ok) back(id.data!, out.error);
  const r = out as { count: number; topic: string };
  back(id.data!, `${r.count} publications proposées sur « ${r.topic} » : relisez-les dans Marketing et donnez-leur un jour.`, true);
}
