"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { isClock } from "@/lib/cohort-sessions";
import { type IaResult, deleteIaDay, openIaDates, updateIaDay } from "@/lib/ia-days-server";
import { syncDayInvites } from "@/lib/ia-plan-server";
import { IA_JOURNEES } from "@/lib/ia-days";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const clock = z.string().refine(isClock, "Heure invalide (HH:MM)");
const capacity = z.coerce.number().int().min(1, "Au moins 1 place").max(50, "50 places au plus");

function done(result: IaResult): never {
  revalidatePath("/admin/ia");
  revalidatePath("/admin/cohortes");
  redirect(`/admin/ia?${result.ok ? "ok" : "erreur"}=${encodeURIComponent(result.ok ? result.message : result.error)}`);
}

function invalid(error: z.ZodError): never {
  redirect(`/admin/ia?erreur=${encodeURIComponent(error.issues[0]?.message ?? "Données invalides")}`);
}

export async function openDatesAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ from: isoDate, to: isoDate, which: z.enum(["both", "saturday", "sunday"]), start: clock, capacity }).safeParse({
    from: formData.get("from"), to: formData.get("to"), which: formData.get("which"), start: formData.get("start"), capacity: formData.get("capacity"),
  });
  if (!parsed.success) invalid(parsed.error);
  done(await openIaDates(parsed.data));
}

export async function updateDayAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ id: z.coerce.number().int().positive(), journee: z.coerce.number().int().min(1).max(IA_JOURNEES), start: clock, capacity, closed: z.boolean() }).safeParse({
    id: formData.get("id"), journee: formData.get("journee"), start: formData.get("start"), capacity: formData.get("capacity"), closed: formData.get("closed") === "on",
  });
  if (!parsed.success) invalid(parsed.error);
  done(await updateIaDay(parsed.data));
}

export async function deleteDayAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) invalid(id.error);
  done(await deleteIaDay(id.data));
}

/** Sends (again) the Google invitation of a date to everyone holding a seat on it. */
export async function inviteDayAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) invalid(id.error);
  try {
    const invited = await syncDayInvites(id.data);
    done({ ok: true, message: invited ? `Invitation envoyée à ${invited} personne${invited > 1 ? "s" : ""}.` : "Invitations à jour." });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    done({ ok: false, error: `Google Agenda a refusé l’invitation : ${error instanceof Error ? error.message : "erreur inconnue"}. Vérifiez la connexion dans Paramètres › Agenda.` });
  }
}
