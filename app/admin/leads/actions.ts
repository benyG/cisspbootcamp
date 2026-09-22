"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { nextFollowupAt } from "@/lib/followups";
import { startRegistration } from "@/lib/registration";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}
const id = z.coerce.number().int().positive();

export async function updateLead(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({
    leadId: id,
    status: z.enum(["new", "contacted", "booked", "called", "registered", "nurture", "lost"]),
    notes: z.string().max(5000).optional().or(z.literal("")),
    tags: z.string().max(300).optional().or(z.literal("")),
    nextFollowupAt: z.string().optional().or(z.literal("")),
  }).safeParse({ leadId: formData.get("leadId"), status: formData.get("status"), notes: formData.get("notes"), tags: formData.get("tags"), nextFollowupAt: formData.get("nextFollowupAt") });
  if (!parsed.success) return;
  const { leadId, status, notes, tags, nextFollowupAt: due } = parsed.data;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      notes: notes || null,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      nextFollowupAt: due ? new Date(due) : null,
    },
  });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

/** Manual registration (SPECS A7): opens a pending_manual seat Ben confirms once paid. */
export async function registerManually(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  const started = await startRegistration({ leadId: leadId.data, method: "netticket" });
  if (started.registration) {
    await prisma.registration.update({ where: { id: started.registration.id }, data: { status: "pending_manual" } });
    await prisma.actionLog.create({ data: { leadId: leadId.data, type: "registration_manual_opened", payload: { registrationId: started.registration.id } } });
  }
  revalidatePath(`/admin/leads/${leadId.data}`);
  revalidatePath("/admin");
}

export async function markLost(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId.data }, data: { status: "lost", nextFollowupAt: null } }),
    prisma.actionLog.create({ data: { leadId: leadId.data, type: "marked_lost" } }),
  ]);
  revalidatePath(`/admin/leads/${leadId.data}`);
  revalidatePath("/admin");
}

export async function scheduleFollowup(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.lead.update({ where: { id: leadId.data }, data: { nextFollowupAt: nextFollowupAt("afterCall", 0, new Date()), followupCount: 0 } });
  revalidatePath(`/admin/leads/${leadId.data}`);
  revalidatePath("/admin");
}

/** Full deletion (SPECS A10): cascades through responses, bookings, registrations, log. */
export async function deleteLead(formData: FormData): Promise<void> {
  await requireAdmin();
  const leadId = id.safeParse(formData.get("leadId"));
  if (!leadId.success) return;
  await prisma.lead.delete({ where: { id: leadId.data } });
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  redirect("/admin/leads?supprime=1");
}
