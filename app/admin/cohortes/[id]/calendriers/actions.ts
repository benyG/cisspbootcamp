"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { confirmPersonalSchedule, invitePersonalSchedule, refusePersonalSchedule, saveLimits } from "@/lib/personal-schedule-send";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();
const back = (path: string, result: { ok: true; message: string } | { ok: false; error: string }): never =>
  redirect(`${path}?${result.ok ? "envoi" : "erreur"}=${encodeURIComponent(result.ok ? result.message : result.error)}`);

/** Sends (or re-sends) a participant the link to choose their own days (Ben, 04/10). */
export async function invitePersonalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = id.parse(formData.get("cohortId"));
  const leadId = id.parse(formData.get("leadId"));
  const result = await invitePersonalSchedule(cohortId, leadId);
  revalidatePath(`/admin/cohortes/${cohortId}`);
  back(`/admin/cohortes/${cohortId}`, result);
}

/** Ben's latest end, weekdays and weekends (Montréal), for every personal calendar. */
export async function saveLimitsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = id.parse(formData.get("cohortId"));
  try {
    await saveLimits({ latestEndWeekday: formData.get("latestEndWeekday"), latestEndWeekend: formData.get("latestEndWeekend") });
  } catch {
    back(`/admin/cohortes/${cohortId}`, { ok: false, error: "Heures de fin invalides." });
  }
  back(`/admin/cohortes/${cohortId}`, { ok: true, message: "Heures de fin enregistrées pour les calendriers personnels." });
}

export async function confirmPersonalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = id.parse(formData.get("cohortId"));
  const scheduleId = id.parse(formData.get("scheduleId"));
  const result = await confirmPersonalSchedule(scheduleId);
  revalidatePath(`/admin/cohortes/${cohortId}`);
  revalidatePath("/admin");
  back(`/admin/cohortes/${cohortId}/calendriers/${scheduleId}`, result);
}

export async function refusePersonalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = id.parse(formData.get("cohortId"));
  const scheduleId = id.parse(formData.get("scheduleId"));
  const note = z.string().trim().min(5, "Écrivez un message pour expliquer ce qui ne va pas.").max(1000).safeParse(formData.get("note"));
  if (!note.success) back(`/admin/cohortes/${cohortId}/calendriers/${scheduleId}`, { ok: false, error: note.error.issues[0]?.message ?? "Message invalide." });
  const result = await refusePersonalSchedule(scheduleId, note.data!);
  revalidatePath(`/admin/cohortes/${cohortId}`);
  revalidatePath("/admin");
  back(`/admin/cohortes/${cohortId}/calendriers/${scheduleId}`, result);
}
