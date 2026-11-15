"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { PRIVACY_KINDS, RECURRENCES, privacyDueAt } from "@/lib/admin-records";
import { completeDeadline, eraseLead, retentionCandidates, saveBusiness } from "@/lib/admin-records-server";
import { prisma } from "@/lib/db";

async function admin(): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const done = (anchor: string) => {
  revalidatePath("/admin/administratif");
  revalidatePath("/admin");
  redirect(`/admin/administratif#${anchor}`);
};

const field = (max: number) => z.string().trim().max(max).default("");

export async function saveBusinessAction(formData: FormData): Promise<void> {
  await admin();
  const parsed = z
    .object({ legalName: field(160), address: field(300), country: field(60), registration: field(120), taxId: field(80), email: z.union([z.literal(""), z.string().trim().email().max(180)]), mentions: field(600) })
    .safeParse(Object.fromEntries(["legalName", "address", "country", "registration", "taxId", "email", "mentions"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return;
  await saveBusiness(parsed.data);
  done("identite");
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((d) => new Date(`${d}T09:00:00Z`));

export async function addDeadline(formData: FormData): Promise<void> {
  await admin();
  const parsed = z
    .object({ title: z.string().trim().min(2).max(160), dueAt: day, recurrence: z.enum(RECURRENCES), note: field(2000) })
    .safeParse({ title: formData.get("title"), dueAt: formData.get("dueAt"), recurrence: formData.get("recurrence"), note: formData.get("note") ?? "" });
  if (!parsed.success) return;
  await prisma.adminDeadline.create({ data: { ...parsed.data, note: parsed.data.note || null } });
  done("echeances");
}

export async function completeDeadlineAction(formData: FormData): Promise<void> {
  await admin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  await completeDeadline(id.data);
  done("echeances");
}

export async function deleteDeadline(formData: FormData): Promise<void> {
  await admin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  await prisma.adminDeadline.delete({ where: { id: id.data } }).catch(() => undefined);
  done("echeances");
}

export async function addPrivacyRequest(formData: FormData): Promise<void> {
  await admin();
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email().max(180), kind: z.enum(PRIVACY_KINDS), receivedAt: day, note: field(2000) })
    .safeParse({ email: formData.get("email"), kind: formData.get("kind"), receivedAt: formData.get("receivedAt"), note: formData.get("note") ?? "" });
  if (!parsed.success) return;
  const lead = await prisma.lead.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  await prisma.privacyRequest.create({ data: { ...parsed.data, note: parsed.data.note || null, leadId: lead?.id ?? null, dueAt: privacyDueAt(parsed.data.receivedAt) } });
  done("demandes");
}

export async function completePrivacyRequest(formData: FormData): Promise<void> {
  await admin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  await prisma.privacyRequest.update({ where: { id: id.data }, data: { doneAt: new Date() } }).catch(() => undefined);
  done("demandes");
}

/** Deletes the prospects past the retention period, after Ben ticks the box. */
export async function purgeRetention(formData: FormData): Promise<void> {
  await admin();
  if (formData.get("confirm") !== "on") return;
  for (const c of await retentionCandidates()) await eraseLead(c.id);
  done("conservation");
}
