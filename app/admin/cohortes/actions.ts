"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { cohortDeletionProblem } from "@/lib/cohorts";
import { COHORTS_CACHE_TAG } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { sendOnboardingDocuments } from "@/lib/onboarding";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const cohortSchema = z
  .object({
    program: z.enum(["cissp", "cc"]).default("cissp"),
    name: z.string().trim().min(1, "Nom requis").max(120),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: z.coerce.number().int().min(1).max(100),
    status: z.enum(["planned", "open", "full", "running", "done"]),
  })
  .refine((c) => c.endsAt > c.startsAt, { message: "La fin doit suivre le début", path: ["endsAt"] });

function parse(formData: FormData) {
  return cohortSchema.safeParse({
    program: formData.get("program") ?? "cissp",
    name: formData.get("name"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    capacity: formData.get("capacity"),
    status: formData.get("status"),
  });
}

export async function createCohort(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) redirect(`/admin/cohortes?erreur=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Données invalides")}`);

  const cohort = await prisma.cohort.create({ data: parsed.data });
  revalidatePath("/admin/cohortes");
  revalidateTag(COHORTS_CACHE_TAG);
  redirect(`/admin/cohortes/${cohort.id}`);
}

export async function updateCohort(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  const parsed = parse(formData);
  if (!id.success) redirect("/admin/cohortes");
  if (!parsed.success) redirect(`/admin/cohortes/${id.data}?erreur=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Données invalides")}`);

  await prisma.cohort.update({ where: { id: id.data }, data: parsed.data });
  revalidatePath("/admin/cohortes");
  revalidatePath(`/admin/cohortes/${id.data}`);
  revalidateTag(COHORTS_CACHE_TAG);
  redirect(`/admin/cohortes/${id.data}?ok=1`);
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
  const fail = (message: string): never => redirect(`/admin/cohortes/${id.data}?erreur=${encodeURIComponent(message)}`);

  const now = new Date();
  const source = await prisma.cohort.findUnique({
    where: { id: id.data },
    include: {
      registrations: { select: { id: true, leadId: true, status: true, reference: true } },
      seatHolds: { where: { releasedAt: null, expiresAt: { gt: now } }, select: { id: true, leadId: true } },
    },
  });
  if (!source) redirect("/admin/cohortes");
  const target = targetId.success ? await prisma.cohort.findUnique({ where: { id: targetId.data } }) : null;
  const leadIds = [...new Set([...source.registrations.map((r) => r.leadId), ...source.seatHolds.map((h) => h.leadId)])];
  const people = leadIds.length;
  const problem = cohortDeletionProblem({
    sourceId: source.id,
    sourceProgram: source.program,
    people,
    target: target ? { id: target.id, program: target.program, status: target.status } : null,
    acknowledged: formData.get("confirm") === "on",
  });
  if (problem) fail(problem);

  await prisma.$transaction(async (tx) => {
    if (target && people > 0) {
      await tx.registration.updateMany({ where: { cohortId: source.id }, data: { cohortId: target.id } });
      await tx.seatHold.updateMany({ where: { id: { in: source.seatHolds.map((h) => h.id) } }, data: { cohortId: target.id } });
      await tx.actionLog.createMany({
        data: leadIds.map((leadId) => ({ leadId, type: "moved_to_cohort", payload: { from: source.name, to: target.name, targetCohortId: target.id } })),
      });
      const paid = await tx.registration.count({ where: { cohortId: target.id, status: "paid" } });
      if (paid >= target.capacity && target.status === "open") await tx.cohort.update({ where: { id: target.id }, data: { status: "full" } });
    }
    await tx.cohort.delete({ where: { id: source.id } });
  });

  revalidatePath("/admin/cohortes");
  revalidatePath("/admin");
  if (target) revalidatePath(`/admin/cohortes/${target.id}`);
  revalidateTag(COHORTS_CACHE_TAG);
  redirect(`/admin/cohortes?supprime=${encodeURIComponent(source.name)}${target && people > 0 ? `&vers=${encodeURIComponent(target.name)}&n=${people}` : ""}`);
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
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId.data },
    include: { registrations: { where: { status: "paid", ...(onlyLead.success ? { leadId: onlyLead.data } : {}) }, select: { id: true, leadId: true } } },
  });
  if (!cohort) redirect("/admin/cohortes");

  const sentTo = onlyLead.success ? new Set<number>() : await registrationsAlreadyOnboarded(cohort.registrations.map((r) => r.leadId));
  const targets = cohort.registrations.filter((r) => !sentTo.has(r.id));
  const documents = await prisma.document.findMany({ where: { program: cohort.program, active: true }, select: { id: true } });

  let sent = 0;
  const failures: string[] = [];
  for (const r of targets) {
    const result = await sendOnboardingDocuments({ leadId: r.leadId, documentIds: documents.map((d) => d.id) });
    if (result.ok) sent++;
    else failures.push(result.error);
  }
  revalidatePath(`/admin/cohortes/${cohort.id}`);
  const message = targets.length === 0 ? "Tous les inscrits ont déjà reçu les documents." : `Documents envoyés à ${sent} inscrit${sent > 1 ? "s" : ""}.${failures.length ? ` Échec pour ${failures.length} : ${failures[0]}` : ""}`;
  redirect(`/admin/cohortes/${cohort.id}?envoi=${encodeURIComponent(message)}`);
}

/** Registrations whose onboarding e-mail already went out, read from the leads' logs. */
async function registrationsAlreadyOnboarded(leadIds: number[]): Promise<Set<number>> {
  if (leadIds.length === 0) return new Set();
  const logs = await prisma.actionLog.findMany({ where: { leadId: { in: leadIds }, type: "onboarding_sent" }, select: { payload: true } });
  return new Set(logs.map((l) => (l.payload as { registrationId?: number } | null)?.registrationId).filter((id): id is number => typeof id === "number"));
}
