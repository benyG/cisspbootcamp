"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { deleteCohortCore, sendCohortDocuments } from "@/lib/admin-ops/sensitive";
import { createCohort as createCohortCore, markCampaignDone as markCampaignDoneCore, updateCohort as updateCohortCore } from "@/lib/admin-ops/cohorts";
import { campaignFromForm } from "@/lib/campaign";
import { isClock } from "@/lib/cohort-sessions";
import { openIaEntry } from "@/lib/ia-days-server";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const cohortFields = (formData: FormData) => Object.fromEntries(["program", "name", "startsAt", "endsAt", "capacity", "targetSeats", "status"].map((k) => [k, formData.get(k) ?? (k === "program" ? "cissp" : null)]));

const iaEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de la J1 requise"),
  start: z.string().refine(isClock, "Heure invalide (HH:MM)"),
  capacity: z.coerce.number().int().min(1, "Au moins 1 place").max(50, "50 places au plus"),
  targetSeats: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().int().min(1, "Objectif : au moins 1 place").max(50).nullable()),
});

export async function createCohort(formData: FormData): Promise<void> {
  await requireAdmin();
  const campaign = formData.get("hasCampaign") ? campaignFromForm((name) => formData.get(name) as string | null) : null;
  // Bâtisseur IA (Ben, 15/11): the entry is a J1 date, opened with its campaign.
  if (formData.get("program") === "ia") {
    const parsed = iaEntrySchema.safeParse({ date: formData.get("startsAt"), start: formData.get("start"), capacity: formData.get("capacity"), targetSeats: formData.get("targetSeats") });
    if (!parsed.success) redirect(`/admin/cohortes/nouvelle?erreur=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Données invalides")}`);
    const result = await openIaEntry({ ...parsed.data, campaign });
    if (!result.ok) redirect(`/admin/cohortes/nouvelle?erreur=${encodeURIComponent(result.error)}`);
    revalidatePath("/admin/cohortes");
    revalidatePath("/admin/ia");
    redirect(`/admin/cohortes/${result.cohortId}`);
  }
  const result = await createCohortCore(cohortFields(formData), campaign);
  if (!result.ok) redirect(`/admin/cohortes${formData.get("hasCampaign") ? "/nouvelle" : ""}?erreur=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/cohortes");
  redirect(`/admin/cohortes/${result.id}`);
}

export async function updateCohort(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/cohortes");
  const result = await updateCohortCore(id.data, cohortFields(formData));
  if (!result.ok) redirect(result.error.startsWith("Aucune cohorte") ? "/admin/cohortes" : `/admin/cohortes/${id.data}?erreur=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/cohortes");
  revalidatePath(`/admin/cohortes/${id.data}`);
  redirect(`/admin/cohortes/${id.data}?ok=1${result.moved ? `&arenvoyer=${result.moved}` : ""}`);
}

/**
 * Deletes a cohort created by mistake (Ben, 26/09). Its registrations (paid
 * or not) and live seat holds move to the target cohort first, each move
 * logged on the lead. Ben warns the people himself: nothing is sent.
 */
export async function deleteCohort(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/cohortes");
  const targetId = z.coerce.number().int().positive().safeParse(formData.get("targetId"));
  const result = await deleteCohortCore({ cohortId: id.data, targetId: targetId.success ? targetId.data : null, acknowledged: formData.get("confirm") === "on" });
  if (!result.ok) redirect(result.error.startsWith("Aucune cohorte") ? "/admin/cohortes" : `/admin/cohortes/${id.data}?erreur=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/cohortes");
  revalidatePath("/admin");
  if (targetId.success) revalidatePath(`/admin/cohortes/${targetId.data}`);
  redirect(`/admin/cohortes?supprime=${encodeURIComponent(result.sourceName ?? "")}${result.targetName && result.people ? `&vers=${encodeURIComponent(result.targetName)}&n=${result.people}` : ""}`);
}

/**
 * Preparation documents from the cohort page (Ben, 27/09): to one paid
 * participant, or to every paid participant who has not had them yet. Each
 * e-mail carries every active document of the programme and, for CISSP, the
 * reading plan link. Triggered by Ben only, never on its own.
 */
export async function sendCohortOnboarding(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = z.coerce.number().int().positive().safeParse(formData.get("cohortId"));
  if (!cohortId.success) redirect("/admin/cohortes");
  const onlyLead = z.coerce.number().int().positive().safeParse(formData.get("leadId"));
  const result = await sendCohortDocuments(cohortId.data, onlyLead.success ? onlyLead.data : undefined);
  if (!result.ok && result.error.startsWith("Aucune cohorte")) redirect("/admin/cohortes");
  revalidatePath(`/admin/cohortes/${cohortId.data}`);
  redirect(`/admin/cohortes/${cohortId.data}?envoi=${encodeURIComponent(result.ok ? result.message : result.error)}`);
}

/** "Lancer une cohorte" on an existing cohort (lot 5): its channels and promo. */
export async function saveCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/cohortes");
  const campaign = campaignFromForm((name) => formData.get(name) as string | null);
  await prisma.cohort.update({ where: { id: id.data }, data: { campaign } });
  revalidatePath(`/admin/cohortes/${id.data}`);
  revalidatePath("/admin");
  redirect(`/admin/cohortes/${id.data}?ok=1#campagne`);
}

/** Ben did a campaign action (lot 5): it leaves his queue and shows "Fait". */
export async function markCampaignDone(formData: FormData): Promise<void> {
  await requireAdmin();
  const cohortId = z.coerce.number().int().positive().parse(formData.get("cohortId"));
  await markCampaignDoneCore(cohortId, String(formData.get("key") ?? ""));
  revalidatePath("/admin");
  revalidatePath(`/admin/cohortes/${cohortId}`);
}
